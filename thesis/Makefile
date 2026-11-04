# Makefile pro kompilaci maturitní práce v LaTeXu
# Střední průmyslová škola a Gymnázium Na Třebešíně

PDF_ENGINE = pdflatex
TEMPLATE = main
TEMPLATE_EN = main-en
DRAFT = prace

.PHONY: all pdf template template-en en draft watch watch-en clean

all: template template-en draft

# Kompilace hlavní české šablony (main.pdf)
template:
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE).tex

# Kompilace anglické verze šablony (main-en.pdf)
template-en:
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE_EN).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(TEMPLATE_EN).tex

en: template-en

# Kompilace rozpracovaného textu práce (prace.pdf)
draft:
	$(PDF_ENGINE) -interaction=nonstopmode $(DRAFT).tex
	$(PDF_ENGINE) -interaction=nonstopmode $(DRAFT).tex

pdf: template

# Automatická rekompilace při každém uložení souboru (vyžaduje latexmk)
watch:
	latexmk -pdf -pvc -interaction=nonstopmode $(TEMPLATE).tex

watch-en:
	latexmk -pdf -pvc -interaction=nonstopmode $(TEMPLATE_EN).tex

# Smazání dočasných a pomocných souborů
clean:
	rm -f *.aux *.log *.out *.toc *.lof *.lot *.bbl *.blg *.fls *.fdb_latexmk *.synctex.gz
