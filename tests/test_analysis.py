"""Verify the complete US race, checkpoint transcription, probabilities and payouts."""
import json
from pathlib import Path
import pytest
import analysis
ROOT=Path(__file__).resolve().parents[1]

def test_complete_derby_field():
    data=analysis.build_snapshot()
    assert data['meta']['country']=='USA'
    assert data['meta']['track']=='Churchill Downs'
    assert len(data['us'])==20
    assert len({h['program'] for h in data['us']})==20
    for checkpoint in ['quarter','half','three_quarters','mile','stretch','finish']:
        assert sorted(h[checkpoint] for h in data['us'])==list(range(1,21))

def test_odds_conversion_and_full_field_normalization():
    horses=analysis.build_snapshot()['us']
    assert sum(h['fair_implied'] for h in horses)==pytest.approx(1)
    for horse in horses:
        assert horse['decimal_odds']==horse['odds_to_one']+1
        assert horse['raw_implied']==pytest.approx(1/horse['decimal_odds'])
    assert max(horses,key=lambda h:h['fair_implied'])['horse']=='Fierceness'

def test_official_winner_and_payout_reconcile():
    horses=analysis.build_snapshot()['us']
    winner=next(h for h in horses if h['finish']==1)
    assert winner['horse']=='Mystik Dan' and winner['market_rank']==7
    assert winner['return_per_2']==pytest.approx(39.22)
    assert next(h for h in horses if h['market_rank']==1)['finish']==15
    assert sum(h['return_per_2'] for h in horses)==pytest.approx(39.22)

def test_published_snapshot_matches_rebuild():
    snapshot=json.loads((ROOT/'docs/data.js').read_text().removeprefix('window.RACING_DATA = ').strip().removesuffix(';'))
    assert snapshot==analysis.build_snapshot()
