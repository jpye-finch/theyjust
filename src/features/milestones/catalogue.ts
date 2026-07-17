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
  /** Celebratory phrasing used on capture and share cards: "They just …!" */
  celebration: string;
  category: MilestoneCategory;
  typicalStartMonths: number;
  typicalEndMonths: number;
  /** One reassuring sentence of context. Never deadline language. */
  context: string;
  /** ≥2 URLs, hosts limited to who.int / cdc.gov / nhs.uk. */
  sources: string[];
};

export const CATEGORY_LABELS: Record<MilestoneCategory, string> = {
  motor: 'Motor',
  social: 'Social',
  language: 'Language',
  feeding: 'Feeding & Self-care',
};

export const CATALOGUE: CatalogueEntry[] = [
  {
    id: 'rolled_over',
    title: 'Rolled over',
    celebration: 'They just rolled over!',
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
    celebration: 'They just took their first steps!',
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
    celebration: 'They just smiled!',
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
    celebration: 'They just said their first word!',
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
    celebration: 'They just used a spoon!',
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
