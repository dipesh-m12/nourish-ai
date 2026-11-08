import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import type { Burn } from '@/types/burn';
import { ActivityList } from './activity-list';
import { ActivitySheet } from './activity-sheet';
import { BurnCard } from './burn-card';
import { WeekChart } from './week-chart';

interface Props {
  burn: Burn;
  date: string;
  /** For kcal estimates (MET × kg × hours). */
  kg: number;
  /** Stagger offset so the section enters after the rest of the dashboard. */
  delay: number;
}

/**
 * "Start burning today": the day's burn (breathing counted for you), tips with the user's own
 * numbers, logging with proof, and the week as a chart.
 */
export function BurnSection({ burn, date, kg, delay }: Props) {
  const [logging, setLogging] = useState(false);

  return (
    <View>
      {/* Same header style and spacing as "Today's challenges" above. */}
      <Animated.View entering={FadeInDown.delay(delay).duration(400)} className="mb-3">
        <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
          Start burning today
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(delay + 80).duration(400)} className="gap-3">
        <BurnCard
          burn={burn}
          kg={kg}
          onLog={() => setLogging(true)}
          onBrowse={() => router.push('/exercises')}
        />
        {burn.activities.length > 0 && (
          <View className="rounded-3xl bg-card px-5 py-4">
            <ActivityList items={burn.activities} date={date} />
          </View>
        )}
        <WeekChart week={burn.week} />
      </Animated.View>

      <ActivitySheet visible={logging} date={date} kg={kg} onClose={() => setLogging(false)} />
    </View>
  );
}
