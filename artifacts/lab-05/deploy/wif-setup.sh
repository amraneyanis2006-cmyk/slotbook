# Issue #24 - Workload Identity setup script, run by Yanis Amrane (project owner) in Cloud Shell, 2026-11-13.
# Project: cpe334-slotbook-y. Output: wif-setup.txt. Copied unchanged except the project number (<PROJECT_NUMBER>).
# The script computes the project number at run time (PN); it is never typed in.
set -euo pipefail
P=cpe334-slotbook-y; PN=$(gcloud projects describe $P --format='value(projectNumber)'); R=asia-southeast1
DEP=slotbook-deployer@$P.iam.gserviceaccount.com; RUN=slotbook-runner@$P.iam.gserviceaccount.com
REPO_ID=1449165803; OWNER_ID=281914725; GH=amraneyanis2006-cmyk/slotbook
echo "== 6.2 APIs + deployer SA ($PN)"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com --project $P
gcloud iam service-accounts describe $DEP --project $P >/dev/null 2>&1 || gcloud iam service-accounts create slotbook-deployer --display-name="SlotBook GitHub Actions deployer" --project $P
gcloud projects add-iam-policy-binding $P --member=serviceAccount:$DEP --role=roles/run.developer --condition=None --quiet --format='value(etag)'
gcloud artifacts repositories add-iam-policy-binding slotbook --location=$R --project $P --member=serviceAccount:$DEP --role=roles/artifactregistry.writer --format='value(etag)'
gcloud iam service-accounts add-iam-policy-binding $RUN --project $P --member=serviceAccount:$DEP --role=roles/iam.serviceAccountUser --format='value(etag)'
echo "== 6.3 WIF pool + provider"
COND="assertion.repository_id == '$REPO_ID' && assertion.repository_owner_id == '$OWNER_ID' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == '$GH/.github/workflows/deploy.yml@refs/heads/main' && (assertion.sub == 'repo:amraneyanis2006-cmyk@$OWNER_ID/slotbook@$REPO_ID:environment:demo' || assertion.sub == 'repo:$GH:environment:demo')"
gcloud iam workload-identity-pools describe github-actions --location=global --project $P >/dev/null 2>&1 || gcloud iam workload-identity-pools create github-actions --location=global --display-name=github-actions --project $P
gcloud iam workload-identity-pools providers describe github-main --location=global --workload-identity-pool=github-actions --project $P >/dev/null 2>&1 || gcloud iam workload-identity-pools providers create-oidc github-main --location=global --workload-identity-pool=github-actions --display-name=github-main --issuer-uri=https://token.actions.githubusercontent.com/ --attribute-mapping=google.subject=assertion.sub,attribute.repository_id=assertion.repository_id --attribute-condition="$COND" --project $P
gcloud iam service-accounts add-iam-policy-binding $DEP --project $P --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/$PN/locations/global/workloadIdentityPools/github-actions/attribute.repository_id/$REPO_ID" --format='value(etag)'
echo "== CHECK"
gcloud iam workload-identity-pools providers describe github-main --location=global --workload-identity-pool=github-actions --project $P --format='value(name,state,attributeCondition)'
echo "deployer keys (user-managed, must be empty):"; gcloud iam service-accounts keys list --iam-account=$DEP --managed-by=user --project $P
echo "deployer project roles:"; gcloud projects get-iam-policy $P --flatten=bindings --filter="bindings.members:$DEP" --format='value(bindings.role)'
echo "WIF_PROVIDER=projects/$PN/locations/global/workloadIdentityPools/github-actions/providers/github-main"
echo "WIF_SERVICE_ACCOUNT=$DEP"
echo WIF_DONE
