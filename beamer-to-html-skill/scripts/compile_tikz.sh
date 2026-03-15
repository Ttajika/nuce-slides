#!/bin/bash
# compile_tikz.sh — Compile standalone TikZ .tex files to SVG
# Usage: bash compile_tikz.sh [directory]
# Looks for tikz_*.tex files in the given directory (default: current dir)

DIR="${1:-.}"
cd "$DIR" || exit 1

SUCCESS=0
FAIL=0

for f in tikz_*.tex; do
    [ -f "$f" ] || continue
    base="${f%.tex}"
    echo -n "Compiling $f... "

    # Detect if Japanese text is present (use xelatex) or not (pdflatex)
    if grep -qP '[\x{3000}-\x{9FFF}]' "$f" 2>/dev/null; then
        ENGINE="xelatex"
    else
        ENGINE="pdflatex"
    fi

    $ENGINE -interaction=nonstopmode "$f" > /dev/null 2>&1
    if [ -f "${base}.pdf" ]; then
        pdftocairo -svg "${base}.pdf" "${base}.svg" 2>/dev/null
        if [ -f "${base}.svg" ]; then
            echo "OK ($ENGINE → SVG)"
            SUCCESS=$((SUCCESS + 1))
        else
            echo "PDF OK, SVG conversion FAILED"
            FAIL=$((FAIL + 1))
        fi
    else
        echo "COMPILE FAILED ($ENGINE)"
        FAIL=$((FAIL + 1))
    fi
done

# Cleanup aux files
rm -f tikz_*.aux tikz_*.log tikz_*.pdf 2>/dev/null

echo ""
echo "Done: $SUCCESS succeeded, $FAIL failed"
ls -la tikz_*.svg 2>/dev/null
