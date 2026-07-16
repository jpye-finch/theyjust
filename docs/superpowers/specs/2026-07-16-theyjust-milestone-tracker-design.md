# TheyJust — Milestone Memory App: Design Spec

**Date:** 2026-07-16
**Status:** Approved by Jonathan (2026-07-16)
**Working name:** TheyJust (domain theyjust.com — available at time of writing, to be registered by owner)

## 1. Product overview

TheyJust is a milestone memory app for parents of children aged 0–5, shipped as a
cross-platform native app (iOS + Android). The core loop is a single joyful action:
something happens, the parent opens the app, taps the milestone (or adds a custom
one), and captures the moment — date, note, photos, and who logged it.

The app answers two questions:

1. **"Will we remember this?"** — a timeline of firsts per child, with photos and notes.
2. **"Is this normal?"** — every curated milestone shows its clinical typical range
   ("Walking typically emerges 8–18 months"), framed as reassurance, never ranking.

**Positioning** (from competitive scan, 2026-07-16): existing apps are either clinical
screening tools (CDC Milestone Tracker, Pathways.org — credible but sterile, no
memory-keeping or family sharing), exhausting daily care loggers (Huckleberry, Tinylog,
Sprout — milestones bolted on), or photo journals with zero clinical context
(Tinybeans, Qeepsake). TheyJust is the milestone *memory* app that also reassures —
emotional capture + clinical context + co-parent sharing, without daily-logging burden.

**Decisions log:**

| Decision | Choice |
|---|---|
| Audience | Real product for other parents (not just personal use) |
| Platform | Cross-platform native: Expo / React Native (iOS + Android) |
| Comparison stats | Clinical ranges (WHO/CDC/NHS) in v1; opt-in anonymised community percentiles as a later phase |
| Moment media | Date + note + photos in v1; video deferred (future premium) |
| Family model | Shared family: owner invites co-parent with equal logging rights; read-only viewers (grandparents) deferred |
| Monetisation | Free MVP; freemium-ready design, no payment code in v1 |
| Milestone set | Curated catalogue (~40, with clinical ranges) + free-form custom moments (no ranges) |

## 2. Architecture

```
Expo (React Native) app — iOS + Android
  ├── Expo Router (navigation), TypeScript
  ├── TanStack Query for server state (optimistic updates, persisted retry queue)
  └── Supabase JS client
Supabase (EU region)
  ├── Postgres + Row-Level Security  → all family-scoped data
  ├── Auth  → Sign in with Apple, Google, email/password
  ├── Storage → photos (private bucket, signed URLs, client-side resize before upload)
  └── Edge Functions → only where RLS can't express the logic (e.g. invite acceptance)
```

- **No custom server.** Supabase (open-source, self-hostable — an exit ramp exists)
  provides auth, data, storage, and permissions. Chosen over a custom Node backend
  (2–4 weeks of undifferentiated auth/ops work) and over local-first sync
  (co-parent two-way sync + photo sync is the hardest problem in app development;
  overkill for v1).
- **Sign in with Apple is mandatory** on iOS because Google sign-in is offered
  (App Store rule).
- **Milestone catalogue ships inside the app** as versioned static JSON — it changes
  rarely, works offline, needs no fetch, and is not a database table.
- The app is **offline-tolerant, not local-first**: cached reads, optimistic writes
  with a persisted retry queue, background photo uploads (detail in §7).

## 3. Data model

```
families        id, name, created_by
family_members  family_id, user_id, role (owner | parent)
children        id, family_id, name, date_of_birth, due_date (nullable), avatar
moments         id, child_id, milestone_id (nullable), custom_title (nullable),
                occurred_on (date), note, logged_by, created_at
moment_photos   id, moment_id, storage_path, width, height, position
invites         id, family_id, code, created_by, expires_at, used_by
```

Rules:

- A **moment** references a catalogue `milestone_id` (and gets clinical-range display)
  **XOR** has a `custom_title` (no range). Enforced with a DB check constraint.
- **RLS on every table:** a user can read/write rows only for families they are a
  member of. This is the primary security boundary and is tested in CI (§8).
- `children.due_date` non-null marks a premature birth and drives corrected age (§5).
- Catalogue entries (static JSON): `id`, `title`, celebratory phrasing
  ("They just smiled!"), `category`, `typical_start_months`, `typical_end_months`,
  one-line context sentence, `source` citation.

## 4. App structure & screens

Tab navigation, five core surfaces:

1. **Timeline (home)** — reverse-chronological moments for the selected child. Card:
   photo, celebratory title, date, age at the time ("4 months, 2 weeks"), who logged
   it. Child switcher at top.
2. **Milestones** — catalogue grouped by category (Motor, Social, Language, Feeding &
   Self-care). Each row: achieved ✓ with age, or typical range if not yet. Tapping an
   unachieved milestone opens the capture flow. This is the "is this normal?" view.
3. **Capture flow (modal)** — one screen: milestone pre-selected or custom title, date
   (defaults today), note, photos (camera/library, client-side resize to ~2048px).
   Save is optimistic and instant.
4. **Moment detail** — full view; edit/delete; native share sheet exporting a rendered
   card (photo + "They just took their first steps at 13 months") — the organic
   growth engine.
5. **Family & settings** — children (add/edit, due date), invite co-parent (one-time
   code/link), account, data export, account deletion.

**Onboarding (3 steps):** sign in → add child (name, DOB, "born before 37 weeks?" →
due date) → land on Milestones with a prompt to backfill firsts that already happened.

## 5. Milestone catalogue & clinical ranges

~40 milestones across four categories. Ranges compiled from the **WHO Motor
Development Study**, **CDC "Learn the Signs. Act Early." (2022 revision)**, and **NHS
guidance**. During implementation, every range must be cross-checked against at least
two of these sources, with the citation stored in the entry.

Safety rules, baked into all copy:

- **Never a deadline.** Always "typically emerges between X–Y months". Achieved
  milestones are celebrated regardless of timing. No red states, no "behind" language.
- **Signpost, not diagnosis.** If a milestone is unachieved once the child's
  (corrected) age is more than 2 months past the outer bound, the row shows a calm note: "Every child is different — if you have questions, your
  health visitor or GP is the right person to ask." The app states plainly that it is
  not a screening tool.
- **Corrected age:** if `due_date` is set, range comparisons use age from due date
  until 24 months (standard practice). Displayed age shows both:
  "6 months — 4½ months corrected".

## 6. Privacy & safety (children's data)

- **EU-hosted Supabase.** Private storage bucket; photos served only via short-lived
  signed URLs. No public URLs, ever.
- **Data minimisation:** child's first name, DOB, optional due date, optional photo.
  No surname, no location, nothing else collected about the child.
- **UK GDPR:** clear privacy policy; in-app **data export** (JSON + photo zip) and
  **full account deletion** (cascade: family → children → moments → storage objects).
  Both are v1 features — Apple requires in-app account deletion regardless.
- **No third-party analytics SDKs in v1.** Sentry crash reporting with PII scrubbing
  is the only telemetry.
- **Session token storage:** during development the Supabase session persists in
  plaintext AsyncStorage. Before store release (Plan 4), harden per Supabase's RN
  guidance: AES key in expo-secure-store (Keychain/Keystore), encrypted session
  blob in AsyncStorage. Tracked as a mandatory pre-release item.
- Future community stats must be **opt-in, anonymised, aggregate-only** — designed in
  Phase 2, but nothing in this schema blocks it.

## 7. Error handling & offline tolerance

- **Optimistic writes:** saved moments appear immediately with a subtle "syncing"
  state; TanStack Query retries with backoff. Offline mutations queue in a persisted
  store (survives app restart) and flush on reconnect. A moment that ultimately fails
  stays visible with tap-to-retry — a captured memory is never lost.
- **Decoupled photo uploads:** the moment row saves first; photos upload in the
  background per-file with retry. A failed photo shows a retry placeholder without
  blocking the moment.
- **Cached reads:** last-fetched timeline and milestone states render instantly and
  revalidate; the app is fully browsable offline.
- **Auth/invite edge cases:** invite codes are single-use, expire after 7 days;
  joining a family you already belong to is a no-op; deleting the owner's account
  transfers ownership to the co-parent if present, otherwise deletes the family after
  an explicit destructive-action confirmation.

## 8. Testing

- **Unit (Jest via jest-expo — one runner for the whole app), TDD:** age calculation
  (corrected age, 24-month cutoff), range phrasing selection, invite state machine.
- **Catalogue validation test:** every entry has both bounds, start < end, a citation,
  and celebratory copy — the content file cannot rot.
- **RLS tests (SQL against local Supabase, in CI):** prove user B cannot read or write
  family A's rows — the most important security property.
- **Component tests (React Native Testing Library):** capture flow, timeline.
- **Manual device pass** (iOS + Android via Expo development builds) before each release.

## 9. MVP cut-line & phases

**v1 (everything above):** auth, family + co-parent invite, children with corrected
age, curated catalogue + custom moments, photos, timeline, share card, data export,
account deletion.

**Phase 2+ (explicitly out of v1):** video, community percentile stats, grandparent
read-only sharing, push-notification nudges, memory-book PDF, payments/premium,
widgets/Live Activities, web app.

Schema/architecture was checked against each Phase 2 item: none is blocked (e.g.
video = `media_type` column on photos table renamed to `moment_media`; percentiles =
opt-in flag + aggregation job).
