import { Camera } from 'lucide-react-native';
import { View } from 'react-native';
import { ActivityRings, type Ring } from '@/components/ui/activity-rings';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import { colors } from '@/constants/colors';
import type { Meal } from '@/types/meal';
import type { Macros, TodayChallenge } from '@/types/today';
import { fmt } from './challenge-widgets';
import { MealsList } from './meals-list';

/** Inner rings around the calorie ring (more would get too thin to read). */
const MAX_CHALLENGE_RINGS = 3;

const MACROS = [
  { key: 'proteinG', label: 'Protein', color: colors.primary, kcalPerG: 4 },
  { key: 'carbsG', label: 'Carbs', color: colors.accent, kcalPerG: 4 },
  { key: 'fatG', label: 'Fat', color: '#D99A2B', kcalPerG: 9 },
] as const;

interface Props {
  targets: Macros;
  eaten: Macros;
  challenges: TodayChallenge[];
  meals: Meal[];
  date: string;
  onLogMeal: () => void;
}

/**
 * Today in one card: big concentric rings (calories outermost, then up to three daily
 * challenges), a one-line-per-ring legend, and the macro split as a single thin bar.
 * Numbers carry the meaning; labels are one word.
 */
export function CalorieCard({ targets, eaten, challenges, meals, date, onLogMeal }: Props) {
  const left = Math.max(0, targets.calories - eaten.calories);
  const daily = challenges.filter((c) => c.frequency === 'daily').slice(0, MAX_CHALLENGE_RINGS);

  const rings: Ring[] = [
    {
      key: 'kcal',
      progress: eaten.calories / targets.calories,
      color: colors.ink,
      track: '#E9E7E1',
    },
    ...daily.map((c) => ({
      key: c.id,
      progress: c.progress.value / c.progress.goal,
      color: CATEGORY_THEME[c.category].mark,
      track: CATEGORY_THEME[c.category].track,
    })),
  ];

  // One short line per ring. Units live on each challenge's own card; the centre already
  // says kcal left, so the calorie row only needs what's eaten.
  const legend = [
    { key: 'kcal', color: colors.ink, label: 'Eaten', value: String(eaten.calories) },
    ...daily.map((c) => ({
      key: c.id,
      color: CATEGORY_THEME[c.category].mark,
      label: c.tracking.label ?? c.title,
      value: `${fmt(c.progress.value)}/${fmt(c.progress.goal)}`,
    })),
  ];

  return (
    <View className="rounded-3xl bg-card p-5">
      <View className="mb-4 flex-row items-center justify-between">
        <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
          Today
        </Text>
        <PressableScale
          onPress={onLogMeal}
          accessibilityRole="button"
          accessibilityLabel="Log a meal with a photo"
          className="h-9 flex-row items-center gap-1.5 rounded-full bg-ink px-3.5"
        >
          <Camera size={16} color="#fff" />
          <Text className="font-sans-semibold text-sm text-white">Log meal</Text>
        </PressableScale>
      </View>

      <View className="flex-row items-center gap-4">
        <ActivityRings rings={rings} size={156} stroke={11} gap={3}>
          <Text className="font-sans-semibold text-2xl leading-none">{left}</Text>
          <Text className="mt-0.5 text-[11px] text-muted">left</Text>
        </ActivityRings>

        <View
          className="flex-1 gap-3"
          accessible
          accessibilityLabel={`${left} kilocalories left. ${legend.map((l) => `${l.label} ${l.value}`).join(', ')}`}
        >
          {legend.map((l) => (
            <View key={l.key} className="flex-row items-center gap-2">
              <View className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
              <Text className="flex-1 text-sm text-muted" numberOfLines={1}>
                {l.label}
              </Text>
              <Text className="font-sans-semibold text-sm">{l.value}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="my-4 h-px bg-line" />
      <MacroSplit targets={targets} eaten={eaten} />

      {meals.length > 0 && (
        <>
          <View className="my-4 h-px bg-line" />
          <MealsList meals={meals} date={date} />
        </>
      )}
    </View>
  );
}

/**
 * Macro targets as one thin segmented bar (each part's share of the day's calories)
 * (weighted by kcal per gram) and one line of eaten/target grams.
 */
function MacroSplit({ targets, eaten }: { targets: Macros; eaten: Macros }) {
  const kcal = MACROS.map((m) => targets[m.key] * m.kcalPerG);
  const total = kcal.reduce((a, b) => a + b, 0) || 1;
  return (
    <View
      accessible
      accessibilityLabel={MACROS.map(
        (m) => `${m.label} ${eaten[m.key]} of ${targets[m.key]} grams`,
      ).join(', ')}
    >
      <View className="h-2 flex-row gap-0.5 overflow-hidden rounded-full">
        {MACROS.map((m, i) => (
          <View key={m.key} style={{ flex: kcal[i]! / total, backgroundColor: m.color }} />
        ))}
      </View>
      <View className="mt-2.5 flex-row justify-between">
        {MACROS.map((m) => (
          <View key={m.key} className="flex-row items-start">
            <Text className="text-sm text-muted">{m.label} </Text>
            <Text className="font-sans-semibold text-sm">
              {eaten[m.key]}
              <Text className="text-sm text-muted">/{targets[m.key]}g</Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
