// The curated milestone catalogue (spec §5). App-bundled static data: it
// changes rarely, works offline, and needs no fetch. Every range was compiled
// from at least two of WHO / CDC "Learn the Signs. Act Early." / NHS guidance;
// the sources array records exactly which. The validation test in
// __tests__/catalogue.test.ts enforces structure so this file cannot rot.

export type MilestoneCategory = 'motor' | 'social' | 'language' | 'feeding';

export type CatalogueEntry = {
  /** Stable snake_case id — stored in moments.milestone_id, never rename. */
  id: string;
  title: string;
  /**
   * Lowercase verb phrase completing "They just …" — composed by
   * celebrationText() on capture and by Plan 3's share card
   * ("They just took their first steps at 13 months").
   */
  verbPhrase: string;
  category: MilestoneCategory;
  typicalStartMonths: number;
  typicalEndMonths: number;
  /** One reassuring sentence of context. Never deadline language. */
  context: string;
  /**
   * True for milestones many children healthily skip entirely (e.g. crawling):
   * suppresses the past-window signpost, which would otherwise false-alarm.
   */
  skippable?: boolean;
  /** ≥2 URLs, hosts limited to who.int / cdc.gov / nhs.uk. */
  sources: string[];
};

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  motor: 'Motor',
  social: 'Social',
  language: 'Language',
  feeding: 'Feeding & Self-care',
};

/** The canonical celebratory sentence: "They just rolled over!" */
export function celebrationText(entry: Pick<CatalogueEntry, 'verbPhrase'>): string {
  return `They just ${entry.verbPhrase}!`;
}

export const CATALOGUE: CatalogueEntry[] = [
  {
    id: 'rolled_over',
    title: 'Rolled over',
    verbPhrase: 'rolled over',
    category: 'motor',
    typicalStartMonths: 3,
    typicalEndMonths: 7,
    context: 'Rolling both ways takes practice — tummy time makes a big difference.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-6mo.html',
      'https://www.nhs.uk/conditions/baby/babys-development/height-weight-and-reviews/baby-reviews/',
    ],
  },
  {
    id: 'first_steps',
    title: 'First steps',
    verbPhrase: 'took their first steps',
    category: 'motor',
    typicalStartMonths: 8,
    typicalEndMonths: 18,
    context: 'Walking has one of the widest healthy windows of any milestone.',
    sources: [
      'https://www.who.int/publications/i/item/924154693X',
      'https://www.cdc.gov/act-early/milestones/milestones-18mo.html',
    ],
  },
  {
    id: 'first_smile',
    title: 'First smile',
    verbPhrase: 'smiled',
    category: 'social',
    typicalStartMonths: 0,
    typicalEndMonths: 3,
    context: 'That first real, social smile is usually aimed at a familiar face.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-2mo.html',
      'https://www.nhs.uk/conditions/baby/babys-development/height-weight-and-reviews/baby-reviews/',
    ],
  },
  {
    id: 'first_word',
    title: 'First word',
    verbPhrase: 'said their first word',
    category: 'language',
    typicalStartMonths: 10,
    typicalEndMonths: 15,
    context: 'First words often hide inside babble — "mama" and "dada" count.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-1yr.html',
      'https://www.nhs.uk/conditions/baby/babys-development/play-and-learning/helping-your-baby-to-talk/',
    ],
  },
  {
    id: 'used_spoon',
    title: 'Used a spoon',
    verbPhrase: 'used a spoon',
    category: 'feeding',
    typicalStartMonths: 12,
    typicalEndMonths: 20,
    context: 'Messy self-feeding is exactly how spoon skills are learned.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/milestones-18mo.html',
      'https://www.nhs.uk/start-for-life/baby/weaning/',
    ],
  },
];
