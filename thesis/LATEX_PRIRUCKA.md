# Příručka LaTeXu pro maturitní práci (SPŠ a Gymnázium Na Třebešíně)

Tato příručka shrnuje vše, co potřebuješ vědět pro psaní své maturitní práce v připravené šabloně `main.tex`, i když s LaTeXem začínáš úplně od nuly.

---

### 1. Jak LaTeX funguje (Rozdíl oproti Wordu)

Ve Wordu (WYSIWYG) řešíš zároveň **obsah** i **vzhled** — klikáš na velikosti písma, zarovnávání a ručně posouváš obrázky, které pak často rozhází zbytek dokumentu.

V **LaTeXu** píšeš čistý text obohacený o jednoduché příkazy začínající zpětným lomítkem (`\section{Úvod}`, `\textbf{tučně}`) a o veškerou typografii, číslování kapitol, číslování obrázků, generování obsahu i dodržení školní šablony se postará překladač při vygenerování `main.pdf`.

---

### 2. Jak práci zkompilovat do PDF (2 možnosti)

#### Možnost A: Overleaf (Doporučeno pro rychlý start bez instalace)
1. Otevři [overleaf.com](https://www.overleaf.com/) a vytvoř si účet zdarma.
2. Klikni na **New Project -> Blank Project** (nebo **Upload Project**).
3. Nahraj do něj soubor `main.tex` a složku `obrazky/logo_skoly.png`.
4. Vlevo píšeš kód, vpravo vidíš živý náhled PDF. Zkratkou `Ctrl + S` se PDF okamžitě přegeneruje.

#### Možnost B: Lokálně v Linuxu (VS Code + LaTeX Workshop)
1. Nainstaluj TeX Live distribuci (v terminálu):
   - Fedora: `sudo dnf install texlive-scheme-medium latexmk`
   - Arch: `sudo pacman -S texlive-most`
   - Ubuntu/Debian: `sudo apt install texlive-full latexmk`
2. Ve **VS Code** si nainstaluj rozšíření **LaTeX Workshop** (autor: James Yu).
3. Kdykoliv uložíš `main.tex` (`Ctrl + S`), rozšíření samo na pozadí vytvoří `main.pdf` a ukáže náhled ve vedlejším panelu (`Ctrl + Alt + V`).
4. Případně můžeš v terminálu ve složce `thesis/` spustit `make`.

---

### 3. Struktura připravené šablony `main.tex`

Šablona je přesnou 1:1 rekonstrukcí školního souboru `2026-27_SPSG_sablona_MPsO.dotx`:

- **Řádky 19–26 (Údaje o práci)**: Zde na jednom místě vyplníš své jméno, název práce, vedoucího a třídu. Šablona tyto údaje automaticky propíše na **Titulní list**, do **Čestného prohlášení** i na **Anotační list**.
- **Strany 1–4**: Titulní list s logem školy, místo pro Zadání, Čestné prohlášení a Poděkování. Tyto strany nemají vytištěné číslo stránky, ale započítávají se.
- **Strany 5–7**: Česká anotace, anglická anotace (*Summary*) a automaticky generovaný *Obsah*. Od 5. strany se dole uprostřed zobrazuje číslování ve formátu `- 5 -`.
- **Strana 8+**: Hlavní kapitoly práce (`1 Úvod`, `2 Teoretická východiska`, `3 Vlastní práce`, `4 Závěr`, `5 Seznam obrázků`, `6 Seznam využitých zdrojů`).

---

### 4. Tahák základních příkazů v LaTeXu

#### A. Nadpisy a členění kapitol
Šablona automaticky nastavuje velikosti písma (Arial 16pt / 14pt / 12pt) a každou hlavní kapitolu (`\section`) automaticky začíná na nové stránce:

```latex
\section{Název hlavní kapitoly}          % Nadpis 1 (např. 2 Teoretická východiska)
\subsection{Název podkapitoly}           % Nadpis 2 (např. 2.1 Architektura)
\subsubsection{Název pod-podkapitoly}    % Nadpis 3 (např. 2.1.1 WebSocket)
\paragraph{Nadpis 4. úrovně}             % Nadpis 4 (např. 2.1.1.1 Formát zpráv)
\subparagraph{Nečíslovaný podnadpis}     % Nadpis 5 (Podnadpis bez čísla)
```

#### B. Formátování textu a odstavců
- **Nový odstavec**: Uděláš tím, že v kódu vynecháš **jeden prázdný řádek**.
- **Tučný text**: `\textbf{tučný text}`
- **Kurzíva**: `\textit{kurzíva}`
- **Strojové písmo (názvy souborů, proměnných, příkazů)**: `\texttt{Canvas.tsx}`
- **České uvozovky**: `\uv{text v českých uvozovkách}`
- **Pomlčka (rozsah stran, klient–server)**: dvě spojovníky za sebou `klient--server`
- **Speciální znaky**: Znaky `%`, `_`, `&`, `#`, `$` mají v LaTeXu speciální význam. Pokud je chceš napsat do běžného textu, dej před ně zpětné lomítko: `100~\%`, `my\_variable`, `C\#`.
- **Komentář v kódu**: Cokoliv za znakem `%` až do konce řádku LaTeX ignoruje.

#### C. Pevná (nezlomitelná) mezera `~` (Velmi důležité u obhajoby!)
Podle školní prezentace *MP – rady a doporučení* nesmí na konci řádku zůstat osamocená jednopísmenná předložka nebo spojka (`v`, `s`, `z`, `k`, `o`, `u`, `a`, `i`) a nesmí se roztrhnout číslo od jednotky či zkratky.
V LaTeXu se místo běžné mezery napíše vlnovka `~` (`AltGr + 1` nebo `Shift + ` `):

```latex
v~aplikaci, s~využitím, k~dispozici, a~zároveň
500~ms, 10~MB, Obr.~\ref{fig:schema}, kap.~\ref{sec:uvod}
```

#### D. Odrážkové a číslované seznamy

```latex
% Odrážkový seznam
\begin{itemize}
    \item První bod seznamu,
    \item druhý bod seznamu.
\end{itemize}

% Číslovaný seznam
\begin{enumerate}
    \item První krok algoritmu,
    \item druhý krok algoritmu.
\end{enumerate}
```

#### E. Vkládání obrázků a křížové odkazy
1. Ulož obrázek (`.png`, `.jpg` nebo `.pdf`) do složky `obrazky/`.
2. Vlož ho pomocí bloku `figure` a dej mu unikátní štítek `\label{fig:nazev}`:

```latex
Jak ukazuje Obr.~\ref{fig:architektura}, komunikace probíhá přes WebSocket.

\begin{figure}[H]
    \centering
    \includegraphics[width=0.85\textwidth]{obrazky/architektura.png}
    \caption{Architektura komunikace mezi klientem a serverem}
    \label{fig:architektura}
\end{figure}
```
> **Pravidlo ze školní prezentace**: Každý obrázek v práci musí mít v textu odkaz (`Obr.~\ref{...}`)! Šablona ho navíc automaticky přidá do kapitoly **5 Seznam obrázků**.

#### F. Vkládání ukázek zdrojového kódu

```latex
\begin{lstlisting}[language=Java, caption={Zpracování události pera na plátně}, label={lst:pointer}]
function handlePointerMove(e: PointerEvent) {
    const point = screenToWorld(e.clientX, e.clientY);
    currentStroke.points.push(point);
}
\end{lstlisting}
```

#### G. Matematické vzorce
- **Vzorec přímo v řádku textu**: Ohraničíš dolary `$ ... $`, např. `složitost algoritmu je $O(n \log n)$ a souřadnice $(x, y)$`.
- **Samostatná očíslovaná rovnice**:

```latex
\begin{equation}
    x_{\text{world}} = \frac{x_{\text{screen}} - t_x}{s}
    \label{eq:world_x}
\end{equation}
```

#### H. Citace a seznam literatury (ČSN ISO 690)
1. Na konci `main.tex` v bloku `\begin{thebibliography}{99}` přidáš zdroj:
   ```latex
   \bibitem{klíč_zdroje}
   AUTOR, Jméno. \textit{Název zdroje} [online]. Rok [cit. 2026-10-19].
   Dostupné z: \url{https://...}
   ```
2. V textu na něj odkážeš příkazem `\cite{klíč_zdroje}`:
   ```latex
   Podle oficiální dokumentace frameworku Tauri~\cite{tauri_docs} je jádro...
   ```
   LaTeX v textu automaticky vytiskne `[2]` a pronutí klikací odkaz na konec práce.

---

### 5. Zlatá pravidla ze školní prezentace (Na co si dát pozor)

1. **Rozsah práce**: Doporučený rozsah je **25–40 normostran** (1 normostrana = 1800 znaků včetně mezer).
2. **Žádná Ich-forma (1. osoba jednotného čísla)**:
   - ❌ *„Naprogramoval jsem server a pak jsem zjistil, že mi to nefunguje...“*
   - ✅ *„Byl implementován serverový modul. Při testování bylo zjištěno, že...“* nebo *„V této kapitole je popsán návrh...“* (trpný rod / 3. osoba).
3. **Žádné vtipy, emotikony ani hovorové výrazy** (*„appka“, „vyrenderovat“, „lagovalo to“* -> *„aplikace“, „vykreslit“, „docházelo k prodlevě odezvy“*).
4. **Konzistentní terminologie**: Pokud jeden pojem nazveš *nekonečné plátno (infinite canvas)*, používej v celé práci stejný termín.
5. **Kvalita obrázků**: Screenshoty vkládej v plném rozlišení (PNG), čitelné a s dostatečnou velikostí písma.
