# Against the odds · The 2026 Kentucky Derby

**[Open the live interactive project →](https://pc-do-betting-odds-match-real-results-a-mar-2uen7v5wuq-uc.a.run.app/)**

View the complete project in your browser. **No installation, download, or account required.**

An interactive USA-only portfolio story by Corinne Bish, written for people who do not follow horse racing.

The entire project covers the **2026 Kentucky Derby at Churchill Downs, Louisville, Kentucky, USA**, on May 2, 2026. It contains all 18 starters from one real American race.

![Animated racing scene](screenshots/hero-desktop.png)

## Explore

- An original 3D racetrack with galloping horses and a finish line spanning the racing surface from the inner rail to the outer rail. Drag to rotate or pause the motion; reduced-motion settings and a non-WebGL fallback are supported.
- Plain-English examples explain odds, adjusted chances, favorites and longshots.
- Linked charts compare rank by final odds with official finish, and show each horse’s adjusted chance of winning. Filter to all horses, the five lowest-odds horses, or longshots; sort by odds or finish.
- Choose any horse to inspect its odds and finish. A historical bet-size illustration shows the known return and net profit/loss.
- Scrub a replay through six published race checkpoints, or follow any of the 18 horses. Movement between checkpoints is illustrative, not measured speed or distance gaps.
- Download precisely the horse records selected in the charts.

## What happened

Golden Tempo won at **23.12-to-1**, ninth in the ranking by odds, and returned **$48.24 on a $2 win bet**. Favorite Further Ado finished **11th**. These are descriptive facts about one race: they do not establish market bias, a reliable win rate, or a repeatable betting advantage.

US odds-to-one describe profit. Adding one includes the original stake. Raw chance is `1 / (odds + 1)`; adjusted chance divides each horse’s raw chance by the total across all 18 horses. Filtering never renormalizes a subset into a different race.

## Free source

[Equibase official result chart: Churchill Downs, May 2, 2026, race 12](https://irp.cdn-website.com/c33a1b13/files/uploaded/Derby_horses_2026_Equibase_Chart_revised.pdf). Eighteen factual runner records, final odds and checkpoint ranks were transcribed into `data/examples/kentucky_derby_2026.csv`. © 2026 Equibase Company LLC. Public viewing does not imply a general redistribution license. Provenance and an input SHA-256 fingerprint are included in the snapshot.

All race observations in the project are from the USA. Horse names may carry breeding-country suffixes; these do not indicate another race venue. This is an independent historical portfolio project, not a live betting or prediction service. No paid feed or API key is required.

<details>
<summary>Developer setup and deployment (optional)</summary>

## Run locally and rebuild

```bash
pip install -r requirements.txt
streamlit run app.py
```

All libraries, fonts and data are bundled locally. To rebuild and check the evidence:

```bash
python analysis.py
pip install pytest
python -m pytest -q
```

Static preview: `python -m http.server 8765 --directory docs`. Optional browser checks are in `tests/browser_checks.py` and require Playwright and Chromium.

`analysis.py` builds the source-backed browser snapshot and processed CSV. `docs/` contains the page, charts, original 3D scene, local fonts and libraries. `app.py` hosts the same page in Streamlit. Library/font attribution is in [THIRD_PARTY.md](THIRD_PARTY.md).

## Deployment

The Google Cloud connection is being migrated to keyless GitHub Workload Identity Federation for Corinne's repositories. See [deployment/README.md](deployment/README.md) for the one-time Cloud Shell setup, the exact IAM roles and branch restrictions, and the reusable workflow for other apps.

The shared configuration remains unactivated until its public project number is supplied by the Google Cloud setup script. No `GCP_SA_KEY` or other long-lived key is required by the new workflow. The existing Cloud Run service and URL are retained; code changes alone do not verify a live deployment.

</details>
