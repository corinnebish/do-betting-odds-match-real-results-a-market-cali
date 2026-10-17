# One keyless Google Cloud connection for Corinne's repositories

This setup lets GitHub Actions in repositories owned by GitHub account **corinnebish (numeric owner ID 290819854)** obtain short-lived Google Cloud credentials. It covers current and future repositories. It does not give this chat a Google login, and it does not export or store a service-account private key.

## Activate once

1. Sign in to [Google Cloud Shell in corinne-portfolio](https://console.cloud.google.com/home/dashboard?project=corinne-portfolio&cloudshell=true) using an account allowed to enable APIs, create service accounts and identity providers, and grant project IAM roles.
2. Download the reviewed `bootstrap-google-cloud.sh` from this repository and run `bash bootstrap-google-cloud.sh`.
3. Approve Google's Cloud Shell authorization if prompted.
4. The script finishes by printing a small JSON object. Send **that configuration JSON** to Codex; it contains the public project number and identity resource names, not a password, token or private key.
5. Codex puts the returned JSON in `deployment/cloud-config.json` and activates the GitHub workflow. IAM propagation can take several minutes.

The committed configuration deliberately has no project number until step 4. Authentication and deployment cannot be verified before the Cloud Shell step is complete.

## What access is granted

- Trust accepts GitHub tokens for numeric repository owner **290819854**, the **main** branch, and **push** or **workflow_dispatch** events. Forks owned by other accounts and pull-request events do not match.
- `corinne-github-deployer` gets Cloud Run Source Developer and Service Usage Consumer on **corinne-portfolio**, plus Service Account User on the dedicated build and runtime identities. It does not receive Owner, Editor, project IAM administration, or permission to change service public-access policies.
- `corinne-source-builder` gets Cloud Run Builder on the project.
- `corinne-app-runtime` gets no project roles. Apps requiring access to other Google APIs must use a reviewed runtime identity with only the required permissions.
- The GitHub owner-wide trust can impersonate only the dedicated deployment identity via Workload Identity User. It does not grant each repository a general administrator account.
- Existing public Cloud Run services remain public. New services are private by default; publishing one publicly requires an explicit Google Cloud access-policy change by an authorized administrator.

A member who can edit trusted main-branch workflow code can use the shared deployer's project deployment permissions. This is an account-wide deployment connection as requested, not isolation between Corinne's repositories. New identities are separate from existing application identities.

## Enable deployment in another repository

The shared connection makes every repo eligible; each app still needs a deployment workflow and a Cloud Run-compatible source folder. It does **not** migrate static sites or change existing hosting just by granting access.

Add `.github/workflows/deploy.yml` in an app repository, using its intended Cloud Run service name:

```yaml
name: Deploy application
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
  id-token: write
jobs:
  deploy:
    uses: corinnebish/do-betting-odds-match-real-results-a-market-cali/.github/workflows/cloud-run-reusable.yml@main
    with:
      service: your-existing-cloud-run-service
      source_directory: .
```

Add the app's existing test job before deployment as appropriate. The shared workflow checks out the calling repo as `app/` and the central configuration separately, so generated authentication files are outside the submitted source folder. Source paths cannot escape the app checkout. The central workflow explicitly selects the dedicated build and runtime service accounts.

The racing repository is the first wired consumer. Its current Cloud Run service name and limits are retained. Other repositories retain their current workflows and hosting until configured for their specific application.

## Rollback and sources

To disable this connection, disable the `github` provider in the `corinne-github` workload identity pool, or remove its Workload Identity User binding on `corinne-github-deployer`. Removing a deployer role from the project stops deployment permissions without changing app data.

The bootstrap script is safe to rerun for its own resources. It rejects a pre-existing identity provider whose issuer, conditions, mappings or enabled status differ rather than silently replacing its trust policy. Commands require the signed-in Cloud Shell administrator; there is no automatic elevation.

- [Google GitHub Actions authentication](https://github.com/google-github-actions/auth)
- [Google Cloud Run source deployment permissions](https://docs.cloud.google.com/run/docs/deploying-source-code)
- [Workload Identity Federation for deployment pipelines](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)
