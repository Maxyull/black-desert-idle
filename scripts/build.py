#!/usr/bin/env python3
"""
Build local pour Black Desert Idle (2026-07-08).

Aucun Node/npm sur cette machine -- pas d'UglifyJS/Terser possible. Ce script fait donc :
  1. lit l'ordre exact des <script src="src/..."> dans index.dev.html (source de verite
     unique pour l'ordre de dependance -- voir CLAUDE.md, section chargement) ;
  2. concatene ces fichiers dans cet ordre, en retirant les commentaires JS (// et /* */)
     via un mini-analyseur caractere par caractere qui respecte les chaines/template
     literals (y compris ${...} imbriques) -- PAS une regex naive qui casserait toute
     chaine contenant "//" (URLs, etc.) ;
  3. compacte les lignes vides ;
  4. ecrit le resultat dans build/source.js ;
  5. reecrit index.html (PROD, servi par GitHub Pages) pour ne plus charger que ce bundle
     (+ la balise Supabase CDN, le CSS, les patch notes en RPC -- pas de tests).

"Compresse sans commentaires" au sens litteral de la demande -- PAS une minification
agressive (pas de renommage de variables, pas d'elimination de code mort). Si Node devient
disponible un jour, ce script peut etre remplace par un vrai Terser/esbuild.

Usage : python scripts/build.py
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEV_HTML = ROOT / "index.dev.html"
PROD_HTML = ROOT / "index.html"
BUILD_DIR = ROOT / "build"
BUNDLE_PATH = BUILD_DIR / "source.js"

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


def main():
    if not DEV_HTML.exists():
        print(f"ERREUR: {DEV_HTML} introuvable", file=sys.stderr)
        sys.exit(1)

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

    rewrite_prod_html(dev_html)
    print("index.html (prod) reecrit pour charger build/source.js")


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
      - <script src="tests/tests.js...> -> retiree entierement, jamais chargee en prod."""
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
                    "<!-- build de production : un seul bundle concatene + commentaires retires --"
                )
                prod_lines.append(
                    "     genere par scripts/build.py depuis index.dev.html, jamais edite a la main -->"
                )
                prod_lines.append(f'<script src="build/source.js?v={version}"></script>')
                bundle_tag_inserted = True
            continue  # les autres balises src/|meta/ sont sautees (deja placees ci-dessus)
        if re.search(r'<script src="tests/tests\.js', line):
            continue  # jamais charge en prod
        prod_lines.append(line)

    if not bundle_tag_inserted:
        raise RuntimeError("aucune balise <script src=\"src/...\"> trouvee dans index.dev.html")

    PROD_HTML.write_text("\n".join(prod_lines), encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
