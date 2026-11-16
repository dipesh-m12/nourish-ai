import { Footprints, Trophy } from 'lucide-react-native';
import { type ComponentRef, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { shareView } from '@/lib/share-image';
import { useToast } from '@/store/toast';
import { formatClock, formatDistance, type LngLat } from '@/utils/geo';
import { segmentsOf } from '@/utils/route';

export interface WalkResult {
  title: string;
  path: LngLat[];
  /** Where a new piece of the route starts (after a gap): drawn as separate lines. */
  breaks?: number[];
  metres: number;
  movingMs: number;
  steps: number | null;
  /** From the server's burn maths; null when the log added none. */
  calories: number | null;
  pauses: number;
  /** Time counted while the app was closed (said on the card, so it's honest). */
  awayMs?: number;
}

const BOX = { w: 280, h: 170, pad: 16 };

/**
 * The walked route as a line in a box: east–west is squeezed by cos(latitude) so the shape
 * matches the ground, then scaled to fit. Fewer than 2 points (indoors) = no line.
 */
function routePoints(path: LngLat[]) {
  if (path.length < 2) return null;
  const k = Math.cos((path[0]![1] * Math.PI) / 180);
  const xs = path.map((p) => p[0] * k);
  const ys = path.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [
    Math.min(...xs),
    Math.max(...xs),
    Math.min(...ys),
    Math.max(...ys),
  ];
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  const scale = Math.min(BOX.w - BOX.pad * 2, BOX.h - BOX.pad * 2) / span;
  const offX = (BOX.w - (maxX - minX) * scale) / 2;
  const offY = (BOX.h - (maxY - minY) * scale) / 2;
  // Screen y grows downwards; latitude grows upwards.
  return xs.map((x, i) => [offX + (x - minX) * scale, offY + (maxY - ys[i]!) * scale] as const);
}

/**
 * After a walk: a trophy card with the route and the numbers, which can be saved or shared as
 * a picture. The card is one plain view so the capture is exactly what the user sees.
 */
export function WalkSummary({
  result,
  onDone,
  doneLabel = 'Done',
}: {
  result: WalkResult;
  onDone: () => void;
  doneLabel?: string;
}) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const toast = useToast((s) => s.show);
  const [sharing, setSharing] = useState(false);
  const pts = routePoints(result.path);
  // One line per piece of the route, all on the same scale (no line across a gap).
  const lines = pts
    ? segmentsOf(
        pts.map((p) => [p[0], p[1]] as LngLat),
        result.breaks,
      ).filter((l) => l.length > 1)
    : [];
  const moved = result.metres > 0;

  const share = async () => {
    setSharing(true);
    const problem = await shareView(card, result.title);
    setSharing(false);
    if (problem) toast(problem);
  };

  const stats = [
    // No distance (yoga, strength): time is the headline, so it isn't repeated here.
    ...(moved ? [{ label: 'Time', value: formatClock(result.movingMs) }] : []),
    ...(result.steps ? [{ label: 'Steps', value: result.steps.toLocaleString('en-IN') }] : []),
    ...(result.calories ? [{ label: 'Kcal', value: String(result.calories) }] : []),
    { label: result.pauses === 1 ? 'Pause' : 'Pauses', value: String(result.pauses) },
  ];

  return (
    <View className="w-full items-center">
      <Animated.View entering={ZoomIn.duration(350)}>
        <View
          ref={card}
          collapsable={false}
          className="items-center rounded-3xl px-6 pb-6 pt-7"
          style={{ backgroundColor: '#E1F1E6', width: BOX.w + 48 }}
        >
          <View className="h-14 w-14 items-center justify-center rounded-full bg-card">
            <Trophy size={28} color={colors.mustard} />
          </View>
          <Text className="mt-3 text-sm text-muted" numberOfLines={1}>
            {result.title}
          </Text>
          <Text className="font-serif-bold text-5xl">
            {moved ? formatDistance(result.metres) : formatClock(result.movingMs)}
          </Text>

          <View
            className="mt-3 items-center justify-center"
            style={{ width: BOX.w, height: BOX.h }}
          >
            {pts ? (
              <Svg width={BOX.w} height={BOX.h}>
                {lines.map((l, i) => (
                  <Polyline
                    key={i}
                    points={l.map((p) => p.join(',')).join(' ')}
                    stroke={colors.accent}
                    strokeWidth={4}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    fill="none"
                  />
                ))}
                <Circle cx={pts[0]![0]} cy={pts[0]![1]} r={5} fill={colors.primary} />
                <Circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={5} fill={colors.accent} />
              </Svg>
            ) : (
              <Footprints size={64} color={colors.primary} />
            )}
          </View>

          <View className="mt-3 flex-row self-stretch">
            {stats.map((s) => (
              <View key={s.label} className="flex-1 items-center">
                <Text className="font-sans-semibold text-lg">{s.value}</Text>
                <Text className="text-xs uppercase tracking-wider text-muted">{s.label}</Text>
              </View>
            ))}
          </View>
          {result.awayMs ? (
            <Text className="mt-3 text-xs text-muted">
              Includes {Math.round(result.awayMs / 60_000)} min with the app closed
            </Text>
          ) : null}
          <Text className="mt-5 font-serif text-sm text-primary">Nourish AI</Text>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(300)} className="mt-6 w-full gap-2">
        {Platform.OS !== 'web' && (
          <Button label="Share" loading={sharing} onPress={() => void share()} />
        )}
        <Button
          variant={Platform.OS === 'web' ? 'primary' : 'ghost'}
          label={doneLabel}
          onPress={onDone}
        />
      </Animated.View>
    </View>
  );
}
