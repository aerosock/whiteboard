# Makefile pro kompilaci maturitní práce v LaTeXu

PDF_ENGINE = pdflatex
MAIN = main

.PHONY: all pdf watch clean

all: pdf

# Dvojí kompilace zajistí správné přepočítání čísel stran v Obsahu a Seznamu obrázků
pdf:
	$(PDF_ENGINE) -interaction=nonstopmode $(MAIN).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(MAIN).tex

# Automatická rekompilace při každém uložení souboru (vyžaduje balíček latexmk)
watch:
	latexmk -pdf -pvc -interaction=nonstopmode $(MAIN).tex

# Smazání pomocných souborů (ponechá výsledné main.pdf)
clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.bbl *.blg *.fls *.fdb_latexmk *.synctex.gz
