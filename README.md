# Against the odds

**Do betting odds match real results?** An interactive portfolio study by Corinne Bish, written for people who do not follow horse racing.

[Open the dashboard](https://pc-do-betting-odds-match-real-results-a-mar-2uen7v5wuq-uc.a.run.app/)

![Dimensional racetrack and galloping horses](screenshots/hero-desktop.png)

A custom 3D racetrack opens the story. Linked charts compare expected and actual wins, show historical returns in dollars, and explore differences between Happy Valley and Sha Tin. A separate US case study follows all 20 horses through six recorded checkpoints in the 2024 Kentucky Derby.

## The evidence

- **14,182 horse starts across 1,150 complete Hong Kong races**, September 28, 2016–June 27, 2018.
- Equal $1 bets on every horse returned **−26.43%** overall. Probability accuracy and betting profitability are different questions.
- The fitted logistic calibration slope is **1.07**, with a race-clustered 95% interval of approximately **1.00–1.14**. Slope alone cannot establish calibration: a perfect logistic calibration relationship also needs intercept zero.
- The Derby example uses **one real US race**. Mystik Dan won at 18.61-to-1, while favorite Fierceness finished 15th. It illustrates uncertainty, not a repeatable betting edge or broad US-market behavior.

### Corrected race identification

The earlier analysis grouped by `race_id`, which repeats across dates and is frequently missing. It therefore combined unrelated races and distorted probability normalization. Earlier figures based on 356,430 runners, 1,500 races, 96.8% margin and slope 0.73 are superseded.

The revised pipeline reconstructs the field using the explicit race catalog's **date + venue + race number + horse list**. It excludes ambiguous duplicate performance records and requires all catalog horses to have valid decimal odds and numeric results, at least three runners, exactly one winner, and an implied-probability total between 1.05 and 1.50. Of 1,539 Hong Kong catalog races, 389 are excluded. Conservative exclusions can introduce selection bias.

**Track names:** HV = Happy Valley; ST = Sha Tin; S = Singapore (Kranji during the archive's period). The raw country field directly confirms that S is Singapore. Singapore is excluded from the analysis because its supplied odds have inconsistent scale; no speculative rescaling is applied.

## What you can explore

- A responsive 3D racetrack with original low-poly horses and jockeys; drag to rotate, pause motion, or use reduced-motion preferences. A static illustration supports devices without WebGL.
- A plain-English guide to odds, probability, favorites and longshots.
- Linked win-chance, difference, return and track-comparison charts. Track and year filters update every Hong Kong visual, finding and CSV download.
- Win-rate uncertainty using 95% Wilson intervals. These pooled intervals treat starts as independent; the regression separately clusters errors by race.
- A Kentucky Derby replay using published positions. Motion between checkpoints is illustrative, not GPS, video, actual gaps or speed. Users can scrub, play, pause, select any horse, and inspect all 20 records.
- Methods, sample exclusions, source attribution and limitations built into the page.

The visual palette retains the original navy `#0A1F44`, blue `#1F4FD8`, gray `#6B7280` and orange `#C65A00`. The opening scene and editorial hierarchy take inspiration from Corinne's [LA fire insurance project](https://github.com/corinnebish/la-fire-insurer-foresight).

## Free data sources

1. [Emmanuel Prochasson's HKJC / Singapore Turf Club archive](https://github.com/eprochasson/horserace_data). Public scraped historical observations; publisher disclaims accuracy and no data license is stated. `docs/data.js` records the input file's SHA-256. This study only uses the Hong Kong records meeting the checks above.
2. [Equibase official result chart: Churchill Downs, May 4, 2024, race 12](https://irp.cdn-website.com/c33a1b13/files/uploaded/Results_2024_Kentucky_Derby.pdf). Twenty factual runner records and six checkpoint positions were transcribed into `data/examples/kentucky_derby_2024.csv`. Copyright 2024 Equibase Company LLC. Public viewing does not imply a blanket data redistribution license. US odds-to-one are converted to decimal returns by adding one; the $2 winner payout reconciles to $39.22.

No paid feeds, API keys, generated observations, stock horse models or recurring data purchases are needed. This is an independent historical portfolio project, not a live betting or prediction product.

## Run and rebuild

```bash
pip install -r requirements.txt
streamlit run app.py
```

Processed evidence and web assets are included, so running the dashboard does not download source data or require third-party CDNs.

To rebuild the Hong Kong analysis:

```bash
python download_data.py
python analysis.py
python -m pip install pytest
python -m pytest -q
```

To preview the static page directly:

```bash
python -m http.server 8765 --directory docs
```

## Project structure

```text
analysis.py                 race reconstruction, validation, regression and export
app.py                      full-window Streamlit host; inlines all local assets
data/examples/              transcribed US example and source metadata
data/processed/             reviewed aggregate tables and audit findings
docs/index.html             story, explanations and semantic page structure
docs/styles.css             responsive design and local fonts
docs/scene.js               original animated three.js racetrack and horse models
docs/app.js                 D3 charts, linked controls, US replay and CSV export
docs/data.js                complete reviewed browser evidence snapshot
docs/vendor/                locally vendored D3 and three.js
tests/                      race identity, complete fields, reconciliation and smoke tests
screenshots/                desktop and mobile previews
```

See [THIRD_PARTY.md](THIRD_PARTY.md) for library and font attribution.

## Deploy

The existing Google Cloud Run service is preserved. The deployment workflow uses `GCP_SA_KEY`, the existing Google Cloud service account secret. A push to `main` or a manual **Actions → Redeploy to Cloud Run → Run workflow** runs the checks before deploying. No new cloud service is required.
