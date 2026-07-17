// The curated milestone catalogue (spec §5). App-bundled static data: it
// changes rarely, works offline, and needs no fetch. Every range was compiled
// from at least two of WHO / CDC "Learn the Signs. Act Early." / NHS guidance;
// the sources array records exactly which. The validation test in
// __tests__/catalogue.test.ts enforces structure so this file cannot rot.

export type MilestoneCategory = 'motor' | 'social' | 'language' | 'feeding';

export type CatalogueEntry = {
  /** Stable snake_case id, stored in moments.milestone_id, never rename. */
  id: string;
  title: string;
  /**
   * Lowercase verb phrase completing "They just …", composed by
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
  /** ≥2 URLs; hosts who.int / cdc.gov / nhs.uk / nhsinform.scot, or subdomains thereof. */
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
  // Motor (13)
  {
    id: 'rolled_over',
    title: 'Rolled over',
    verbPhrase: 'rolled over',
    category: 'motor',
    typicalStartMonths: 3,
    typicalEndMonths: 7,
    context: 'Rolling both ways takes practice, and tummy time makes a big difference.',
    sources: [
      'https://www.nhsinform.scot/ready-steady-baby/early-parenthood/your-baby-s-development-from-2-to-12-months/',
      'https://www.cdc.gov/act-early/milestones/6-months.html',
    ],
  },
  {
    id: 'sat_unsupported',
    title: 'Sat without support',
    verbPhrase: 'sat up without support',
    category: 'motor',
    typicalStartMonths: 4,
    typicalEndMonths: 9,
    context:
      'Of all the big motor skills, sitting arrives on the most predictable schedule around the world.',
    sources: [
      'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/motor-development-milestones/who-motor-development-study-windows-of-achievement-for-six-gross-motor-development-milestones.pdf',
      'https://www.cdc.gov/act-early/milestones/9-months.html',
    ],
  },
  {
    id: 'crawled',
    title: 'Crawled',
    verbPhrase: 'crawled',
    category: 'motor',
    typicalStartMonths: 6,
    typicalEndMonths: 12,
    context:
      'Plenty of babies skip crawling entirely; bottom-shuffling or rolling to get around is just as healthy.',
    skippable: true,
    sources: [
      'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/motor-development-milestones/who-motor-development-study-windows-of-achievement-for-six-gross-motor-development-milestones.pdf',
      'https://www.nhs.uk/best-start-in-life/baby/baby-moves/',
    ],
  },
  {
    id: 'pulled_to_stand',
    title: 'Pulled up to stand',
    verbPhrase: 'pulled up to stand',
    category: 'motor',
    typicalStartMonths: 5,
    typicalEndMonths: 12,
    context:
      'Furniture makes a wonderful gym: pulling up is a near-universal step, even for babies who never crawl.',
    sources: [
      'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/motor-development-milestones/who-motor-development-study-windows-of-achievement-for-six-gross-motor-development-milestones.pdf',
      'https://www.cdc.gov/act-early/milestones/1-year.html',
    ],
  },
  {
    id: 'stood_unaided',
    title: 'Stood alone',
    verbPhrase: 'stood without holding on',
    category: 'motor',
    typicalStartMonths: 8,
    typicalEndMonths: 18,
    context:
      'The first solo stand is often just a wobbly second or two; that fleeting balance is the whole milestone.',
    sources: [
      'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/motor-development-milestones/mm_percentiles_table.pdf?sfvrsn=81f3b60b_5',
      'https://www.buckshealthcare.nhs.uk/cyp/wp-content/uploads/sites/6/2021/08/Development-guide-from-birth-to-18-months.pdf',
    ],
  },
  {
    id: 'first_steps',
    title: 'First steps',
    verbPhrase: 'took their first steps',
    category: 'motor',
    typicalStartMonths: 9,
    typicalEndMonths: 18,
    context:
      'Walking has one of the widest healthy windows of any milestone, and bottom-shufflers especially like to take their time, and that is a perfectly normal path.',
    sources: [
      'https://cdn.who.int/media/docs/default-source/child-growth/child-growth-standards/indicators/motor-development-milestones/mm_percentiles_table.pdf?sfvrsn=81f3b60b_5',
      'https://www.cdc.gov/act-early/milestones-in-action/18-months.html',
      'https://www.uhd.nhs.uk/uploads/about/docs/our_publications/patient_information_leaflets/Childrens_therapy/Bottom_shuffling_Babies.pdf',
    ],
  },
  {
    id: 'climbed_stairs',
    title: 'Climbed the stairs',
    verbPhrase: 'climbed the stairs',
    category: 'motor',
    typicalStartMonths: 18,
    typicalEndMonths: 24,
    context:
      'Walking up stairs starts with a steadying hand or the rail, and every supervised trip builds strength and coordination.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/2-years.html',
      'https://www.buckshealthcare.nhs.uk/cyp/pifs/development-guide-from-18-months-to-3-years/',
    ],
  },
  {
    id: 'ran',
    title: 'First run',
    verbPhrase: 'ran',
    category: 'motor',
    typicalStartMonths: 18,
    typicalEndMonths: 24,
    context: 'First runs are wonderfully wobbly; running grows straight out of confident walking.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/2-years.html',
      'https://www.buckshealthcare.nhs.uk/cyp/pifs/development-guide-from-18-months-to-3-years/',
    ],
  },
  {
    id: 'kicked_ball',
    title: 'Kicked a ball',
    verbPhrase: 'kicked a ball',
    category: 'motor',
    typicalStartMonths: 20,
    typicalEndMonths: 36,
    context:
      'Early kicks often look like walking straight into the ball; that little bump is exactly how kicking starts.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/2-years.html',
      'https://cambspborochildrenshealth.nhs.uk/child-development-and-growing-up/milestones/2-years/',
      'https://www.oxfordhealth.nhs.uk/cit/resources/gross-motor-skills-babies-and-toddlers/',
    ],
  },
  {
    id: 'jumped',
    title: 'Jumped',
    verbPhrase: 'jumped with both feet',
    category: 'motor',
    typicalStartMonths: 22,
    typicalEndMonths: 36,
    context:
      'Jumping is usually one of the last big skills to click into place, arriving once running and climbing are old news.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/30-months.html',
      'https://cambspborochildrenshealth.nhs.uk/child-development-and-growing-up/milestones/2-years/',
      'https://www.oxfordhealth.nhs.uk/cit/resources/gross-motor-skills-babies-and-toddlers/',
    ],
  },
  {
    id: 'pincer_grip',
    title: 'Pincer grip',
    verbPhrase: 'picked something up with finger and thumb',
    category: 'motor',
    typicalStartMonths: 10,
    typicalEndMonths: 13,
    context:
      'That raking little grab at food around nine months is the warm-up act for this neat finger-and-thumb pinch.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/1-year.html',
      'https://www.buckshealthcare.nhs.uk/cyp/pifs/pincer-grip/',
    ],
  },
  {
    id: 'stacked_blocks',
    title: 'Stacked blocks',
    verbPhrase: 'stacked blocks',
    category: 'motor',
    typicalStartMonths: 12,
    typicalEndMonths: 20,
    context: 'Two cups, two boxes, two anything: any small tower counts as stacking.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/15-months.html',
      'https://cambspborochildrenshealth.nhs.uk/child-development-and-growing-up/milestones/18-months/',
    ],
  },
  {
    id: 'scribbled',
    title: 'First scribble',
    verbPhrase: 'scribbled',
    category: 'motor',
    typicalStartMonths: 15,
    typicalEndMonths: 21,
    context:
      'Scribbling arrives through pure exploration, with no lessons needed, just something safe to make marks with.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/18-months.html',
      'https://cambspborochildrenshealth.nhs.uk/child-development-and-growing-up/milestones/18-months/',
    ],
  },
  // Social (9)
  {
    id: 'first_smile',
    title: 'First smile',
    verbPhrase: 'smiled',
    category: 'social',
    typicalStartMonths: 1,
    typicalEndMonths: 2,
    context:
      'The true social smile usually appears around six weeks, aimed at a familiar face; those earlier sleepy newborn smiles were just the rehearsal.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/2-months.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/emotions-behaviour-play',
    ],
  },
  {
    id: 'laughed',
    title: 'First laugh',
    verbPhrase: 'laughed',
    category: 'social',
    typicalStartMonths: 3,
    typicalEndMonths: 6,
    context: 'Chuckles and giggles usually warm up the room before the first proper laugh arrives.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/6-months.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/emotions-behaviour-play',
    ],
  },
  {
    id: 'played_peekaboo',
    title: 'Played peekaboo',
    verbPhrase: 'played peekaboo',
    category: 'social',
    typicalStartMonths: 6,
    typicalEndMonths: 9,
    context:
      'Peekaboo is secretly a lesson that people still exist when you cannot see them, and it is brilliant fun.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/9-months.html',
      'https://www.nhs.uk/baby/babys-development/play-and-learning/help-your-baby-learn-to-talk/',
    ],
  },
  {
    id: 'stranger_awareness',
    title: 'Stranger awareness',
    verbPhrase: 'got wary of new faces',
    category: 'social',
    typicalStartMonths: 6,
    typicalEndMonths: 12,
    context:
      'Wariness of new faces is common right up to age three, and it is usually a sign of just how strongly they have bonded with you.',
    skippable: true,
    sources: [
      'https://www.cdc.gov/act-early/milestones/9-months.html',
      'https://www.nhs.uk/baby/babys-development/behaviour/separation-anxiety/',
    ],
  },
  {
    id: 'waved_bye',
    title: 'Waved bye-bye',
    verbPhrase: 'waved bye-bye',
    category: 'social',
    typicalStartMonths: 6,
    typicalEndMonths: 12,
    context: 'A wave is really a first word in gesture form, a whole goodbye in one little hand.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/1-year.html',
      'https://www.gosh.nhs.uk/conditions-and-treatments/procedures-and-treatments/speech-and-language-development-birth-12-months/',
    ],
  },
  {
    id: 'pointed_to_show',
    title: 'Pointed to share',
    verbPhrase: 'pointed to show you something',
    category: 'social',
    typicalStartMonths: 12,
    typicalEndMonths: 18,
    context:
      'This point means "look at that!": sharing excitement, not asking for things, is what makes it special.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/18-months.html',
      'https://www.nhsinform.scot/ready-steady-baby/early-parenthood/your-baby-s-development-from-2-to-12-months/',
    ],
  },
  {
    id: 'pretend_play',
    title: 'Pretend play',
    verbPhrase: 'played pretend',
    category: 'social',
    typicalStartMonths: 18,
    typicalEndMonths: 30,
    context:
      'The first pretend games are wonderfully ordinary: sipping from an empty cup or chatting on a toy phone.',
    sources: [
      'https://www.healthiertogether.nhs.uk/child-under-5-years/emotions-behaviour-play',
      'https://www.cdc.gov/act-early/milestones/30-months.html',
    ],
  },
  {
    id: 'parallel_play',
    title: 'Played alongside',
    verbPhrase: 'played alongside another child',
    category: 'social',
    typicalStartMonths: 24,
    typicalEndMonths: 30,
    context:
      'Playing next to other children rather than with them is a healthy stage all of its own; real teamwork comes after.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/30-months.html',
      'https://www.buckshealthcare.nhs.uk/cyp/pifs/development-guide-from-18-months-to-3-years/',
    ],
  },
  {
    id: 'took_turns',
    title: 'Took turns',
    verbPhrase: 'took turns',
    category: 'social',
    typicalStartMonths: 36,
    typicalEndMonths: 60,
    context:
      'Turn-taking is practised over years; a pause or a handed-over toy counts long before board-game manners appear.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/5-years.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/emotions-behaviour-play',
    ],
  },
  // Language (10)
  {
    id: 'cooed',
    title: 'First coo',
    verbPhrase: 'cooed',
    category: 'language',
    typicalStartMonths: 2,
    typicalEndMonths: 4,
    context:
      'Those first ooh and aah sounds often surprise babies themselves; it is the very start of conversation.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/4-months.html',
      'https://www.justonenorfolk.nhs.uk/child-development-additional-needs/talk-and-play/communication-milestones/',
    ],
  },
  {
    id: 'babbled',
    title: 'Babbled',
    verbPhrase: 'babbled',
    category: 'language',
    typicalStartMonths: 6,
    typicalEndMonths: 10,
    context:
      'Strings of "ba-ba" and "da-da" are the building blocks that first words are made from.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/9-months.html',
      'https://www.justonenorfolk.nhs.uk/child-development-additional-needs/talk-and-play/communication-milestones/',
    ],
  },
  {
    id: 'responded_to_name',
    title: 'Responded to their name',
    verbPhrase: 'responded to their name',
    category: 'language',
    typicalStartMonths: 4,
    typicalEndMonths: 12,
    context:
      'It starts with simply knowing the sound of their name; reliably turning to it comes with practice.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/9-months.html',
      'https://www.justonenorfolk.nhs.uk/child-development-additional-needs/talk-and-play/communication-milestones/',
    ],
  },
  {
    id: 'first_word',
    title: 'First word',
    verbPhrase: 'said their first word',
    category: 'language',
    typicalStartMonths: 10,
    typicalEndMonths: 15,
    context: 'First words often hide inside babble, and "mama" and "dada" count.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/1-year.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/speech-and-language',
    ],
  },
  {
    id: 'understood_no',
    title: 'Understood "no"',
    verbPhrase: 'understood "no"',
    category: 'language',
    typicalStartMonths: 9,
    typicalEndMonths: 12,
    context: 'Understanding "no" looks like a brief pause or a glance; it is recognition, not obedience.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/1-year.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/speech-and-language',
    ],
  },
  {
    id: 'followed_instruction',
    title: 'Followed an instruction',
    verbPhrase: 'followed a simple instruction',
    category: 'language',
    typicalStartMonths: 15,
    typicalEndMonths: 18,
    context:
      'Following words alone, with no pointing to help, is the real magic here; gestures carried the meaning first.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/18-months.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/speech-and-language',
    ],
  },
  {
    id: 'two_word_phrase',
    title: 'Two-word phrases',
    verbPhrase: 'put two words together',
    category: 'language',
    typicalStartMonths: 18,
    typicalEndMonths: 24,
    context:
      '"More milk" and "all gone" are proper sentences to a toddler: two words that carry a whole thought.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/2-years.html',
      'https://www.gosh.nhs.uk/conditions-and-treatments/procedures-and-treatments/speech-and-language-development-12-24-months/',
    ],
  },
  {
    id: 'named_body_part',
    title: 'Pointed to a body part',
    verbPhrase: 'pointed to a body part',
    category: 'language',
    typicalStartMonths: 12,
    typicalEndMonths: 24,
    context: 'Tummies, noses and eyes are usually the first stars of this show.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/2-years.html',
      'https://www.eput.nhs.uk/services/childrens-speech-language-therapy/universal-support-for-speech-language-and-communication-development-from-birth/12-24-months/',
    ],
  },
  {
    id: 'fifty_words',
    title: 'Fifty words',
    verbPhrase: 'reached fifty words',
    category: 'language',
    typicalStartMonths: 24,
    typicalEndMonths: 36,
    context:
      'Vocabularies grow at wildly different speeds; anywhere around two to three years is normal territory for this.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/30-months.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/speech-and-language',
    ],
  },
  {
    id: 'said_own_name',
    title: 'Said their own name',
    verbPhrase: 'said their own name',
    category: 'language',
    typicalStartMonths: 30,
    typicalEndMonths: 36,
    context:
      'Saying their own name tends to arrive alongside other self-knowledge, like their age and favourite colours.',
    sources: [
      'https://www.cdc.gov/act-early/milestones/3-years.html',
      'https://www.healthiertogether.nhs.uk/child-under-5-years/speech-and-language',
    ],
  },
  // Feeding & Self-care (8)
  {
    id: 'first_finger_food',
    title: 'First finger food',
    verbPhrase: 'ate their first finger food',
    category: 'feeding',
    typicalStartMonths: 6,
    typicalEndMonths: 9,
    context:
      'From first tastes around six months, picking food up themselves builds hand-eye coordination as much as it fills tummies.',
    sources: [
      'https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/from-around-6-months/',
      'https://www.cdc.gov/act-early/milestones/9-months.html',
    ],
  },
  {
    id: 'drank_open_cup',
    title: 'Drank from an open cup',
    verbPhrase: 'drank from an open cup',
    category: 'feeding',
    typicalStartMonths: 6,
    typicalEndMonths: 18,
    context:
      'Sips with a steadying hand come first, spills and all; open cups are kindest to growing teeth.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/1-year.html',
      'https://www.nhs.uk/best-start-in-life/baby/weaning/what-to-feed-your-baby/from-around-6-months/',
      'https://www.cdc.gov/act-early/milestones/18-months.html',
    ],
  },
  {
    id: 'used_spoon',
    title: 'Used a spoon',
    verbPhrase: 'used a spoon',
    category: 'feeding',
    typicalStartMonths: 12,
    typicalEndMonths: 18,
    context: 'Messy self-feeding is exactly how spoon skills are learned.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/18-months.html',
      'https://www.justonenorfolk.nhs.uk/media/ghwj2qk2/using-a-spoon-information-sheet.pdf',
    ],
  },
  {
    id: 'fed_self_meal',
    title: 'Ate a whole meal themselves',
    verbPhrase: 'fed themselves a whole meal',
    category: 'feeding',
    typicalStartMonths: 18,
    typicalEndMonths: 36,
    context:
      'Around two, most toddlers are keen to run the whole meal themselves, with smaller portions of the family food are perfect.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/2-years.html',
      'https://www.justonenorfolk.nhs.uk/media/ghwj2qk2/using-a-spoon-information-sheet.pdf',
    ],
  },
  {
    id: 'used_fork',
    title: 'Used a fork',
    verbPhrase: 'used a fork',
    category: 'feeding',
    typicalStartMonths: 24,
    typicalEndMonths: 36,
    context:
      'First comes the stab; mastering knife and fork together is a much longer journey, and that is fine.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/3-years.html',
      'https://www.justonenorfolk.nhs.uk/media/mz1jao5l/using-a-fork-information-sheet.pdf',
    ],
  },
  {
    id: 'took_off_clothes',
    title: 'Took off clothes',
    verbPhrase: 'took off some clothes by themselves',
    category: 'feeding',
    typicalStartMonths: 12,
    typicalEndMonths: 30,
    context:
      'Socks and hats go first; undressing is the easy half, which is why it comes well before dressing.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/30-months.html',
      'https://www.nhsborders.scot.nhs.uk/media/1001733/Developing-Dressing-Skills-.pdf',
    ],
  },
  {
    id: 'washed_hands',
    title: 'Washed their hands',
    verbPhrase: 'washed their hands',
    category: 'feeding',
    typicalStartMonths: 18,
    typicalEndMonths: 60,
    context:
      'It begins with little hands held out to be washed and grows, year by year, into doing the whole job solo.',
    sources: [
      'https://www.cdc.gov/act-early/milestones-in-action/18-months.html',
      'https://www.bedslutonchildrenshealth.nhs.uk/child-development-and-growing-up/hygiene/hygiene-for-toddlers-and-children/',
    ],
  },
  {
    id: 'brushed_teeth_helped',
    title: 'Brushed teeth with help',
    verbPhrase: 'took a turn brushing their teeth',
    category: 'feeding',
    typicalStartMonths: 36,
    typicalEndMonths: 72,
    context:
      'From around three, children can take a turn with the brush themselves, though most still need an adult finishing touch until around seven.',
    sources: [
      'https://www.nhs.uk/live-well/healthy-teeth-and-gums/taking-care-of-childrens-teeth/',
      'https://www.cdc.gov/oral-health/prevention/oral-health-tips-for-children.html',
    ],
  },
];
