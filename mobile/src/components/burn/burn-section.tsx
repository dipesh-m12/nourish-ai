import Animated, { FadeInDown } from 'react-native-reanimated';
import { View } from 'react-native';
import { SectionLabel } from '@/components/ui/section-label';
import type { Burn } from '@/types/burn';
import { BurnCard } from './burn-card';
import { WeekChart } from './week-chart';

interface Props {
  burn: Burn;
  date: string;
  /** Stagger offset so the section enters after the rest of the dashboard. */
  delay: number;
}

/**
 * "Move" on the dashboard: today's burn (its Workout button opens Exercises, where workouts
 * start) and the week. Nothing else: the workout tiles and the library live on Exercises.
 */
export function BurnSection({ burn, date, delay }: Props) {
  return (
    <View>
      {/* Same header style and spacing as "Challenges" above. */}
      <Animated.View entering={FadeInDown.delay(delay).duration(400)} className="mb-3">
        <SectionLabel>Move</SectionLabel>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(delay + 80).duration(400)} className="gap-3">
        <BurnCard burn={burn} date={date} />
        <WeekChart week={burn.week} />
      </Animated.View>
    </View>
  );
}
