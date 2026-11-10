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

An AI statement is not evidence (DoD). Before merging, the humans checked the following:

- **Contracts.** Yanis decided every contract point raised by the AI or its review subagent:
  - the 18 points of v1.1 (PR #9);
  - the questions from Issues #5–#7 (SRS A-04, the STS UNIT-04/05, API-23, E2E-06 and §6 wording, the SDS §3.2 example);
  - the F-06 v1.2 change.
  - These decisions are recorded in `docs/sprints/sprint-1/README.md`.
- **Reviews on GitHub.** Each PR was approved by the other student, never by its author.
  - **#13 and #14:** Yanis posted review comments listing these checks. The #13 comment ends mid-sentence, and the #14 comment still contains an unfilled template placeholder for its remark:
    - the transaction and row-lock order in `book()` and `cancel()`;
    - the 60 min / 3 bookings / 2 h constants and their boundary tests;
    - the P2002 → 409 mapping and the API-17 race;
    - `customerId` ignored;
    - 404 for another customer's booking;
    - the route order;
    - a manual try of `/bookings` and cancellation in the browser.
  - **#15:** Yanis requested that screenshot 17 be redone, so that it shows the Customer and the final `/book` page. The request still contains two unfilled template placeholders. Yanis approved twice: at 06:40Z, before the new screenshot was pushed, and again at 07:42Z, after it. Both approvals have an empty body.
  - **#9–#12:** Simeon approved them on 2026-11-07 without a written review comment. On 2026-11-10 Claude Code collected file:line evidence from the merged code for written comments on these PRs; none had been posted when this file was written.
- **Test runs.** Every test total in a PR body comes from a real run whose output is saved in `artifacts/sprint-1/tdd/` (red and green per Issue). The release totals come from the clean-clone run in `artifacts/sprint-1/clean-clone-check.md`.
- **Local setup.** Simeon ran the README setup on a Windows machine (Node 24, npm 12, PostgreSQL 18) and created the database role by hand. That run found the setup gaps fixed in Issue #8.
