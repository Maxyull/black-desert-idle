#!/usr/bin/env python3
"""
Corrige les dates fictives de meta/patch-notes-data.js (champ `d:`) en les remplaçant par la
VRAIE date du commit git qui a introduit chaque entrée (identifiée par son `v:'VNNN'`).

Script one-off (2026-07-13, revu 2026-07-15 -- voir CLAUDE.md/session courante) -- pas destiné à
tourner en continu, gardé dans scripts/ pour traçabilité/relecture, pas branché au workflow
normal (build.py etc).

Méthode (v2, 2026-07-15) : parcourt UNIQUEMENT le tronc de `main` (`git log --first-parent`,
du plus ancien au plus récent), c'est-à-dire les commits qui sont réellement devenus visibles
sur `main` -- soit un commit direct, soit un commit de MERGE. Pour chaque commit du tronc, le
diff est fait contre son PREMIER parent (`git diff h^1 h`) : pour un commit normal ça équivaut
au diff habituel, mais pour un commit de merge ça capture d'un coup TOUT ce que la branche
mergée a apporté, et attribue donc correctement la date du MERGE (le moment où l'entrée devient
réellement partie de `main`) plutôt que la date du commit d'origine sur la branche de feature.
La première fois qu'une version `v:'VNNN'` apparaît dans une ligne AJOUTÉE de ce diff, on retient
l'horodatage de CE commit de tronc (committer date, %cI) comme date réelle de l'entrée.

Bug corrigé par cette v2 : la v1 parcourait TOUT l'historique atteignable (union
`--follow` + `--full-history`), y compris les commits internes aux branches de feature -- une
fois une branche mergée, ses commits internes deviennent aussi "atteignables depuis main", donc
la v1 leur attribuait à tort la date d'écriture originale sur la branche plutôt que la date du
merge (constaté sur V447 : commit de branche `2026-07-14T02:21`, mais réellement mergé sur main
et visible des joueurs seulement le `2026-07-15T11:55`, un écart de 33h+).

`--first-parent` est combiné à `--follow` (nécessaire car le fichier a été déplacé lors de la
réorg `src/` de V301) -- contrairement à la combinaison `--follow`+`--full-history` ou
`--follow`+`--reverse` (toutes deux cassées, cf. historique de ce script), `--first-parent`+
`--follow` fonctionne correctement sur ce repo (vérifié empiriquement : retrouve bien le commit
de merge `21bc40b` avec sa date réelle pour V447).

Le contenu du fichier est lu via `git show <ref>:<path>` (PAS le fichier de travail sur disque)
-- ce repo tourne avec plusieurs agents en parallèle sur le même checkout (voir CLAUDE.md §24),
le fichier de travail peut contenir des changements non commités d'une autre session en cours ;
lire depuis la référence git garantit qu'on corrige uniquement l'historique réellement commité.

Sortie : par défaut, écrit le résultat sur stdout (jamais sur le fichier de travail directement,
justement à cause du risque de collision avec une autre session -- voir ci-dessus). Passer
`--write` pour écrire directement sur `meta/patch-notes-data.js` (à ne faire que si on a vérifié
qu'aucune autre session n'a de changement non commité en cours sur ce fichier). Versions sans
commit d'introduction identifiable (repli) : date laissée inchangée, listées en sortie (stderr)
pour audit manuel.
"""
import argparse
import re
import subprocess
import sys
from datetime import datetime, timezone

sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('ref', nargs='?', default='origin/main',
                         help='Référence git à partir de laquelle lire le contenu ET parcourir '
                              'le tronc --first-parent (def: origin/main).')
    parser.add_argument('--write', action='store_true',
                         help='Écrit directement sur meta/patch-notes-data.js. Par défaut : '
                              'affiche sur stdout uniquement (ne touche jamais au fichier de '
                              'travail sans ce flag explicite).')
    args = parser.parse_args()
    start_ref = args.ref
    path = 'meta/patch-notes-data.js'

    # 1. Liste des commits du TRONC de main touchant le fichier, du plus ancien au plus récent.
    # `--first-parent` + `--reverse` n'a pas le bug connu de `--follow`+`--reverse` (testé sur ce
    # repo), mais on retrie quand même nous-mêmes par date pour rester cohérent avec la logique
    # ci-dessous qui a besoin de la date de chaque commit de toute façon.
    res = run(['git', 'log', '--first-parent', '--follow', '--format=%H', start_ref, '--', path])
    commits_raw = [h for h in res.stdout.strip().split('\n') if h]
    dated_commits = []
    for h in commits_raw:
        iso = run(['git', 'show', '-s', '--format=%cI', h]).stdout.strip()
        dated_commits.append((iso, h))
    dated_commits.sort()  # ISO8601 trie lexicographiquement = chronologique
    commits = [h for _, h in dated_commits]
    print(f'{len(commits)} commits trouvés sur le tronc --first-parent de {start_ref}.', file=sys.stderr)

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

    # 3. Lire le CONTENU depuis la référence git (pas le fichier de travail, voir docstring),
    #    extraire la liste des v: présents (dans l'ordre du tableau).
    content = run(['git', 'show', f'{start_ref}:{path}']).stdout

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

    if args.write:
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(new_content)
        print(f'{replaced} dates remplacées, écrites sur {path}.', file=sys.stderr)
    else:
        print(f'{replaced} dates remplacées (mode aperçu, rien écrit -- relancer avec --write '
              f'pour appliquer).', file=sys.stderr)
        sys.stdout.write(new_content)

    if missing:
        print(f'{len(missing)} versions SANS date de commit trouvée (inchangées) : {missing}', file=sys.stderr)

if __name__ == '__main__':
    main()
