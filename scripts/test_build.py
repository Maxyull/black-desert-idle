#!/usr/bin/env python3
"""
Tests de scripts/build.py (2026-07-20).

Lances par `npm run test:build` et par la CI. Stdlib uniquement (unittest) : le job CI
installe deja Python pour check_build_freshness.py, on n'ajoute pas pytest pour autant.

Motivation : strip_js_comments_safe() ignorait les litteraux regex. `/^\\//` etait lu comme
un debut de commentaire `//` et la ligne se retrouvait TRONQUEE dans build/source.js (bug
reel du 2026-07-20 sur src/admin/admin-panel.js, terser plantait sur « Unexpected line
terminator »). Le cas `/a\\/*b/` etait pire : `/*` avalait tout jusqu'au prochain `*/`, ce
qui peut donner un bundle syntaxiquement valide mais FAUX -- une corruption silencieuse
qu'aucun check ne rattrape puisque le build reussit.

Usage : python scripts/test_build.py
"""
import importlib.util
import unittest
from pathlib import Path

_spec = importlib.util.spec_from_file_location("build", Path(__file__).with_name("build.py"))
build = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(build)

strip = build.strip_js_comments_safe


class StripCommentsRegexLiterals(unittest.TestCase):
    """Un litteral regex doit traverser le scanner intact, sans rien tronquer apres lui."""

    def test_escaped_slash_is_not_a_line_comment(self):
        # le bug d'origine : `\/` suivi du `/` fermant formait la paire `//`
        src = "const p = s.replace(/^\\//, '');\nconst after = 1;"
        self.assertEqual(strip(src), src)

    def test_regex_containing_block_comment_opener(self):
        # cas silencieux : `/*` avalait tout jusqu'au prochain `*/` (ou la fin du fichier)
        src = "const r = /a\\/*b/.test(x);\nconst after = 2;"
        self.assertEqual(strip(src), src)

    def test_character_class_containing_slash(self):
        # dans `[...]` un `/` ne termine pas la regex
        src = "const cls = /[/]/.test(x);\nconst after = 3;"
        self.assertEqual(strip(src), src)

    def test_regex_after_return(self):
        src = "function f() { return /x\\/y/; }\nconst after = 4;"
        self.assertEqual(strip(src), src)

    def test_regex_with_flags(self):
        src = "const re = /a\\/b/gi;\nconst after = 5;"
        self.assertEqual(strip(src), src)

    def test_regex_in_template_expression(self):
        src = "const t = `x${ s.replace(/^\\//, '') }y`;\nconst after = 6;"
        self.assertEqual(strip(src), src)

    def test_comment_after_regex_is_still_stripped(self):
        # la regex ne doit pas "eteindre" le retrait des commentaires qui la suivent
        self.assertEqual(strip("const re = /a\\/b/; // fin\nconst z = 1;"),
                         "const re = /a\\/b/; \nconst z = 1;")


class StripCommentsDivision(unittest.TestCase):
    """Une division ne doit pas etre prise pour une regex (l'autre moitie de l'heuristique)."""

    def test_simple_division(self):
        src = "const d = a / b / c;"
        self.assertEqual(strip(src), src)

    def test_division_after_paren_and_bracket(self):
        src = "const d = (a + b) / 2 + arr[0] / 3;"
        self.assertEqual(strip(src), src)

    def test_division_by_number_then_comment(self):
        self.assertEqual(strip("const d = total / 100; // pourcent\nconst z = 1;"),
                         "const d = total / 100; \nconst z = 1;")

    def test_division_spanning_what_looks_like_a_regex(self):
        # `a / b, c / d` : si `/` etait lu comme une regex, tout `/ b, c /` disparaitrait
        src = "f(a / b, c / d);"
        self.assertEqual(strip(src), src)


class StripCommentsExistingBehaviour(unittest.TestCase):
    """Non-regression du comportement d'origine (chaines, templates, commentaires)."""

    def test_url_in_string_is_kept(self):
        src = "const u = 'https://example.com/x';"
        self.assertEqual(strip(src), src)

    def test_line_comment_is_stripped(self):
        self.assertEqual(strip("const a = 1; // note\nconst b = 2;"),
                         "const a = 1; \nconst b = 2;")

    def test_block_comment_is_stripped(self):
        self.assertEqual(strip("const a = /* note */ 1;"), "const a =  1;")

    def test_comment_inside_template_literal_is_kept(self):
        src = "const t = `a // b /* c */ d`;"
        self.assertEqual(strip(src), src)

    def test_comment_inside_template_expression_is_stripped(self):
        self.assertEqual(strip("const t = `a${ x /* note */ }b`;"), "const t = `a${ x  }b`;")


if __name__ == "__main__":
    unittest.main(verbosity=2)
