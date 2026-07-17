import { CATALOGUE, CATEGORY_LABELS, MilestoneCategory } from '../catalogue';

// Task 4 ships 5 exemplar entries (one per category, two motor); Task 5
// raises this to the full 40.
const EXPECTED_MILESTONE_COUNT = 5;

const ALLOWED_SOURCE_HOSTS = ['who.int', 'cdc.gov', 'nhs.uk'];

describe('milestone catalogue', () => {
  it('has the expected number of entries', () => {
    expect(CATALOGUE).toHaveLength(EXPECTED_MILESTONE_COUNT);
  });

  it('has unique, snake_case ids', () => {
    const ids = CATALOGUE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it.each(CATALOGUE.map((e) => [e.id, e] as const))('%s is fully specified', (_id, e) => {
    expect(e.title.trim().length).toBeGreaterThan(0);
    expect(e.celebration.trim().length).toBeGreaterThan(0);
    expect(e.context.trim().length).toBeGreaterThan(0);
    expect(Object.keys(CATEGORY_LABELS)).toContain(e.category);
    expect(e.typicalStartMonths).toBeGreaterThanOrEqual(0);
    expect(e.typicalEndMonths).toBeGreaterThan(e.typicalStartMonths);
    expect(e.typicalEndMonths).toBeLessThanOrEqual(72);
    expect(e.sources.length).toBeGreaterThanOrEqual(2);
    for (const s of e.sources) {
      const host = new URL(s).hostname;
      expect(
        ALLOWED_SOURCE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)),
      ).toBe(true);
    }
  });

  it('never uses deadline or "behind" language in copy', () => {
    for (const e of CATALOGUE) {
      const copy = `${e.celebration} ${e.context}`.toLowerCase();
      expect(copy).not.toMatch(/behind|should have|by now|late|delayed/);
    }
  });

  it('covers every category', () => {
    const byCategory = new Map<MilestoneCategory, number>();
    for (const e of CATALOGUE) {
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + 1);
    }
    for (const category of Object.keys(CATEGORY_LABELS) as MilestoneCategory[]) {
      expect(byCategory.get(category) ?? 0).toBeGreaterThanOrEqual(1);
    }
  });
});
