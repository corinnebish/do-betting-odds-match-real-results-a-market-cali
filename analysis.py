"""Reproducible calibration analysis at one runner per identified race.

Only Hong Kong races from the explicit 2016–2018 race catalog are used.
Historical race_id is reused and Singapore's odds scale is unresolved.
"""
import hashlib
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parent
RAW = ROOT / 'data/raw/horserace_data-master/data'
OUT = ROOT / 'data/processed'
EDGES = [1, 2, 3, 5, 8, 12, 20, 40, np.inf]
LABELS = ['1–2', '2–3', '3–5', '5–8', '8–12', '12–20', '20–40', '40+']
TRACKS = {'HV': 'Happy Valley', 'ST': 'Sha Tin', 'S': 'Kranji (Singapore)'}


def wilson_interval(wins, n, z=1.96):
    if not n:
        return (None, None)
    p = wins / n
    den = 1 + z*z/n
    centre = (p + z*z/(2*n))/den
    half = z*math.sqrt(p*(1-p)/n + z*z/(4*n*n))/den
    return centre-half, centre+half


def load_and_clean():
    races = pd.read_csv(RAW/'races.csv.gz')
    perf = pd.read_csv(RAW/'performances.csv.gz', low_memory=False)
    races = races[races.race_country.eq('HK')].copy()
    for frame in [races, perf]:
        frame['date'] = pd.to_datetime(frame.race_date).dt.strftime('%Y-%m-%d')
    races['race_key'] = races.date + '|' + races.race_location + '|' + races.race_no.astype(str)
    races['horse_id'] = races.horse_list.str.split(',')
    races = races.explode('horse_id')
    races.horse_id = races.horse_id.astype(str).str.strip()
    perf.horse_id = perf.horse_id.astype(str).str.strip()
    keys = ['date', 'race_location', 'horse_id']
    conflicting = perf.duplicated(keys, keep=False)
    # Ambiguous records are excluded, never selected arbitrarily.
    perf = perf[~conflicting]
    wanted = ['race_key', *keys, 'race_no', 'race_class', 'distance', 'track']
    df = races[wanted].merge(perf[keys+['horse_name','winning_odds','final_placing']], on=keys, how='left', validate='many_to_one')
    df['odds'] = pd.to_numeric(df.winning_odds, errors='coerce')
    df['position'] = pd.to_numeric(df.final_placing, errors='coerce')
    df['won'] = df.position.eq(1).astype(int)
    valid = df.odds.ge(1) & np.isfinite(df.odds) & df.position.notna()
    df['valid'] = valid
    status = df.groupby('race_key').agg(valid=('valid','all'), winners=('won','sum'), runners=('horse_id','size'))
    good = status.index[status.valid & status.winners.eq(1) & status.runners.ge(3)]
    df = df[df.race_key.isin(good)].copy()
    df['raw_implied'] = 1 / df.odds
    totals = df.groupby('race_key').raw_implied.transform('sum')
    # Guard against truncated fields and source-scale anomalies before normalizing.
    df = df[totals.between(1.05, 1.5)].copy()
    df['fair_implied'] = df.raw_implied / df.groupby('race_key').raw_implied.transform('sum')
    df['band'] = pd.cut(df.odds, EDGES, labels=LABELS, right=False).astype(str)
    df['venue'] = df.race_location
    df['race_type'] = df.race_class.fillna('Unknown').astype(str)
    df['year'] = df.date.str[:4]
    df['payout'] = df.odds * df.won
    audit = {'catalog_races': int(len(status)), 'retained_races': int(df.race_key.nunique()),
             'retained_runners': int(len(df)), 'excluded_races': int(len(status)-df.race_key.nunique()),
             'key': 'date + venue + race number', 'singapore_excluded': True}
    return df, audit


def summarise(df, keys):
    out = df.groupby(keys, observed=True).agg(runners=('won','size'), wins=('won','sum'),
        implied_sum=('fair_implied','sum'), raw_sum=('raw_implied','sum'), payout=('payout','sum')).reset_index()
    out['actual_win_rate'] = out.wins/out.runners
    out['fair_implied'] = out.implied_sum/out.runners
    out['raw_implied'] = out.raw_sum/out.runners
    out['gap'] = out.actual_win_rate-out.fair_implied
    out['roi_flat_bet'] = out.payout/out.runners-1
    bounds = [wilson_interval(int(w), int(n)) for w,n in zip(out.wins,out.runners)]
    out['ci_low'] = [b[0] for b in bounds]; out['ci_high'] = [b[1] for b in bounds]
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df, audit = load_and_clean()
    bands = summarise(df, ['band'])
    bands['odds_band'] = bands.band
    bands.to_csv(OUT/'calibration_bands.csv', index=False)
    summarise(df, ['venue','band']).to_csv(OUT/'track_gaps.csv', index=False)
    summarise(df, ['venue','race_type','band']).to_csv(OUT/'segment_gaps.csv', index=False)
    p = df.fair_implied.clip(1e-6,1-1e-6)
    x = sm.add_constant(np.log(p/(1-p)).rename('slope'))
    model = sm.Logit(df.won,x).fit(disp=0,cov_type='cluster',cov_kwds={'groups':df.race_key})
    conf = model.conf_int()
    regression = [{'term': t, 'estimate':float(model.params[t]), 'std_error':float(model.bse[t]),
                   'ci_low':float(conf.loc[t,0]),'ci_high':float(conf.loc[t,1])} for t in ['const','slope']]
    pd.DataFrame(regression).to_csv(OUT/'regression.csv',index=False)
    findings = {'rows_analyzed':len(df), 'races':df.race_key.nunique(), 'date_range':[df.date.min(),df.date.max()],
                'roi':float(df.payout.mean()-1), 'slope':regression[1], 'audit':audit}
    (OUT/'findings.json').write_text(json.dumps(findings,indent=2))
    # Compact runner rows make every browser filter and CSV export use the same evidence.
    cols = ['race_key','horse_id','date','venue','race_type','odds','won','fair_implied','band']
    rows = df[cols].copy()
    rows['fair_implied'] = rows.fair_implied.round(9)
    us = pd.read_csv(ROOT/'data/examples/kentucky_derby_2024.csv')
    us['decimal_odds'] = us.odds_to_one+1
    us['raw_implied'] = 1/us.decimal_odds
    us['fair_implied'] = us.raw_implied/us.raw_implied.sum()
    us['market_rank'] = us.odds_to_one.rank(method='min').astype(int)
    snapshot = {'meta': findings, 'columns':cols, 'rows':rows.values.tolist(), 'bands':LABELS,
       'tracks':TRACKS, 'regression':regression, 'us':us.to_dict('records'),
       'sources':[
           {'name':'HKJC / Singapore Turf Club historical archive', 'url':'https://github.com/eprochasson/horserace_data',
            'classification':'Public scraped historical observations; publisher disclaims accuracy; no data license stated.',
            'sha256':hashlib.sha256((RAW/'performances.csv.gz').read_bytes()).hexdigest()},
           {'name':'Equibase official chart · Kentucky Derby 2024',
            'url':'https://irp.cdn-website.com/c33a1b13/files/uploaded/Results_2024_Kentucky_Derby.pdf',
            'classification':'20 factual runner records transcribed from a publicly available official result chart; copyright Equibase 2024. No blanket redistribution license asserted.'}
       ]}
    (ROOT/'docs/data.js').write_text('window.RACING_DATA = '+json.dumps(snapshot,separators=(',',':'),allow_nan=False)+';\n')
    df[cols].to_csv(OUT/'reviewed_runners.csv',index=False)
    print(json.dumps(findings, indent=2))


if __name__ == '__main__':
    main()
