// True iff `iso` is a real YYYY-MM-DD calendar date. A UTC round-trip rejects
// out-of-range days (2026-02-30), non-leap Feb 29, and bad months, so every form
// validates dates identically. Shared by ChildForm and CaptureForm.
export function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}
