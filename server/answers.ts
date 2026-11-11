// SERVER-ONLY answer key. Never import this from src/ (the browser bundle).
import type { Property } from '../src/shared/types.js';

export type Topic = Property | 'combo';

export interface Question {
  id: string;
  topic: Topic;
  /** For combo questions: which properties it connects. */
  props?: Property[];
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
}

export const QUESTIONS: Question[] = [
  // ───── Cohesion ─────
  {
    id: 'c1', topic: 'cohesion',
    prompt: 'Two water drops touch and instantly merge into one bigger drop. What causes this?',
    options: ['Cohesion: water molecules attract each other', 'Adhesion: water sticks to the table', 'Gravity pulls the drops together', 'Evaporation joins the drops'],
    answer: 0,
    explain: 'Water molecules attract each other through hydrogen bonds (cohesion), so touching drops pull together into one.',
  },
  {
    id: 'c2', topic: 'cohesion',
    prompt: 'What is cohesion?',
    options: ['Water attracting different materials', 'Water molecules attracting other water molecules', 'The weight of water', 'Water turning into a gas'],
    answer: 1,
    explain: 'Cohesion is the attraction between molecules of the same substance: water sticking to water.',
  },
  {
    id: 'c3', topic: 'cohesion',
    prompt: 'Which kind of attraction between water molecules causes cohesion?',
    options: ['Hydrogen bonds', 'Magnetic force', 'Metal bonds', 'Friction'],
    answer: 0,
    explain: 'The slightly positive hydrogen of one molecule is attracted to the slightly negative oxygen of another. That is a hydrogen bond.',
  },
  {
    id: 'c4', topic: 'cohesion',
    prompt: 'Why are small raindrops round?',
    options: ['Wind sculpts them', 'Clouds are round', 'Cohesion pulls the molecules inward into the smallest shape', 'Adhesion to the air'],
    answer: 2,
    explain: 'Cohesion pulls each molecule toward the others, so a small drop takes the shape with the least surface area: a sphere.',
  },
  {
    id: 'c5', topic: 'cohesion',
    prompt: 'Rain on a waxed car forms tall round beads. Which force is winning?',
    options: ['Adhesion to the wax', 'Cohesion between water molecules', 'Air pressure', 'Magnetism from the car'],
    answer: 1,
    explain: 'Wax repels water, so adhesion is weak. Cohesion is stronger, so water pulls itself into beads.',
  },
  {
    id: 'c6', topic: 'cohesion',
    prompt: 'In a water molecule, the oxygen end is slightly ___ and the hydrogen ends are slightly ___.',
    options: ['negative, positive', 'positive, negative', 'neutral, neutral', 'hot, cold'],
    answer: 0,
    explain: 'Oxygen pulls shared electrons closer, making it slightly negative and leaving the hydrogens slightly positive. That polarity makes water "sticky".',
  },
  {
    id: 'c7', topic: 'cohesion',
    prompt: 'Why does a thin stream from a faucet stay connected for a while before breaking into drops?',
    options: ['The pipe is magnetic', 'Cohesion holds the molecules together', 'Air holds it up', 'Adhesion to the sink'],
    answer: 1,
    explain: 'Cohesion keeps water molecules connected in one stream until gravity stretches it too thin.',
  },
  {
    id: 'c8', topic: 'cohesion',
    prompt: 'Water forms taller beads on wax paper than rubbing alcohol does. What does that tell you?',
    options: ['Water has stronger cohesion', 'Alcohol has stronger cohesion', 'Wax absorbs alcohol', 'Water is lighter'],
    answer: 0,
    explain: 'Water\'s hydrogen bonds give it stronger cohesion than alcohol, so water pulls itself into taller beads.',
  },
  {
    id: 'c9', topic: 'cohesion',
    prompt: 'Which observation shows cohesion most clearly?',
    options: ['A paperclip floating', 'Dew drops on a web joining into bigger drops', 'Water soaking into soil', 'Rain sticking to a window'],
    answer: 1,
    explain: 'Drops joining together is water attracting water: cohesion.',
  },
  {
    id: 'c10', topic: 'cohesion',
    prompt: 'Evaporation needs energy because molecules must…',
    options: ['become heavier', 'break the hydrogen bonds holding them to neighbors', 'stick to the container', 'turn into salt'],
    answer: 1,
    explain: 'Cohesive hydrogen bonds hold water molecules together; a molecule needs energy to break free and escape as vapor.',
  },

  // ───── Adhesion ─────
  {
    id: 'a1', topic: 'adhesion',
    prompt: 'Rain clings to a window instead of sliding right off. Which interaction explains it?',
    options: ['Cohesion only', 'Adhesion: water attracted to the glass', 'Evaporation', 'Water is lighter than air'],
    answer: 1,
    explain: 'Water molecules are attracted to the glass surface. That adhesion holds drops on the window.',
  },
  {
    id: 'a2', topic: 'adhesion',
    prompt: 'What is adhesion?',
    options: ['Water attracting different materials and surfaces', 'Water attracting other water molecules', 'Water freezing', 'The skin on top of water'],
    answer: 0,
    explain: 'Adhesion is attraction between different substances, like water and glass, paper, or plant cells.',
  },
  {
    id: 'a3', topic: 'adhesion',
    prompt: 'In a glass graduated cylinder, the water surface curves UP at the edges. Why?',
    options: ['The glass is warm', 'Air pushes down the middle', 'Water adheres to the glass and climbs the walls', 'Cohesion pushes water up'],
    answer: 2,
    explain: 'Water is attracted to glass (adhesion), so it creeps up the sides, forming a curved meniscus.',
  },
  {
    id: 'a4', topic: 'adhesion',
    prompt: 'Water spreads out on clean glass but beads up on wax paper. Why?',
    options: ['Wax is colder', 'Adhesion to glass is strong; adhesion to wax is weak', 'Glass has more cohesion', 'Wax is wetter'],
    answer: 1,
    explain: 'Polar water sticks well to glass but poorly to waxy, non-polar surfaces.',
  },
  {
    id: 'a5', topic: 'adhesion',
    prompt: 'Why can you build a sandcastle with damp sand but not dry sand?',
    options: ['Water makes sand magnetic', 'Water adheres to grains and forms bridges between them', 'Wet sand melts together', 'Dry sand is too heavy'],
    answer: 1,
    explain: 'Water sticks to the sand grains (adhesion) and forms tiny bridges that hold the grains together.',
  },
  {
    id: 'a6', topic: 'adhesion',
    prompt: 'Water would adhere LEAST to which material?',
    options: ['Glass', 'Paper', 'Cotton', 'Wax'],
    answer: 3,
    explain: 'Wax is non-polar and water-repelling, so water adheres to it very weakly.',
  },
  {
    id: 'a7', topic: 'adhesion',
    prompt: 'A drop hangs on the underside of a leaf. What keeps it from falling?',
    options: ['Adhesion to the leaf', 'Evaporation', 'Wind', 'Surface tension of the air'],
    answer: 0,
    explain: 'The attraction between water and the leaf surface (adhesion) holds the drop against gravity.',
  },
  {
    id: 'a8', topic: 'adhesion',
    prompt: 'Water is attracted to glass, paper, and plant cells because water molecules are…',
    options: ['polar (they have charged ends)', 'very heavy', 'always cold', 'magnetic'],
    answer: 0,
    explain: 'Water\'s slightly charged ends are attracted to other polar or charged surfaces. That is adhesion.',
  },
  {
    id: 'a9', topic: 'adhesion',
    prompt: 'Pour water slowly from a teapot and it dribbles down the outside of the spout. Why?',
    options: ['Gravity is weaker near teapots', 'Water adheres to the spout surface and follows it', 'Cohesion pushes it away', 'The teapot is hot'],
    answer: 1,
    explain: 'At low speeds, adhesion to the spout keeps the water clinging to the surface as it curves around.',
  },
  {
    id: 'a10', topic: 'adhesion',
    prompt: 'A wet T-shirt clings to your skin. Which property is responsible?',
    options: ['Surface tension', 'Adhesion', 'Evaporation', 'Density'],
    answer: 1,
    explain: 'Water adheres to both the cloth fibers and your skin, holding them together.',
  },

  // ───── Surface tension ─────
  {
    id: 's1', topic: 'surface',
    prompt: 'A water strider stays on top of a pond. How?',
    options: ['It is buoyant like a boat', 'Surface tension forms a skin strong enough to support it', 'It swims very fast', 'Adhesion to the air'],
    answer: 1,
    explain: 'Strong cohesion at the surface creates surface tension, a flexible skin that supports the light strider.',
  },
  {
    id: 's2', topic: 'surface',
    prompt: 'What creates surface tension?',
    options: ['Strong cohesion between molecules at the surface', 'Adhesion to the container', 'Wind blowing on water', 'Salt in the water'],
    answer: 0,
    explain: 'Surface molecules are pulled inward and sideways by neighbors (cohesion) with nothing pulling up, creating a tight surface.',
  },
  {
    id: 's3', topic: 'surface',
    prompt: 'A steel paperclip floats when placed gently on water. Why?',
    options: ['Steel is less dense than water', 'The paperclip is hollow', 'Surface tension supports it', 'Adhesion lifts it'],
    answer: 2,
    explain: 'Steel is denser than water, but the surface "skin" can hold it up as long as it is not broken.',
  },
  {
    id: 's4', topic: 'surface',
    prompt: 'You add dish soap next to a floating paperclip. What happens?',
    options: ['It floats higher', 'It sinks, because soap weakens surface tension', 'Nothing happens', 'It dissolves'],
    answer: 1,
    explain: 'Soap gets between water molecules at the surface and weakens surface tension, so the skin can no longer hold the clip.',
  },
  {
    id: 's5', topic: 'surface',
    prompt: 'Why can a penny hold a dome of many water drops?',
    options: ['Copper absorbs water', 'Surface tension holds the dome together', 'Gravity is weaker on coins', 'Adhesion to the air'],
    answer: 1,
    explain: 'Surface tension holds the water together in a curved dome until it gets too heavy and spills.',
  },
  {
    id: 's6', topic: 'surface',
    prompt: 'A molecule at the surface of water is pulled…',
    options: ['upward by the air', 'inward and sideways by its neighbors', 'equally in every direction', 'not at all'],
    answer: 1,
    explain: 'With no water above it, a surface molecule is only pulled sideways and inward, which tightens the surface.',
  },
  {
    id: 's7', topic: 'surface',
    prompt: 'A paper boat with soap on its back end zooms forward. Why?',
    options: ['Soap is a fuel', 'Soap lowers surface tension behind the boat, so the stronger surface in front pulls it', 'Soap makes water flow downhill', 'Adhesion pushes it'],
    answer: 1,
    explain: 'The unbalanced surface tension (weak behind, strong in front) pulls the boat forward.',
  },
  {
    id: 's8', topic: 'surface',
    prompt: 'Pepper floats on water and rushes to the edges when soap touches the middle. Why?',
    options: ['Pepper is repelled by soap\'s smell', 'Soap weakens surface tension in the middle, and the stronger surface at the edges pulls the pepper', 'Soap is magnetic', 'The pepper dissolves'],
    answer: 1,
    explain: 'Where soap touches, surface tension drops; the surrounding stronger surface pulls outward, carrying the pepper.',
  },
  {
    id: 's9', topic: 'surface',
    prompt: 'Which change would DECREASE water\'s surface tension?',
    options: ['Adding soap', 'Cooling the water slightly', 'Using a cleaner glass', 'Adding more water'],
    answer: 0,
    explain: 'Soaps and detergents (surfactants) lower surface tension. Colder water actually has slightly higher surface tension.',
  },
  {
    id: 's10', topic: 'surface',
    prompt: 'You can fill a glass slightly ABOVE the rim without spilling. What is happening?',
    options: ['The glass stretches', 'Surface tension holds the water in a dome', 'Adhesion pulls water down', 'The water got lighter'],
    answer: 1,
    explain: 'The surface acts like a stretched skin that holds the water in a slight dome above the rim.',
  },

  // ───── Combination questions ─────
  {
    id: 'x1', topic: 'combo', props: ['cohesion', 'adhesion'],
    prompt: 'Water rises in a narrow tube. How do cohesion AND adhesion contribute?',
    options: [
      'Adhesion pulls water up the tube walls; cohesion pulls more water along behind it',
      'Cohesion pushes water down; adhesion does nothing',
      'Only gravity moves the water',
      'Surface tension melts the tube',
    ],
    answer: 0,
    explain: 'This is capillary action: water adheres to the walls and climbs, and cohesion drags the rest of the water up with it.',
  },
  {
    id: 'x2', topic: 'combo', props: ['cohesion', 'adhesion'],
    prompt: 'How does water travel from the roots to the leaves of a tall tree?',
    options: [
      'Roots pump it like a heart',
      'Adhesion to the narrow xylem tubes plus cohesion linking molecules into a column pulled up as leaves lose water',
      'Gravity pulls it upward',
      'Sunlight lifts the water directly',
    ],
    answer: 1,
    explain: 'Water sticks to the xylem walls (adhesion) and to itself (cohesion). As water evaporates from leaves, the whole chain is pulled upward.',
  },
  {
    id: 'x3', topic: 'combo', props: ['cohesion', 'adhesion'],
    prompt: 'A paper towel touches a spill and water climbs up into it. Which properties work together?',
    options: ['Only surface tension', 'Only evaporation', 'Adhesion to the fibers plus cohesion pulling water along', 'Only gravity'],
    answer: 2,
    explain: 'Water adheres to the paper fibers and cohesion pulls more water along: capillary action.',
  },
  {
    id: 'x4', topic: 'combo', props: ['cohesion', 'surface'],
    prompt: 'Surface tension is actually caused by which other property?',
    options: ['Adhesion', 'Cohesion', 'Evaporation', 'Density'],
    answer: 1,
    explain: 'Surface tension happens because cohesion pulls surface molecules inward and sideways, tightening the surface.',
  },
  {
    id: 'x5', topic: 'combo', props: ['cohesion', 'surface'],
    prompt: 'A penny holds many drops before spilling. Which properties explain it?',
    options: [
      'Adhesion and evaporation',
      'Cohesion between molecules creates surface tension that holds the dome together',
      'Gravity and magnetism',
      'Density and heat',
    ],
    answer: 1,
    explain: 'Cohesion pulls the molecules together, producing a surface tension "skin" that holds the dome until gravity wins.',
  },
  {
    id: 'x6', topic: 'combo', props: ['adhesion', 'cohesion'],
    prompt: 'A raindrop clings to a window AND stays in a rounded bead. Which properties explain both?',
    options: [
      'Adhesion keeps it on the glass; cohesion keeps it rounded',
      'Cohesion keeps it on the glass; adhesion keeps it round',
      'Only gravity',
      'Only evaporation',
    ],
    answer: 0,
    explain: 'Adhesion attracts the drop to the glass, while cohesion holds the drop\'s own molecules together in a bead.',
  },
  {
    id: 'x7', topic: 'combo', props: ['surface', 'adhesion'],
    prompt: 'Soap helps water clean clothes. Soap lowers ___ so water can spread and ___ the fabric fibers better.',
    options: ['surface tension; adhere to', 'cohesion; evaporate from', 'gravity; freeze on', 'density; boil on'],
    answer: 0,
    explain: 'With lower surface tension, water spreads out instead of beading, so it can adhere to and soak into fibers.',
  },
  {
    id: 'x8', topic: 'combo', props: ['adhesion', 'cohesion'],
    prompt: 'Water curves UP in a glass tube, but mercury curves DOWN. Why?',
    options: [
      'Both curve the same way',
      'Water adheres to glass more than it coheres; mercury coheres more than it adheres',
      'Mercury is colder',
      'Glass repels water',
    ],
    answer: 1,
    explain: 'For water, adhesion to glass beats cohesion, so it climbs. Mercury\'s cohesion is stronger than its adhesion to glass.',
  },
  {
    id: 'x9', topic: 'combo', props: ['adhesion', 'surface'],
    prompt: 'A water strider\'s legs are covered in waxy, water-repelling hairs. How does that help?',
    options: [
      'Low adhesion keeps its legs dry, so surface tension can support it',
      'It makes the strider heavier',
      'It lets the strider swim underwater',
      'It increases adhesion so it sticks to the water',
    ],
    answer: 0,
    explain: 'Water barely adheres to the waxy hairs, so the legs press on the surface without breaking through the skin.',
  },
  {
    id: 'x10', topic: 'combo', props: ['cohesion', 'adhesion'],
    prompt: 'Why does water climb HIGHER in a narrower tube?',
    options: [
      'Narrow tubes are colder',
      'Gravity is weaker in narrow tubes',
      'There is more wall (adhesion) for the small amount of water to lift, and cohesion carries it up',
      'Narrow tubes contain soap',
    ],
    answer: 2,
    explain: 'In a narrow tube, the wall-to-water ratio is bigger, so adhesion can lift a taller, lighter column, and cohesion keeps it connected.',
  },
];

export const QUESTION_MAP: Record<string, Question> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q]));

/** Each Challenge card asks its own signature question. */
export const CHALLENGE_QUESTION: Record<string, string> = {
  'chl-merge': 'c1',
  'chl-window': 'a1',
  'chl-strider': 's1',
  'chl-tube': 'x1',
  'chl-tree': 'x2',
  'chl-penny': 'x5',
};

export const CLASSIFY_OPTIONS = ['Cohesion', 'Adhesion', 'Surface Tension', 'Cohesion + Adhesion'];

/** Real-world example answers (index into CLASSIFY_OPTIONS) and the explanation revealed after play. */
export const REALWORLD: Record<string, { answer: number; props: Property[]; explain: string }> = {
  'rw-plant': {
    answer: 3, props: ['adhesion', 'cohesion'],
    explain: 'Water adheres to the narrow xylem tubes in the stem (adhesion) and stays linked as one column (cohesion), so it is pulled up to the leaves.',
  },
  'rw-towel': {
    answer: 3, props: ['adhesion', 'cohesion'],
    explain: 'Water sticks to the paper fibers (adhesion) and pulls more water along behind it (cohesion). This is capillary action.',
  },
  'rw-glasses': {
    answer: 1, props: ['adhesion'],
    explain: 'Water molecules are attracted to the lens surface, so drops stick instead of falling off: adhesion.',
  },
  'rw-car': {
    answer: 0, props: ['cohesion'],
    explain: 'Wax repels water, so water molecules cling to each other instead and pull into round beads: cohesion.',
  },
  'rw-needle': {
    answer: 2, props: ['surface'],
    explain: 'A steel needle is denser than water, but the surface skin created by surface tension holds it up.',
  },
  'rw-puddle': {
    answer: 0, props: ['cohesion'],
    explain: 'Once the puddles connect, water molecules attract each other and pull the two puddles into one: cohesion.',
  },
};
