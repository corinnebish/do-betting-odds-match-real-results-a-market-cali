"""Regression checks for the race-key bug, complete fields, and US transcription."""
import json
from pathlib import Path
import pandas as pd
import pytest
import analysis

ROOT = Path(__file__).resolve().parents[1]

@pytest.fixture
def catalog(tmp_path, monkeypatch):
    races, performances = [], []
    for date, venue, country in [('2017-01-01','HV','HK'),('2017-01-02','ST','HK'),('2017-01-03','S','SG')]:
        races.append(dict(race_date=date,race_location=venue,race_country=country,race_no=1,horse_list='A,B,C',race_class='3',distance=1200,track='Turf'))
        for n,(horse,odds) in enumerate([('A',2),('B',3),('C',4)],1):
            performances.append(dict(race_date=date,race_location=venue,race_id=42,horse_id=horse,horse_name=horse,winning_odds=odds,final_placing=n))
    pd.DataFrame(races).to_csv(tmp_path/'races.csv.gz',index=False)
    pd.DataFrame(performances).to_csv(tmp_path/'performances.csv.gz',index=False)
    monkeypatch.setattr(analysis,'RAW',tmp_path)
    return tmp_path


def test_reused_race_ids_do_not_merge_dates(catalog):
    frame,audit=analysis.load_and_clean()
    assert frame.race_key.nunique()==2
    assert len(frame)==6
    assert set(frame.venue)=={'HV','ST'}
    assert frame.groupby('race_key').won.sum().eq(1).all()
    assert frame.groupby('race_key').fair_implied.sum().to_numpy()==pytest.approx([1,1])
    assert not frame.duplicated(['race_key','horse_id']).any()


def test_incomplete_field_is_excluded_as_a_whole(catalog):
    file=catalog/'performances.csv.gz'
    perf=pd.read_csv(file)
    perf=perf[~(perf.race_location.eq('HV') & perf.horse_id.eq('B'))]
    perf.to_csv(file,index=False)
    frame,audit=analysis.load_and_clean()
    assert set(frame.venue)=={'ST'}
    assert audit['excluded_races']==1


def test_snapshot_rates_reconcile_to_reviewed_runners():
    snapshot=json.loads((ROOT/'docs/data.js').read_text().removeprefix('window.RACING_DATA = ').strip().removesuffix(';'))
    frame=pd.DataFrame(snapshot['rows'],columns=snapshot['columns'])
    findings=json.loads((ROOT/'data/processed/findings.json').read_text())
    bands=pd.read_csv(ROOT/'data/processed/calibration_bands.csv')
    assert len(frame)==findings['rows_analyzed']==int(bands.runners.sum())
    assert frame.race_key.nunique()==findings['races']
    assert frame.groupby('race_key').won.sum().eq(1).all()
    assert frame.groupby('race_key').fair_implied.sum().to_numpy()==pytest.approx([1]*findings['races'])
    roi=(frame.odds*frame.won).mean()-1
    assert roi==pytest.approx(findings['roi'])
    assert (bands.payout.sum()/bands.runners.sum()-1)==pytest.approx(roi)


def test_us_example_is_one_complete_field_with_correct_odds_conversion():
    derby=pd.read_csv(ROOT/'data/examples/kentucky_derby_2024.csv')
    assert len(derby)==20 and derby.program.nunique()==20
    for col in ['quarter','half','three_quarters','mile','stretch','finish']:
        assert sorted(derby[col])==list(range(1,21))
    winner=derby.loc[derby.finish.eq(1)].iloc[0]
    assert winner.horse=='Mystik Dan'
    assert (winner.odds_to_one+1)*2==pytest.approx(39.22)
    favorite=derby.loc[derby.odds_to_one.idxmin()]
    assert favorite.horse=='Fierceness' and favorite.finish==15
