"""Validate trust setup without contacting Google or creating credentials."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import pytest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('deployment_config',ROOT/'deployment/validate-config.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)


def test_unactivated_configuration_cannot_deploy(tmp_path):
    config=json.loads((ROOT/'deployment/cloud-config.json').read_text())
    config['project_number']=None
    config['workload_identity_provider']=None
    with pytest.raises(ValueError,match='not activated'):
        module.validate(config,'portfolio-app','.',tmp_path)


def test_source_cannot_escape_checkout(tmp_path):
    config=json.loads((ROOT/'deployment/cloud-config.json').read_text())
    config['project_number']='123456'
    config['workload_identity_provider']='projects/123456/locations/global/workloadIdentityPools/corinne-github/providers/github'
    with pytest.raises(ValueError,match='inside'):
        module.validate(config,'portfolio-app','..',tmp_path)
    assert module.validate(config,'portfolio-app','.',tmp_path)['source']==str(tmp_path.resolve())


@pytest.mark.parametrize('existing',[False,True])
def test_bootstrap_new_and_existing_setup_without_keys(tmp_path,existing):
    stub=tmp_path/'gcloud'
    stub.write_text('''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
args=sys.argv[1:]
with open(os.environ['GCLOUD_LOG'],'a') as f:f.write(json.dumps(args)+'\\n')
if args[:2]==['projects','describe']:
 print('123456');sys.exit(0)
if 'describe' in args:
 if os.environ['EXISTING']=='0':sys.exit(1)
 if 'providers' in args:
  print(json.dumps({'oidc':{'issuerUri':'https://token.actions.githubusercontent.com'},
   'attributeCondition':"assertion.repository_owner_id == '290819854' && assertion.ref == 'refs/heads/main' && assertion.event_name in ['push', 'workflow_dispatch']",
   'attributeMapping':{'google.subject':'assertion.sub','attribute.repository':'assertion.repository',
    'attribute.repository_owner_id':'assertion.repository_owner_id','attribute.ref':'assertion.ref','attribute.event_name':'assertion.event_name'}}))
sys.exit(0)
''')
    stub.chmod(0o755)
    logfile=tmp_path/'calls.jsonl'
    env={**os.environ,'PATH':str(tmp_path)+os.pathsep+os.environ['PATH'],
         'GCLOUD_LOG':str(logfile),'EXISTING':str(int(existing))}
    result=subprocess.run(['bash',str(ROOT/'deployment/bootstrap-google-cloud.sh')],env=env,capture_output=True,text=True,check=True)
    config=json.loads(result.stdout)
    assert config['project_number']=='123456'
    assert config['workload_identity_provider'].endswith('/corinne-github/providers/github')
    calls=[json.loads(line) for line in logfile.read_text().splitlines()]
    assert not any('keys' in call for call in calls)
    assert not any('--role=roles/owner' in call or '--role=roles/editor' in call for call in calls)
    bindings=[c for c in calls if 'add-iam-policy-binding' in c]
    assert any('roles/iam.workloadIdentityUser' in ' '.join(c) and '/attribute.repository_owner_id/290819854' in ' '.join(c) for c in bindings)
    if existing:
        assert not any('create-oidc' in call for call in calls)
    else:
        provider=next(c for c in calls if 'create-oidc' in c)
        condition=next(arg for arg in provider if arg.startswith('--attribute-condition='))
        assert "refs/heads/main" in condition and "290819854" in condition
    module.validate(config,'portfolio-app','.',tmp_path)
