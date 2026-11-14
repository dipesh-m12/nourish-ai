import * as Haptics from 'expo-haptics';
import { Moon, Sun } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useLogProgress } from '@/api/today';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { pickTime } from '@/lib/pick-date';
import type { TodayChallenge } from '@/types/today';

/** The bar is full at the goal plus this much, so the goal mark sits inside it. */
const HEADROOM = 1.25;
/** A lighter step of the sleep hue (a meter's track is its own colour, lighter). */
const TRACK = '#DCE7DF';

type Clock = { hour: number; minute: number };

const clockText = ({ hour, minute }: Clock) => {
  const h = hour % 12 || 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
};

/** Bed → wake across midnight, to the nearest quarter hour. */
function hoursBetween(bed: Clock, wake: Clock) {
  const mins = (wake.hour * 60 + wake.minute - (bed.hour * 60 + bed.minute) + 1440) % 1440;
  return Math.round((mins / 60) * 4) / 4;
}

const hoursText = (h: number) => {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}h ${mins}m` : `${whole}h`;
};

interface Props {
  challenge: TodayChallenge;
  date: string;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Last night in two taps: when you went to bed and when you got up. The hours work themselves
 * out in the middle, and the bar shows them against the goal (the small mark).
 */
export function SleepLog({ challenge, date, onDone, onError }: Props) {
  const log = useLogProgress(date);
  const reduceMotion = useReducedMotion();
  const [bed, setBed] = useState<Clock>({ hour: 23, minute: 0 });
  const [wake, setWake] = useState<Clock>({ hour: 7, minute: 0 });
  const hours = hoursBetween(bed, wake);
  const goal = challenge.progress.goal;
  const full = Math.max(goal * HEADROOM, 1);
  const fill = useSharedValue(0);

  useEffect(() => {
    const to = Math.min(hours / full, 1);
    fill.set(
      reduceMotion ? to : withTiming(to, { duration: 500, easing: Easing.out(Easing.cubic) }),
    );
  }, [hours, full, fill, reduceMotion]);

  const barStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  const change = async (which: 'bed' | 'wake') => {
    const current = which === 'bed' ? bed : wake;
    const picked = await pickTime(current.hour, current.minute);
    if (!picked) return;
    Haptics.selectionAsync();
    if (which === 'bed') setBed(picked);
    else setWake(picked);
  };

  const save = () => {
    if (hours <= 0) return onError('Bedtime and wake time are the same.');
    log.mutate(
      { challengeId: challenge.id, amount: hours },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onDone(
            hours >= goal ? `${hoursText(hours)}. Well rested.` : `${hoursText(hours)} logged.`,
          );
        },
        onError: (e) => onError(e.message),
      },
    );
  };

  return (
    <View>
      <View className="flex-row items-stretch gap-3">
        <TimeTile
          icon="moon"
          label="Bed"
          value={clockText(bed)}
          onPress={() => void change('bed')}
        />
        <TimeTile
          icon="sun"
          label="Up"
          value={clockText(wake)}
          onPress={() => void change('wake')}
        />
      </View>

      <View
        className="mt-6 items-center"
        accessible
        accessibilityLabel={`${hoursText(hours)} of sleep, goal ${hoursText(goal)}`}
      >
        <Text className="font-serif-bold text-5xl">{hoursText(hours)}</Text>
        <Text className="text-sm text-muted">
          {hours >= goal
            ? 'Goal reached'
            : `${hoursText(goal - hours)} short of ${hoursText(goal)}`}
        </Text>
      </View>

      <View className="mt-4 h-3 justify-center">
        <View className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: TRACK }}>
          <Animated.View
            className="h-2 rounded-full"
            style={[{ backgroundColor: colors.sleep }, barStyle]}
          />
        </View>
        {/* The goal: a small ink mark on the bar. */}
        <View
          className="absolute h-3 w-0.5 rounded-full bg-ink"
          style={{ left: `${(goal / full) * 100}%` }}
        />
      </View>

      <Button className="mt-6" label="Log my night" loading={log.isPending} onPress={save} />
    </View>
  );
}

function TimeTile({
  icon,
  label,
  value,
  onPress,
}: {
  icon: 'moon' | 'sun';
  label: string;
  value: string;
  onPress: () => void;
}) {
  const Icon = icon === 'moon' ? Moon : Sun;
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} at ${value}. Change`}
      // The wrapper takes the row share; the surface just fills it.
      containerClassName="flex-1"
      className="items-center gap-1 rounded-2xl bg-bg px-3 py-4"
    >
      <Icon size={22} color={icon === 'moon' ? colors.sleep : colors.mustard} />
      <Text className="text-xs uppercase tracking-wider text-muted">{label}</Text>
      <Text className="font-sans-semibold text-lg">{value}</Text>
    </PressableScale>
  );
}
