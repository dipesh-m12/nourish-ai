import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { weekdayLetter } from '@/utils/date';
import { BURN_COLORS } from './burn-card';

const BAR_HEIGHT = 96;
/** Keeps a quiet week from drawing tiny days as full-height bars. */
const MIN_SCALE_KCAL = 150;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Active kcal for the last 7 days as thin bars (dataviz skill: one hue, a lighter track,
 * today emphasised and labelled). Bars grow in on load and glide when a day changes.
 */
export function WeekChart({ week }: { week: { date: string; active: number }[] }) {
  const max = Math.max(MIN_SCALE_KCAL, ...week.map((d) => d.active));
  const total = week.reduce((s, d) => s + d.active, 0);

  return (
    <View className="rounded-3xl bg-card p-5">
      <View className="flex-row items-end justify-between">
        <Text className="text-sm text-muted">Active this week</Text>
        <Text className="font-sans-semibold">
          {total.toLocaleString()} <Text className="text-sm text-muted">kcal</Text>
        </Text>
      </View>

      <View
        className="mt-4 flex-row items-end gap-2"
        accessible
        accessibilityLabel={`Active calories, last 7 days: ${week.map((d) => d.active).join(', ')}`}
      >
        {week.map((d, i) => (
          <Bar
            key={d.date}
            index={i}
            share={d.active / max}
            value={d.active}
            isToday={i === week.length - 1}
            letter={weekdayLetter(d.date)}
          />
        ))}
      </View>
    </View>
  );
}

interface BarProps {
  index: number;
  share: number;
  value: number;
  isToday: boolean;
  letter: string;
}

function Bar({ index, share, value, isToday, letter }: BarProps) {
  const height = useDerivedValue(() =>
    withDelay(index * 40, withTiming(share * BAR_HEIGHT, { duration: 500, easing: EASE_OUT })),
  );
  const style = useAnimatedStyle(() => ({ height: height.get() }));

  return (
    <View className="flex-1 items-center gap-1.5">
      {/* Only today carries a number: the rest read as shape, not text. */}
      <Text className="h-4 text-[11px] font-sans-semibold">{isToday && value ? value : ''}</Text>
      <View
        className="w-full justify-end overflow-hidden rounded-md"
        style={{ height: BAR_HEIGHT, backgroundColor: '#F6E3DD' }}
      >
        <Animated.View
          className="w-full rounded-md"
          style={[style, { backgroundColor: BURN_COLORS.active, opacity: isToday ? 1 : 0.55 }]}
        />
      </View>
      <Text className={isToday ? 'text-[10px] font-sans-semibold' : 'text-[10px] text-muted'}>
        {letter}
      </Text>
    </View>
  );
}
