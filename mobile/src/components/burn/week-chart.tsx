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
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * The whole burn (body + sleep + active) for the last 7 days, the same number as the big one
 * above, so the chart and the card always agree. dataviz skill: one hue, a lighter track of
 * the same hue, today emphasised and the only bar with a number. No total: a week's sum of
 * whole-day burns tells nobody anything.
 */
export function WeekChart({ week }: { week: { date: string; total: number }[] }) {
  const max = Math.max(1, ...week.map((d) => d.total));

  return (
    <View className="rounded-3xl bg-card p-5">
      <Text className="text-sm text-muted">This week</Text>

      <View
        className="mt-4 flex-row items-end gap-2"
        accessible
        accessibilityLabel={`Calories burned, last 7 days: ${week.map((d) => d.total).join(', ')}`}
      >
        {week.map((d, i) => (
          <Bar
            key={d.date}
            index={i}
            share={d.total / max}
            value={d.total}
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
      <Text className="h-4 font-sans-semibold text-[11px]">
        {isToday && value ? value.toLocaleString() : ''}
      </Text>
      <View
        className="w-full justify-end overflow-hidden rounded-md"
        style={{ height: BAR_HEIGHT, backgroundColor: '#F6E3DD' }}
      >
        <Animated.View
          className="w-full rounded-md"
          style={[style, { backgroundColor: BURN_COLORS.active, opacity: isToday ? 1 : 0.55 }]}
        />
      </View>
      <Text className={isToday ? 'font-sans-semibold text-[10px]' : 'text-[10px] text-muted'}>
        {letter}
      </Text>
    </View>
  );
}
