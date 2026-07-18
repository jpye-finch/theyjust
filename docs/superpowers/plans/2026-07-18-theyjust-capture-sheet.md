# Capture Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capturing and editing a moment happen in a card that animates up from the bottom and leaves the timeline visible behind it, instead of a screen that swallows the app.

**Architecture:** Capture is currently a tab-hidden screen inside the `Tabs` navigator, and a tab screen cannot be presented modally. So the tabs move down into a `(tabs)` group and `(app)` becomes a `Stack`, letting `capture` be a `formSheet` screen above them. That restructure also fixes a real bug for free: tab screens stay mounted, which is why capture had to re-seed itself on focus. A dismissed sheet unmounts, so that workaround can go.

**Tech Stack:** Expo SDK 57, expo-router (React Navigation 7 native-stack), React Native.

---

## Why this is its own plan

An attempt at this mid-session was reverted deliberately. The move itself is four `git mv` calls, but every moved file's route registration changes at the same time, and a half-applied restructure leaves the app unbootable. It wants a fresh context and a browser check at each step, not a rushed one.

Two things were already finished and are on `main` at `34abbfb`, so this plan does not need to redo them:

- **Editing can change a moment's title.** Editing now reuses `CaptureForm`, so the same card serves capture and edit, and a custom moment can be converted to a catalogue milestone. `updateMoment` sends `milestone_id` and `custom_title` (Plan 1's column grant already allowed both; no migration was needed).
- **`deleteMomentPhoto` exists and is tested.** It removes the storage object *before* the row that names it, so a failure cannot strand a blob. Only its UI is missing (see Task 5).

## Scope

**In:** the routing restructure, capture presented as a sheet, editing routed into that same sheet, and removal of the now-redundant focus re-seed.

**Out:** any visual restyle. The mockup that prompted this is the **old Figma** — terracotta button, white rounded cards — which PRODUCT.md names as the anti-reference. Only the *presentation* (rises from the bottom, partial height, grabber, close affordance) is being adopted. The hardback palette and type stay exactly as they are.

## Context an implementer needs

- `npm test` pins `TZ=America/Los_Angeles`; a bare `npx jest` uses the host zone.
- Local `tsc` needs `rm -f .expo/types/router.d.ts` first, and again after any route change, because the generated typed-routes file goes stale. CI never generates it.
- The Bash shell may resolve an old Node 14 from an inherited PATH. If `npm` complains about the Node version, run commands through `zsh -lc '…'`, which picks up nvm's default.
- Local Supabase must be running (`supabase start`) or every screen past sign-in fails with a bare `Failed to fetch`.
- `Alert.alert` is a no-op on react-native-web; use `notify` / `confirmDestructive` from `src/lib/dialog.ts`.
- Routes must not change. `(tabs)` is a group, so `(app)/(tabs)/index.tsx` still serves `/`, and `/milestones`, `/family`, `/capture`, `/moment/[id]` all stay put. Nothing that calls `router.push` should need editing.

## File structure

| File | Change |
|---|---|
| `src/app/(app)/_layout.tsx` | becomes a `Stack`; keeps `SelectedChildProvider` |
| `src/app/(app)/(tabs)/_layout.tsx` | new home of the `Tabs` config (moved) |
| `src/app/(app)/(tabs)/index.tsx` | moved, unchanged |
| `src/app/(app)/(tabs)/milestones.tsx` | moved, unchanged |
| `src/app/(app)/(tabs)/family.tsx` | moved, unchanged |
| `src/app/(app)/capture.tsx` | drops the focus re-seed; accepts an optional `momentId` |
| `src/app/(app)/moment/[id].tsx` | "Edit" routes to the sheet instead of editing inline |

---

### Task 1: Move the tabs into a group

Pure file move. Nothing inside the moved files changes yet, so if the app boots afterwards the move was clean.

**Files:**
- Move: `src/app/(app)/{_layout,index,milestones,family}.tsx` → `src/app/(app)/(tabs)/`

- [ ] **Step 1: Move the four files, preserving history**

```bash
mkdir -p "src/app/(app)/(tabs)"
git mv "src/app/(app)/_layout.tsx" "src/app/(app)/(tabs)/_layout.tsx"
git mv "src/app/(app)/index.tsx" "src/app/(app)/(tabs)/index.tsx"
git mv "src/app/(app)/milestones.tsx" "src/app/(app)/(tabs)/milestones.tsx"
git mv "src/app/(app)/family.tsx" "src/app/(app)/(tabs)/family.tsx"
```

- [ ] **Step 2: Remove the two hidden-tab registrations.** In `src/app/(app)/(tabs)/_layout.tsx`, delete these lines. `capture` and `moment/[id]` are about to live on the Stack above, not in the tab bar:

```tsx
        <Tabs.Screen name="capture" options={{ href: null }} />
        <Tabs.Screen name="moment/[id]" options={{ href: null }} />
```

- [ ] **Step 3: Do not verify yet.** The app is intentionally broken between here and Task 2: `(app)` currently has no layout at all. Go straight to Task 2, then verify. Do not commit a broken tree.

---

### Task 2: Make `(app)` a Stack and present capture as a sheet

**Files:**
- Create: `src/app/(app)/_layout.tsx`

- [ ] **Step 1: Create `src/app/(app)/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { SelectedChildProvider } from '@/features/children/selectedChild';
import { color } from '@/theme/tokens';

// The tabs live one level down so that capture can sit ABOVE them on a stack: a
// screen inside a Tabs navigator cannot be presented modally, which is why
// capture used to swallow the whole app.
export default function AppLayout() {
  return (
    <SelectedChildProvider>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.paper } }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="capture"
          options={{
            presentation: 'formSheet',
            // Opens tall enough to reach Save without scrolling, and can be
            // dragged to full height for a long note.
            sheetAllowedDetents: [0.85, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 24,
          }}
        />
        <Stack.Screen name="moment/[id]" />
      </Stack>
    </SelectedChildProvider>
  );
}
```

- [ ] **Step 2: Verify the app boots and routes are unchanged**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Expected: tsc exit 0; 139 tests green.

- [ ] **Step 3: Check it in the browser.** Reload, then confirm: the three tabs still work, `/` is still the Timeline, tapping `+` opens capture, and tapping an unachieved milestone row still opens capture pre-selected. On web the sheet options are ignored and it presents as a plain screen — that is expected, and the sheet itself is verified on a device in Task 6.

- [ ] **Step 4: Commit** (one commit, because the tree does not build between Tasks 1 and 2)

```bash
git add -A
git commit -m "refactor(routing): tabs move into a group so capture can present as a sheet"
```

---

### Task 3: Drop the focus re-seed that the sheet makes redundant

`capture.tsx` re-seeds its form on every focus because a tab screen stays mounted, so the previous capture's note and title used to linger. A sheet unmounts when dismissed, so the workaround is now dead weight — and worse, it fights editing, which needs the form to keep the values it was opened with.

**Files:**
- Modify: `src/app/(app)/capture.tsx`

- [ ] **Step 1: Delete the re-seed.** Remove this block and the `formKey` state:

```tsx
  const [formKey, setFormKey] = useState(0);

  // capture is a tab-hidden screen, so it stays mounted after the first visit.
  // Re-seed the form and drop picked photos each time it regains focus, or the
  // previous capture's title/date/note/photos would linger into the next one.
  useFocusEffect(
    useCallback(() => {
      setFormKey((k) => k + 1);
      setPhotos([]);
    }, []),
  );
```

Remove `key={formKey}` from `<CaptureForm>`, and drop `useFocusEffect` and `useCallback` from the imports.

- [ ] **Step 2: Verify the stale-state bug has not returned**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Then in the browser: open capture, type a note, dismiss the sheet, open capture again. The note field must be empty. If it is not, the sheet is not unmounting and the re-seed has to come back — say so rather than papering over it.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/capture.tsx"
git commit -m "refactor: drop the focus re-seed, now that a dismissed sheet unmounts"
```

---

### Task 4: Edit in the same sheet

Editing currently happens inline on the moment detail screen. It already uses `CaptureForm`, so routing it into the sheet means one card serves both jobs.

**Files:**
- Modify: `src/app/(app)/capture.tsx`
- Modify: `src/app/(app)/moment/[id].tsx`

- [ ] **Step 1: Accept a moment to edit.** In `capture.tsx`, read an optional `momentId`, find that moment in the cached timeline, and pre-fill from it:

```tsx
  const { milestoneId, momentId } = useLocalSearchParams<{
    milestoneId?: string;
    momentId?: string;
  }>();
  const { data: moments = [] } = useTimeline(selected?.id ?? null);
  const editing = momentId ? moments.find((m) => m.id === momentId) : undefined;
```

Pass the pre-fill through, falling back to capture's defaults when nothing is being edited:

```tsx
      <CaptureForm
        initialMilestoneId={editing ? editing.milestone_id : (milestoneId ?? null)}
        initialCustomTitle={editing?.custom_title ?? ''}
        initialNote={editing?.note ?? ''}
        defaultOccurredOn={editing ? editing.occurred_on : todayIso()}
        submitLabel={editing ? 'Save changes' : 'Save moment'}
        photoCount={editing ? editing.moment_photos.length : photos.length}
        onPickPhoto={handlePick}
        onSubmit={handleSubmit}
        busy={createMoment.isPending || updateMoment.isPending}
      />
```

`handleSubmit` branches on `editing`: call `updateMoment.mutate` with the `MomentEdit` shape when editing, otherwise the existing create-then-upload path. Wire `useUpdateMoment(selected.id)` beside the existing `useCreateMoment`.

- [ ] **Step 2: Point "Edit" at the sheet.** In `moment/[id].tsx`, replace the inline editing state with navigation, and delete the `editing` state, the `<CaptureForm>` block and its now-unused imports:

```tsx
        <TextButton
          label="Edit"
          onPress={() => router.push({ pathname: '/capture', params: { momentId: moment.id } })}
        />
```

- [ ] **Step 3: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Then in the browser: open a moment, tap Edit, confirm the sheet opens pre-filled with that moment's title, date and note; change the title; save; confirm the timeline and the detail screen both show the new title.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/capture.tsx" "src/app/(app)/moment/[id].tsx"
git commit -m "feat: editing opens the same capture sheet, pre-filled"
```

---

### Task 5: Photos while editing (add and remove)

Deferred from the session that built `deleteMomentPhoto`. The data layer is done and tested; only the UI is missing.

**Files:**
- Modify: `src/features/moments/CaptureForm.tsx`
- Modify: `src/app/(app)/capture.tsx`

- [ ] **Step 1: Show existing photos.** Give `CaptureForm` an optional `existingPhotos` prop (`{ id, storagePath, url }[]`) rendered as a row of thumbnails, each with a remove control labelled for screen readers (`Remove photo`). Keep the dashed "Add a photo" control below it.

- [ ] **Step 2: Wire the actions in `capture.tsx`.** While editing, a moment id already exists, so a picked photo can upload immediately with `uploadMomentPhoto(momentId, …)` rather than being held until save. Removal calls `deleteMomentPhoto(photo.id, photo.storagePath)`. Both then invalidate `['timeline', childId]` so the thumbnails and the timeline agree.

- [ ] **Step 3: Confirm before removing.** A deleted photo cannot be recovered, so route it through `confirmDestructive('Remove this photo?', 'It cannot be brought back.', 'Remove', …)` from `src/lib/dialog.ts`.

- [ ] **Step 4: Verify**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test
```

Then in the browser: edit a moment with a photo, add a second, confirm both appear on the timeline card; remove one, confirm it disappears; then confirm in SQL that both the `moment_photos` row **and** the storage object are gone:

```sql
select count(*) from storage.objects where bucket_id = 'moment-photos';
select count(*) from public.moment_photos;
```

- [ ] **Step 5: Commit**

```bash
git add src/features/moments/CaptureForm.tsx "src/app/(app)/capture.tsx"
git commit -m "feat: add and remove photos while editing a moment"
```

---

### Task 6: Full gates and device check

**Files:** none new.

- [ ] **Step 1: Full local gates**

```bash
rm -f .expo/types/router.d.ts
npx tsc --noEmit && npm test && supabase test db
```

Expected: tsc exit 0; Jest green; pgTAP passes.

- [ ] **Step 2: Web export smoke check**

```bash
npx expo export --platform web 2>&1 | tail -3 && rm -rf dist
```

Expected: exit 0.

- [ ] **Step 3: Device check, which is the only place the sheet is real.** Web ignores `presentation: 'formSheet'`, so everything above only proves nothing broke. On an iOS device or simulator, confirm: capture rises from the bottom over a still-visible timeline, stops short of full height, shows a grabber, can be dragged to full height and swiped away, and that dismissing it and reopening gives an empty form. Also confirm the native date picker inside it opens the inline calendar (still unverified on device from earlier work).

---

## Self-review

**Spec coverage.** This plan is not spec-driven; it comes from direct feedback on the shipped UI ("have this UI style just for the card, so that animates up and doesn't fill the whole screen"), plus the photo-management half deferred from the session that built its data layer.

**Deliberate gaps.** No visual restyle: only the presentation is adopted, because the mockup's terracotta-and-rounded-cards look is PRODUCT.md's stated anti-reference. No automated test covers the sheet presentation itself, because it is a navigator option with no rendered output to assert on in jest-expo; Task 6 step 3 is the check that matters, and it needs a device. Tasks 1 and 2 share one commit because the tree does not build between them.

**Type consistency.** `CaptureForm`'s props (`initialMilestoneId`, `initialCustomTitle`, `initialNote`, `defaultOccurredOn`, `submitLabel`, `photoCount`, `onPickPhoto`, `onSubmit`, `busy`) match what shipped in `34abbfb`. `MomentEdit` is `{ milestoneId, customTitle, occurredOn, note }`. `deleteMomentPhoto(photoId, storagePath)` and `uploadMomentPhoto(momentId, photoId, photo, position)` match `momentQueries.ts` and `photoUpload.ts` as shipped.
