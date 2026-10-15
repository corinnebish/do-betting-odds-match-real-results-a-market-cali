"""Streamlit dashboard: do betting odds match real race results?"""
import json
import math
from pathlib import Path

import numpy as np
import pandas as pd
import plotly.graph_objects as go
import streamlit as st

DATA_DIR = Path("data/processed")

# One palette for every chart so colors keep the same meaning
BLUE = "#1F4FD8"    # actual results
GRAY = "#6B7280"    # what the odds say
NAVY = "#0A1F44"    # text and lines
ORANGE = "#C65A00"  # warnings and negative gaps

st.set_page_config(page_title="Odds vs Results: Racing Market Check", page_icon="🏇", layout="wide")

HERO_HTML = """
<style>
.hero {background:#0A1F44; border-radius:14px; padding:22px 28px; color:#FFFFFF; margin-bottom:12px;}
.hero h1 {color:#FFFFFF; margin:0 0 6px 0; font-size:2rem;}
.hero p {color:#E3E8F2; margin:0; font-size:1.05rem; max-width:60rem;}
.hero svg {width:100%; height:64px; margin-top:14px; display:block;}
@media (prefers-reduced-motion: no-preference) {
  .runner {animation: dash 6s linear infinite;}
  .runner.r2 {animation-duration: 7.5s;}
  .runner.r3 {animation-duration: 9s;}
  @keyframes dash {from {transform: translateX(0);} to {transform: translateX(860px);}}
}
</style>
<div class="hero">
  <h1>Do betting odds match real results?</h1>
  <p>When the market gives a horse a certain chance of winning, how often does it really win?
  And are longshots and favorites priced fairly?</p>
  <svg viewBox="0 0 900 64" role="img" aria-label="Three lanes of a race track with a finish line">
    <rect x="0" y="4" width="900" height="16" fill="#1F4FD8" opacity="0.55"/>
    <rect x="0" y="24" width="900" height="16" fill="#6B7280" opacity="0.55"/>
    <rect x="0" y="44" width="900" height="16" fill="#1F4FD8" opacity="0.55"/>
    <circle class="runner" cx="20" cy="12" r="6" fill="#FFFFFF"/>
    <circle class="runner r2" cx="20" cy="32" r="6" fill="#FFFFFF"/>
    <circle class="runner r3" cx="20" cy="52" r="6" fill="#FFFFFF"/>
    <rect x="880" y="2" width="10" height="10" fill="#FFFFFF"/>
    <rect x="890" y="12" width="10" height="10" fill="#FFFFFF"/>
    <rect x="880" y="22" width="10" height="10" fill="#FFFFFF"/>
    <rect x="890" y="32" width="10" height="10" fill="#FFFFFF"/>
    <rect x="880" y="42" width="10" height="10" fill="#FFFFFF"/>
    <rect x="890" y="52" width="10" height="10" fill="#FFFFFF"/>
  </svg>
</div>
"""


@st.cache_data
def load_csv(name):
    """Read one processed CSV file."""
    return pd.read_csv(DATA_DIR / name)


@st.cache_data
def load_findings():
    """Read the findings file written by the analysis step."""
    with open(DATA_DIR / "findings.json", encoding="utf-8") as handle:
        return json.load(handle)


def style_figure(fig, title, x_title, y_title):
    """Apply the shared chart look and axis labels."""
    fig.update_layout(
        title=dict(text=title, font=dict(size=17, color=NAVY)),
        xaxis_title=x_title,
        yaxis_title=y_title,
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="#FFFFFF",
        font=dict(color=NAVY),
        legend=dict(orientation="h", yanchor="bottom", y=-0.35, x=0),
        margin=dict(t=70, b=40),
    )
    fig.update_xaxes(gridcolor="#E3E8F2", linecolor=NAVY)
    fig.update_yaxes(gridcolor="#E3E8F2", linecolor=NAVY)
    return fig


def show_chart(fig, caption):
    """Draw a chart with its one-line reading guide underneath."""
    st.plotly_chart(fig, use_container_width=True)
    st.caption(caption)


def empty_notice():
    """Tell the user that the filters left nothing to show."""
    st.info("No data matches the current filters. Try widening them in the sidebar.")


def band_chart(bands):
    """Bars of actual win rate against raw implied chance by odds band."""
    ordered = bands.sort_values("avg_odds")
    first, last = ordered.iloc[0], ordered.iloc[-1]
    title = (
        f"Shortest odds win {first['actual_win_rate']:.0%} against {first['raw_implied']:.0%} implied; "
        f"longest win {last['actual_win_rate']:.1%} against {last['raw_implied']:.1%}"
    )
    fig = go.Figure()
    fig.add_bar(
        x=ordered["odds_band"], y=ordered["actual_win_rate"], name="Actual win rate",
        marker_color=BLUE,
        error_y=dict(
            type="data", symmetric=False,
            array=ordered["ci_high"] - ordered["actual_win_rate"],
            arrayminus=ordered["actual_win_rate"] - ordered["ci_low"],
            color=NAVY,
        ),
    )
    fig.add_bar(x=ordered["odds_band"], y=ordered["raw_implied"], name="Implied by odds (1 / odds)", marker_color=GRAY)
    fig.update_layout(barmode="group")
    fig.update_yaxes(tickformat=".0%")
    return style_figure(fig, title, "Odds band (shortest to longest)", "Win rate")


def roi_chart(bands):
    """Bars of flat-bet return per unit staked by odds band."""
    ordered = bands.sort_values("avg_odds")
    losing = int((ordered["roi_flat_bet"] < 0).sum())
    worst = ordered["roi_flat_bet"].min()
    title = f"{losing} of {len(ordered)} odds bands lose money on a flat bet; the worst loses {abs(worst):.0%}"
    fig = go.Figure(go.Bar(
        x=ordered["odds_band"], y=ordered["roi_flat_bet"], marker_color=BLUE,
        text=ordered["roi_flat_bet"].map("{:.0%}".format), textposition="outside",
    ))
    fig.update_yaxes(tickformat=".0%")
    return style_figure(fig, title, "Odds band (shortest to longest)", "Return per 1 unit staked")


def venue_chart(tracks):
    """Grouped bars by track and odds group, actual against implied."""
    top = tracks.loc[tracks["gap"].idxmax()]
    title = f"{top['venue']} has the widest gap, in {top['odds_group'].lower()}"
    labels = tracks["venue"] + " - " + tracks["odds_group"]
    fig = go.Figure()
    fig.add_bar(
        x=labels, y=tracks["actual_win_rate"], name="Actual win rate", marker_color=BLUE,
        error_y=dict(
            type="data", symmetric=False,
            array=tracks["ci_high"] - tracks["actual_win_rate"],
            arrayminus=tracks["actual_win_rate"] - tracks["ci_low"],
            color=NAVY,
        ),
    )
    fig.add_bar(x=labels, y=tracks["raw_implied"], name="Implied by odds (1 / odds)", marker_color=GRAY)
    fig.update_layout(barmode="group")
    fig.update_yaxes(tickformat=".0%")
    return style_figure(fig, title, "Track and odds group", "Win rate")


def heatmap_chart(segments, metric_col, metric_label, odds_group):
    """Heatmap of a gap or return metric by race type and track."""
    table = segments.pivot_table(index="race_type", columns="venue", values=metric_col, aggfunc="first")
    best = segments.loc[segments[metric_col].idxmax()]
    title = (
        f"{odds_group}: highest {metric_label.lower()} is {best[metric_col]:+.1%} "
        f"at {best['venue']}, race type {best['race_type']}"
    )
    limit = float(np.abs(table.to_numpy()).max()) or 1.0
    fig = go.Figure(go.Heatmap(
        z=table.to_numpy(), x=list(table.columns), y=[str(r) for r in table.index],
        zmin=-limit, zmax=limit,
        colorscale=[[0, ORANGE], [0.5, "#F5F7FB"], [1, BLUE]],
        text=table.to_numpy(), texttemplate="%{text:.1%}", colorbar=dict(title=metric_label, tickformat=".0%"),
        hovertemplate="Track %{x}<br>Race type %{y}<br>" + metric_label + " %{z:.1%}<extra></extra>",
    ))
    fig.update_yaxes(type="category")
    return style_figure(fig, title, "Track", "Race type")


def curve_chart(bands, regression):
    """Fitted calibration curve from the regression against the perfect line."""
    coef = regression.set_index("term")["estimate"]
    intercept, slope = coef["intercept"], coef["slope"]
    low, high = bands["fair_implied"].min(), bands["fair_implied"].max()
    xs = np.linspace(low, high, 100)
    logit = np.log(xs / (1 - xs))
    fitted = 1 / (1 + np.exp(-(intercept + slope * logit)))
    title = f"Fitted slope is {slope:.2f}: win rates do not rise one for one with implied chance"
    fig = go.Figure()
    fig.add_scatter(x=xs, y=xs, mode="lines", name="Perfect calibration", line=dict(color=GRAY, dash="dash"))
    fig.add_scatter(x=xs, y=fitted, mode="lines", name="Fitted from regression", line=dict(color=BLUE, width=3))
    fig.add_scatter(
        x=bands["fair_implied"], y=bands["actual_win_rate"], mode="markers", name="Odds bands",
        marker=dict(color=NAVY, size=9, symbol="diamond"), text=bands["odds_band"],
    )
    fig.update_xaxes(tickformat=".1%")
    fig.update_yaxes(tickformat=".0%")
    return style_figure(fig, title, "Implied win chance (margin removed)", "Actual win rate")


def scale_warning(bands):
    """Warn when margin-free implied chances are far below the raw ones."""
    raw = (bands["raw_implied"] * bands["runners"]).sum()
    fair = (bands["fair_implied"] * bands["runners"]).sum()
    if fair <= 0 or not math.isfinite(raw / fair):
        return
    ratio = raw / fair
    if ratio > 2:
        st.warning(
            f"Data check: the margin-free implied chances are about {ratio:.0f} times smaller than the raw "
            "ones (1 / odds). A normal bookmaker margin would shrink them only a little. The charts below "
            "therefore compare results with the raw implied chance, and the margin-free figures should be "
            "treated with care."
        )


def show_metrics(findings):
    """Row of metric cards built from findings.json."""
    metrics = findings["metrics"]
    for col, metric in zip(st.columns(len(metrics)), metrics):
        col.metric(metric["label"], metric["value"], help=metric["explanation"])


def show_findings(findings):
    """Plain-English findings and what to do about them."""
    for item in findings["findings"]:
        st.markdown(f"**{item['statement']}**")
        st.write(item["evidence"])
        st.write(f"So what: {item['so_what']}")


def show_expanders(findings):
    """Method notes and caveats in collapsible sections."""
    with st.expander("How it was done"):
        for note in findings["method_notes"]:
            st.markdown(f"**{note['method']}**")
            st.write(f"Why: {note['why']}")
            st.write(f"Not used: {note['alternative']}")
    with st.expander("Limits of this data"):
        for caveat in findings["caveats"]:
            st.markdown(f"- {caveat}")


bands = load_csv("calibration_bands.csv")
regression = load_csv("regression.csv")
segments = load_csv("segment_gaps.csv")
tracks = load_csv("track_gaps.csv")
findings = load_findings()

st.markdown(HERO_HTML, unsafe_allow_html=True)
st.caption(f"Data covers {findings['date_range']}. Final odds are compared with real race results.")

st.sidebar.header("Filters")
venues = sorted(set(tracks["venue"]) | set(segments["venue"]))
chosen_venues = st.sidebar.multiselect("Tracks", venues, default=venues)
group_options = list(segments["odds_group"].drop_duplicates())
chosen_group = st.sidebar.selectbox("Odds group for the heatmap", group_options)
metric_choice = st.sidebar.radio("Heatmap shows", ["Gap (actual minus implied)", "Flat-bet return"])
min_runners = st.sidebar.number_input("Minimum runners per segment", min_value=0, value=200, step=50)

show_metrics(findings)
scale_warning(bands)

st.subheader("1. Actual results against the odds")
show_chart(
    band_chart(bands),
    "Blue bars are how often runners really won (with 95 percent range lines). Gray bars are what the odds imply. "
    "Where blue is taller than gray, the odds were too generous.",
)

st.subheader("2. What a flat bet would have returned")
show_chart(
    roi_chart(bands),
    "Each bar is the profit or loss from betting 1 unit on every runner in that band. Below zero means a loss.",
)

st.subheader("3. How the gap differs by track")
track_view = tracks[tracks["venue"].isin(chosen_venues)]
if track_view.empty:
    empty_notice()
else:
    show_chart(
        venue_chart(track_view),
        "Compare the blue and gray bar in each pair. A bigger difference means prices and results are further apart.",
    )

st.subheader("4. Over- and under-priced segments by track and race type")
metric_col, metric_label = (
    ("gap", "Gap") if metric_choice.startswith("Gap") else ("roi_flat_bet", "Flat-bet return")
)
segment_view = segments[
    segments["venue"].isin(chosen_venues)
    & (segments["odds_group"] == chosen_group)
    & (segments["runners"] >= min_runners)
]
if segment_view.empty:
    empty_notice()
else:
    show_chart(
        heatmap_chart(segment_view, metric_col, metric_label, chosen_group),
        "Blue cells are higher and orange cells are lower. Blue gaps mean runners won more often than the odds say. "
        "Blank cells have too few runners.",
    )

st.subheader("5. The calibration line")
show_chart(
    curve_chart(bands, regression),
    "The dashed gray line is a perfect market. The blue line is what the regression found. "
    "The further it sits from the dashed line, the less fair the prices.",
)

st.subheader("What this means")
show_findings(findings)
show_expanders(findings)

from credits import show_data_credit
show_data_credit()
