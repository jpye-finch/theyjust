import { buildExportBundle, photoFileName } from '../exportBundle';

const child = {
  id: 'c1',
  family_id: 'f1',
  name: 'Wren',
  date_of_birth: '2026-01-15',
  due_date: null,
};

const moment = {
  id: 'm1',
  child_id: 'c1',
  milestone_id: 'rolled_over',
  custom_title: null,
  occurred_on: '2026-05-29',
  note: 'flipped right over',
  logged_by: 'u1',
  created_at: '2026-05-29T10:00:00.000Z',
  moment_photos: [
    { id: 'p1', moment_id: 'm1', storage_path: 'm1/m1-0.jpg', width: 100, height: 80, position: 0 },
  ],
};

describe('buildExportBundle', () => {
  it('nests moments under their child and resolves the celebration title', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [moment]);

    expect(bundle.exportedAt).toBe('2026-07-18T09:00:00.000Z');
    expect(bundle.children).toHaveLength(1);
    expect(bundle.children[0].name).toBe('Wren');
    expect(bundle.children[0].moments[0].title).toBe('They just rolled over!');
    expect(bundle.children[0].moments[0].occurredOn).toBe('2026-05-29');
    expect(bundle.children[0].moments[0].note).toBe('flipped right over');
  });

  it('points each moment at the photo files packed beside the JSON', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [moment]);
    expect(bundle.children[0].moments[0].photos).toEqual(['photos/m1-0.jpg']);
  });

  it('keeps a custom title verbatim and records no milestone', () => {
    const custom = { ...moment, milestone_id: null, custom_title: 'First haircut' };
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [custom]);
    expect(bundle.children[0].moments[0].title).toBe('First haircut');
    expect(bundle.children[0].moments[0].milestoneId).toBeNull();
  });

  it('includes a child with no moments rather than dropping them', () => {
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], []);
    expect(bundle.children[0].moments).toEqual([]);
  });

  it("orders a moment's photos by position", () => {
    const twoPhotos = {
      ...moment,
      moment_photos: [
        { id: 'p2', moment_id: 'm1', storage_path: 'm1/m1-1.jpg', width: 1, height: 1, position: 1 },
        { id: 'p1', moment_id: 'm1', storage_path: 'm1/m1-0.jpg', width: 1, height: 1, position: 0 },
      ],
    };
    const bundle = buildExportBundle('2026-07-18T09:00:00.000Z', [child], [twoPhotos]);
    expect(bundle.children[0].moments[0].photos).toEqual(['photos/m1-0.jpg', 'photos/m1-1.jpg']);
  });

  it("keeps each child's moments to their own", () => {
    const sibling = { ...child, id: 'c2', name: 'Rowan' };
    const siblingMoment = { ...moment, id: 'm2', child_id: 'c2', custom_title: null };
    const bundle = buildExportBundle(
      '2026-07-18T09:00:00.000Z',
      [child, sibling],
      [moment, siblingMoment],
    );
    expect(bundle.children[0].moments).toHaveLength(1);
    expect(bundle.children[1].moments).toHaveLength(1);
    expect(bundle.children[1].name).toBe('Rowan');
  });
});

describe('photoFileName', () => {
  it('flattens a storage path to a unique file name', () => {
    expect(photoFileName('m1/m1-0.jpg')).toBe('m1-0.jpg');
  });
});
