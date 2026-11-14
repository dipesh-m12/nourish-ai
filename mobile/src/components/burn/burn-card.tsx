import { router } from 'expo-router';
import { Play } from 'lucide-react-native';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import type { Burn } from '@/types/burn';
import { ActivityList } from './activity-list';

// One family per meaning (dataviz skill): calm sage for the body's own burn, deeper sage for
// sleep, coral for effort. Text stays ink; colour lives only on the marks.
export const BURN_COLORS = { resting: '#A9CDB7', sleep: '#6A8D73', active: '#E07A5F' };
/** The burn number's colour: the active hue, darkened to read on white (4.7:1). */
export const BURN_TEXT = '#C2503C';

/**
 * Today's burn as one number (body + sleep + workouts), one way to add to it (Workout opens
 * Exercises), and underneath, folded, the list of what it's made of.
 */
export function BurnCard({ burn, date }: { burn: Burn; date: string }) {
  return (
    <View className="rounded-3xl bg-card px-5 pb-2 pt-3">
      <View className="flex-row items-center justify-between">
        <View
          className="flex-row items-baseline gap-2"
          accessible
          accessibilityLabel={`Burned ${burn.total} kilocalories today`}
        >
          <RollingNumber
            value={burn.total}
            format={(n) => n.toLocaleString()}
            className="font-num-black text-3xl"
            color={BURN_TEXT}
          />
          <Text className="font-sans-semibold text-xs text-muted">kcal burned</Text>
        </View>
        <PressableScale
          onPress={() => router.push('/exercises')}
          accessibilityRole="button"
          accessibilityLabel="Start a workout"
          className="-mr-2 h-11 flex-row items-center gap-2 rounded-full bg-primary px-4"
        >
          <Play size={14} color="#fff" fill="#fff" />
          <Text className="font-sans-semibold text-white">Workout</Text>
        </PressableScale>
      </View>

      {/* What the number is made of, folded until tapped. */}
      <View className="mt-2 border-t border-line pt-1">
        <ActivityList items={burn.activities} date={date} resting={burn.resting} />
      </View>
    </View>
  );
}
