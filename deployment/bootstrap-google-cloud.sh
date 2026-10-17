#!/usr/bin/env bash
# Run once in Google Cloud Shell, signed in to a project administrator account.
# No service-account keys, GitHub tokens, passwords, or exported credentials.
set -euo pipefail

project_id='corinne-portfolio'
owner_id='290819854'
pool_id='corinne-github'
provider_id='github'
deployer_id='corinne-github-deployer'
builder_id='corinne-source-builder'
runtime_id='corinne-app-runtime'
region='us-central1'

command -v gcloud >/dev/null || { echo 'Run this script in Google Cloud Shell.' >&2; exit 1; }
command -v python3 >/dev/null || { echo 'Python 3 is required.' >&2; exit 1; }

echo 'Setting up keyless deployment for repositories owned by corinnebish.' >&2
echo 'Target: corinne-portfolio. Trusted events: main-branch push and manual runs.' >&2
project_number="$(gcloud projects describe "$project_id" --format='value(projectNumber)')"
[[ "$project_number" =~ ^[0-9]+$ ]] || { echo 'Could not resolve the Google Cloud project number.' >&2; exit 1; }

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com \
  sts.googleapis.com cloudresourcemanager.googleapis.com run.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com logging.googleapis.com \
  --project="$project_id" --quiet --format=none

for account_id in "$deployer_id" "$builder_id" "$runtime_id"; do
  email="${account_id}@${project_id}.iam.gserviceaccount.com"
  if ! gcloud iam service-accounts describe "$email" --project="$project_id" --format=none >/dev/null 2>&1; then
    gcloud iam service-accounts create "$account_id" --project="$project_id" \
      --display-name="$account_id" --quiet --format=none
  fi
done

deployer_email="${deployer_id}@${project_id}.iam.gserviceaccount.com"
builder_email="${builder_id}@${project_id}.iam.gserviceaccount.com"
runtime_email="${runtime_id}@${project_id}.iam.gserviceaccount.com"

# Dedicated deployment and build identities; the runtime identity receives no project roles.
for role in roles/run.sourceDeveloper roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "$project_id" \
    --member="serviceAccount:${deployer_email}" --role="$role" \
    --condition=None --quiet --format=none
done
gcloud projects add-iam-policy-binding "$project_id" \
  --member="serviceAccount:${builder_email}" --role=roles/run.builder \
  --condition=None --quiet --format=none
for target in "$builder_email" "$runtime_email"; do
  gcloud iam service-accounts add-iam-policy-binding "$target" --project="$project_id" \
    --member="serviceAccount:${deployer_email}" --role=roles/iam.serviceAccountUser \
    --quiet --format=none
done

if ! gcloud iam workload-identity-pools describe "$pool_id" --project="$project_id" \
  --location=global --format=none >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create "$pool_id" --project="$project_id" \
    --location=global --display-name='Corinne GitHub deployments' --quiet --format=none
fi

mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.event_name=assertion.event_name'
condition="assertion.repository_owner_id == '${owner_id}' && assertion.ref == 'refs/heads/main' && assertion.event_name in ['push', 'workflow_dispatch']"
if provider_json="$(gcloud iam workload-identity-pools providers describe "$provider_id" \
  --project="$project_id" --location=global --workload-identity-pool="$pool_id" --format=json 2>/dev/null)"; then
  # Do not silently replace a pre-existing provider with a different trust policy.
  python3 - "$condition" "$provider_json" <<'PY'
import json, sys
provider=json.loads(sys.argv[2])
expected={'google.subject':'assertion.sub','attribute.repository':'assertion.repository',
          'attribute.repository_owner_id':'assertion.repository_owner_id',
          'attribute.ref':'assertion.ref','attribute.event_name':'assertion.event_name'}
if (provider.get('oidc',{}).get('issuerUri')!='https://token.actions.githubusercontent.com'
    or provider.get('attributeCondition')!=sys.argv[1]
    or any(provider.get('attributeMapping',{}).get(k)!=v for k,v in expected.items())
    or provider.get('disabled')):
    raise SystemExit('Existing provider differs from the expected GitHub trust. Stop and inspect it before continuing.')
PY
else
  gcloud iam workload-identity-pools providers create-oidc "$provider_id" \
    --project="$project_id" --location=global --workload-identity-pool="$pool_id" \
    --display-name='Corinne GitHub Actions' \
    --issuer-uri='https://token.actions.githubusercontent.com' \
    --attribute-mapping="$mapping" --attribute-condition="$condition" \
    --quiet --format=none
fi

pool_name="projects/${project_number}/locations/global/workloadIdentityPools/${pool_id}"
gcloud iam service-accounts add-iam-policy-binding "$deployer_email" --project="$project_id" \
  --member="principalSet://iam.googleapis.com/${pool_name}/attribute.repository_owner_id/${owner_id}" \
  --role=roles/iam.workloadIdentityUser --quiet --format=none

echo 'Setup complete. Send the JSON below to Codex. It contains configuration, not credentials.' >&2
echo 'New IAM permissions can take a few minutes to propagate.' >&2
python3 - "$project_id" "$project_number" "$pool_name/providers/$provider_id" \
  "$deployer_email" "$builder_email" "$runtime_email" "$region" <<'PY'
import json,sys
project,number,provider,deployer,builder,runtime,region=sys.argv[1:]
print(json.dumps({'project_id':project,'project_number':number,
 'workload_identity_provider':provider,'deployer_service_account':deployer,
 'build_service_account':f'projects/{project}/serviceAccounts/{builder}',
 'runtime_service_account':runtime,'region':region},indent=2))
PY
