import * as Haptics from 'expo-haptics';
import { Flag } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useFinishChallenge, useUpdateExpiry } from '@/api/challenges';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { useToast } from '@/store/toast';
import type { Today } from '@/types/today';

interface Props {
  date: string;
  ended: Today['ended'];
}

/**
 * A challenge reached its last day. Instead of quietly vanishing, the PA asks once:
 * keep going (+7, +21, always) or call it done. Nothing is lost either way.
 */
export function EndedCards({ date, ended }: Props) {
  if (!ended.length) return null;
  return (
    <View className="mb-3 gap-3">
      {ended.map((c) => (
        <EndedCard key={c.id} date={date} challenge={c} />
      ))}
    </View>
  );
}

function EndedCard({ date, challenge }: { date: string; challenge: Today['ended'][number] }) {
  const extend = useUpdateExpiry();
  const finish = useFinishChallenge();
  const toast = useToast((s) => s.show);
  const busy = extend.isPending || finish.isPending;

  const keep = (extendDays: number | null) => {
    Haptics.selectionAsync();
    extend.mutate(
      extendDays === null
        ? { id: challenge.id, date, endsOn: null }
        : { id: challenge.id, date, extendDays },
      {
        onSuccess: () => toast('Keeping it going'),
        onError: (e) => toast(e.message),
      },
    );
  };
  const done = () =>
    finish.mutate(challenge.id, {
      onSuccess: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(`${challenge.title}: done`);
      },
      onError: (e) => toast(e.message),
    });

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.duration(300)}
      className="rounded-3xl bg-accent-soft p-4"
    >
      <View className="flex-row items-center gap-2">
        <Flag size={16} color={colors.accent} />
        <Text className="flex-1 font-sans-semibold" numberOfLines={1}>
          {challenge.title}
        </Text>
      </View>
      <Text className="mt-0.5 text-sm text-muted">Finished. Keep it going?</Text>
      <View className={cn('mt-3 flex-row flex-wrap gap-2', busy && 'opacity-60')}>
        <Pill label="+7 days" onPress={() => keep(7)} disabled={busy} />
        <Pill label="+21 days" onPress={() => keep(21)} disabled={busy} />
        <Pill label="Always" onPress={() => keep(null)} disabled={busy} />
        <Pill label="Done" onPress={done} disabled={busy} muted />
      </View>
    </Animated.View>
  );
}

function Pill({
  label,
  onPress,
  disabled,
  muted,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
  muted?: boolean;
}) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('h-10 justify-center rounded-full px-4', muted ? 'bg-card' : 'bg-ink')}
    >
      <Text className={cn('font-sans-semibold text-sm', muted ? 'text-ink' : 'text-white')}>
        {label}
      </Text>
    </PressableScale>
  );
}
