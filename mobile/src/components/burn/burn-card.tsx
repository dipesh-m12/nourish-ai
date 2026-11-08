import { ChevronRight, Plus } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import type { Burn } from '@/types/burn';
import { BurnTips } from './burn-tips';

// One family per meaning (dataviz skill): calm sage for the body's own burn, deeper sage for
// sleep, coral for effort. Text stays ink; colour lives only on the marks.
export const BURN_COLORS = { resting: '#A9CDB7', sleep: '#6A8D73', active: '#E07A5F' };

const hours = (min: number) => {
  const h = min / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
};

interface Props {
  burn: Burn;
  kg: number;
  onLog: () => void;
  /** Opens the exercise library. */
  onBrowse: () => void;
}

/**
 * Today's burn at a glance: one big number, one split bar, three short lines. Breathing is
 * counted for you; sleep and activity fill in as they're logged.
 */
export function BurnCard({ burn, kg, onLog, onBrowse }: Props) {
  const parts = [
    { key: 'resting', label: 'Breathing & body', value: burn.resting, color: BURN_COLORS.resting },
    {
      key: 'sleep',
      label: burn.sleepMinutes ? `Sleep · ${hours(burn.sleepMinutes)}` : 'Sleep',
      value: burn.sleep,
      color: BURN_COLORS.sleep,
    },
    { key: 'active', label: 'Active', value: burn.active, color: BURN_COLORS.active },
  ];
  const total = burn.total || 1;

  return (
    <View className="rounded-3xl bg-card p-5">
      <View className="flex-row items-start justify-between">
        <View>
          <Text className="text-sm text-muted">Burned today</Text>
          <View className="mt-0.5 flex-row items-baseline gap-1.5">
            <RollingNumber
              value={burn.total}
              format={(n) => n.toLocaleString()}
              className="font-sans-semibold text-4xl leading-tight"
            />
            <Text className="text-muted">kcal</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          {/* Green arrow: into the exercise library, the "what should I do?" path. */}
          <PressableScale
            onPress={onBrowse}
            accessibilityRole="button"
            accessibilityLabel="Browse exercises"
            className="h-9 w-9 items-center justify-center rounded-full bg-primary"
          >
            <ChevronRight size={18} color="#fff" strokeWidth={2.5} />
          </PressableScale>
          <PressableScale
            onPress={onLog}
            accessibilityRole="button"
            accessibilityLabel="Log an activity"
            className="h-9 flex-row items-center gap-1.5 rounded-full bg-ink px-3.5"
          >
            <Plus size={16} color="#fff" />
            <Text className="font-sans-semibold text-sm text-white">Activity</Text>
          </PressableScale>
        </View>
      </View>

      {/* Share of today's burn; segments resize smoothly as sleep or activity is added. */}
      <View className="mt-4 h-2 flex-row gap-0.5 overflow-hidden rounded-full">
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <Animated.View
              key={p.key}
              layout={LinearTransition.duration(400)}
              style={{ flex: p.value / total, backgroundColor: p.color }}
            />
          ))}
      </View>

      <View
        className="mt-3 gap-2"
        accessible
        accessibilityLabel={parts.map((p) => `${p.label} ${p.value} kilocalories`).join(', ')}
      >
        {parts.map((p) => (
          <View key={p.key} className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            <Text className="flex-1 text-sm text-muted">{p.label}</Text>
            <RollingNumber value={p.value} className="font-sans-semibold text-sm" />
          </View>
        ))}
      </View>

      <View className="mt-4">
        <BurnTips restingPerHour={burn.restingPerHour} kg={kg} />
      </View>
    </View>
  );
}
