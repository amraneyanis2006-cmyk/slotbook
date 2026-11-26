# Contributions — Sprint 1

Facts taken from GitHub on 2026-11-10 (`gh issue list --state all`, `gh pr list --state all`, and the reviews and comments of each PR with their GitHub API dates, UTC).
Team EN-036 "Y Que Fue": Yanis Amrane (`amraneyanis2006-cmyk`) and Simeon Audouit (`simeon-94`).

| Student | Issues authored (assignee and PR author) | PRs authored | PRs reviewed | Pair work |
| :--- | :--- | :--- | :--- | :--- |
| Yanis Amrane | #1 contracts, #2 F-00 platform, #3 F-01 + F-02 auth and access, #4 F-03 staff slots; created all eight Sprint 1 Issues (#1–#8) | #9, #10, #11, #12 | #13, #14, #15 (one round of changes requested on #15, approved after the fix) | None recorded on GitHub; decided the contract questions raised during #5–#7 (applied in Issue #8) |
| Simeon Audouit | #5 F-04 book a slot, #6 F-05 my bookings, #7 F-06 schedule + E2E/responsive/a11y/screenshots, #8 release | #13, #14, #15, #16 | #9, #10, #11, #12 | None recorded on GitHub; raised those contract questions |

## Pull requests (all into `sprint-1-staging`)

| PR | Issue | Author | Reviewer and decision | Merged |
| :--- | :--- | :--- | :--- | :--- |
| #9 | #1 Product docs (SRS, features, traceability, SDS, plan) + Sprint 1 contracts | Yanis | Simeon: approved 2026-11-07 09:43Z (empty body); written review comment posted after the merge, 2026-11-10 08:48Z | 2026-11-07 |
| #10 | #2 F-00 Platform foundation | Yanis | Simeon: approved 2026-11-07 09:46Z (empty body); written review comment posted after the merge, 2026-11-10 08:49Z | 2026-11-07 |
| #11 | #3 F-01 + F-02 Authentication and access control | Yanis | Simeon: approved 2026-11-07 09:49Z (empty body); written review comment posted after the merge, 2026-11-10 08:49Z | 2026-11-07 |
| #12 | #4 F-03 Staff publishes slots | Yanis | Simeon: approved 2026-11-07 09:50Z (empty body); written review comment posted after the merge, 2026-11-10 08:49Z | 2026-11-07 |
| #13 | #5 F-04 Browse and book a slot | Simeon | Yanis: approved 06:31Z (empty body); review comment posted 06:31Z, ending mid-sentence, completed after the merge (last edit 08:35Z) | 2026-11-10 |
| #14 | #6 F-05 My bookings and cancellation | Simeon | Yanis: approved 06:34Z (empty body); review comment posted 06:34Z with a template placeholder, rewritten after the merge (08:36Z) | 2026-11-10 |
| #15 | #7 F-06 Staff schedule + Sprint 1 E2E, responsive/a11y, screenshots | Simeon | Yanis: changes requested 06:35Z (screenshot 17; text with template placeholders, rewritten after the merge, last edit 08:36Z); approved 06:40Z before the new screenshot and again 07:42Z after it (both empty bodies) | 2026-11-10 |
| #16 | #8 Sprint 1 release | Simeon | Yanis | (open) |

Every PR was reviewed by the student who did not write it, and only the author's teammate approved it. AI
assistance is declared in [`ai-use.md`](ai-use.md).

---

# Contributions — Sprint 2 and Deliverable 2

Facts taken from GitHub on 2026-11-25 (PRs #64–#73, their reviews and merge records, UTC). Code and tests were
written with Claude (see [`ai-use.md`](ai-use.md), Sprint 2 section); the split below is the agreed ownership of
each feature (commit author, PR opener) and who reviewed it.

| Student | Issues owned | PRs opened | PRs reviewed and approved |
| :--- | :--- | :--- | :--- |
| Yanis Amrane | #49 contracts, #50 F-10, #51 F-11, #54 F-08, #56 release, #57 Sprint 3 contracts, #58 F-15; created Issues #49–#63 | #64, #65, #66, #69, #71, #72, #73 | #67, #68, #70 |
| Simeon Audouit | #52 F-07, #53 F-09, #55 F-12 | #67, #68, #70 | #64, #65, #66, #69, #71, #72, #73 |

## Pull requests (all into `staging`, merge commits)

| PR | Issue | Opened by | Approved by (UTC) | Merged (UTC) by |
| :--- | :--- | :--- | :--- | :--- |
| #64 | #49 Sprint 2 contracts, STS, DoD | Yanis | Simeon 11:01 | 11:04, Yanis |
| #65 | #50 F-10 Booking history | Yanis | Simeon 14:17 | 14:18, Yanis |
| #66 | #51 F-11 Service catalogue + A-04 | Yanis | Simeon 14:21 | 14:22, Yanis |
| #67 | #52 F-07 Slot maintenance | Simeon | Yanis 14:41 | 14:45, Simeon |
| #68 | #53 F-09 Attendance outcome | Simeon | Yanis 14:52 | 14:52, Simeon |
| #69 | #54 F-08 Reschedule | Yanis | Simeon 14:56 | 14:58, Yanis |
| #70 | #55 F-12 Slot search + NFR-11 | Simeon | Yanis 15:01 | 15:05, Simeon |
| #71 | #57 Sprint 3 contracts | Yanis | Simeon 15:07 | 15:09, Yanis |
| #72 | #58 F-15 Staff dashboard | Yanis | Simeon 15:10 | 15:11, Yanis |
| #73 | #56 Sprint 2 release preparation | Yanis | Simeon (to re-review after the STS results commit) | open |

Every PR was approved by the student who did not open it. Issues close when `staging` is released to `main`.

---

# Contributions — Sprint 3 and Final Release

Facts taken from GitHub on 2026-11-26 (PRs #77–#80, their reviews and merge records, UTC). Code and tests were
written with Claude (see [`ai-use.md`](ai-use.md), Sprint 3 section); the split is the agreed ownership of each
feature (commit author, PR opener) and who reviewed it.

| Student | Issues owned | PRs opened | PRs reviewed and approved |
| :--- | :--- | :--- | :--- |
| Yanis Amrane | #60 F-16, #62 F-18 (pair, implemented by Yanis), #63 final release | #79, #80, release PRs | #77, #78 |
| Simeon Audouit | #59 F-14, #61 F-17 | #77, #78 | #79, #80, release PRs |

## Pull requests (all into `staging`, merge commits)

| PR | Issue | Opened by | Approved by (UTC), on commit | Merged (UTC) by |
| :--- | :--- | :--- | :--- | :--- |
| #77 | #61 F-17 Accounts and no-show policy | Simeon 05:30 | Yanis 05:36, `155c89d` | 05:37, Yanis |
| #78 | #59 F-14 Availability templates | Simeon 05:31 | Yanis 05:35, `8eb3d25` | 05:39, Yanis |
| #79 | #60 F-16 In-app notifications | Yanis 05:39 | Simeon 05:41, `b6c15d0` | 05:42, Yanis |
| #80 | #62 F-18 Product hardening | Yanis 05:42 | Simeon 05:49, `fcde4e4` (after the branch update from `staging`) | 05:49, Yanis |

Every PR was approved, with a written review, by the student who did not open it, on the exact head that was
merged; both required checks (`test-and-docker`, `e2e`) were green before each merge. The merges were run by
Claude Code on Yanis's computer when Yanis asked for them, after checking the approval and the checks.
