import * as Haptics from 'expo-haptics';
import { ChevronDown } from 'lucide-react-native';
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

/**
 * Today's activity folded into one line, like meals. Entries made by a challenge are shown but
 * not removable here (they belong to that challenge's log).
 */
export function ActivityList({ items, date }: { items: ActivityEntry[]; date: string }) {
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

  if (!items.length) return null;

  return (
    <Animated.View layout={LinearTransition.duration(250).easing(EASE_OUT)}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Your activity, ${items.length}. ${open ? 'Hide' : 'Show'}`}
        className="flex-row items-center gap-2 active:opacity-70"
      >
        <Text className="flex-1 text-sm text-muted">
          Your activity · <Text className="font-sans-semibold text-sm">{items.length}</Text>
        </Text>
        <Animated.View style={chevron}>
          <ChevronDown size={18} color={colors.muted} />
        </Animated.View>
      </Pressable>

      {open && (
        <View className="mt-2 gap-1">
          {items.map((a, i) => (
            <Animated.View
              key={a.id}
              entering={FadeInDown.delay(i * 50)
                .duration(260)
                .easing(EASE_OUT)}
              exiting={FadeOut.duration(150)}
              layout={LinearTransition.duration(250)}
            >
              <Pressable
                onPress={() => !a.fromChallenge && setPending(a)}
                disabled={a.fromChallenge}
                accessibilityRole="button"
                accessibilityLabel={`${a.label}, ${duration(a.minutes)}, ${a.calories} kilocalories${a.fromChallenge ? ', from a challenge' : '. Tap to remove.'}`}
                className="flex-row items-center gap-3 py-1.5 active:opacity-70"
              >
                <View className="flex-1">
                  <Text className="font-sans-medium text-sm">{a.label}</Text>
                  <Text className="text-xs text-muted">
                    {duration(a.minutes)}
                    {a.fromChallenge ? ' · from challenge' : ''}
                  </Text>
                </View>
                <Text className="font-sans-semibold text-sm">{a.calories}</Text>
              </Pressable>
            </Animated.View>
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
