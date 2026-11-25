# F-16 — In-App Notifications (Sprint 3 contract)

| Field | Value |
| :--- | :--- |
| Linked requirements | FR-21, BR-08, BR-09, BR-17, NFR-09 |
| Issue / owner / reviewer | Issue #60 — Yanis Amrane (author), Simeon Audouit (reviewer) |
| Depends on | F-07 (staff cancellation), F-10 (history writer), F-17 (deactivation cancels bookings) |
| Contract version | 1.0 (2026-11-25) — history in §8 |

## 1. Behavior and Workflow

1. A notification is created for the **customer** of a booking whenever a **Staff member** changes that
   booking's status: staff slot cancellation (F-07), outcome recorded (F-09), cancellation by account
   deactivation (F-17). A change made by the customer creates no notification.
2. It is written by `recordStatusChange` (F-10) **in the same transaction** as the history row, when the
   actor is a Staff member, so a change and its notification commit together.
3. The header shows a **Notifications** link with the unread count ("Notifications (2)"); `/notifications`
   lists them newest first: message, time, link to the booking, **Mark as read**, and **Mark all as read**.
4. Messages: "Your booking BK-… on Tue 2 Dec 2026, 10:30 was cancelled by Anan Wong: <reason>.",
   "Your booking BK-… on … was recorded as No-show." (or "Completed"). Times in Asia/Bangkok (NFR-10).

## 2. Pure Rule Function

`notificationFor(change, booking, actor)` in `server/src/rules/notificationRules.ts` → `null | { userId,
message }`: `null` when the actor is the customer; otherwise the message of §1 step 4 for `to = CANCELLED`,
`COMPLETED` or `NO_SHOW`.

## 3. API

| Method and path | Request | Success | Errors |
| :--- | :--- | :--- | :--- |
| `GET /api/notifications` | — | `200 { "notifications": [{ id, message, bookingReference, createdAt, readAt }], "unread": 2 }` own only, newest first, last 50 | 401, 403 (Staff) |
| `POST /api/notifications/:id/read` | `{}` | `200 { "notification": … }` | 401, 403, 404 (missing or another customer's) |
| `POST /api/notifications/read-all` | `{}` | `200 { "unread": 0 }` | 401, 403 |

## 4. UI

Header link with the unread count (`aria-label="Notifications, 2 unread"`), refreshed on navigation;
`/notifications` page with the list (unread in bold with the text "Unread"), buttons, empty state "No
notifications yet.", loading and error states.

## 5. Data

New table `Notification (id, userId FK, bookingId FK, message varchar(300), createdAt, readAt nullable)`, index
`(userId, createdAt)`.

## 6. Acceptance Criteria

| AC | Criterion |
| :--- | :--- |
| AC-76 | A staff cancellation, an outcome and a deactivation cancellation each create exactly one notification for the customer in the same transaction; a customer's own cancellation or reschedule creates none. |
| AC-77 | `GET /api/notifications` returns only the caller's notifications newest first with the unread count; marking one or all as read updates `readAt`; another customer's id → 404; Staff → 403. |
| AC-78 | UI: after Staff cancels a booked slot, the customer sees "Notifications (1)" in the header, opens the page, reads the message with the reason and marks it as read; the count disappears. |

## 7. Failure / Boundary Cases

A notification whose booking was later rescheduled (link still opens the old booking), more than 50
notifications (last 50 returned, unread count over all), marking an already read notification (200, unchanged).

## 8. Version History

| Version | Date | Author | Change |
| :--- | :--- | :--- | :--- |
| 1.0 | 2026-11-25 | Yanis Amrane | Sprint 3 contract (Issue #57), reviewed by Simeon Audouit. |
