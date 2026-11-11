// Original line-art illustrations for every card. 64×64 viewBox, stroke = currentColor, water = var(--water).
import { memo, type ReactNode } from 'react';

const W = 'var(--water, #7dd3fc)';
const WL = 'var(--water-light, #e0f7ff)';

/** Water drop centred at (x, y) with radius r (the round bottom). */
function Drop({ x, y, r, fill = W, face = false }: { x: number; y: number; r: number; fill?: string; face?: boolean }) {
  const top = y - r * 2.1;
  const d = `M${x} ${top} C ${x + r * 0.35} ${y - r * 1.3}, ${x + r} ${y - r * 0.75}, ${x + r} ${y} A ${r} ${r} 0 1 1 ${x - r} ${y} C ${x - r} ${y - r * 0.75}, ${x - r * 0.35} ${y - r * 1.3}, ${x} ${top} Z`;
  return (
    <g>
      <path d={d} fill={fill} stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d={`M${x - r * 0.55} ${y - r * 0.1} q 0 ${-r * 0.5} ${r * 0.35} ${-r * 0.8}`} stroke={WL} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      {face && (
        <g fill="currentColor">
          <circle cx={x - r * 0.35} cy={y + r * 0.05} r={r * 0.11} />
          <circle cx={x + r * 0.35} cy={y + r * 0.05} r={r * 0.11} />
          <path d={`M${x - r * 0.3} ${y + r * 0.38} q ${r * 0.3} ${r * 0.28} ${r * 0.6} 0`} stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round" />
        </g>
      )}
    </g>
  );
}

const Water = ({ y = 46 }: { y?: number }) => (
  <path d={`M4 ${y} q 7 -3 14 0 t 14 0 t 14 0 t 14 0 V 60 H 4 Z`} fill={W} opacity={0.55} stroke="none" />
);

const ARTS: Record<string, ReactNode> = {
  merge: (
    <>
      <Drop x={20} y={38} r={9} face />
      <Drop x={44} y={38} r={9} face />
      <path d="M29 34 h6 M29 40 h6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M10 20 l-4 -4 M54 20 l4 -4 M32 14 v-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  molecule: (
    <>
      {[[20, 24], [44, 40]].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={8} fill={W} stroke="currentColor" strokeWidth={2.2} />
          <circle cx={x - 9} cy={y + 7} r={4} fill={WL} stroke="currentColor" strokeWidth={2} />
          <circle cx={x + 9} cy={y + 7} r={4} fill={WL} stroke="currentColor" strokeWidth={2} />
        </g>
      ))}
      <path d="M29 31 L 36 33" stroke="currentColor" strokeWidth={2} strokeDasharray="2 2.5" strokeLinecap="round" />
      <text x={16} y={27} fontSize={7} fontWeight={800} fill="currentColor">O</text>
      <text x={40} y={43} fontSize={7} fontWeight={800} fill="currentColor">O</text>
    </>
  ),
  raindrop: (
    <>
      <circle cx={32} cy={32} r={13} fill={W} stroke="currentColor" strokeWidth={2.2} />
      <path d="M25 27 q 2 -5 7 -6" stroke={WL} strokeWidth={2} fill="none" strokeLinecap="round" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <path key={a} d="M32 13 v-5" transform={`rotate(${a} 32 32)`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      ))}
      {[45, 135, 225, 315].map((a) => (
        <path key={a} d="M32 22 l0 3" transform={`rotate(${a} 32 32)`} stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" opacity={0.6} />
      ))}
    </>
  ),
  beads: (
    <>
      <path d="M6 48 L58 48 L54 56 L10 56 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <ellipse cx={20} cy={42} rx={8} ry={6.5} fill={W} stroke="currentColor" strokeWidth={2.2} />
      <ellipse cx={40} cy={40} rx={10} ry={8.5} fill={W} stroke="currentColor" strokeWidth={2.2} />
      <ellipse cx={53} cy={44} rx={4} ry={3.5} fill={W} stroke="currentColor" strokeWidth={2} />
      <path d="M35 36 q 2 -3 5 -3 M16 39 q 1 -2 3 -2" stroke={WL} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  ),
  faucet: (
    <>
      <path d="M6 14 H30 a6 6 0 0 1 6 6 v4 h-8 v-2 H6 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M14 14 v-6 M8 8 h12" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <path d="M31 25 C 31 34, 33 40, 32 46" stroke={W} strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M31 25 C 31 34, 33 40, 32 46" stroke="currentColor" strokeWidth={1.2} fill="none" opacity={0.5} />
      <Drop x={32} y={56} r={4} />
    </>
  ),
  web: (
    <>
      {[0, 45, 90, 135].map((a) => (
        <path key={a} d="M32 6 V58" transform={`rotate(${a} 32 32)`} stroke="currentColor" strokeWidth={1.4} opacity={0.75} />
      ))}
      {[10, 18, 25].map((r) => (
        <polygon key={r} points={Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return `${32 + r * Math.sin(a)},${32 - r * Math.cos(a)}`;
        }).join(' ')} fill="none" stroke="currentColor" strokeWidth={1.4} opacity={0.75} />
      ))}
      <circle cx={42} cy={22} r={4.5} fill={W} stroke="currentColor" strokeWidth={1.8} />
      <circle cx={21} cy={39} r={3} fill={W} stroke="currentColor" strokeWidth={1.6} />
      <circle cx={36} cy={47} r={2.2} fill={W} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={18} cy={20} r={2} fill={W} stroke="currentColor" strokeWidth={1.4} />
    </>
  ),
  window: (
    <>
      <rect x={10} y={8} width={44} height={48} rx={3} fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M32 8 V56 M10 32 H54" stroke="currentColor" strokeWidth={2} />
      <Drop x={21} y={22} r={3.5} />
      <Drop x={44} y={18} r={3} />
      <Drop x={40} y={45} r={4} />
      <Drop x={19} y={47} r={2.6} />
      <path d="M44 22 v6 M21 26 v3" stroke={W} strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  meniscus: (
    <>
      <path d="M18 6 V54 a4 4 0 0 0 4 4 h20 a4 4 0 0 0 4 -4 V6" fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M18 26 Q 32 36 46 26 V54 a4 4 0 0 1 -4 4 H22 a4 4 0 0 1 -4 -4 Z" fill={W} opacity={0.75} />
      <path d="M18 24 Q 32 36 46 24" stroke="currentColor" strokeWidth={2} fill="none" />
      {[14, 22, 30, 38, 46].map((y) => (
        <path key={y} d={`M46 ${y} h-5`} stroke="currentColor" strokeWidth={1.5} />
      ))}
      <path d="M12 22 l4 3 M52 22 l-4 3" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  leaf: (
    <>
      <path d="M8 40 C 14 14, 44 6, 58 10 C 54 30, 38 52, 8 40 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M8 40 C 24 32, 38 22, 58 10 M24 32 l-2 -8 M34 25 l1 -9 M30 28 l8 4 M42 19 l8 2" stroke="currentColor" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      <Drop x={30} y={53} r={5} />
      <circle cx={44} cy={30} r={3} fill={W} stroke="currentColor" strokeWidth={1.5} />
    </>
  ),
  sand: (
    <>
      <path d="M8 54 H56 M14 54 V36 h8 v-6 h20 v6 h8 v18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M24 30 V20 h4 v3 h8 v-3 h4 v10 M32 20 V8 l8 3 -8 3" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      {[[18, 42], [26, 46], [36, 40], [44, 46], [30, 36], [40, 50], [20, 50]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.6} fill={W} stroke="currentColor" strokeWidth={0.8} />
      ))}
      <rect x={29} y={44} width={6} height={10} rx={3} fill="none" stroke="currentColor" strokeWidth={1.8} />
    </>
  ),
  teapot: (
    <>
      <path d="M16 26 h26 a4 4 0 0 1 4 4 v8 a12 12 0 0 1 -12 12 h-10 a12 12 0 0 1 -12 -12 v-8 a4 4 0 0 1 4 -4 Z" fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M22 26 a7 4 0 0 1 14 0 M29 20 v2" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M46 32 c 6 -2 10 -6 12 -10" stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <path d="M58 22 c 2 6 -2 10 -6 12 c -2 6 -2 12 0 18" stroke={W} strokeWidth={3.2} fill="none" strokeLinecap="round" />
      <path d="M12 30 c -6 0 -6 10 0 10" stroke="currentColor" strokeWidth={2.2} fill="none" />
    </>
  ),
  shirt: (
    <>
      <path d="M22 8 L8 16 l5 10 6 -3 V56 h26 V23 l6 3 5 -10 L42 8 c -2 5 -6 7 -10 7 s -8 -2 -10 -7 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M22 30 c 4 4 0 8 4 12 c 4 4 10 0 14 4" stroke={W} strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.9} />
      <Drop x={28} y={50} r={2.8} />
      <Drop x={38} y={34} r={2.4} />
    </>
  ),
  strider: (
    <>
      <Water y={44} />
      <ellipse cx={32} cy={30} rx={10} ry={4} fill={W} stroke="currentColor" strokeWidth={2.2} />
      <circle cx={44} cy={29} r={3} fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M26 31 L14 38 L6 44 M38 31 L50 38 L58 44 M28 28 L20 20 L10 22 M36 28 L44 20 L54 22 M30 33 L24 44 M34 33 L40 44" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 44 q 4 4 8 0 M54 44 q 4 4 8 0 M20 44 q 4 3 8 0 M36 44 q 4 3 8 0" stroke="currentColor" strokeWidth={1.6} fill="none" />
    </>
  ),
  paperclip: (
    <>
      <Water y={40} />
      <path d="M16 36 h30 a5 5 0 0 0 0 -10 H18 a3 3 0 0 0 0 6 h24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M4 40 q 10 4 20 0 t 20 0 t 16 0" stroke="currentColor" strokeWidth={1.8} fill="none" />
    </>
  ),
  penny: (
    <>
      <ellipse cx={32} cy={46} rx={22} ry={7} fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M10 46 v4 a22 7 0 0 0 44 0 v-4" fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M12 45 C 12 24, 52 24, 52 45" fill={W} stroke="currentColor" strokeWidth={2.2} opacity={0.9} />
      <path d="M20 34 q 4 -6 10 -7" stroke={WL} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M32 18 v-6 M18 22 l-4 -4 M46 22 l4 -4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  glass: (
    <>
      <path d="M16 18 L20 58 H44 L48 18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M16.5 22 L20 58 H44 L47.5 22 Z" fill={W} opacity={0.6} />
      <path d="M15 18 C 18 11, 46 11, 49 18" fill={W} stroke="currentColor" strokeWidth={2} />
      <path d="M24 16 q 4 -3 8 -3" stroke={WL} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  ),
  boat: (
    <>
      <Water y={44} />
      <path d="M14 38 H50 L44 46 H20 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M32 38 V14 L46 32 H32" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <circle cx={10} cy={42} r={3} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={5} cy={36} r={2} fill="none" stroke="currentColor" strokeWidth={1.4} />
      <path d="M52 42 h8 M54 37 h6" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  pepper: (
    <>
      <ellipse cx={32} cy={40} rx={26} ry={12} fill={W} opacity={0.5} stroke="currentColor" strokeWidth={2.2} />
      {[[12, 38], [16, 44], [52, 38], [48, 45], [22, 32], [44, 32], [10, 42], [54, 42], [28, 50], [38, 50]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.3} fill="currentColor" />
      ))}
      <path d="M32 6 v18" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <Drop x={32} y={34} r={3} fill="var(--soap, #fef3c7)" />
      <path d="M26 40 l-5 0 M38 40 l5 0" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </>
  ),
  question: (
    <>
      <circle cx={32} cy={32} r={22} fill={W} opacity={0.35} stroke="currentColor" strokeWidth={2.2} />
      <path d="M24 26 a8 8 0 1 1 11 7.5 c -2 1 -3 2.5 -3 5 v2" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" />
      <circle cx={32} cy={46} r={2.4} fill="currentColor" />
    </>
  ),
  magnifier: (
    <>
      <circle cx={27} cy={27} r={15} fill={W} opacity={0.35} stroke="currentColor" strokeWidth={2.6} />
      <path d="M38 38 L54 54" stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
      <Drop x={27} y={31} r={5} />
    </>
  ),
  tube: (
    <>
      <path d="M6 50 h52" stroke="currentColor" strokeWidth={2} />
      <path d="M6 50 V58 H58 V50" fill={W} opacity={0.5} />
      {[[16, 8, 34], [32, 5, 22], [46, 3, 14]].map(([x, w, top], i) => (
        <g key={i}>
          <rect x={x - w / 2} y={top} width={w} height={50 - top + 6} fill={W} opacity={0.85} />
          <path d={`M${x - w / 2} 8 V56 M${x + w / 2} 8 V56`} stroke="currentColor" strokeWidth={2} />
        </g>
      ))}
      <path d="M52 30 l4 -4 4 4 M56 26 v14" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  ),
  tree: (
    <>
      <circle cx={32} cy={20} r={14} fill="none" stroke="currentColor" strokeWidth={2.2} />
      <circle cx={20} cy={26} r={8} fill="none" stroke="currentColor" strokeWidth={2} />
      <circle cx={44} cy={26} r={8} fill="none" stroke="currentColor" strokeWidth={2} />
      <path d="M28 58 V32 M36 58 V32" stroke="currentColor" strokeWidth={2.2} />
      <path d="M32 54 V28" stroke={W} strokeWidth={3} strokeDasharray="3 3" strokeLinecap="round" />
      <path d="M28 58 l-6 4 M36 58 l6 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  soap: (
    <>
      <rect x={10} y={34} width={30} height={18} rx={6} fill="var(--soap, #fef3c7)" opacity={0.85} stroke="currentColor" strokeWidth={2.2} />
      <text x={14} y={47} fontSize={8} fontWeight={800} fill="currentColor">SOAP</text>
      <circle cx={44} cy={22} r={9} fill={W} opacity={0.35} stroke="currentColor" strokeWidth={2} />
      <circle cx={28} cy={20} r={5} fill={W} opacity={0.35} stroke="currentColor" strokeWidth={1.8} />
      <circle cx={52} cy={40} r={4} fill={W} opacity={0.35} stroke="currentColor" strokeWidth={1.6} />
      <path d="M40 18 q 2 -3 5 -3" stroke={WL} strokeWidth={1.6} fill="none" strokeLinecap="round" />
    </>
  ),
  sun: (
    <>
      <circle cx={22} cy={20} r={9} fill="var(--sun, #fde68a)" stroke="currentColor" strokeWidth={2.2} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path key={a} d="M22 6 v-3" transform={`rotate(${a} 22 20)`} stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
      ))}
      <Water y={50} />
      <path d="M38 46 c -4 -4 4 -8 0 -12 c -4 -4 4 -8 0 -12 M48 46 c -4 -4 4 -8 0 -12 c -4 -4 4 -8 0 -12" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.8} />
    </>
  ),
  swap: (
    <>
      <path d="M14 24 a18 18 0 0 1 32 -6 l2 -6 M46 18 l-7 -1" stroke="currentColor" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M50 40 a18 18 0 0 1 -32 6 l-2 6 M18 46 l7 1" stroke="currentColor" strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={10} y={28} width={12} height={16} rx={2.5} fill={W} stroke="currentColor" strokeWidth={2} />
      <rect x={42} y={20} width={12} height={16} rx={2.5} fill={WL} stroke="currentColor" strokeWidth={2} />
    </>
  ),
  grab: (
    <>
      <Drop x={24} y={40} r={13} face />
      <Drop x={50} y={42} r={5} />
      <path d="M38 38 h4 M38 44 h4" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M44 24 c 4 -4 10 -2 12 2" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeDasharray="2 3" />
    </>
  ),
  splash: (
    <>
      <path d="M6 48 c 8 -2 10 -16 6 -24 c 8 4 10 10 10 14 c 2 -10 8 -18 10 -30 c 4 10 6 22 6 30 c 2 -6 6 -10 12 -12 c -2 8 -2 16 8 22" fill={W} opacity={0.6} stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M4 52 h56" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx={16} cy={14} r={2.5} fill={W} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={48} cy={12} r={3} fill={W} stroke="currentColor" strokeWidth={1.4} />
      <circle cx={56} cy={28} r={2} fill={W} stroke="currentColor" strokeWidth={1.2} />
    </>
  ),
  plant: (
    <>
      <path d="M32 50 V14" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M32 30 c -12 0 -18 -8 -18 -16 c 10 0 18 6 18 16 Z M32 22 c 10 0 16 -6 16 -14 c -10 0 -16 6 -16 14 Z" fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      <path d="M32 48 V20" stroke={W} strokeWidth={2.2} strokeDasharray="2.5 3" strokeLinecap="round" />
      <path d="M30 18 l2 -4 2 4" stroke={W} strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M8 50 h48 M32 50 l-8 8 M32 50 l8 8 M32 50 v10 M24 54 l-6 2 M40 54 l6 2" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),
  towel: (
    <>
      <path d="M4 54 c 10 -4 16 4 26 0 c 10 -4 16 4 30 0 V60 H4 Z" fill={W} opacity={0.6} />
      <rect x={22} y={8} width={20} height={48} rx={2} fill="none" stroke="currentColor" strokeWidth={2.2} />
      <path d="M22.5 56 V32 c 6 -3 13 3 19 0 V56 Z" fill={W} opacity={0.75} />
      <path d="M26 14 v6 M32 12 v8 M38 14 v6" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" opacity={0.6} />
      <path d="M48 46 v-12 l-3 3 M48 34 l3 3" stroke="currentColor" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </>
  ),
  glasses: (
    <>
      <circle cx={18} cy={34} r={11} fill={W} opacity={0.25} stroke="currentColor" strokeWidth={2.4} />
      <circle cx={46} cy={34} r={11} fill={W} opacity={0.25} stroke="currentColor" strokeWidth={2.4} />
      <path d="M29 33 c 2 -3 4 -3 6 0 M7 32 L3 26 M57 32 l4 -6" stroke="currentColor" strokeWidth={2.2} fill="none" strokeLinecap="round" />
      <Drop x={14} y={34} r={2.4} />
      <Drop x={22} y={40} r={2} />
      <Drop x={48} y={30} r={2.6} />
      <path d="M12 12 l-2 4 M24 8 l-2 4 M40 10 l-2 4 M52 12 l-2 4" stroke={W} strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  car: (
    <>
      <path d="M6 44 v-8 l8 -2 6 -10 h22 l8 10 8 2 v8 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={18} cy={46} r={5} fill="var(--card-bg, #12284a)" stroke="currentColor" strokeWidth={2.2} />
      <circle cx={46} cy={46} r={5} fill="var(--card-bg, #12284a)" stroke="currentColor" strokeWidth={2.2} />
      {[[16, 30], [26, 28], [40, 29], [52, 36], [10, 36]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y - 4} rx={2.6} ry={2.2} fill={W} stroke="currentColor" strokeWidth={1.2} />
      ))}
      <path d="M14 12 l-2 5 M28 8 l-2 5 M44 10 l-2 5" stroke={W} strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  needle: (
    <>
      <ellipse cx={32} cy={42} rx={26} ry={12} fill={W} opacity={0.4} stroke="currentColor" strokeWidth={2.2} />
      <path d="M12 38 L52 32" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
      <ellipse cx={49} cy={32.5} rx={2.5} ry={1.2} transform="rotate(-8 49 32.5)" fill="none" stroke="var(--card-bg, #12284a)" strokeWidth={1} />
      <path d="M10 41 q 22 -5 44 -8" stroke="currentColor" strokeWidth={1.4} fill="none" opacity={0.6} />
    </>
  ),
  puddle: (
    <>
      <path d="M6 38 c 0 -8 18 -10 20 -2 c 2 6 -2 12 -10 12 c -6 0 -10 -4 -10 -10 Z" fill={W} opacity={0.7} stroke="currentColor" strokeWidth={2.2} />
      <path d="M38 36 c 2 -8 20 -8 20 2 c 0 8 -10 10 -14 8 c -4 -2 -7 -5 -6 -10 Z" fill={W} opacity={0.7} stroke="currentColor" strokeWidth={2.2} />
      <path d="M24 40 h16" stroke={W} strokeWidth={4} strokeLinecap="round" />
      <path d="M30 26 c 0 -6 2 -14 6 -18 M30 26 l-2 -4 M30 26 l3 -3" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
    </>
  ),
  hero: (
    <>
      <path d="M18 30 L8 56 L22 48 L30 58 L32 40 Z" fill="var(--cape, #f472b6)" opacity={0.6} stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" />
      <Drop x={34} y={36} r={12} />
      <rect x={24} y={30} width={20} height={6} rx={3} fill="currentColor" />
      <path d="M30 44 q 4 3 8 0" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M14 12 l4 4 M54 12 l-4 4 M34 4 v6 M8 26 h5 M55 26 h5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  bond: (
    <>
      <circle cx={32} cy={32} r={8} fill={W} stroke="currentColor" strokeWidth={2.2} />
      {[0, 120, 240].map((a) => (
        <g key={a} transform={`rotate(${a} 32 32)`}>
          <path d="M32 24 V14" stroke="currentColor" strokeWidth={2} strokeDasharray="2.5 2.5" strokeLinecap="round" />
          <circle cx={32} cy={10} r={5} fill={WL} stroke="currentColor" strokeWidth={2} />
        </g>
      ))}
      <path d="M50 46 l4 4 M14 46 l-4 4" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  bolt: (
    <>
      <path d="M36 4 L16 36 H30 L26 60 L48 26 H34 Z" fill="var(--sun, #fde68a)" stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M10 14 l4 3 M54 46 l-4 -3 M54 14 l-4 3" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </>
  ),
  shield: (
    <>
      <path d="M32 6 L52 14 V30 C52 44 42 54 32 58 C22 54 12 44 12 30 V14 Z" fill={W} opacity={0.3} stroke="currentColor" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M18 32 q 4 -4 8 0 t 8 0 t 8 0 t 4 0" stroke="currentColor" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M20 40 q 4 -3 8 0 t 8 0 t 8 0" stroke="currentColor" strokeWidth={1.6} fill="none" strokeLinecap="round" opacity={0.7} />
    </>
  ),
  cloud: (
    <>
      <path d="M16 34 a9 9 0 0 1 2 -17 a12 12 0 0 1 22 -3 a9 9 0 0 1 10 15 a5 5 0 0 1 -2 5 Z" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <Drop x={20} y={48} r={3.5} />
      <Drop x={32} y={54} r={3.5} />
      <Drop x={44} y={48} r={3.5} />
    </>
  ),
  star: (
    <>
      <path d="M32 6 L39 23 L57 24 L43 36 L48 54 L32 44 L16 54 L21 36 L7 24 L25 23 Z" fill="var(--sun, #fde68a)" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" />
      <path d="M27 32 a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth={0} />
      <Drop x={32} y={35} r={4.5} />
    </>
  ),
};

export const CardArt = memo(function CardArt({ art, className }: { art: string; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      {ARTS[art] ?? ARTS.question}
    </svg>
  );
});

export const ART_IDS = Object.keys(ARTS);
