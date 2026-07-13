#!/usr/bin/env python3
"""
Corrige les dates fictives de meta/patch-notes-data.js (champ `d:`) en les remplaçant par la
VRAIE date du commit git qui a introduit chaque entrée (identifiée par son `v:'VNNN'`).

Script one-off (2026-07-13, voir CLAUDE.md/session courante) -- pas destiné à tourner en continu,
gardé dans scripts/ pour traçabilité/relecture, pas branché au workflow normal (build.py etc).

Méthode : parcourt l'historique git du fichier (`git log --follow`, du plus ancien au plus
récent -- --follow est nécessaire car le fichier a été déplacé lors de la réorg `src/` de V301,
un `git log` simple ne remonte que 127 commits au lieu des ~386 réels), et pour chaque commit
regarde les lignes AJOUTÉES (diff `+`) qui matchent `v:'VNNN'` -- la première fois qu'une version
apparaît dans une ligne ajoutée, on retient l'horodatage de CE commit (committer date, %cI) comme
date réelle de l'entrée. Les éditions ultérieures (typo, etc.) n'écrasent pas cette date.

Sortie : réécrit meta/patch-notes-data.js en remplaçant chaque `d:'DD/MM/YYYY HH:mm'` par la
date réelle trouvée. Versions sans commit d'introduction identifiable (repli) : date laissée
inchangée, listée en sortie pour audit manuel.
"""
import re
import subprocess
import sys
from datetime import datetime, timezone

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')

def main():
    path = 'meta/patch-notes-data.js'

    # 1. Liste des commits touchant le fichier, du PLUS ANCIEN au plus récent.
    # NB: `--follow` combiné à `--reverse` est cassé (bug git connu -- ne retourne qu'1 commit sur
    # ce repo/cette version de git, vérifié empiriquement) -- on récupère donc en ordre normal
    # (plus récent en premier) puis on inverse nous-mêmes en Python.
    # NB2 : on part de `origin/main`, PAS `HEAD` -- ce repo tourne avec plusieurs agents en
    # parallèle sur le même checkout (voir CLAUDE.md §24), HEAD local peut être en retard sur
    # origin/main (une branche divergente/pas encore fast-forward) et manquerait alors les commits
    # les plus récents ayant introduit les toutes dernières entrées.
    # NB3 : deux requêtes UNIES plutôt qu'une seule, aucune des deux seule ne suffit --
    #   `--follow` seul survit au renommage/déplacement (réorg V301) mais son historique par
    #   défaut SIMPLIFIE et masque des commits de MERGE qui n'introduisent un changement que via
    #   résolution de conflit (repéré sur V426 : ajouté dans un commit de merge résolvant une
    #   collision de numérotation, invisible avec `--follow` seul, y compris avec
    #   `--full-history` en plus -- `--follow`+`--full-history` ensemble semble aussi cassé sur ce
    #   repo, même famille de bug que `--follow`+`--reverse`) ;
    #   `--full-history` seul (sans `--follow`) voit bien ces merges mais perdrait l'historique
    #   d'avant un renommage s'il y en avait eu un after coup.
    # Union des deux + tri par date de commit (au lieu de faire confiance à l'ordre de `git log`,
    # potentiellement incohérent entre les deux requêtes une fois fusionnées).
    start_ref = sys.argv[1] if len(sys.argv) > 1 else 'origin/main'
    res_follow = run(['git', 'log', '--follow', '--format=%H', start_ref, '--', path])
    res_full = run(['git', 'log', '--full-history', '--format=%H', start_ref, '--', path])
    commit_set = set()
    for res in (res_follow, res_full):
        commit_set.update(h for h in res.stdout.strip().split('\n') if h)
    dated_commits = []
    for h in commit_set:
        iso = run(['git', 'show', '-s', '--format=%cI', h]).stdout.strip()
        dated_commits.append((iso, h))
    dated_commits.sort()  # ISO8601 trie lexicographiquement = chronologique
    commits = [h for _, h in dated_commits]
    print(f'{len(commits)} commits trouvés dans l\'historique du fichier (union --follow + --full-history).', file=sys.stderr)

    version_commit_date = {}  # 'V420' -> ISO commit date string
    version_re = re.compile(r"v:'(V\d+)'")

    # 2. Pour chaque commit, regarder les lignes AJOUTÉES du diff vs son PREMIER parent qui
    #    introduisent une nouvelle entrée `v:'VNNN'` -- première apparition = date réelle retenue.
    #    `git show` sur un commit de MERGE ne montre RIEN par défaut pour un fichier sans conflit
    #    (pas de -m/-c) -- repéré sur V426 (ajouté dans un commit de merge qui résolvait une
    #    renumérotation de collision) : `git diff <merge>^1 <merge> -- path` fonctionne pour les
    #    merges ET les commits normaux (équivalent à `git show` pour un commit simple).
    for h in commits:
        diff = run(['git', 'diff', f'{h}^1', h, '--', path])
        if diff.returncode != 0:
            # commit racine (pas de parent) -- repli sur `git show` classique
            diff = run(['git', 'show', '--format=', '-U0', h, '--', path])
        date_res = None
        for line in diff.stdout.split('\n'):
            if not line.startswith('+') or line.startswith('+++'):
                continue
            m = version_re.search(line)
            if m:
                v = m.group(1)
                if v not in version_commit_date:
                    if date_res is None:
                        date_res = run(['git', 'show', '-s', '--format=%cI', h]).stdout.strip()
                    version_commit_date[v] = date_res

    print(f'{len(version_commit_date)} versions avec une date de commit trouvée.', file=sys.stderr)

    # 3. Relire le fichier courant, extraire la liste des v: présents (dans l'ordre du tableau).
    with open(path, encoding='utf-8') as f:
        content = f.read()

    entry_re = re.compile(r"\{ v:'(V\d+)', d:'(\d{2}/\d{2}/\d{4} \d{2}:\d{2})'")
    entries = entry_re.findall(content)
    print(f'{len(entries)} entrées avec un champ d: dans le fichier actuel.', file=sys.stderr)

    missing = []
    def fmt(iso):
        # git %cI = ISO8601 avec offset, ex 2026-07-13T08:42:44+02:00 -- on garde l'heure locale du
        # commit telle quelle (pas de conversion UTC, cohérent avec la convention existante qui
        # semble déjà être une heure "locale" arbitraire, pas un vrai fuseau affiché au joueur).
        dt = datetime.fromisoformat(iso)
        return dt.strftime('%d/%m/%Y %H:%M')

    replaced = 0
    def repl(m):
        nonlocal replaced
        v, old_d = m.group(1), m.group(2)
        iso = version_commit_date.get(v)
        if iso is None:
            missing.append(v)
            return m.group(0)
        new_d = fmt(iso)
        replaced += 1
        return f"{{ v:'{v}', d:'{new_d}'"

    new_content = entry_re.sub(repl, content)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content)

    print(f'{replaced} dates remplacées.', file=sys.stderr)
    if missing:
        print(f'{len(missing)} versions SANS date de commit trouvée (inchangées) : {missing}', file=sys.stderr)

if __name__ == '__main__':
    main()
