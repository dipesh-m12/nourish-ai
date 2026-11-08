import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { TodayChallenge } from '@/types/today';
import { weekdayLetter } from '@/utils/date';

interface DaySummary {
  date: string;
  /** Daily challenges active that day. */
  active: number;
  done: number;
}

/** Folds every daily challenge's 28-day history into one row per day. */
function summarise(challenges: TodayChallenge[]): DaySummary[] {
  const daily = challenges.filter((c) => c.frequency === 'daily');
  const days = daily[0]?.progress.history.map((h) => h.date) ?? [];
  return days.map((date, i) => {
    let active = 0;
    let done = 0;
    for (const c of daily) {
      const h = c.progress.history[i];
      if (!h?.active) continue;
      active++;
      if (h.value >= c.progress.goal) done++;
    }
    return { date, active, done };
  });
}

/** Consecutive "perfect" days (all active daily challenges done), ending today or yesterday. */
function perfectStreak(days: DaySummary[]): number {
  const perfect = (d?: DaySummary) => Boolean(d && d.active > 0 && d.done === d.active);
  let i = days.length - 1;
  if (!perfect(days[i])) i--; // today isn't over: don't break the streak yet
  let streak = 0;
  while (perfect(days[i])) {
    streak++;
    i--;
  }
  return streak;
}

/**
 * The whole timeline in one card: consistency %, perfect-day streak, missed days,
 * and the last 7 days as fill-level pills (share of daily challenges done per day).
 */
export function ConsistencyCard({ challenges }: { challenges: TodayChallenge[] }) {
  const days = summarise(challenges);
  const past = days.slice(0, -1).filter((d) => d.active > 0); // completed days only
  const doneSlots = past.reduce((s, d) => s + d.done, 0);
  const totalSlots = past.reduce((s, d) => s + d.active, 0);
  const consistency = totalSlots ? Math.round((doneSlots / totalSlots) * 100) : null;
  const missedDays = past.filter((d) => d.done < d.active).length;
  const streak = perfectStreak(days);
  if (!days.length) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} className="rounded-3xl bg-card p-5">
      <View className="flex-row items-end justify-between">
        <View>
          <Text className="text-sm text-muted">Consistency</Text>
          {/* No finished days yet → "Day 1" rather than an empty dash. */}
          <Text className="font-sans-semibold text-4xl leading-tight">
            {consistency === null ? 'Day 1' : `${consistency}%`}
          </Text>
        </View>
        <View className="flex-row gap-5">
          <Stat value={streak} label="Streak" />
          <Stat value={missedDays} label="Missed" />
        </View>
      </View>

      {/* One row, last 7 days: each pill fills from the bottom by the share of that day's
          challenges done (empty = none, full = all). Today is outlined. */}
      <View
        className="mt-4 flex-row gap-2"
        accessible
        accessibilityLabel={`This week: ${streak} day perfect streak, ${missedDays} days with a miss`}
      >
        {days.slice(-7).map((d, i) => {
          const share = d.active ? d.done / d.active : 0;
          const isToday = i === 6;
          return (
            <View key={d.date} className="flex-1 items-center gap-1.5">
              <View
                className="h-16 w-full justify-end overflow-hidden rounded-lg"
                style={{
                  backgroundColor: d.active ? colors.primarySoft : '#F0EEE8',
                  borderWidth: isToday ? 1.5 : 0,
                  borderColor: colors.ink,
                }}
              >
                <View
                  className="w-full rounded-lg"
                  style={{ height: `${share * 100}%`, backgroundColor: colors.primary }}
                />
              </View>
              <Text className="text-[10px] text-muted">{weekdayLetter(d.date)}</Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View className="items-end">
      <Text className="font-sans-semibold text-xl leading-tight">{value}</Text>
      <Text className="text-xs text-muted">{label}</Text>
    </View>
  );
}
