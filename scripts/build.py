#!/usr/bin/env python3
"""
Build local pour Black Desert Idle (2026-07-08, Terser ajoute le 2026-07-17).

Ce script fait donc :
  1. lit l'ordre exact des <script src="src/..."> dans index.dev.html (source de verite
     unique pour l'ordre de dependance -- voir CLAUDE.md, section chargement) ;
  2. concatene ces fichiers dans cet ordre, en retirant les commentaires JS (// et /* */)
     via un mini-analyseur caractere par caractere qui respecte les chaines/template
     literals (y compris ${...} imbriques) -- PAS une regex naive qui casserait toute
     chaine contenant "//" (URLs, etc.) ;
  3. compacte les lignes vides ;
  4. ecrit le bundle lisible (commentaires retires, pas de renommage de variables) dans
     build/source.js ;
  5. minifie avec Terser dans build/source.min.js (2026-07-17, Node desormais installe sur
     cette machine -- voir PR #5) : compression + variables locales raccourcies, --compress
     --mangle SANS --toplevel ni --mangle-props pour ne jamais renommer les globals lus
     dynamiquement (fonctions appelees par les onclick inline de index.dev.html, callbacks
     Supabase, proprietes des payloads RPC) ;
  6. reecrit index.html (PROD, servi par GitHub Pages) pour ne charger que build/source.min.js
     (+ la balise Supabase CDN, le CSS, les patch notes en RPC -- pas de tests).

Necessite Node/npm (npx terser) -- installes via winget (OpenJS.NodeJS.LTS) le 2026-07-17,
absents avant cette date sur cette machine (voir historique de ce fichier).

Usage : python scripts/build.py
"""
import re
import subprocess
import sys
from pathlib import Path

# sous Windows, "npx" est un script shell (.cmd/.ps1), pas un executable natif -- CreateProcess
# (utilise par subprocess.run sans shell=True) ne sait le trouver que via son extension exacte
NPX_CMD = "npx.cmd" if sys.platform == "win32" else "npx"
# node.exe est un executable natif (contrairement a npx, un script shell) : CreateProcess le
# resout sans probleme sous Windows meme sans shell=True, pas besoin d'un NODE_CMD distinct par OS.
NODE_CMD = "node"

ROOT = Path(__file__).resolve().parent.parent
DEV_HTML = ROOT / "index.dev.html"
PROD_HTML = ROOT / "index.html"
BUILD_DIR = ROOT / "build"
BUNDLE_PATH = BUILD_DIR / "source.js"
MINIFIED_BUNDLE_PATH = BUILD_DIR / "source.min.js"
CSS_PATH = ROOT / "src" / "styles" / "styles.css"
MINIFIED_CSS_PATH = BUILD_DIR / "styles.min.css"

# fichiers explicitement exclus du bundle prod meme s'ils apparaissent dans index.dev.html
EXCLUDED_SUBSTRINGS = ("tests/tests.js", "meta/patch-notes-data.js", "supabase-js")


def extract_script_order(html_text):
    """Ordre exact des <script src="src/..."> dans index.dev.html, dans l'ordre du document."""
    srcs = re.findall(r'<script src="([^"]+)"', html_text)
    ordered = []
    for src in srcs:
        if any(x in src for x in EXCLUDED_SUBSTRINGS):
            continue
        if not src.startswith("src/"):
            continue  # garde-fou : ne prend que les fichiers de gameplay sous src/
        path = src.split("?")[0]  # retire le ?v=XXX
        ordered.append(path)
    return ordered


def strip_js_comments_safe(code):
    """
    Analyseur caractere par caractere (pas une regex naive) : retire les commentaires
    // et /* */ en dehors des chaines/template literals. Les ${...} a l'interieur d'un
    template literal sont traites comme du VRAI code JS (via scan_expr, recursif sur les
    accolades), donc leurs propres chaines/commentaires sont geres correctement -- sans
    ca, un commentaire ou un guillemet a l'interieur d'un ${...} casserait le reste du
    fichier.
    """
    out = []
    i, n = 0, len(code)

    def scan(i, in_template):
        """Retourne (texte_nettoye, nouvel_index) ; s'arrete a la fin du fichier, ou si
        in_template est vrai, a la fin du template literal (backtick fermant)."""
        buf = []
        while i < n:
            c = code[i]
            two = code[i:i + 2]
            if two == "//" and not in_template:
                j = code.find("\n", i)
                i = n if j == -1 else j
                continue
            if two == "/*" and not in_template:
                j = code.find("*/", i + 2)
                i = n if j == -1 else j + 2
                continue
            if c in ("'", '"') and not in_template:
                buf.append(c)
                i += 1
                start_quote = c
                while i < n:
                    if code[i] == "\\" and i + 1 < n:
                        buf.append(code[i:i + 2])
                        i += 2
                        continue
                    buf.append(code[i])
                    if code[i] == start_quote:
                        i += 1
                        break
                    i += 1
                continue
            if not in_template and c == "`":
                buf.append(c)
                i += 1
                inner, i = scan(i, in_template=True)
                buf.append(inner)
                continue
            if in_template and c == "\\" and i + 1 < n:
                buf.append(code[i:i + 2])
                i += 2
                continue
            if in_template and two == "${":
                buf.append("${")
                i += 2
                inner, i = scan_expr(i)
                buf.append(inner)
                continue
            if in_template and c == "`":
                buf.append(c)
                i += 1
                return "".join(buf), i
            buf.append(c)
            i += 1
        return "".join(buf), i

    def scan_expr(i):
        """Scanne le contenu d'un ${...} (du vrai code) jusqu'a l'accolade fermante
        correspondante (profondeur d'accolades), puis consomme le '}'."""
        buf = []
        depth = 1
        while i < n:
            c = code[i]
            two = code[i:i + 2]
            if two == "//":
                j = code.find("\n", i)
                i = n if j == -1 else j
                continue
            if two == "/*":
                j = code.find("*/", i + 2)
                i = n if j == -1 else j + 2
                continue
            if c in ("'", '"'):
                buf.append(c)
                i += 1
                start_quote = c
                while i < n:
                    if code[i] == "\\" and i + 1 < n:
                        buf.append(code[i:i + 2])
                        i += 2
                        continue
                    buf.append(code[i])
                    if code[i] == start_quote:
                        i += 1
                        break
                    i += 1
                continue
            if c == "`":
                buf.append(c)
                i += 1
                inner, i = scan(i, in_template=True)
                buf.append(inner)
                continue
            if c == "{":
                depth += 1
                buf.append(c)
                i += 1
                continue
            if c == "}":
                depth -= 1
                if depth == 0:
                    buf.append(c)
                    i += 1
                    return "".join(buf), i
                buf.append(c)
                i += 1
                continue
            buf.append(c)
            i += 1
        return "".join(buf), i

    text, _ = scan(0, in_template=False)
    return text


def compact_blank_lines(code):
    lines = code.split("\n")
    out = []
    blank_run = 0
    for line in lines:
        if line.strip() == "":
            blank_run += 1
            if blank_run > 1:
                continue
        else:
            blank_run = 0
        out.append(line)
    return "\n".join(out)


def format_bytes(size):
    if size >= 1024 * 1024:
        return f"{size / (1024 * 1024):.1f} Mo"
    if size >= 1024:
        return f"{size / 1024:.1f} Ko"
    return f"{size} o"


def minify_bundle_with_terser():
    """Minifie build/source.js avec Terser (npx, voir package.json). Mode "safe" : pas de
    --toplevel (ne renomme jamais les identifiants de portee globale -- tout le jeu vit dans
    un seul scope global partage entre scripts, voir CLAUDE.md), pas de --mangle-props (les
    noms de proprietes sont lus dynamiquement un peu partout : payloads RPC Supabase,
    save_data, INV/EQUIP...). --mangle reste actif pour les variables LOCALES uniquement."""
    cmd = [
        NPX_CMD, "--no-install", "terser", str(BUNDLE_PATH),
        "--compress", "passes=2", "--mangle", "--output", str(MINIFIED_BUNDLE_PATH),
    ]
    try:
        subprocess.run(cmd, cwd=ROOT, check=True)
    except FileNotFoundError:
        print("ERREUR: npx introuvable. Installe Node/npm, lance npm install, puis relance.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        print("ERREUR: Terser a echoue. Lance npm install, puis relance le build.", file=sys.stderr)
        sys.exit(exc.returncode)


def minify_css_with_csso():
    """Minifie src/styles/styles.css avec csso (2026-07-21, repo-audit-todo.md point 5) --
    equivalent CSS de minify_bundle_with_terser() ci-dessus, meme convention npx.cmd Windows.
    csso-cli est un simple wrapper CLI autour de csso (compression + suppression de doublons),
    pas de renommage de selecteurs/variables (rien d'equivalent aux risques de --toplevel cote JS :
    le CSS n'a pas de scope global partage a casser)."""
    BUILD_DIR.mkdir(exist_ok=True)
    cmd = [NPX_CMD, "--no-install", "csso", str(CSS_PATH), "-o", str(MINIFIED_CSS_PATH)]
    try:
        subprocess.run(cmd, cwd=ROOT, check=True)
    except FileNotFoundError:
        print("ERREUR: npx introuvable. Installe Node/npm, lance npm install, puis relance.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        print("ERREUR: csso a echoue. Lance npm install, puis relance le build.", file=sys.stderr)
        sys.exit(exc.returncode)


def gen_locales():
    """Recompile /locales/{fr,en}/*.json en src/core/i18n-resources.generated.js (voir
    docs/I18N_PLAN.md §5, CLAUDE.md §31) -- lance AVANT la concatenation, pour que le fichier genere
    soit a jour dans le bundle. Meme piege Windows npx que Terser : script Node via npx-like direct
    call ici, mais gen-locales.js n'a pas de dependance npm, donc appele directement via NODE_CMD."""
    script = ROOT / "scripts" / "gen-locales.js"
    cmd = [NODE_CMD, str(script)]
    try:
        subprocess.run(cmd, cwd=ROOT, check=True)
    except FileNotFoundError:
        print("ERREUR: node introuvable. Installe Node.js, puis relance.", file=sys.stderr)
        sys.exit(1)
    except subprocess.CalledProcessError as exc:
        print("ERREUR: scripts/gen-locales.js a echoue.", file=sys.stderr)
        sys.exit(exc.returncode)


def main():
    if not DEV_HTML.exists():
        print(f"ERREUR: {DEV_HTML} introuvable", file=sys.stderr)
        sys.exit(1)

    gen_locales()

    dev_html = DEV_HTML.read_text(encoding="utf-8")
    files = extract_script_order(dev_html)
    if not files:
        print("ERREUR: aucun script src/... trouve dans index.dev.html", file=sys.stderr)
        sys.exit(1)

    print(f"{len(files)} fichiers a bundler, dans cet ordre :")
    for f in files:
        print(f"  - {f}")

    parts = []
    total_before, total_after = 0, 0
    for rel_path in files:
        full_path = ROOT / rel_path
        if not full_path.exists():
            print(f"ERREUR: {full_path} introuvable", file=sys.stderr)
            sys.exit(1)
        src = full_path.read_text(encoding="utf-8")
        total_before += len(src)
        stripped = strip_js_comments_safe(src)
        stripped = compact_blank_lines(stripped)
        total_after += len(stripped)
        parts.append(f"// ==== {rel_path} ====\n{stripped.strip()}\n")

    bundle = "\n".join(parts)
    BUILD_DIR.mkdir(exist_ok=True)
    BUNDLE_PATH.write_text(bundle, encoding="utf-8", newline="\n")
    pct = 100 * (1 - total_after / total_before) if total_before else 0
    print(f"\nbuild/source.js genere : {total_before} -> {total_after} octets ({pct:.1f}% de reduction)")

    minify_bundle_with_terser()
    readable_size = BUNDLE_PATH.stat().st_size
    minified_size = MINIFIED_BUNDLE_PATH.stat().st_size
    min_pct = 100 * (1 - minified_size / readable_size) if readable_size else 0
    print(f"build/source.min.js genere : {format_bytes(readable_size)} -> {format_bytes(minified_size)} ({min_pct:.1f}% de reduction)")

    minify_css_with_csso()
    css_size = CSS_PATH.stat().st_size
    min_css_size = MINIFIED_CSS_PATH.stat().st_size
    css_pct = 100 * (1 - min_css_size / css_size) if css_size else 0
    print(f"build/styles.min.css genere : {format_bytes(css_size)} -> {format_bytes(min_css_size)} ({css_pct:.1f}% de reduction)")

    rewrite_prod_html(dev_html)
    print("index.html (prod) reecrit pour charger build/source.min.js + build/styles.min.css")


def rewrite_prod_html(dev_html):
    """Reconstruit index.html a partir de index.dev.html, ligne par ligne (approche simple et
    robuste, plutot que de detecter des "blocs de commentaires" -- les commentaires d'index.html
    ne sont pas executes, les laisser en prod meme s'ils deviennent legerement obsoletes est sans
    consequence, largement preferable a une detection fragile qui risquerait de couper au mauvais
    endroit) :
      - chaque <script src="src/...  -> retiree ; une seule balise vers le bundle est inseree
        a la position de la PREMIERE d'entre elles ;
      - <script src="meta/patch-notes-data.js...> -> conservee TELLE QUELLE, encore chargee
        separement (pas migree vers Supabase -- Phase 2) : sans elle, CURRENT_VERSION =
        PATCH_NOTES[0].v (top-level dans game-supabase.js, donc dans le bundle) plante au
        chargement ;
      - <script src="tests/tests.js...> -> retiree entierement, jamais chargee en prod ;
      - <link rel="stylesheet" href="src/styles/styles.css...> -> pointe vers build/styles.min.css
        a la place (2026-07-21, repo-audit-todo.md point 5)."""
    m = re.search(r"\?v=(\d+)", dev_html)
    version = m.group(1) if m else "1"

    lines = dev_html.split("\n")
    # meta/patch-notes-data.js doit charger AVANT le bundle (CURRENT_VERSION = PATCH_NOTES[0].v
    # est lu au top-level dans game-supabase.js, qui fait partie du bundle) -- quelle que soit sa
    # position d'origine dans index.dev.html (au milieu de la liste src/), sa balise est extraite
    # et reinseree juste avant la balise du bundle.
    meta_lines = [ln for ln in lines if re.search(r'<script src="meta/', ln)]

    prod_lines = []
    bundle_tag_inserted = False
    for line in lines:
        if re.search(r'<script src="(src/|meta/)', line):
            if not bundle_tag_inserted:
                prod_lines.extend(meta_lines)
                prod_lines.append(
                    "<!-- build de production : bundle concatene, commentaires retires, puis minifie -->"
                )
                prod_lines.append(
                    "     par Terser (build/source.min.js) -- genere par scripts/build.py depuis"
                )
                prod_lines.append(
                    "     index.dev.html, jamais edite a la main -->"
                )
                prod_lines.append(f'<script src="build/source.min.js?v={version}"></script>')
                bundle_tag_inserted = True
            continue  # les autres balises src/|meta/ sont sautees (deja placees ci-dessus)
        if re.search(r'<script src="tests/tests\.js', line):
            continue  # jamais charge en prod
        if re.search(r'<link rel="stylesheet" href="src/styles/styles\.css', line):
            prod_lines.append(f'<link rel="stylesheet" href="build/styles.min.css?v={version}">')
            continue
        prod_lines.append(line)

    if not bundle_tag_inserted:
        raise RuntimeError("aucune balise <script src=\"src/...\"> trouvee dans index.dev.html")

    PROD_HTML.write_text("\n".join(prod_lines), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
