"""Market calibration check: do final win odds match actual win rates?"""
import json
import math
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

RAW_DIR = Path("data/raw/horserace_data-master/data")
RAW_ZIP = Path("data/raw/horserace_data-master.zip")
OUT_DIR = Path("data/processed")

# Odds band edges (decimal odds, return per 1 staked including the stake)
BAND_EDGES = [0, 2, 3, 5, 8, 12, 20, 40, np.inf]
# Coarser groups used for the track and race type view
GROUP_EDGES = [0, 5, 15, np.inf]
GROUP_LABELS = ["Short odds (under 5)", "Mid odds (5 to 15)", "Long odds (15 and over)"]
MIN_RUNNERS_SEGMENT = 300

# Exact column names from the performances file
PERF_COLUMNS = [
    "race_id", "horse_id", "final_placing", "winning_odds",
    "race_date", "race_location", "race_class",
]


def read_performances():
    """Read the performances table from the extracted folder, or from the zip if needed."""
    path = RAW_DIR / "performances.csv.gz"
    if path.exists():
        return pd.read_csv(path, usecols=PERF_COLUMNS, low_memory=False)
    with zipfile.ZipFile(RAW_ZIP) as zf:
        with zf.open("horserace_data-master/data/performances.csv.gz") as handle:
            return pd.read_csv(handle, compression="gzip",
                               usecols=PERF_COLUMNS, low_memory=False)


def wilson_interval(wins, n, z=1.96):
    """Return a 95 percent Wilson confidence interval for a win rate."""
    if n == 0:
        return np.nan, np.nan
    p = wins / n
    centre = (p + z * z / (2 * n)) / (1 + z * z / n)
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return centre - half, centre + half


def load_and_clean():
    """Load performances, clean them, and print what was removed."""
    df = read_performances()
    print(f"Loaded {len(df):,} performance rows in {df['race_id'].nunique():,} races.")

    # The same horse should only appear once per race
    before = len(df)
    df = df.drop_duplicates(subset=["race_id", "horse_id"])
    print(f"Removed {before - len(df):,} duplicate race and horse rows.")

    # Odds must be at least 1.0 (decimal, stake included) to become a probability.
    # Missing or zero odds mean the horse did not run or had no final price.
    df["odds"] = pd.to_numeric(df["winning_odds"], errors="coerce")
    before = len(df)
    df = df[df["odds"] >= 1]
    print(f"Removed {before - len(df):,} rows with missing or invalid final odds "
          "(mostly withdrawn horses), since they cannot be priced.")

    # Placing text can carry notes such as dead heats. No digits means no placing (e.g. pulled up).
    df["position"] = pd.to_numeric(
        df["final_placing"].astype(str).str.extract(r"(\d+)")[0], errors="coerce"
    )
    no_place = int(df["position"].isna().sum())
    print(f"Kept {no_place:,} priced runners with no numeric placing and counted them as "
          "non-winners, because they started and did not win.")

    df["won"] = (df["position"] == 1).astype(int)

    # A race with no recorded winner means incomplete data, so the race is unusable
    winners = df.groupby("race_id")["won"].transform("sum")
    before = len(df)
    df = df[winners >= 1]
    print(f"Removed {before - len(df):,} rows from races with no recorded winner.")

    # Races with a single priced runner cannot be normalised in a useful way
    sizes = df.groupby("race_id")["horse_id"].transform("size")
    before = len(df)
    df = df[sizes >= 2]
    print(f"Removed {before - len(df):,} rows from races with fewer than 2 priced runners.")

    df["date"] = pd.to_datetime(df["race_date"], errors="coerce")
    df["venue"] = df["race_location"].astype(str).str.strip().replace({"nan": "Unknown", "": "Unknown"})
    df["race_type"] = df["race_class"].astype(str).str.strip().replace({"nan": "Unknown", "": "Unknown"})
    print(f"Rows kept for analysis: {len(df):,}.")
    return df[["race_id", "horse_id", "position", "won", "odds", "date", "venue", "race_type"]]


def add_probabilities(df):
    """Add raw implied chance, margin-free chance and band labels."""
    df = df.copy()
    df["raw_implied"] = 1 / df["odds"]
    # Dividing by the race total removes the bookmaker margin so we compare like with like
    race_total = df.groupby("race_id")["raw_implied"].transform("sum")
    df["fair_implied"] = df["raw_implied"] / race_total
    df["band"] = pd.cut(df["odds"], BAND_EDGES, right=False)
    df["group"] = pd.cut(df["odds"], GROUP_EDGES, labels=GROUP_LABELS, right=False)
    return df


def band_label(interval):
    """Turn a pandas interval into plain text like '5 to 8'."""
    left, right = interval.left, interval.right
    if left == 0:
        return f"under {right:g}"
    if np.isinf(right):
        return f"{left:g} and over"
    return f"{left:g} to {right:g}"


def summarise(frame, keys):
    """Aggregate runners, wins, implied chances, gap and flat-bet return by keys."""
    frame = frame.assign(payout=frame["odds"] * frame["won"])
    out = frame.groupby(keys, observed=True).agg(
        runners=("won", "size"),
        wins=("won", "sum"),
        avg_odds=("odds", "mean"),
        raw_implied=("raw_implied", "mean"),
        fair_implied=("fair_implied", "mean"),
        total_payout=("payout", "sum"),
    ).reset_index()
    out["actual_win_rate"] = out["wins"] / out["runners"]
    out["gap"] = out["actual_win_rate"] - out["fair_implied"]
    # Flat 1 unit bet on every runner: profit per unit staked
    out["roi_flat_bet"] = out["total_payout"] / out["runners"] - 1
    bounds = [wilson_interval(w, n) for w, n in zip(out["wins"], out["runners"])]
    out["ci_low"] = [b[0] for b in bounds]
    out["ci_high"] = [b[1] for b in bounds]
    # Actual rate above the implied rate means the price was too generous to the bettor
    out["verdict"] = np.select(
        [out["fair_implied"] < out["ci_low"], out["fair_implied"] > out["ci_high"]],
        ["Odds too generous", "Odds too harsh"],
        default="Fairly priced",
    )
    return out.drop(columns=["total_payout"])


def calibration_bands(df):
    """Build the overall table of actual versus implied win rates by odds band."""
    bands = summarise(df, ["band"])
    bands["odds_band"] = bands["band"].apply(band_label)
    return bands.drop(columns=["band"])


def segment_table(df):
    """Build gaps by track, race type and odds group, keeping only large segments."""
    seg = summarise(df, ["venue", "race_type", "group"])
    seg = seg.rename(columns={"group": "odds_group"})
    seg["odds_group"] = seg["odds_group"].astype(str)
    return seg[seg["runners"] >= MIN_RUNNERS_SEGMENT]


def track_table(df):
    """Build gaps by track and odds group across all race types."""
    out = summarise(df, ["venue", "group"]).rename(columns={"group": "odds_group"})
    out["odds_group"] = out["odds_group"].astype(str)
    return out[out["runners"] >= MIN_RUNNERS_SEGMENT]


def run_regression(df):
    """Fit win ~ logit(fair implied chance) with race-clustered errors."""
    p = df["fair_implied"].clip(1e-4, 1 - 1e-4)
    x = sm.add_constant(np.log(p / (1 - p)).rename("logit_implied"))
    groups = pd.factorize(df["race_id"])[0]
    model = sm.Logit(df["won"], x).fit(
        disp=0, cov_type="cluster", cov_kwds={"groups": groups}
    )
    slope = model.params["logit_implied"]
    se = model.bse["logit_implied"]
    conf = model.conf_int()
    table = pd.DataFrame({
        "term": ["intercept", "slope"],
        "estimate": [model.params["const"], slope],
        "std_error": [model.bse["const"], se],
        "ci_low": [conf.loc["const", 0], conf.loc["logit_implied", 0]],
        "ci_high": [conf.loc["const", 1], conf.loc["logit_implied", 1]],
        # Intercept is tested against 0 and slope against 1, the values of a perfect market
        "p_value_vs_calibrated": [
            model.pvalues["const"],
            2 * (1 - 0.5 * (1 + math.erf(abs((slope - 1) / se) / math.sqrt(2)))),
        ],
    })
    return table, slope, se


def pct(value):
    """Format a share as a percent string with one decimal."""
    return f"{value * 100:.1f}%"


def build_findings(df, bands, tracks, slope, se):
    """Assemble the findings.json content from computed results."""
    n_races = df["race_id"].nunique()
    overround = df.groupby("race_id")["raw_implied"].sum().mean()
    margin = 1 - 1 / overround

    longs = df[df["group"] == GROUP_LABELS[2]]
    shorts = df[df["group"] == GROUP_LABELS[0]]
    long_act, long_imp = longs["won"].mean(), longs["fair_implied"].mean()
    short_act, short_imp = shorts["won"].mean(), shorts["fair_implied"].mean()
    long_roi = (longs["odds"] * longs["won"]).mean() - 1
    short_roi = (shorts["odds"] * shorts["won"]).mean() - 1
    all_roi = (df["odds"] * df["won"]).mean() - 1

    long_word = "less" if long_act < long_imp else "more"
    headline = (
        f"Longshots (odds of 15 or more) win {pct(long_act)} of the time against "
        f"{pct(long_imp)} implied by the odds, so they win {long_word} often than the market says."
    )

    dates = df["date"].dropna()
    date_range = f"{dates.min():%Y-%m-%d} to {dates.max():%Y-%m-%d}" if len(dates) else ""

    harsh = int((bands["verdict"] == "Odds too harsh").sum())
    generous = int((bands["verdict"] == "Odds too generous").sum())

    long_tracks = tracks[tracks["odds_group"] == GROUP_LABELS[2]].sort_values("gap")
    if len(long_tracks):
        low = long_tracks.iloc[0]
        high = long_tracks.iloc[-1]
        track_evidence = (
            f"For long odds runners, {low['venue']} has the lowest gap ({low['gap'] * 100:+.1f} points, "
            f"{int(low['runners']):,} runners) and {high['venue']} has the highest "
            f"({high['gap'] * 100:+.1f} points, {int(high['runners']):,} runners)."
        )
    else:
        track_evidence = "No track had enough long odds runners to compare."

    metrics = [
        {"label": "Runners analysed", "value": f"{len(df):,}",
         "explanation": f"Priced runners across {n_races:,} races."},
        {"label": "Average market margin", "value": pct(margin),
         "explanation": "How much the raw implied chances add up to above 100 percent, shown as a share of the total."},
        {"label": "Short odds win rate", "value": f"{pct(short_act)} vs {pct(short_imp)}",
         "explanation": "Actual win rate against the margin-free implied rate for runners with odds under 5."},
        {"label": "Long odds win rate", "value": f"{pct(long_act)} vs {pct(long_imp)}",
         "explanation": "Actual win rate against the margin-free implied rate for runners with odds of 15 or more."},
        {"label": "Calibration slope", "value": f"{slope:.2f}",
         "explanation": "1.00 means odds are perfectly calibrated. Below 1 means the market overrates longshots relative to favorites."},
    ]

    findings = [
        {"statement": "Longshots and favorites are not priced equally fairly.",
         "evidence": (f"Long odds runners win {pct(long_act)} against {pct(long_imp)} implied. "
                      f"Short odds runners win {pct(short_act)} against {pct(short_imp)} implied."),
         "so_what": "Review the price of the bands with the biggest gap first, because that is where price and result differ most."},
        {"statement": "A flat bet on every runner returns different amounts in different odds groups.",
         "evidence": (f"Betting 1 unit on every runner returns {all_roi * 100:+.1f}% overall, "
                      f"{short_roi * 100:+.1f}% on short odds and {long_roi * 100:+.1f}% on long odds."),
         "so_what": "Use return per unit staked by odds group as a simple monthly pricing health metric."},
        {"statement": "The calibration regression shows how far the odds are from fair.",
         "evidence": (f"The slope is {slope:.2f} (standard error {se:.2f}) where 1.00 is perfect. "
                      f"{harsh} odds bands look too harsh and {generous} too generous "
                      f"out of {len(bands)} bands, using 95 percent intervals."),
         "so_what": "Track the slope over time and by track. A falling slope would signal growing longshot bias."},
        {"statement": "Pricing gaps differ by track.",
         "evidence": track_evidence,
         "so_what": "Focus commercial review on the tracks with the biggest gaps and check them against competitor prices."},
    ]

    method_notes = [
        {"method": "SQL-style aggregation",
         "why": "Grouping runners into odds bands and counting wins gives a direct actual versus implied comparison.",
         "alternative": "A plain scatter of every runner was not used because each point is only a win or a loss and shows nothing."},
        {"method": "Segmentation analysis",
         "why": "Splitting by track, race class and odds group shows where prices are off, not only whether they are off overall.",
         "alternative": "One overall number was not used because it hides local gaps. Very small segments are dropped to avoid noise."},
        {"method": "Logistic regression with clustered errors",
         "why": "Regressing win on the log-odds of the implied chance gives one slope that summarises bias. Runners in the same race are linked, so errors are clustered by race.",
         "alternative": "A simple correlation or a chi-square test was not used because they do not say which direction the bias runs."},
    ]

    caveats = [
        "Final odds (winning_odds) are assumed to be decimal odds that include the returned stake, so the implied chance is 1 divided by the odds.",
        "Implied chances are scaled to add to 100 percent in each race, which removes the bookmaker margin before comparing.",
        "Runners with missing or zero odds were removed as non-runners. A runner that truly started but has no price would slightly distort its race.",
        "Priced runners with no numeric placing (for example pulled up) count as non-winners.",
        "Dead heats count as wins for each horse involved, which slightly raises win rates.",
        "Track means the race_location column and race type means the race_class column. Other race details were not used.",
        "Data was scraped from public websites and the license is not stated, so check reuse terms before sharing.",
        "This covers pool-style racing markets. It cannot show how FanDuel or competitors price the same races.",
        "Bands marked too harsh or too generous are statistical signals on past races, not proof of future gaps.",
    ]

    return {
        "headline": headline,
        "rows_analyzed": int(len(df)),
        "date_range": date_range,
        "metrics": metrics,
        "findings": findings,
        "method_notes": method_notes,
        "caveats": caveats,
    }


def main():
    """Run the full pipeline and save dashboard tables."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    df = add_probabilities(load_and_clean())

    bands = calibration_bands(df)
    segments = segment_table(df)
    tracks = track_table(df)
    reg_table, slope, se = run_regression(df)

    bands.to_csv(OUT_DIR / "calibration_bands.csv", index=False)
    segments.to_csv(OUT_DIR / "segment_gaps.csv", index=False)
    tracks.to_csv(OUT_DIR / "track_gaps.csv", index=False)
    reg_table.to_csv(OUT_DIR / "regression.csv", index=False)

    findings = build_findings(df, bands, tracks, slope, se)
    with open(OUT_DIR / "findings.json", "w", encoding="utf-8") as handle:
        json.dump(findings, handle, indent=2)
    print("Saved tables and findings.json to", OUT_DIR)


if __name__ == "__main__":
    main()
