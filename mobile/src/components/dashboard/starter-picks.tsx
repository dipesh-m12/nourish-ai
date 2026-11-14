import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Mic } from 'lucide-react-native';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAcceptChallenges, usePlan } from '@/api/plan';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import { colors } from '@/constants/colors';
import { useToast } from '@/store/toast';
import type { Challenge } from '@/types/plan';

const PICKS = 3;

/** The plan's first ideas, one per category, so the three never overlap (two water habits). */
function starters(challenges: Challenge[]) {
  const picks: Challenge[] = [];
  for (const c of challenges) {
    if (c.source !== 'plan' || c.accepted) continue;
    if (picks.some((p) => p.category === c.category)) continue;
    picks.push(c);
    if (picks.length === PICKS) break;
  }
  return picks;
}

interface Props {
  /** Opens the "+" sheet: their own words, or other ideas. */
  onOther: () => void;
}

/**
 * No challenges running. A PA doesn't hand over an empty page: it arrives with its picks from
 * the plan, ready for one tap ("Start these"). Saying what they want instead stays one tap away.
 */
export function StarterPicks({ onOther }: Props) {
  const plan = usePlan();
  const accept = useAcceptChallenges();
  const queryClient = useQueryClient();
  const toast = useToast((s) => s.show);
  const all = plan.data?.challenges ?? [];
  const picks = starters(all);

  // Wait for the plan rather than flash the ask card and swap it for the picks.
  if (plan.isPending) return null;
  if (!picks.length) return <AskCard onPress={onOther} />;

  const start = () => {
    const ids = [...all.filter((c) => c.accepted).map((c) => c.id), ...picks.map((c) => c.id)];
    accept.mutate(ids, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ['today'] });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      },
      onError: (err) => toast(err.message),
    });
  };

  return (
    <Animated.View entering={FadeInDown.duration(400)} className="rounded-3xl bg-card p-5">
      <Text className="font-sans-semibold text-lg">Start with these</Text>
      <View className="mt-4 gap-3">
        {picks.map((c) => (
          <View
            key={c.id}
            className="flex-row items-center gap-3"
            accessible
            accessibilityLabel={`${c.title}, ${c.target}`}
          >
            {/* The category's mark colour, as on its card later (cards carry no icons). */}
            <View
              className="h-9 w-1.5 rounded-full"
              style={{ backgroundColor: CATEGORY_THEME[c.category].mark }}
            />
            <View className="flex-1">
              <Text className="font-sans-semibold" numberOfLines={1}>
                {c.title}
              </Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {c.target}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Button
        className="mt-5"
        label={picks.length === 1 ? 'Start it' : `Start these ${picks.length}`}
        loading={accept.isPending}
        onPress={start}
      />
      <Button
        className="mt-2"
        variant="ghost"
        label="Something else"
        disabled={accept.isPending}
        onPress={onOther}
      />
    </Animated.View>
  );
}

/** Nothing left to suggest: the PA asks, the user answers in their own words. */
function AskCard({ onPress }: { onPress: () => void }) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="What do you want to achieve?"
      className="flex-row items-center gap-4 rounded-3xl bg-card p-5"
    >
      <View className="h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
        <Mic size={22} color={colors.primary} />
      </View>
      <Text className="flex-1 font-sans-semibold text-lg">What do you want to achieve?</Text>
    </PressableScale>
  );
}
