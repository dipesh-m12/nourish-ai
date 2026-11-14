import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ChevronDown, Trophy } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDeleteActivity } from '@/api/activities';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useToast } from '@/store/toast';
import type { ActivityEntry } from '@/types/burn';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function duration(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

interface Props {
  items: ActivityEntry[];
  date: string;
  /** Body upkeep for the hours awake: first row, so the rows add up to the big number. */
  resting: number;
}

/**
 * What today's burn is made of, folded into one line until tapped: Body, then sleep and each
 * activity with its kcal. A tracked workout opens its trophy card; one logged by hand can be
 * removed; challenge-made ones belong to their challenge.
 */
export function ActivityList({ items, date, resting }: Props) {
  const remove = useDeleteActivity(date);
  const toast = useToast((s) => s.show);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<ActivityEntry | null>(null);

  const progress = useDerivedValue(() =>
    withTiming(open ? 1 : 0, { duration: 240, easing: EASE_OUT }),
  );
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.get() * 180}deg` }],
  }));

  const count = items.length + (resting > 0 ? 1 : 0);
  if (!count) return null;

  return (
    <Animated.View layout={LinearTransition.duration(250).easing(EASE_OUT)}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Your activity, ${count}. ${open ? 'Hide' : 'Show'}`}
        className="min-h-11 flex-row items-center gap-2 active:opacity-70"
      >
        <Text className="flex-1 text-sm text-muted">Your activity</Text>
        <Animated.View style={chevron}>
          <ChevronDown size={18} color={colors.muted} />
        </Animated.View>
      </Pressable>

      {open && (
        <View className="gap-1 pb-1">
          {resting > 0 && <Row label="Body" kcal={resting} delay={0} />}
          {items.map((a, i) => (
            <Row
              key={a.id}
              label={a.label}
              sub={duration(a.minutes)}
              kcal={a.calories}
              trophy={Boolean(a.sessionId)}
              delay={(i + 1) * 50}
              onPress={
                a.sessionId
                  ? () => router.push({ pathname: '/trophy/[id]', params: { id: a.sessionId! } })
                  : a.fromChallenge
                    ? undefined
                    : () => setPending(a)
              }
              hint={a.sessionId ? 'Open the trophy card' : a.fromChallenge ? undefined : 'Remove'}
            />
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={Boolean(pending)}
        title="Remove this activity?"
        message="Its calories come off today’s burn."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        error={remove.isError ? remove.error.message : null}
        onConfirm={() =>
          pending &&
          remove.mutate(pending.id, {
            onSuccess: () => {
              setPending(null);
              toast('Activity removed');
            },
          })
        }
        onCancel={() => {
          setPending(null);
          remove.reset();
        }}
      />
    </Animated.View>
  );
}

function Row({
  label,
  sub,
  kcal,
  trophy,
  delay,
  onPress,
  hint,
}: {
  label: string;
  sub?: string;
  kcal: number;
  trophy?: boolean;
  delay: number;
  onPress?: () => void;
  hint?: string;
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(260).easing(EASE_OUT)}
      exiting={FadeOut.duration(150)}
    >
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${label}${sub ? `, ${sub}` : ''}, ${kcal} kilocalories${hint ? `. ${hint}` : ''}`}
        className="min-h-11 flex-row items-center gap-3 py-1 active:opacity-70"
      >
        <View className="flex-1">
          <Text className="font-sans-medium text-sm">{label}</Text>
          {sub && <Text className="text-xs text-muted">{sub}</Text>}
        </View>
        {trophy && <Trophy size={16} color={colors.mustard} />}
        <Text className="font-sans-semibold text-sm">{kcal.toLocaleString()}</Text>
      </Pressable>
    </Animated.View>
  );
}
