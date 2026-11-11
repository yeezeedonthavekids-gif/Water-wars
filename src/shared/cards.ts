// The Water Wars card database. Public data only: challenge question answers and
// real-world classifications live server-side (server/answers.ts) so they can't be read from the client bundle.
import type { Category, EffectId, Mode, Property } from './types.js';

export interface CardDef {
  id: string;
  name: string;
  category: Category;
  /** Concepts this card connects to (used for Classic color matching). */
  properties: Property[];
  /** Wild cards can be played on any active property in Classic. */
  wild?: boolean;
  /** Short scenario shown on the card face. */
  description: string;
  /** Scientific explanation (for real-world cards this is revealed only after the card is played). */
  science: string;
  classic: string;
  battle: string;
  points: number;
  power: number;
  effect?: EffectId;
  /** Needs a target opponent when played. Can differ by mode. */
  target?: Partial<Record<Mode, boolean>>;
  art: string;
  copies: number;
}

export const PROPERTY_LABEL: Record<Property, string> = {
  cohesion: 'Cohesion',
  adhesion: 'Adhesion',
  surface: 'Surface Tension',
};

export const PROPERTY_SHORT: Record<Property, string> = {
  cohesion: 'Water ↔ water attraction',
  adhesion: 'Water ↔ other surfaces',
  surface: 'Flexible skin from cohesion',
};

export const PROPERTY_DEFINITION: Record<Property, string> = {
  cohesion:
    'Water molecules attract other water molecules. Each molecule has a slightly negative oxygen end and slightly positive hydrogen ends, so neighbors pull on each other through hydrogen bonds.',
  adhesion:
    'Water molecules attract different materials and surfaces, like glass, paper, plant tissue, or sand. Because water is polar, it sticks to other polar or charged surfaces.',
  surface:
    'At the surface, water molecules are pulled inward and sideways by their neighbors but nothing pulls them upward. Those strong cohesive forces create a flexible "skin" that resists being broken.',
};

export const CATEGORY_LABEL: Record<Category, string> = {
  cohesion: 'Cohesion',
  adhesion: 'Adhesion',
  surface: 'Surface Tension',
  challenge: 'Challenge',
  action: 'Action',
  realworld: 'Real-World',
  powerup: 'Power-Up',
};

const prop = (
  id: string,
  name: string,
  category: Property,
  points: number,
  description: string,
  science: string,
  art: string,
): CardDef => ({
  id,
  name,
  category,
  properties: [category],
  description,
  science,
  classic: `Play it when the color is ${PROPERTY_LABEL[category]} (or on another ${PROPERTY_LABEL[category]} card).`,
  battle: `Attack for ${points + 1} damage. Boost with a science question to double it!`,
  points,
  power: points + 1,
  art,
  copies: 3,
});

export const CARDS: CardDef[] = [
  // ───────── Cohesion ─────────
  prop('coh-merge', 'Droplet Merge', 'cohesion', 2,
    'Two drops touch and instantly become one bigger drop.',
    'Hydrogen bonds attract water molecules to each other. When two drops touch, their molecules pull together into one drop.',
    'merge'),
  prop('coh-bond', 'Hydrogen Bond', 'cohesion', 1,
    'Water molecules link up, oxygen to hydrogen.',
    'The slightly negative oxygen of one water molecule attracts the slightly positive hydrogen of another. These hydrogen bonds are the source of cohesion.',
    'molecule'),
  prop('coh-sphere', 'Round Raindrop', 'cohesion', 1,
    'Small raindrops pull themselves into round shapes.',
    'Cohesion pulls every molecule inward, squeezing a small drop into the shape with the least surface: a sphere.',
    'raindrop'),
  prop('coh-bead', 'Wax Paper Beads', 'cohesion', 2,
    'Water beads up tall on wax paper.',
    'Water barely sticks to wax, so cohesion wins: the molecules huddle together into tall, round beads.',
    'beads'),
  prop('coh-stream', 'Faucet Stream', 'cohesion', 2,
    'A thin stream of water stays connected as it falls.',
    'Cohesion holds the molecules together in one continuous stream until gravity stretches it so thin it breaks into drops.',
    'faucet'),
  prop('coh-web', 'Spider Web Dew', 'cohesion', 3,
    'Tiny dew drops on a web roll together into big shiny beads.',
    'When small drops touch, cohesion pulls them into larger drops, so dew on a web gathers into bigger and bigger beads.',
    'web'),

  // ───────── Adhesion ─────────
  prop('adh-window', 'Window Rain', 'adhesion', 2,
    'Raindrops cling to a window instead of falling straight off.',
    'Water molecules are attracted to the glass. That adhesion holds drops on the window even though gravity pulls them down.',
    'window'),
  prop('adh-meniscus', 'Meniscus Curve', 'adhesion', 3,
    'Water curves up the sides of a glass cylinder.',
    'Water adheres to glass, so at the edges it climbs the walls. That makes the curved surface called a meniscus.',
    'meniscus'),
  prop('adh-leaf', 'Leaf Cling', 'adhesion', 1,
    'A drop hangs on the underside of a leaf without falling.',
    'Adhesion between water and the leaf surface holds the drop in place against gravity.',
    'leaf'),
  prop('adh-sand', 'Sandcastle Glue', 'adhesion', 2,
    'Damp sand holds a castle shape, but dry sand crumbles.',
    'Water adheres to each sand grain and forms tiny bridges between grains, holding the castle together.',
    'sand'),
  prop('adh-teapot', 'Teapot Dribble', 'adhesion', 2,
    'Pour slowly and water dribbles down the outside of the spout.',
    'At low speed, water sticks to the spout surface (adhesion) and follows it around the curve instead of pouring cleanly.',
    'teapot'),
  prop('adh-shirt', 'Clingy Shirt', 'adhesion', 1,
    'A wet T-shirt sticks to your skin.',
    'Water adheres to both the cotton fibers and your skin, so a thin layer of water holds the fabric against you.',
    'shirt'),

  // ───────── Surface Tension ─────────
  prop('sur-strider', 'Water Strider', 'surface', 3,
    'A water strider walks across a pond without sinking.',
    'Cohesion makes the surface act like a stretchy skin. The strider is light and spreads its weight, so the skin holds it up.',
    'strider'),
  prop('sur-clip', 'Floating Paperclip', 'surface', 2,
    'A steel paperclip floats when placed gently on water.',
    'Steel is denser than water, but surface tension can support the clip as long as the surface "skin" is not broken.',
    'paperclip'),
  prop('sur-penny', 'Penny Dome', 'surface', 2,
    'A penny holds a dome of many water drops.',
    'Surface tension holds the water together in a dome above the edge of the penny until it gets too heavy.',
    'penny'),
  prop('sur-glass', 'Overfull Glass', 'surface', 1,
    'Water bulges above the rim of a glass without spilling.',
    'Surface tension acts like a skin across the top, holding the water in a slight dome above the rim.',
    'glass'),
  prop('sur-boat', 'Soap Boat', 'surface', 2,
    'A paper boat with soap on its back zooms across the water.',
    'Soap lowers surface tension behind the boat. The stronger surface tension in front pulls the boat forward.',
    'boat'),
  prop('sur-pepper', 'Pepper Scatter', 'surface', 1,
    'Pepper rests on water, then rushes away when soap touches the middle.',
    'Pepper sits on the surface skin. Soap weakens surface tension in the middle, and the stronger surface around the edges pulls the pepper outward.',
    'pepper'),

  // ───────── Challenge ─────────
  {
    id: 'chl-merge', name: 'Merge Mystery', category: 'challenge', properties: ['cohesion'],
    description: 'Two drops merge into one. Explain the molecular attraction.',
    science: 'Challenges test an opponent. Cohesion questions focus on water attracting water.',
    classic: 'Quiz an opponent with a science question. Wrong answer: they draw 2 cards.',
    battle: 'Challenge an opponent. Wrong answer: they take 3 damage. Correct: they heal 1.',
    points: 2, power: 3, target: { classic: true, battle: true }, art: 'question', copies: 1,
  },
  {
    id: 'chl-window', name: 'Window Detective', category: 'challenge', properties: ['adhesion'],
    description: 'Rain clings to a window. Which interaction explains it?',
    science: 'Challenges test an opponent. Adhesion questions focus on water sticking to other materials.',
    classic: 'Quiz an opponent with a science question. Wrong answer: they draw 2 cards.',
    battle: 'Challenge an opponent. Wrong answer: they take 3 damage. Correct: they heal 1.',
    points: 2, power: 3, target: { classic: true, battle: true }, art: 'magnifier', copies: 1,
  },
  {
    id: 'chl-strider', name: 'Strider Secret', category: 'challenge', properties: ['surface'],
    description: 'A water strider stays on top of a pond. Explain how.',
    science: 'Challenges test an opponent. Surface tension questions focus on the "skin" of water.',
    classic: 'Quiz an opponent with a science question. Wrong answer: they draw 2 cards.',
    battle: 'Challenge an opponent. Wrong answer: they take 4 damage. Correct: they heal 1.',
    points: 3, power: 4, target: { classic: true, battle: true }, art: 'question', copies: 1,
  },
  {
    id: 'chl-tube', name: 'Capillary Combo', category: 'challenge', properties: ['cohesion', 'adhesion'],
    description: 'Water rises in a narrow tube. Explain cohesion AND adhesion.',
    science: 'Combo challenges need two properties working together.',
    classic: 'Combo quiz for an opponent. Wrong answer: they draw 2 cards.',
    battle: 'Combo challenge! Wrong answer: they take 5 damage. Correct: they heal 1.',
    points: 4, power: 5, target: { classic: true, battle: true }, art: 'tube', copies: 1,
  },
  {
    id: 'chl-tree', name: 'Treetop Express', category: 'challenge', properties: ['cohesion', 'adhesion'],
    description: 'How does water climb from roots to the top of a tall tree?',
    science: 'Combo challenges need two properties working together.',
    classic: 'Combo quiz for an opponent. Wrong answer: they draw 2 cards.',
    battle: 'Combo challenge! Wrong answer: they take 5 damage. Correct: they heal 1.',
    points: 4, power: 5, target: { classic: true, battle: true }, art: 'tree', copies: 1,
  },
  {
    id: 'chl-penny', name: 'Penny Puzzle', category: 'challenge', properties: ['cohesion', 'surface'],
    description: 'A penny holds many drops before spilling. Which properties explain it?',
    science: 'Combo challenges need two properties working together.',
    classic: 'Combo quiz for an opponent. Wrong answer: they draw 2 cards.',
    battle: 'Combo challenge! Wrong answer: they take 5 damage. Correct: they heal 1.',
    points: 4, power: 5, target: { classic: true, battle: true }, art: 'penny', copies: 1,
  },

  // ───────── Action ─────────
  {
    id: 'act-soap', name: 'Soap Disruptor', category: 'action', properties: ['surface'], effect: 'soap',
    description: 'Soap breaks the surface skin.',
    science: 'Soap molecules squeeze between water molecules at the surface and weaken surface tension.',
    classic: 'The next player is skipped.',
    battle: 'Pop a target\'s shield, then deal 2 damage.',
    points: 1, power: 2, target: { battle: true }, art: 'soap', copies: 1,
  },
  {
    id: 'act-evap', name: 'Evaporation', category: 'action', properties: ['cohesion'], effect: 'evaporation',
    description: 'Heat snaps hydrogen bonds and molecules escape.',
    science: 'To evaporate, a molecule must break the cohesive hydrogen bonds holding it to its neighbors. That takes energy.',
    classic: 'Reverse the turn order.',
    battle: 'Target discards a random card and takes 1 damage.',
    points: 1, power: 1, target: { battle: true }, art: 'sun', copies: 1,
  },
  {
    id: 'act-swap', name: 'Property Swap', category: 'action', properties: ['adhesion'], effect: 'swap',
    description: 'Stick to something new!',
    science: 'Adhesion means water can stick to many different materials, so it can switch from one surface to another.',
    classic: 'Give one of your cards to an opponent and take a random card from them.',
    battle: 'Give one of your cards to an opponent and take a random card from them.',
    points: 1, power: 0, target: { classic: true, battle: true }, art: 'swap', copies: 1,
  },
  {
    id: 'act-capillary', name: 'Capillary Pull', category: 'action', properties: ['adhesion'], effect: 'capillary',
    description: 'Water climbs up into narrow spaces.',
    science: 'In narrow spaces, adhesion pulls water up the walls and cohesion drags more water along behind it.',
    classic: 'The next player draws 2 cards, unless they stack another draw card!',
    battle: 'You draw 2 cards.',
    points: 1, power: 0, art: 'tube', copies: 1,
  },
  {
    id: 'act-grab', name: 'Droplet Grab', category: 'action', properties: ['cohesion'], effect: 'grab',
    description: 'Big drops pull in smaller ones.',
    science: 'When drops touch, cohesion pulls them together, so a little drop gets absorbed into the big drop next to it.',
    classic: 'Push one of your cards into an opponent\'s hand.',
    battle: 'Take a random card from an opponent.',
    points: 1, power: 0, target: { classic: true, battle: true }, art: 'grab', copies: 1,
  },
  {
    id: 'act-splash', name: 'Surfactant Splash', category: 'action', properties: ['surface'], effect: 'splash',
    description: 'A wave of detergent hits the whole pond.',
    science: 'Surfactants (like detergents) lower surface tension everywhere they spread, so floating objects sink.',
    classic: 'Every other player draws 1 card.',
    battle: 'Deal 2 damage to every opponent.',
    points: 1, power: 2, art: 'splash', copies: 1,
  },

  // ───────── Twist cards (wild actions) ─────────
  {
    id: 'act-storm', name: 'Storm Surge', category: 'action', properties: ['cohesion'], wild: true, effect: 'storm',
    description: 'A massive wave rolls in and swamps the next player.',
    science: 'Cohesion keeps water molecules linked together, so a wave moves as one connected mass with huge force.',
    classic: 'Wild. Choose the color. The next player draws 4, unless they stack another draw card!',
    battle: 'Deal 4 damage to a target.',
    points: 0, power: 4, target: { battle: true }, art: 'wave', copies: 2,
  },
  {
    id: 'act-whirlpool', name: 'Whirlpool', category: 'action', properties: ['cohesion'], wild: true, effect: 'whirlpool',
    description: 'Everything gets sucked in and spun around.',
    science: 'In a whirlpool, cohesion keeps the spinning water together, so floating things get pulled toward the center.',
    classic: 'Wild. Swap your whole hand with any player.',
    battle: 'Swap your whole hand with any player.',
    points: 0, power: 0, target: { classic: true, battle: true }, art: 'whirlpool', copies: 1,
  },
  {
    id: 'act-current', name: 'Ocean Current', category: 'action', properties: ['cohesion'], wild: true, effect: 'current',
    description: 'The current carries everyone\'s cards downstream.',
    science: 'Cohesion keeps water flowing as one connected current, carrying everything in it along with the flow.',
    classic: 'Wild. Everyone passes their whole hand to the next player.',
    battle: 'Everyone passes their whole hand to the next player.',
    points: 0, power: 0, art: 'current', copies: 1,
  },

  // ───────── Real-World Examples ─────────
  ...([
    ['rw-plant', 'Plant Stem Express', 'Water travels up through a plant stem from the roots to the leaves.', 'plant'],
    ['rw-towel', 'Paper Towel Rescue', 'A paper towel touches a spill and water climbs up into it.', 'towel'],
    ['rw-glasses', 'Rainy Glasses', 'Raindrops stick to your eyeglasses on a rainy walk.', 'glasses'],
    ['rw-car', 'Waxed Car Hood', 'Rain on a freshly waxed car forms round beads.', 'car'],
    ['rw-needle', 'Floating Needle', 'A sewing needle rests on top of a bowl of water.', 'needle'],
    ['rw-puddle', 'Puddle Bridge', 'Drag a finger between two puddles and they rush together into one.', 'puddle'],
  ] as const).map(([id, name, description, art]): CardDef => ({
    id, name, category: 'realworld', properties: [], wild: true, description,
    science: 'Play this card to classify the example. The science is revealed after you answer!',
    classic: 'Wild. Name the property this example shows. Wrong answer: you draw 1 card.',
    battle: 'Name the property this shows: correct deals 3 damage to your target.',
    points: 3, power: 3, target: { battle: true }, art, copies: 1,
  })),

  // ───────── Power-Ups ─────────
  {
    id: 'pow-water', name: 'Water Power!', category: 'powerup', properties: ['cohesion', 'adhesion', 'surface'], wild: true,
    effect: 'waterPower',
    description: 'Unleash the power of water!',
    science: 'Water is powerful because cohesion, adhesion, and surface tension all come from its polar molecules.',
    classic: 'Wild. Choose: next player draws 2, skip the next player, or gain a Shield.',
    battle: 'Free action. Choose: draw 2, heal 3, or a 3-point Shield.',
    points: 0, power: 0, art: 'hero', copies: 2,
  },
  {
    id: 'pow-wild', name: 'Wild Bond', category: 'powerup', properties: ['cohesion', 'adhesion', 'surface'], wild: true,
    effect: 'wildBond',
    description: 'Hydrogen bonds connect to anything polar.',
    science: 'The same polarity that causes cohesion also lets water bond with other polar materials (adhesion).',
    classic: 'Wild. Choose the next color.',
    battle: 'Free action. Draw 1 card and heal 2.',
    points: 0, power: 0, art: 'bond', copies: 1,
  },
  {
    id: 'pow-hbond', name: 'H-Bond Boost', category: 'powerup', properties: ['cohesion'], wild: true, effect: 'hbond',
    description: 'Extra-strong hydrogen bonding!',
    science: 'Hydrogen bonds are much stronger than the attractions between most other small molecules. That is why water has such strong cohesion.',
    classic: 'Wild. Take another turn right away.',
    battle: 'Free action. Your next attack deals double damage.',
    points: 0, power: 0, art: 'bolt', copies: 1,
  },
  {
    id: 'pow-shield', name: 'Surface Shield', category: 'powerup', properties: ['surface'], wild: true, effect: 'shield',
    description: 'Hide under a tough surface film.',
    science: 'Surface tension lets the water surface resist being pushed or broken, like a stretched elastic sheet.',
    classic: 'Wild. Block the next action or challenge aimed at you.',
    battle: 'Free action. Gain a Shield that absorbs 5 damage.',
    points: 0, power: 0, art: 'shield', copies: 1,
  },
  {
    id: 'pow-rain', name: 'Rain Refill', category: 'powerup', properties: ['cohesion'], wild: true, effect: 'rain',
    description: 'Fresh rain fills your drop back up.',
    science: 'Raindrops form as cohesion pulls tiny cloud droplets together into drops heavy enough to fall.',
    classic: 'Wild. The next player draws 2 cards (stackable).',
    battle: 'Free action. Heal 5.',
    points: 0, power: 0, art: 'cloud', copies: 1,
  },
  {
    id: 'pow-star', name: 'Science Star', category: 'powerup', properties: ['cohesion', 'adhesion', 'surface'], wild: true,
    effect: 'star',
    description: 'Answer a bonus science question.',
    science: 'Scientists explain what they observe using evidence. Answer correctly to earn the reward.',
    classic: 'Wild. Bonus question: correct = take another turn, wrong = draw 1.',
    battle: 'Free action. Bonus question: correct heals 4 and draws 1.',
    points: 0, power: 0, art: 'star', copies: 1,
  },
];

export const CARD_MAP: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Card instances are "defId~n" so duplicates are distinguishable. */
export function defOf(instanceId: string): CardDef {
  const def = CARD_MAP[instanceId.split('~')[0]];
  if (!def) throw new Error(`Unknown card ${instanceId}`);
  return def;
}

export function buildDeckIds(): string[] {
  const ids: string[] = [];
  for (const c of CARDS) for (let i = 1; i <= c.copies; i++) ids.push(`${c.id}~${i}`);
  return ids;
}

export const isPropertyCard = (c: CardDef) =>
  c.category === 'cohesion' || c.category === 'adhesion' || c.category === 'surface';

export function needsTarget(c: CardDef, mode: Mode): boolean {
  if (mode === 'battle' && isPropertyCard(c)) return true;
  return !!c.target?.[mode];
}

/** Classic: draw cards that can be stacked on a pending draw (+2 / +4). */
export function isStackable(c: CardDef): boolean {
  return c.effect === 'capillary' || c.effect === 'rain' || c.effect === 'storm' || c.effect === 'waterPower';
}

/** Classic: can this card be played on the current pile? */
export function classicPlayable(c: CardDef, active: Property | null, topId: string | null): boolean {
  if (c.wild) return true;
  if (!active) return true;
  if (c.properties.includes(active)) return true;
  if (topId && defOf(topId).id === c.id) return true;
  return false;
}
