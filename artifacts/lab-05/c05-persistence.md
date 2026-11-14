# Branch:  docs/26-persistence-rollback
# Commit:  d44a9be (Merge pull request #39 from amraneyanis2006-cmyk/docs/25-c06-evidence)
# Date:    2026-11-14 16:24:39 +0700
# Command: gh workflow run deploy.yml --ref main -f image_tag=<tag>; gh run watch <run> --exit-status; gh run view <run> --log (excerpts); curl -s https://slotbook-mivepbjoza-as.a.run.app/api/version; Cloud Shell (human): gcloud run services update ..., gcloud artifacts docker images list ... --include-tags

# C-05: persistence, rollback and roll forward (Issue #26, R-04)

The data lives in Cloud SQL (`slotbook-pg`), not in the container. A booking made on the public URL must survive
a restart, a redeploy, a rollback to an older image and a roll forward. Every step below kept it.

- Public URL: https://slotbook-mivepbjoza-as.a.run.app
- Demo user: seeded Customer Nina Park. The human signed in; no password was shared or captured.
- Booking: **BK-2026-000006**, Sun 15 Nov 2026 09:00–09:30, Academic advising, staff Anan Wong, status Booked.
- Release 2 SHA: `82bc8b786d836a8ade7f8b406c6efd7d51c0d113`, digest `sha256:370c2e905d3a99138b24a4d40252cccd87206146e1851ed5e4a0407b75958685`.
- Release 1 image (`latest`, built by `deploy.sh` from `3845f83` before `/api/version` existed): digest
  `sha256:f696ce9dc31fe06219e1b6343f7c243f24dc868140196e7f5b934b90e2e15c54`.

## Available tags (read-only, Cloud Shell, run by the human before the rollback)

`gcloud artifacts docker images list asia-southeast1-docker.pkg.dev/cpe334-slotbook-y/slotbook/slotbook --include-tags`

| Digest | Tags | Created (UTC) |
|---|---|---|
| `sha256:f696ce9dc31f…` | `latest` | 2026-11-12T18:16:35 |
| `sha256:370c2e905d3a…` | `82bc8b786d836a8ade7f8b406c6efd7d51c0d113` | 2026-11-14T07:38:54 |
| `sha256:22ac44747cb5…` | (none: 1473 bytes, build attestation/index from the docker push) | 2026-11-14T07:38:53 |
| `sha256:ad407e6721e0…` | (none: platform image under the tagged index) | 2026-11-14T07:38:53 |

## Steps

Times are UTC. The screenshots show the local clock (UTC+7).

| # | Step | Who / how | Time (UTC) | Revision | Image | `/api/version` | Footer | Booking | Screenshot |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Before: book a slot | human, browser | ~08:12 | `slotbook-00002-fmw` | Release 2 `82bc8b7` | commit `82bc8b7…`, revision `slotbook-00002-fmw` | Release 82bc8b7 | BK-2026-000006 created | `screenshots/issue-26/c05-1-before.png` |
| 2 | Restart (new revision, no code change) | human, Cloud Shell: `gcloud run services update slotbook --region asia-southeast1 --update-env-vars RESTARTED_AT=20261114T1500` | ~09:10 | `slotbook-00003-np2` | Release 2 (unchanged) | commit `82bc8b7…`, revision `slotbook-00003-np2` (checked 09:11:29) | Release 82bc8b7 | still there | `screenshots/issue-26/c05-2-after-restart.png` |
| 3 | Redeploy the current SHA | Claude: `gh workflow run deploy.yml --ref main -f image_tag=82bc8b786d836a8ade7f8b406c6efd7d51c0d113`, run [43579388131](https://github.com/amraneyanis2006-cmyk/slotbook/actions/runs/43579388131) (09:11:43 → 09:12:34, test skipped, deploy success) | 09:12 | `slotbook-00004-dpc` | `sha256:370c2e90…` | commit `82bc8b7…`, revision `slotbook-00004-dpc` | Release 82bc8b7 | still there | `screenshots/issue-26/c05-3-after-redeploy.png` |
| 4 | Rollback to Release 1 | Claude: `gh workflow run deploy.yml --ref main -f image_tag=latest`, run [43579900715](https://github.com/amraneyanis2006-cmyk/slotbook/actions/runs/43579900715) (09:18:10 → 09:18:56, test skipped, migration skipped, deploy success) | 09:18 | `slotbook-00005-srt` | `sha256:f696ce9d…` (`latest`) | **HTTP 404**: the old code is running; `/api/health` = `{"status":"ok","database":"up"}` | **no Release line** | still there | `screenshots/issue-26/c05-4-after-rollback.png` |
| 5 | Roll forward to Release 2 | Claude: `gh workflow run deploy.yml --ref main -f image_tag=82bc8b786d836a8ade7f8b406c6efd7d51c0d113`, run [43580291684](https://github.com/amraneyanis2006-cmyk/slotbook/actions/runs/43580291684) (09:23:00 → 09:23:50, test skipped, deploy success) | 09:23 | `slotbook-00006-vkw` | `sha256:370c2e90…` | commit `82bc8b786d836a8ade7f8b406c6efd7d51c0d113`, revision `slotbook-00006-vkw` (checked 09:24:20) | Release 82bc8b7 | still there | `screenshots/issue-26/c05-5-after-rollforward.png` |

The smoke test in each of the runs 3–5 printed `PASS /api/health`, `PASS /api/ready`, `PASS /`, `PASS /api/services`
and `SKIP sign-in: optional smoke credentials not configured`. In run 4, `deploy.yml` skipped "Check the running
commit" (`IMAGE_TAG` = `latest`).

## Result

C-05 passed. Booking BK-2026-000006 survived a restart (revision 00003), a redeploy (00004), a rollback to the
Release 1 image (00005) and a roll forward to Release 2 (00006). The rollback changed only the image: no
migration ran, and the newer schema in Cloud SQL still worked with the Release 1 code (`/api/ready` PASS, booking
listed). The service URL printed by `gcloud run services update` (the deterministic form that contains the project
number) is not copied here. Only the public URL above is used.

# Exit code: 0
