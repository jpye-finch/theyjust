# Notifications — Design

**Status:** draft for review, 2026-07-19.

## 1. Why

A memory app dies of being forgotten. Nothing else in TheyJust brings a parent back on a day when nothing new happened, and a book nobody opens is a book nobody adds to.

Notifications are the only retention mechanism this product has. They are also the one place it can most easily betray itself: this app exists to reassure, and a badly aimed reminder is a small accusation delivered to a lock screen. The whole of this spec is an attempt to make the reassuring version the only one the code can express.

## 2. The window this app lives in

TheyJust is for roughly the first two to three years. That single fact rules out the obvious design.

"On this day, a year ago" is the mechanic Timehop built a company on and Google Photos made a retention pillar — but both launched into users holding years of backlog. Here, a year-ago look-back produces nothing at all for the first twelve months, which is exactly the window where a parent is most active and most worth keeping, and it only ever has two or three years to work with before the child ages out of the product.

**So the look-back interval is months, not years.** "Two months ago today, Wren rolled over" works from week five, and it keeps working for the whole life of the app. It is the same rhythm the spine already rules itself by — monthly through two years, yearly after — and reusing that cadence is deliberate: the app should measure time one way.

## 3. The rule the whole design hangs on

Every notification is triggered by **the child's calendar**. None is ever triggered by **the parent's behaviour**.

This is not a copy guideline, it is a structural one, and that is the point — a copy guideline cannot be enforced and a trigger rule can.

- "Wren is six months old today" cannot be a guilt trip, because the parent is not its subject.
- "You haven't logged anything in three weeks" always risks being one, however gently it is worded, because the subject of the sentence is the parent's failure.

The consequence is that **the scheduler never reads a parent's activity** — not last-opened, not last-logged, not a streak. It reads dates of birth and dates of moments. Nothing in this feature needs behavioural tracking, and nothing in it should acquire any.

## 4. What gets sent

Two kinds, both computed from stored dates.

### 4.1 Look-back

> **Two months ago today**
> Wren rolled over.

Fires when a logged moment falls exactly 1, 2, 3, 6, 12, 18 or 24 months before today, using the same `addMonths` clamping the spine uses (so the 31st behaves).

### 4.2 Age

> **Wren is six months old today**
> Anything you'd like to remember?

Fires on the child's monthly birthday, for months 1–24, then birthdays. This is the "gentle nudge", grounded in the child rather than the parent. It is the only notification that invites rather than recalls, and its invitation is open-ended: never a specific thing the child ought to be doing.

Corrected age is used when a due date is present, matching the rest of the app.

### 4.3 Deliberately excluded: "milestones opening"

The catalogue knows when each milestone typically emerges, so "around now, many babies start to roll over" is an obvious third type. **It is excluded.**

It converts the catalogue from a description into an expectation, delivered unprompted to a lock screen where it cannot be softened by surrounding context. A parent whose child is not doing the thing receives a notification that says other children are. That is the precise anxiety this product exists to avoid, and no wording fixes a message whose whole content is a comparison.

## 5. How much, and when

**At most one notification per week, per family.** Not per child — a parent of three does not want three times the interruption.

Restraint is a feature, not a limitation. The tone this app is going for is a quiet friend, not a habit-forming loop, and a memory book that pings daily is a different and worse product. Weekly is also enough to keep the app in mind, which is all it needs to do.

When more than one candidate falls in a week, priority is:

1. **Age** over look-back — it happens once and cannot be deferred.
2. **A moment with a photo** over one without — the payoff is better.
3. **The longest interval** — "six months ago" lands harder than "one month ago".
4. **The child least recently featured**, so a second or third child is not perpetually crowded out.

Delivered at **19:30 local**, after a bedtime that has probably just happened, which is when there is a minute to look at something.

**Settings:** Weekly (default), Monthly, or Off. Deliberately no Daily — the product should not offer the setting that damages it.

## 6. Asking for permission

Notification permission is one-shot. Refused once, it is effectively gone for good, and the standard way to lose it is to ask on first launch before the app has earned anything.

**Ask after the parent's third captured moment**, at which point they have felt what the app is for and the request can explain itself in terms of something they already value. If they decline, the app never asks again in-app; the settings row points at the OS.

## 7. Architecture

Local notifications only — `expo-notifications`, scheduled on the device.

This is worth stating plainly because it changes what is blocked: **local notifications need no Apple Developer account, no APNs certificate and no push server.** Everything here is computable on-device from data already stored. Only true server-driven push would be blocked behind Plan 5 Part B, and there is no server-driven push in this design.

| File | Responsibility |
|---|---|
| `src/features/notifications/notificationPlan.ts` | pure: children + moments + today + settings → the notifications to schedule |
| `src/features/notifications/scheduler.ts` | thin shell over expo-notifications: cancel all, schedule the plan |
| `src/features/notifications/notificationSettings.ts` | the persisted cadence preference |
| `src/features/notifications/permission.ts` | the ask, and the record that it happened |
| `src/app/(app)/(tabs)/family.tsx` | the settings row |

`notificationPlan.ts` holds every decision worth testing — the intervals, the weekly cap, the priority order, corrected age, child rotation, the copy itself — and touches nothing native. That is the boundary that matters: the whole behaviour can be proved in Jest without a device, exactly as `spineLayout` is.

**Scheduling is cancel-and-rebuild.** The plan is deterministic given its inputs, so the safest scheduler is one that cancels everything and reschedules from scratch. Rebuild on: app foreground, moment created or edited or deleted, child added or edited, settings changed.

**iOS allows 64 pending local notifications.** A rolling eight-week window at one per week uses eight, so the cap is not a constraint in practice — but the scheduler must still window rather than schedule the child's whole future, or a three-year plan would silently truncate.

**Rotation is computed, not stored.** Which child features is derived from the week number and the family's child list, so it needs no persisted cursor and stays deterministic under test.

## 8. Privacy

A notification puts a child's name and a moment's title on a lock screen, visible to anyone holding the phone.

That is the feature — a preview with the content stripped out would be pointless — but it is a real disclosure and it should be a deliberate one. The permission request says what will appear. Beyond that this is the OS's job: both platforms let a user hide previews, and this app should not try to out-think that setting.

No notification content leaves the device. Nothing is logged about what was sent, opened, or ignored — partly on principle, and partly because §3 means the app has no use for it.

## 9. Testing

**Unit, TDD** — `notificationPlan` end to end: each interval firing on the right date, the month-end clamp, corrected age, the weekly cap, every branch of the priority order, child rotation, the Off and Monthly settings, and an empty timeline producing nothing. Every string that can reach a parent is asserted, so the copy rules in §3 are enforced by the suite rather than by good intentions.

**Component, RNTL** — the settings row renders the current cadence and changes it; the permission prompt appears on the third moment and never twice.

**Runtime** — needs a development build, since `expo-notifications` is native and absent from Expo Go. Android can be verified without any Apple involvement; iOS needs the bundle identifier from Plan 5 Task 5, so it queues behind the same account as everything else. The pure plan is fully verifiable before either.

## 10. Open questions for review

1. **Is weekly right?** It is the most consequential number here and the one I am least sure of. It suits the brand; it is on the quiet side for retention.
2. **19:30** is a guess at when a parent has a free minute. It may want to be a setting, or simply to be morning.
3. **Look-back intervals** are 1, 2, 3, 6, 12, 18, 24 months. The short end may be too soon: "one month ago today" may not feel like enough time to have passed to be worth a notification.
4. **Should the app show a look-back in-app as well**, on a day that has one, for a parent who has notifications off? It is more surface area, and it was originally how I framed this before the two-to-three-year window made the notification the better home for it.
