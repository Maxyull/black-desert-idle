#!/usr/bin/env python3
"""
Verifie que build/source.min.js est a jour par rapport aux sources (2026-07-21,
repo-audit-todo.md point 2) : compare le contenu regenere par scripts/build.py au
contenu deja committe, plutot que les mtimes (peu fiables : un git checkout/clone
remet tous les mtimes a l'heure du checkout, un simple "touch" fausserait aussi une
comparaison par date). Utilise en local avant un commit, et par la CI (voir
.github/workflows/ci.yml) pour bloquer un push qui oublierait de relancer le build.

Usage : python scripts/check_build_freshness.py
Exit 0 si a jour, exit 1 sinon (avec le nom des fichiers qui divergent).
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRACKED = ["build/source.js", "build/source.min.js", "index.html", "src/core/i18n-resources.generated.js"]


def main():
    before = {}
    for rel in TRACKED:
        p = ROOT / rel
        before[rel] = p.read_bytes() if p.exists() else None

    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "build.py")],
        cwd=ROOT, capture_output=True, text=True,
    )
    if result.returncode != 0:
        print("ERREUR: scripts/build.py a echoue pendant la verification :", file=sys.stderr)
        print(result.stdout, file=sys.stderr)
        print(result.stderr, file=sys.stderr)
        sys.exit(1)

    stale = []
    for rel in TRACKED:
        p = ROOT / rel
        after = p.read_bytes() if p.exists() else None
        if after != before[rel]:
            stale.append(rel)

    if stale:
        print("ERREUR: le build n'est pas a jour, ces fichiers divergent apres relance de build.py :")
        for rel in stale:
            print(f"  - {rel}")
        print("\nLance `python scripts/build.py`, verifie le diff, puis commit le resultat.")
        sys.exit(1)

    print("OK: build/source.js, build/source.min.js et index.html sont a jour.")
    sys.exit(0)


if __name__ == "__main__":
    main()
