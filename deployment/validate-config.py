"""Validate public deployment metadata and export only checked GitHub outputs."""
import json
import os
from pathlib import Path
import re
import sys


def validate(config, service, source_directory, checkout):
    if not re.fullmatch(r'[a-z][a-z0-9-]{0,47}[a-z0-9]|[a-z]', service):
        raise ValueError('Invalid Cloud Run service name.')
    if config.get('project_id') != 'corinne-portfolio':
        raise ValueError('Expected the corinne-portfolio project.')
    number = str(config.get('project_number') or '')
    expected_provider = f'projects/{number}/locations/global/workloadIdentityPools/corinne-github/providers/github'
    if not number.isdigit() or config.get('workload_identity_provider') != expected_provider:
        raise ValueError('Cloud setup is not activated. Run deployment/bootstrap-google-cloud.sh in Cloud Shell, then add its non-secret JSON to deployment/cloud-config.json.')
    expected = {
        'deployer_service_account': 'corinne-github-deployer@corinne-portfolio.iam.gserviceaccount.com',
        'build_service_account': 'projects/corinne-portfolio/serviceAccounts/corinne-source-builder@corinne-portfolio.iam.gserviceaccount.com',
        'runtime_service_account': 'corinne-app-runtime@corinne-portfolio.iam.gserviceaccount.com',
        'region': 'us-central1',
    }
    for key, value in expected.items():
        if config.get(key) != value:
            raise ValueError(f'Unexpected {key}; review shared identity settings before deployment.')
    checkout = Path(checkout).resolve()
    source = (checkout / source_directory).resolve()
    if source != checkout and checkout not in source.parents:
        raise ValueError('Source directory must stay inside the calling repository.')
    if not source.is_dir():
        raise ValueError('Source directory does not exist.')
    return {**config, 'source': str(source)}


if __name__ == '__main__':
    try:
        values = validate(json.loads(Path(sys.argv[1]).read_text()),
                          os.environ['SERVICE_NAME'], os.environ['SOURCE_DIRECTORY'], Path('app'))
    except (ValueError, KeyError) as error:
        raise SystemExit(f'Deployment configuration error: {error}')
    with open(os.environ['GITHUB_OUTPUT'], 'a') as handle:
        for key, value in values.items():
            if '\n' in str(value) or '\r' in str(value):
                raise SystemExit('Multiline configuration values are not allowed.')
            handle.write(f'{key}={value}\n')
