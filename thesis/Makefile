# Makefile pro kompilaci maturitní práce v LaTeXu
# Střední průmyslová škola a Gymnázium Na Třebešíně

PDF_ENGINE = pdflatex
TEMPLATE = main
DRAFT = prace

.PHONY: all pdf template draft watch clean

all: template draft

# Kompilace hlavní šablony (main.pdf)
template:
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE).tex

# Kompilace rozpracovaného textu práce (prace.pdf)
draft:
	$(PDF_ENGINE) -interaction=nonstopmode $(DRAFT).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(DRAFT).tex

pdf: template

# Automatická rekompilace při každém uložení souboru (vyžaduje latexmk)
watch:
	latexmk -pdf -pvc -interaction=nonstopmode $(TEMPLATE).tex

# Smazání dočasných a pomocných souborů
clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.bbl *.blg *.fls *.fdb_latexmk *.synctex.gz
