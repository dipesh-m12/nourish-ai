import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Plus } from 'lucide-react-native';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { useAcceptChallenges, usePlan } from '@/api/plan';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useToast } from '@/store/toast';
import type { Challenge } from '@/types/plan';
import type { TodayChallenge } from '@/types/today';

const SHOWN = 4;
/** One of these per day is enough: a second water or sleep challenge is always a duplicate. */
const ONE_PER_DAY = new Set(['hydration', 'sleep']);
const FILLER = new Set(['more', 'your', 'with', 'daily', 'every', 'each', 'today', 'that', 'this']);

const words = (text: string) =>
  text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 3 && !FILLER.has(w));

/** Already on the day in some form: same water/sleep slot, or the same thing by name. */
function taken(c: Challenge, active: TodayChallenge[]) {
  const mine = new Set(words(c.title));
  return active.some(
    (a) =>
      a.category === c.category &&
      (ONE_PER_DAY.has(c.category) ||
        words(`${a.title} ${a.tracking.label ?? ''}`).some((w) => mine.has(w))),
  );
}

interface Props {
  /** Today's running challenges: anything like them is not suggested again. */
  active: TodayChallenge[];
}

/**
 * The plan's ideas the user hasn't taken, inside the "+" sheet. One tap adds one to today;
 * it then drops out of the list. Renders nothing when there's nothing new to suggest.
 */
export function SuggestedChallenges({ active }: Props) {
  const plan = usePlan();
  const accept = useAcceptChallenges();
  const queryClient = useQueryClient();
  const toast = useToast((s) => s.show);

  const all = plan.data?.challenges ?? [];
  const open = all.filter((c) => !c.accepted && !taken(c, active)).slice(0, SHOWN);
  if (!open.length) return null;

  const add = (c: Challenge) => {
    Haptics.selectionAsync();
    const ids = [...all.filter((x) => x.accepted).map((x) => x.id), c.id];
    accept.mutate(ids, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['today'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast(`${c.title} added`);
      },
      onError: (err) => toast(err.message),
    });
  };

  return (
    <View>
      <Text className="mb-2 font-sans-semibold text-sm uppercase tracking-wider text-muted">
        Or pick one
      </Text>
      <View className="gap-2">
        {open.map((c) => {
          const busy = accept.isPending && accept.variables?.includes(c.id);
          return (
            <Animated.View
              key={c.id}
              entering={FadeInDown.duration(300)}
              exiting={FadeOut.duration(200)}
              layout={LinearTransition.duration(300)}
            >
              <Pressable
                onPress={() => add(c)}
                disabled={accept.isPending}
                accessibilityRole="button"
                accessibilityLabel={`Add ${c.title}, ${c.target}`}
                className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3 active:opacity-80"
              >
                <View className="flex-1">
                  <Text className="font-sans-semibold" numberOfLines={1}>
                    {c.title}
                  </Text>
                  <Text className="text-sm text-muted" numberOfLines={1}>
                    {c.target}
                  </Text>
                </View>
                <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
                  {busy ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Plus size={18} color={colors.primary} />
                  )}
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}
