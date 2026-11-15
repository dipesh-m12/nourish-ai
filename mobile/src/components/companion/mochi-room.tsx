import { type ReactNode, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';
import { CatFace } from '@/components/companion/cat-face';
import { ROOM_ITEMS, type RoomItem } from '@/constants/mochi-room';
import type { CompanionMood } from '@/types/companion';

/** The scene's own coordinate space; it scales to any width (4:3). */
const W = 320;
const H = 240;
const FLOOR_Y = 168;

// Palette from the design system (§7), plus two warm wood tones and a lamp glow.
const C = {
  wall: '#F3EBDD',
  floor: '#E8D8C3',
  board: '#D9C6AE',
  sage: '#1F7A55',
  sageMid: '#6A8D73',
  sageLight: '#A9CDB7',
  sageSoft: '#E6F2EB',
  coral: '#E07A5F',
  coralLight: '#F0A08A',
  coralSoft: '#FBEDE8',
  mustard: '#D99A2B',
  mustardSoft: '#F7EBD3',
  wood: '#C9A27A',
  woodDark: '#A8825C',
  glow: '#FFF1CC',
  sun: '#F2C46B',
  ink: '#1C2321',
  cream: '#F7F6F2',
};

/** Each unlockable item, drawn in the scene's coordinates. */
const ART: Record<RoomItem, ReactNode> = {
  rug: (
    <G>
      <Ellipse cx={160} cy={210} rx={100} ry={20} fill={C.sageLight} />
      <Ellipse
        cx={160}
        cy={210}
        rx={82}
        ry={14}
        fill="none"
        stroke={C.cream}
        strokeWidth={2}
        strokeDasharray="6 5"
      />
    </G>
  ),
  cushion: (
    <G>
      <Ellipse cx={160} cy={200} rx={54} ry={15} fill={C.coral} />
      <Ellipse cx={160} cy={195} rx={44} ry={9} fill={C.coralLight} />
    </G>
  ),
  plant: (
    <G>
      <Path d="M30 104 C 20 80, 34 64, 44 70 C 40 86, 42 96, 44 108 Z" fill={C.sageMid} />
      <Path d="M46 108 C 44 84, 58 62, 70 70 C 62 84, 56 96, 50 110 Z" fill={C.sage} />
      <Path d="M44 112 C 26 104, 14 112, 16 122 C 28 118, 36 118, 46 118 Z" fill={C.sage} />
      <Path d="M50 114 C 66 104, 80 110, 78 120 C 68 118, 60 118, 50 120 Z" fill={C.sageMid} />
      <Path d="M24 120 L 72 120 L 64 176 L 32 176 Z" fill={C.mustard} />
      <Rect x={22} y={116} width={52} height={10} rx={3} fill={C.woodDark} />
    </G>
  ),
  yarn: (
    <G>
      <Path
        d="M232 206 C 222 214, 214 206, 204 214"
        stroke={C.mustard}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={250} cy={200} r={15} fill={C.mustard} />
      <Path
        d="M238 194 C 246 200, 254 200, 262 192 M237 204 C 247 210, 257 208, 264 200 M244 187 C 250 196, 252 206, 248 214"
        stroke={C.mustardSoft}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  ),
  frame: (
    <G>
      <Rect x={34} y={30} width={62} height={50} rx={4} fill={C.wood} />
      <Rect x={40} y={36} width={50} height={38} rx={2} fill={C.coralSoft} />
      <Path
        d="M65 66 C 54 58, 50 52, 54 47 C 57 43, 63 44, 65 49 C 67 44, 73 43, 76 47 C 80 52, 76 58, 65 66 Z"
        fill={C.coral}
      />
    </G>
  ),
  lamp: (
    <G>
      <Circle cx={292} cy={86} r={34} fill={C.glow} opacity={0.7} />
      <Line x1={292} y1={96} x2={292} y2={196} stroke={C.ink} strokeWidth={3} />
      <Ellipse cx={292} cy={198} rx={14} ry={4} fill={C.ink} />
      <Path d="M276 70 L 308 70 L 316 98 L 268 98 Z" fill={C.sun} />
    </G>
  ),
  shelf: (
    <G>
      <Rect x={112} y={44} width={10} height={30} rx={2} fill={C.sage} />
      <Rect x={124} y={50} width={9} height={24} rx={2} fill={C.coral} />
      <Rect x={135} y={46} width={10} height={28} rx={2} fill={C.mustard} />
      <Path d="M150 74 L 162 50 L 170 54 L 158 76 Z" fill={C.sageMid} />
      <Rect x={104} y={74} width={74} height={6} rx={2} fill={C.wood} />
    </G>
  ),
  lights: (
    <G>
      <Path
        d="M6 14 Q 82 46 160 22 Q 238 46 314 14"
        stroke={C.woodDark}
        strokeWidth={1.5}
        fill="none"
      />
      {[
        [30, 24],
        [58, 31],
        [86, 33],
        [114, 30],
        [140, 25],
        [182, 26],
        [208, 31],
        [236, 33],
        [264, 30],
        [290, 23],
      ].map(([x, y], i) => (
        <Circle key={x} cx={x} cy={y! + 4} r={4} fill={[C.coral, C.sun, C.sageLight][i % 3]} />
      ))}
    </G>
  ),
};

/** The room itself: wall, floor and a window (always there), so an empty room still reads. */
function Shell() {
  return (
    <G>
      <Rect x={0} y={0} width={W} height={FLOOR_Y} fill={C.wall} />
      <Rect x={0} y={FLOOR_Y} width={W} height={H - FLOOR_Y} fill={C.floor} />
      <Rect x={0} y={FLOOR_Y - 4} width={W} height={6} fill={C.board} />
      <Rect x={196} y={30} width={66} height={78} rx={6} fill={C.cream} />
      <Rect x={202} y={36} width={54} height={66} rx={3} fill={C.sageSoft} />
      <Circle cx={240} cy={56} r={9} fill={C.sun} opacity={0.85} />
      <Line x1={229} y1={36} x2={229} y2={102} stroke={C.cream} strokeWidth={4} />
      <Line x1={202} y1={69} x2={256} y2={69} stroke={C.cream} strokeWidth={4} />
    </G>
  );
}

/** One item on its own layer, so a new one can pop in without redrawing the room. */
function Layer({ children, ghost }: { children: ReactNode; ghost?: boolean }) {
  return (
    <Svg
      viewBox={`0 0 ${W} ${H}`}
      style={[StyleSheet.absoluteFill, ghost && { opacity: 0.16 }]}
      pointerEvents="none"
    >
      {children}
    </Svg>
  );
}

interface Props {
  /** How many items are unlocked (the first N, in order). */
  unlocked: number;
  mood: CompanionMood;
  /** Pops in (it arrived in the last couple of days). */
  newItem?: RoomItem | null;
}

/**
 * Mochi's room, drawn in code: earned items in full colour, the next one as a faint outline
 * (something to look forward to), Mochi in the middle with today's mood.
 */
export function MochiRoom({ unlocked, mood, newItem }: Props) {
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const next = ROOM_ITEMS[unlocked];
  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      className="w-full overflow-hidden rounded-3xl"
      style={{ aspectRatio: W / H }}
      accessible
      accessibilityLabel={`Mochi's room: ${unlocked} of ${ROOM_ITEMS.length} things so far`}
    >
      <Layer>
        <Shell />
      </Layer>
      {next && <Layer ghost>{ART[next]}</Layer>}
      {ROOM_ITEMS.slice(0, unlocked).map((item) => (
        <Animated.View
          key={item}
          style={StyleSheet.absoluteFill}
          entering={item === newItem && !reduceMotion ? ZoomIn.delay(400).springify() : undefined}
          pointerEvents="none"
        >
          <Layer>{ART[item]}</Layer>
        </Animated.View>
      ))}
      {/* Mochi sits on the rug, centred; sized from the room's width once it's measured. */}
      {width > 0 && (
        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: width * 0.32, bottom: width * 0.045 }}
        >
          <CatFace mood={mood} size={width * 0.36} />
        </View>
      )}
    </View>
  );
}
