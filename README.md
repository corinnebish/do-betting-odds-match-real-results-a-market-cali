# Do Betting Odds Match Real Results? A Market Calibration Check

A check of whether horse racing odds match real win rates, built for pricing and market quality teams at FanDuel and anyone who judges betting markets.

**[Open the live dashboard](https://pc-do-betting-odds-match-real-results-a-mar-2uen7v5wuq-uc.a.run.app)**

## The business problem

Prices that are too generous or too harsh cost margin and erode customer trust. This project asks how often a horse wins compared with the chance the market gives it, and whether longshots and favorites are priced fairly.

## Question

> When the market gives a horse a certain chance of winning, how often does it actually win, and do longshots and favorites get priced fairly?

## Key findings

- Longshots (odds of 15 or more) won 2.4% of the time against 0.1% implied by the odds, out of 356,430 runners across 1,500 races from 1979 to 2018.
- Favorites (odds under 5) won 21.5% of the time against 1.2% implied, so the price gap runs in both directions across the odds range.
- The calibration slope is 0.73, where 1.00 means perfect pricing. Below 1 means the market overrates longshots relative to favorites.
- A flat 1 unit bet on every runner returned -31.6% overall, -38.3% on short odds and -31.4% on long odds.
- For long odds runners, the pricing gap ranges from +1.1 points at S (25,822 runners) to +2.8 points at HV (39,516 runners).

## How it was done

- SQL-style aggregation: grouped 356,430 priced runners into odds bands and counted wins, which gives a direct comparison of actual win rate against implied chance.
- Segmentation analysis: split results by track, race class and odds group, so local pricing gaps show up instead of being hidden in one overall number. Very small segments were dropped to reduce noise.
- Logistic regression with errors clustered by race: gave one calibration slope that summarises the direction and size of bias. Runners in the same race were linked, so the errors account for that.
- Margin removal: scaled implied chances to add to 100 percent in each race, so the bookmaker margin does not distort the comparison.

Methods used: SQL-style aggregation, segmentation analysis, regression.

## Data source and license

- **Dataset:** [Hong Kong Jockey Club and Singapore TurfClub Horse Race Data](https://github.com/eprochasson/horserace_data)
- **Publisher:** Emmanuel Prochasson (GitHub user eprochasson), scraped from public HKJC and Singapore TurfClub websites
- **License:** Not stated on the source page
- The data is public and unmodified in `data/raw/` (too large for the repo - run `python download_data.py` to fetch it).
- This is an independent portfolio project. It is not endorsed by the data publisher.

## Limits of this analysis

- Final odds (winning_odds) are assumed to be decimal odds that include the returned stake, so the implied chance is 1 divided by the odds.
- Implied chances are scaled to add to 100 percent in each race, which removes the bookmaker margin before comparing.
- Runners with missing or zero odds were removed as non-runners. A runner that truly started but has no price would slightly distort its race.
- Priced runners with no numeric placing (for example pulled up) count as non-winners.
- Dead heats count as wins for each horse involved, which slightly raises win rates.
- Track means the race_location column and race type means the race_class column. Other race details were not used.
- Data was scraped from public websites and the license is not stated, so check reuse terms before sharing.
- This covers pool-style racing markets. It cannot show how FanDuel or competitors price the same races.
- Bands marked too harsh or too generous are statistical signals on past races, not proof of future gaps.

## What I would do next

- Track the calibration slope and the return per unit staked by odds group each month. A falling slope would signal growing longshot bias.
- Test the largest gap bands and tracks against current competitor prices. The data covers pool-style racing and cannot show how FanDuel or rivals price the same races.
- Check the data reuse terms before sharing. The source was scraped from public websites and no license is stated. Also note that past gaps are signals, not proof of future gaps.

## Run it yourself

```bash
pip install -r requirements.txt
python download_data.py
python analysis.py        # cleans the data and builds data/processed/
streamlit run app.py      # opens the dashboard
```

## Project layout

```
analysis.py        cleaning + analysis, writes data/processed/
app.py             Streamlit dashboard (reads data/processed/ only)
credits.py         shows the data source and license on the dashboard
data/raw/          the public source data
data/processed/    small tables the dashboard uses
tests/             smoke test: the dashboard opens without errors
Dockerfile         how the dashboard is packaged for Google Cloud Run
```

## Redeploying

The dashboard runs on Google Cloud Run. To redeploy after a change, open the **Actions** tab, choose **Redeploy to Cloud Run**, and press **Run workflow**. It needs a repository secret named `GCP_SA_KEY` (a Google Cloud service account key that can deploy to Cloud Run).
