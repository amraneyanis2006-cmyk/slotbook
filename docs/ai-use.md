# AI Use Declaration — Sprint 1

## Tools

- **Claude Code** (Anthropic, model Claude Opus 5.5), used by both students on their own branches. Commits it wrote
  carry `Co-Authored-By: Claude Opus 5.5` (24 of Yanis's commits and 25 of Simeon's up to the merge of PR #15), and
  all seven PR descriptions (#9–#15) end with "Generated with Claude Code".
- **Written prompts and a rule file.** The students drove it with one prompt per Issue and a rule file
  (contract-first, TDD with red/green files, one PR per Issue, no merge without the teammate's approval, no secrets).
- **Independent review subagent.** Before every PR, a separate Claude Code subagent reviewed the diff against the
  Issue's contract and the STS, for at most two rounds. Its findings are summarised in each PR body under
  "Pre-PR self-review".

All accounts and data in the repository are synthetic seed data; no real personal data is involved.

## What the AI did, per Issue

For #1–#4 this table summarises Yanis's PR bodies (#9–#12); for #5–#8 it summarises Simeon's reports and PR bodies.

| Issue / PR | Student | What the AI did |
| :--- | :--- | :--- |
| #1 / #9 Contracts | Yanis | Drafted the SRS, features, traceability, SDS, the F-00..F-06 contracts, the STS and the DoD. Its review subagent found 5 blocking contradictions and 13 wording/traceability gaps; the team decided all 18 (contract v1.1). |
| #2 / #10 F-00 Platform | Yanis | Wrote the failing tests, then the Prisma schema and migration (partial unique index, reference sequence), the idempotent seed, the health endpoint and the Express skeleton. Two self-review rounds (12 findings, fixed). |
| #3 / #11 F-01 + F-02 | Yanis | Tests first, then login/logout/me, `requireAuth`/`requireRole`, the error handler, the access matrix test, the login page and the route guards. Two self-review rounds (10 findings fixed; 2 UI nits left as known limitations). |
| #4 / #12 F-03 Staff slots | Yanis | Tests first, then the slot rules, the locked create-slot transaction, the endpoints and My Slots. Two self-review rounds (findings fixed; 3 nits left, per the PR body). |
| #5 / #13 F-04 Book a slot | Simeon | Tests first (red file saved), then the booking rules, the locked booking transaction in the binding rule order, the two endpoints and `/book`. Two self-review rounds, fixes applied. |
| #6 / #14 F-05 My bookings | Simeon | Tests first, then the my-bookings and cancellation service (row lock, BR-13 then BR-05), the routes and the two pages. Two self-review rounds, fixes applied. |
| #7 / #15 F-06 Schedule + E2E | Simeon | Tests first, then the schedule API and page, E2E-06..08, the 23 demo screenshots (SHOT-01) with `INDEX.md`, and the database read-back script. It also proposed the F-06 §2 summary change (v1.2), which Yanis accepted. |
| #8 Release | Simeon | Wrote the traceability-check script and ran it, ran the clean-clone check and the secrets scan, applied the contract decisions Yanis made for Issue #8, fixed the README, filled the STS "Result" column from the clean-clone run, and drafted this file and `contributions.md`. |

**Screenshot 11** (`artifacts/sprint-1/screenshots/11-late-cancel-no-button.png`) does not come from a booking made through the app. The AI-written spec inserts a booking that starts 75–90 minutes later **directly into the test database**, bypassing the slot rules, so that the shot does not depend on the time of day. It deletes the booking after the shot. `INDEX.md` says so on that row.

## What the humans verified

An AI statement is not evidence (DoD). The humans checked the following. Times are UTC, read from the GitHub API on
2026-11-10 (`submittedAt`, `createdAt` and `lastEditedAt`; earlier versions are in GitHub's edit history). They
show which written records were posted or completed after the merge.

- **Contracts.** Yanis decided every contract point raised by the AI or its review subagent:
  - the 18 points of v1.1 (PR #9);
  - the questions from Issues #5–#7 (SRS A-04, the STS UNIT-04/05, API-23, E2E-06 and §6 wording, the SDS §3.2 example);
  - the F-06 v1.2 change.
  - These decisions are recorded in `docs/sprints/sprint-1/README.md`.
- **Reviews on GitHub.** Each PR was approved by the other student, never by its author. Every approval review
  (#9–#15) has an empty body; the written checks are in separate comments or reviews.
  - **#9–#12 (Simeon):**
    - **Approvals:** on 2026-11-07 at 09:43Z, 09:46Z, 09:49Z and 09:50Z, before each merge (09:47Z, 09:47Z, 09:49Z, 09:51Z), all with an empty body.
    - **Written checks:** posted three days after the merge, on 2026-11-10, as "Comment" reviews: #9 at 08:48:40Z, #10 at 08:49:13Z, #11 at 08:49:35Z, #12 at 08:49:57Z.
    - **What they state:**
      - #9: the role table, rule order and 60 min / 3 bookings / 2 h values are consistent.
      - #10: the partial unique index; seed run twice with the same data; the README followed, with missing steps fixed in Issue #8.
      - #11: the same error for wrong password, unknown e-mail and inactive account; old cookie rejected after logout; a Customer is refused the staff page.
      - #12: row lock before the overlap check; 17:30 accepted and 17:45 refused; the overlap error seen in the browser.
    - **AI help:** Claude Code had collected file:line evidence for these checks earlier the same day.
  - **#13 (Yanis):**
    - **Approval:** at 06:31:50Z, empty body. Merged at 06:36:45Z.
    - **Review comment:** created at 06:31:38Z and ended mid-sentence. Completed after the merge (edited at 08:29:52Z and 08:35:54Z).
    - **What it states now:** one transaction, the slot locked first, the rules in the contract order; the parallel double-booking test; the customer id taken from the login.
  - **#14 (Yanis):**
    - **Approval:** at 06:34:47Z, empty body. Merged at 06:38:59Z.
    - **Review comment:** created at 06:34:38Z with an unfilled template placeholder for its remark. Rewritten after the merge (edited at 08:36:20Z).
    - **What it states now:** the 2-hour cancel check is done on the server; the same "not found" for a missing booking and another customer's booking; a browser try showing the Cancel button only when allowed.
  - **#15 (Yanis):**
    - **Changes requested:** at 06:35:59Z, on commit `4f2cce6`, asking for screenshot 17 to be redone. That first text contained two unfilled template placeholders. Its main points were usable: the screenshot must show the Customer Ploy in the header and the final `/book` page, and match `INDEX.md`.
    - **First approval:** at 06:40:16Z, still on `4f2cce6`, before the new screenshot was pushed (`f25e583`, 06:42:35Z).
    - **Second approval:** at 07:42:25Z on `f25e583`. Both approvals have an empty body. Merged at 07:43:44Z.
    - **After the merge:** the change request was rewritten (edited at 08:24:19Z and 08:36:42Z). It now says the first screenshot 17 did not clearly show the customer or the final page and is fixed, that the schedule shows only the staff member's own slots, and that the pages fit on small screens.
- **Test runs.** Every test total in a PR body comes from a real run whose output is saved in `artifacts/sprint-1/tdd/` (red and green per Issue). The release totals come from the clean-clone run in `artifacts/sprint-1/clean-clone-check.md`.
- **Local setup.** Simeon ran the README setup on a Windows machine (Node 24, npm 12, PostgreSQL 18) and created the database role by hand. That run found the setup gaps fixed in Issue #8.
