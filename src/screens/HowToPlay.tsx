import { useMemo, useState } from 'react';
import type { Route } from '../App';
import { CARDS, CATEGORY_LABEL, PROPERTY_DEFINITION, PROPERTY_LABEL } from '../shared/cards';
import type { Category, Mode, Property } from '../shared/types';
import { CardArt } from '../components/CardArt';
import { Icon } from '../components/Icons';
import { CardDetail, CardView, Modal } from '../components/ui';

const TABS = [
  { id: 'science', label: 'The Science' },
  { id: 'classic', label: 'Classic' },
  { id: 'battle', label: 'Battle' },
  { id: 'cards', label: 'Card Library' },
] as const;

const EXAMPLES: Record<Property, { art: string; text: string }[]> = {
  cohesion: [
    { art: 'merge', text: 'Two drops touching merge into one.' },
    { art: 'beads', text: 'Water beads up tall on wax paper.' },
  ],
  adhesion: [
    { art: 'window', text: 'Rain clings to a window.' },
    { art: 'meniscus', text: 'Water curves up the sides of a glass tube.' },
  ],
  surface: [
    { art: 'strider', text: 'A water strider walks on a pond.' },
    { art: 'penny', text: 'A penny holds a dome of drops.' },
  ],
};

export function RulesClassic() {
  return (
    <div className="rules">
      <p className="lead">Inspired by UNO and Go Fish: match properties, collect sets, and answer science questions. Highest score wins!</p>
      <ol className="steps">
        <li><b>Setup.</b> Everyone gets 7 cards. One property card starts the pile; its color is the <b>active property</b>.</li>
        <li><b>Free actions</b> (start of your turn, optional, once each):
          <ul>
            <li><b>Bank a Set:</b> 3 property cards of the same property. Answer a science question: correct = <b>+6</b>, wrong = +2.</li>
            <li><b>Offer a Trade:</b> give one card to an opponent in exchange for a card of a property you name. They can accept or decline.</li>
          </ul>
        </li>
        <li><b>Main action</b> (pick one):
          <ul>
            <li><b>Play a card</b> that matches the active property (or the same card, or any wild). Property cards score their points.</li>
            <li><b>Draw</b> one card, then you may play a card or end your turn.</li>
            <li><b>Go Fish:</b> ask an opponent for a property. If they have one, you take it and may then play. If not, “Go Fish!”: draw 1 and your turn ends.</li>
          </ul>
        </li>
        <li><b>Challenge cards</b> quiz an opponent. Correct: they score. Wrong: you score and they draw 1.</li>
        <li><b>Real-World cards</b> are wild: name the property shown (cohesion, adhesion, surface tension, or both cohesion + adhesion). Correct = +3.</li>
        <li><b>Winning.</b> The first player to empty their hand gets <b>+10</b> and ends the game. Otherwise the game ends after 10 rounds. Highest score wins.</li>
      </ol>
      <div className="tip"><Icon name="info" size={16} /> Strategy: banking sets scores big but empties your hand of matching colors. Going out early ends the game for everyone, so time it well!</div>
    </div>
  );
}

export function RulesBattle() {
  return (
    <div className="rules">
      <p className="lead">Inspired by battle card games: every player is a water drop with <b>20 HP</b>. Last drop standing wins!</p>
      <ol className="steps">
        <li><b>Setup.</b> Everyone gets 5 cards. At the start of your turn you draw 1 (up to 8 cards).</li>
        <li><b>Power-Up</b> (free, once per turn): shields, healing, H-Bond Boost (double damage), and more.</li>
        <li><b>Main action</b> (pick one):
          <ul>
            <li><b>Attack</b> with a property card. Its damage is shown in the corner.</li>
            <li><b>Science Boost:</b> answer a question about that property. Correct = <b>double damage</b>. Wrong = the attack fizzles!</li>
            <li><b>Combo Attack:</b> play two cards of <b>different</b> properties and answer a combination question. Correct = both damages <b>+2</b>. Wrong = half.</li>
            <li><b>Challenge</b> an opponent: if they answer wrong they take damage, if right they heal 1.</li>
            <li><b>Real-World</b> cards: classify the example correctly to deal 3 damage.</li>
            <li><b>Action</b> cards: Soap Disruptor pops shields, Surfactant Splash hits everyone, and more.</li>
            <li><b>Rest:</b> draw 1 and heal 1.</li>
          </ul>
        </li>
        <li><b>Knockouts.</b> At 0 HP your drop evaporates. Knocking someone out earns bonus points.</li>
        <li><b>Drought.</b> After round 10, every drop loses 1 HP at the start of its turn, so games always end.</li>
      </ol>
      <div className="tip"><Icon name="info" size={16} /> Strategy: a Science Boost is risky but powerful. Know your science and it pays off!</div>
    </div>
  );
}

export default function HowToPlay({ navigate, initialTab }: { navigate: (r: Route) => void; initialTab?: string }) {
  const [tab, setTab] = useState<string>(initialTab ?? 'science');
  const [detail, setDetail] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('classic');
  const [filter, setFilter] = useState<Category | 'all'>('all');
  const cards = useMemo(() => CARDS.filter((c) => filter === 'all' || c.category === filter), [filter]);

  return (
    <main className="screen howto">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => navigate({ name: 'menu' })} aria-label="Back">
          <Icon name="back" />
        </button>
        <h1>How to Play</h1>
      </header>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'science' && (
        <div className="science-grid">
          {(['cohesion', 'adhesion', 'surface'] as Property[]).map((p) => (
            <section key={p} className={`panel science-card cat-${p}`}>
              <h2>{PROPERTY_LABEL[p]}</h2>
              <p>{PROPERTY_DEFINITION[p]}</p>
              <div className="examples">
                {EXAMPLES[p].map((ex) => (
                  <div key={ex.art} className="example">
                    <CardArt art={ex.art} className="example-art" />
                    <span>{ex.text}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
          <section className="panel science-card combo">
            <h2>Working together</h2>
            <p>
              Many real examples use more than one property. In <b>capillary action</b> (water rising in a narrow tube, a paper
              towel, or a plant stem), <b>adhesion</b> pulls water up the walls while <b>cohesion</b> drags the rest of the water
              along. And <b>surface tension</b> itself is caused by <b>cohesion</b> at the water's surface.
            </p>
          </section>
        </div>
      )}
      {tab === 'classic' && <div className="panel">{<RulesClassic />}</div>}
      {tab === 'battle' && <div className="panel">{<RulesBattle />}</div>}
      {tab === 'cards' && (
        <div className="library">
          <div className="library-bar">
            <div className="chips-scroll">
              {(['all', 'cohesion', 'adhesion', 'surface', 'challenge', 'action', 'realworld', 'powerup'] as const).map((c) => (
                <button key={c} className={`chip-btn ${c !== 'all' ? `cat-${c}` : ''} ${filter === c ? 'on' : ''}`} onClick={() => setFilter(c)}>
                  {c === 'all' ? `All (${CARDS.length})` : CATEGORY_LABEL[c]}
                </button>
              ))}
            </div>
            <div className="seg seg-sm">
              <button className={mode === 'classic' ? 'on' : ''} onClick={() => setMode('classic')}>Classic</button>
              <button className={mode === 'battle' ? 'on' : ''} onClick={() => setMode('battle')}>Battle</button>
            </div>
          </div>
          <div className="card-grid">
            {cards.map((c) => (
              <CardView key={c.id} id={c.id} size="md" mode={mode} onClick={() => setDetail(c.id)} />
            ))}
          </div>
        </div>
      )}
      <Modal open={!!detail} onClose={() => setDetail(null)} wide>
        {detail && <CardDetail id={detail} mode={mode} />}
      </Modal>
    </main>
  );
}
