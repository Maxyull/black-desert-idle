#!/usr/bin/env python3
"""Serveur statique des tests Playwright (remplace `python3 -m http.server`).

POURQUOI CE FICHIER EXISTE (2026-08-03, diagnostic d'une flakiness locale poursuivie depuis le
2026-07-20 sans jamais etre nommee -- voir la "seconde cause inconnue" citee dans
tests/companions.spec.js:signInForTest).

Symptome : dans la suite complete, un test compagnon echouait au hasard sur un
`ReferenceError: $a is not defined` / `isZoneDangerous is not defined`, ou restait bloque 30 s
dans waitCompanionsReady. Jamais reproductible en isolant le test (10/10 verts).

Cause reelle, mesuree : `python3 -m http.server` repond en **HTTP/1.0**, donc SANS keep-alive --
le serveur ferme la connexion apres CHAQUE reponse. index.dev.html charge ~90 scripts, plus ~30
de plus dans l'iframe compagnon : environ 130 connexions TCP par test, ~8000 par run complet, en
une minute. Sous Windows la plage de ports ephemeres fait 16384 entrees
(`netsh int ipv4 show dynamicport tcp`) avec un TIME_WAIT de 2 min : en enchainant les runs, la
plage sature. Chromium n'obtient alors plus de socket et ABANDONNE une requete au hasard :

    [REQ_FAILED] admin-monitoring.js -> net::ERR_NO_BUFFER_SPACE
    [REQ_FAILED] pvp-tournament.js   -> net::ERR_ADDRESS_IN_USE
    [REQ_FAILED] account-panel.js    -> net::ERR_NO_BUFFER_SPACE

Un `<script>` manquant ne casse rien tout de suite : ses globales restent juste indefinies, et ca
ressort beaucoup plus tard, dans un test qui n'a rien a voir. Quand la victime est un fichier
anodin (admin-monitoring.js) le run reste vert ; quand c'est game-core.js ou
notifications-quests.js, un test compagnon tombe. D'ou l'aspect "1 flaky au hasard".

Ce n'est donc PAS `reuseExistingServer` (hypothese notee dans playwright.config.js le 2026-07-20,
qui expliquait des ERR_CONNECTION_REFUSED -- un symptome different) ni le backlog TCP de
http.server (deja mesure et innocente : 0/360 refus). C'est la CHURN de sockets.

Correctif : HTTP/1.1 + keep-alive (une connexion reutilisee pour les ~130 requetes d'une page au
lieu de 130 connexions) + serveur threade (SimpleHTTPRequestHandler est mono-thread, il servait
les ~30 scripts de l'iframe en file -- mesure citee dans companions.spec.js: le logo repondait
entre 130 et 1180 ms sous contention).

Diagnostic rapide en cas de doute :
    netstat -an | find /c "TIME_WAIT"     # Windows
    ss -s                                 # Linux
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class KeepAliveHandler(SimpleHTTPRequestHandler):
    # LA ligne qui compte : bascule les reponses en HTTP/1.1, donc connexions persistantes.
    # SimpleHTTPRequestHandler envoie deja un Content-Length exact sur les fichiers ET sur les
    # erreurs (send_error), condition necessaire pour que le keep-alive soit correct.
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):
        # Playwright pipe stdout/stderr du webServer dans la sortie des tests : une ligne par
        # requete noie le rapport (~8000 lignes par run). On ne garde que ce qui est anormal --
        # un 404 sur un script est justement le genre de signal a ne PAS perdre.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 49213
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(KeepAliveHandler, directory=directory)
    # ThreadingHTTPServer : daemon_threads evite qu'une connexion keep-alive encore ouverte
    # empeche l'arret du serveur entre deux runs.
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    server.daemon_threads = True
    print(f"serveur de test HTTP/1.1 (keep-alive, threade) sur http://127.0.0.1:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
