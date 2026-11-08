import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { ArrowRight, Heart, PawPrint, TrendingDown } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { CatFace } from '@/components/companion/cat-face';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import type { Briefing, BriefingAction } from '@/types/briefing';
import type { Companion } from '@/types/companion';

interface Props {
  briefing: Briefing | undefined;
  loading: boolean;
  date: string;
  onAction: (action: BriefingAction) => void;
  /** Fired once per day when everything's done; the screen plays the confetti full-size. */
  onCelebrate: () => void;
  /** Mochi (or the invitation to adopt her). Absent while today loads. */
  companion?: Companion;
  onCompanion: () => void;
}

/** One celebration per day, even if the dashboard re-mounts. */
const celebratedKey = (date: string) => `briefing:celebrated:${date}`;

/**
 * The PA's word for right now: one insight with real numbers, one or two actions that do the
 * work, and why it matters to this user. The rules pick it; the dashboard just shows it.
 */
export function BriefingCard({
  briefing: b,
  loading,
  date,
  onAction,
  onCelebrate,
  companion,
  onCompanion,
}: Props) {
  const allDone = b?.kind === 'all_done';

  useEffect(() => {
    if (!allDone) return;
    let live = true;
    AsyncStorage.getItem(celebratedKey(date))
      .then((seen) => {
        if (!live || seen) return;
        onCelebrate();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return AsyncStorage.setItem(celebratedKey(date), '1');
      })
      .catch(() => {}); // storage hiccup: just skip the confetti
    return () => {
      live = false;
    };
  }, [allDone, date, onCelebrate]);

  if (!b) return loading ? <BriefingSkeleton /> : null; // optional card: no error noise

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      layout={LinearTransition.duration(250)}
      className={cn('rounded-3xl p-5', allDone ? 'bg-primary-soft' : 'bg-card')}
    >
      {/* The header already greets; this spot is Mochi's (or the invite to adopt her). */}
      <CompanionStrip companion={companion} onPress={onCompanion} />

      {/* Keyed by the insight, so a new one fades in rather than snapping. */}
      <Animated.View key={b.kind + b.headline} entering={FadeIn.duration(300)}>
        <Text
          className={cn(
            'font-sans-semibold text-lg leading-snug',
            showsCompanion(companion) && 'mt-3',
          )}
        >
          {b.headline}
        </Text>

        {b.actions.length > 0 && (
          <View className="mt-4 flex-row flex-wrap gap-2">
            {b.actions.map((a, i) => (
              <PressableScale
                key={a.label}
                onPress={() => {
                  Haptics.selectionAsync();
                  onAction(a);
                }}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                className={cn(
                  'h-10 justify-center rounded-full px-4',
                  i === 0 ? 'bg-ink' : 'border border-line bg-card',
                )}
              >
                <Text
                  className={cn('font-sans-semibold text-sm', i === 0 ? 'text-white' : 'text-ink')}
                >
                  {a.label}
                </Text>
              </PressableScale>
            ))}
          </View>
        )}

        <View className="mt-4 flex-row items-start gap-2 border-t border-line pt-3">
          <Heart size={14} color={colors.accent} fill={colors.accent} style={{ marginTop: 3 }} />
          <Text className="flex-1 text-sm leading-5 text-muted">{b.why}</Text>
        </View>
        {b.week && (
          <View className="mt-2 flex-row items-start gap-2">
            <TrendingDown size={14} color={colors.muted} style={{ marginTop: 3 }} />
            <Text className="flex-1 text-sm leading-5 text-muted">{b.week}</Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const showsCompanion = (c?: Companion) => Boolean(c && c.status !== 'declined');

/**
 * Mochi with her mood line, or a small invite when no choice has been made. Declined: nothing,
 * ever (changeable from Profile).
 */
function CompanionStrip({ companion: c, onPress }: { companion?: Companion; onPress: () => void }) {
  if (!c || c.status === 'declined') return null;

  if (c.status === 'undecided') {
    return (
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Adopt a cat"
        containerClassName="self-start"
        className="h-9 flex-row items-center gap-2 rounded-full bg-accent-soft px-3.5"
      >
        <PawPrint size={16} color={colors.accent} />
        <Text className="font-sans-semibold text-sm text-accent">Adopt a cat</Text>
        <ArrowRight size={16} color={colors.accent} />
      </PressableScale>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${c.name}: ${c.line ?? ''}`}
      className="flex-row items-center gap-3 active:opacity-80"
    >
      <CatFace mood={c.mood ?? 'normal'} size={64} />
      <View className="flex-1">
        <Text className="font-sans-semibold">{c.name}</Text>
        <Text className="text-sm text-muted" numberOfLines={2}>
          {c.line}
        </Text>
      </View>
    </Pressable>
  );
}

function BriefingSkeleton() {
  return (
    <SkeletonGroup
      className="rounded-3xl bg-card p-5"
      accessible
      accessibilityLabel="Loading your briefing"
      accessibilityState={{ busy: true }}
    >
      <View className="flex-row items-center gap-2.5">
        <SkeletonBlock className="h-8 w-8 rounded-full" />
        <SkeletonBlock className="h-3 w-32" />
      </View>
      <SkeletonBlock className="mt-4 h-5 w-full" />
      <SkeletonBlock className="mt-2 h-5 w-2/3" />
      <SkeletonBlock className="mt-4 h-10 w-36 rounded-full" />
    </SkeletonGroup>
  );
}
