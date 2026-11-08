import { Check } from 'lucide-react-native';
import { View } from 'react-native';
import { ProgressRing } from '@/components/ui/progress-ring';
import { Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import type { TodayChallenge } from '@/types/today';
import { weekdayLetter } from '@/utils/date';

/**
 * Chart-first visualisations of one challenge (the AI picks which per challenge, Grafana-style).
 * Rules from the dataviz skill: the number IS the content (big, ink), colour only on marks,
 * thin rounded marks, recessive tracks, and as few words as possible.
 */

/** Trims float noise: 1.5000001 → "1.5", 20 → "20". */
export const fmt = (n: number) => String(Math.round(n * 100) / 100);

function BigNumber({ value, unit, goal }: { value: number; unit: string | null; goal: number }) {
  return (
    <View>
      <Text className="font-sans-semibold text-3xl leading-none">
        {fmt(value)}
        {unit && <Text className="font-sans-medium text-sm"> {unit}</Text>}
      </Text>
      <Text className="mt-1 text-xs text-muted">of {fmt(goal)}</Text>
    </View>
  );
}

/** Amount towards a total (water, sleep): a large ring with the number inside. */
export function RingWidget({ c }: { c: TodayChallenge }) {
  const theme = CATEGORY_THEME[c.category];
  const { value, goal } = c.progress;
  return (
    <View className="items-center">
      <ProgressRing
        progress={value / goal}
        size={96}
        stroke={10}
        color={theme.mark}
        trackColor={theme.track}
      >
        <Text className="font-sans-semibold text-2xl leading-none">{fmt(value)}</Text>
        <Text className="mt-0.5 text-[11px] text-muted">
          / {fmt(goal)}
          {c.tracking.unit ? ` ${c.tracking.unit}` : ''}
        </Text>
      </ProgressRing>
    </View>
  );
}

/** Minutes/distance where the week matters: big number + 7 full-height bar tracks. */
export function BarsWidget({ c }: { c: TodayChallenge }) {
  const theme = CATEGORY_THEME[c.category];
  const { value, goal, history } = c.progress;
  const week = history.slice(-7);
  const max = Math.max(goal, ...week.map((h) => h.value));
  const AREA = 44;
  return (
    <View className="gap-3">
      <BigNumber value={value} unit={c.tracking.unit} goal={goal} />
      <View>
        <View className="flex-row items-end justify-between" style={{ height: AREA }}>
          {week.map((h) => (
            <View
              key={h.date}
              className="w-1.5 justify-end overflow-hidden rounded-full"
              style={{ height: AREA, backgroundColor: h.active ? theme.track : 'transparent' }}
            >
              <View
                className="w-full rounded-full"
                style={{
                  height: (Math.min(h.value, max) / max) * AREA,
                  backgroundColor: theme.mark,
                }}
              />
            </View>
          ))}
        </View>
        <View className="mt-1 flex-row justify-between">
          {week.map((h) => (
            <Text key={h.date} className="w-1.5 text-center text-[9px] text-muted">
              {weekdayLetter(h.date)}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}

/** Small whole counts (servings, sessions): big fraction + one segment per step. */
export function TallyWidget({ c }: { c: TodayChallenge }) {
  const theme = CATEGORY_THEME[c.category];
  const { value, goal } = c.progress;
  const slots = Math.min(8, Math.max(1, Math.round(goal / c.tracking.step)));
  const filled = Math.min(slots, Math.floor(value / c.tracking.step));
  return (
    <View className="gap-3">
      <Text className="font-sans-semibold text-3xl leading-none">
        {filled}
        <Text className="font-sans-medium text-sm text-muted"> / {slots}</Text>
      </Text>
      <View className="flex-row gap-1">
        {Array.from({ length: slots }, (_, i) => (
          <View
            key={i}
            className="h-6 flex-1 rounded-md"
            style={{ backgroundColor: i < filled ? theme.mark : theme.track }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Done / not done: a large tick (filled when done today), then this week as a strip of dots
 * with weekday letters, so a single day of history still reads as a week, not a stray dot.
 */
export function CheckWidget({ c }: { c: TodayChallenge }) {
  const theme = CATEGORY_THEME[c.category];
  const week = c.progress.history.slice(-7);
  const done = c.progress.done;
  return (
    <View className="gap-3">
      <View
        className="h-14 w-14 items-center justify-center self-center rounded-full"
        style={{ backgroundColor: done ? theme.mark : theme.track }}
      >
        <Check size={28} strokeWidth={3} color={done ? '#fff' : theme.mark} />
      </View>
      <View className="flex-row justify-between">
        {week.map((h) => (
          <View key={h.date} className="items-center gap-1">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{
                backgroundColor: !h.active
                  ? '#ECEAE4'
                  : h.value >= c.progress.goal
                    ? theme.mark
                    : theme.track,
              }}
            />
            <Text className="text-[9px] text-muted">{weekdayLetter(h.date)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const WIDGETS = {
  ring: RingWidget,
  bars: BarsWidget,
  tally: TallyWidget,
  check: CheckWidget,
} as const;
