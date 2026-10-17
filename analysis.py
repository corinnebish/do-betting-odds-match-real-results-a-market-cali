"""Rebuild the USA-only Kentucky Derby snapshot from its attributed source records."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'data/processed'
SOURCE = ROOT / 'data/examples/kentucky_derby_2026.csv'


def build_snapshot():
    with SOURCE.open() as handle:
        horses = list(csv.DictReader(handle))
    for horse in horses:
        for key in ['program', 'finish', 'quarter', 'half', 'three_quarters', 'mile', 'stretch']:
            horse[key] = int(horse[key])
        horse['odds_to_one'] = float(horse['odds_to_one'])
        horse['decimal_odds'] = horse['odds_to_one'] + 1
        horse['raw_implied'] = 1 / horse['decimal_odds']
    if len(horses) != 18 or len({h['program'] for h in horses}) != 18:
        raise ValueError('The Derby source must contain 18 unique starters.')
    for column in ['finish', 'quarter', 'half', 'three_quarters', 'mile', 'stretch']:
        if sorted(h[column] for h in horses) != list(range(1, 19)):
            raise ValueError(f'Incomplete or duplicated checkpoint: {column}')
    total = sum(h['raw_implied'] for h in horses)
    for horse in horses:
        horse['fair_implied'] = horse['raw_implied'] / total
        horse['market_rank'] = 1 + sum(h['odds_to_one'] < horse['odds_to_one'] for h in horses)
        horse['return_per_2'] = horse['decimal_odds'] * 2 if horse['finish'] == 1 else 0
    source = json.loads((ROOT / 'data/examples/source.json').read_text())
    source['sha256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    return {'us': sorted(horses, key=lambda h: h['finish']), 'source': source,
            'meta': {'country': 'USA', 'track': 'Churchill Downs', 'race': '2026 Kentucky Derby',
                     'date': '2026-05-02', 'horses': 18, 'races': 1,
                     'raw_probability_total': total,
                     'scope': 'One race. Descriptive comparison, not a market-calibration study.'}}


def main():
    snapshot = build_snapshot()
    OUT.mkdir(parents=True, exist_ok=True)
    (ROOT / 'docs/data.js').write_text('window.RACING_DATA = ' + json.dumps(snapshot, separators=(',', ':'), allow_nan=False) + ';\n')
    (OUT / 'findings.json').write_text(json.dumps(snapshot['meta'], indent=2))
    with (OUT / 'derby_runners.csv').open('w', newline='') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(snapshot['us'][0]), lineterminator='\n')
        writer.writeheader(); writer.writerows(snapshot['us'])
    print('Built 18 Kentucky Derby horse records at Churchill Downs, USA.')


if __name__ == '__main__':
    main()
