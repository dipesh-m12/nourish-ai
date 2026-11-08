import { TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { MealCredit, MealItem } from '@/types/meal';
import { scaledItem, totalsOf, type ItemEntry } from '@/utils/meal-items';
import { AddFoodRow } from './add-food-row';
import { fmt } from './challenge-widgets';
import { MealItemRow } from './meal-item-row';

const LAYOUT = LinearTransition.duration(220);

interface Props {
  title: string;
  entries: ItemEntry[];
  comment: string;
  credits: MealCredit[];
  warnings: string[];
  onScale: (key: string, scale: number) => void;
  onRemove: (key: string) => void;
  onAdd: (item: MealItem, dietWarning: string | null) => void;
}

/**
 * The AI's read of the plate, fully editable: the total rolls as items change, each item opens
 * to adjust amount or calories, and anything missed can be typed in.
 */
export function MealEstimate({
  title,
  entries,
  comment,
  credits,
  warnings,
  onScale,
  onRemove,
  onAdd,
}: Props) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const totals = totalsOf(entries.map(scaledItem));

  return (
    <Animated.View entering={FadeIn.duration(250)} layout={LAYOUT}>
      <Text className="text-sm text-muted" numberOfLines={1}>
        {title}
      </Text>
      <View className="mt-1 flex-row items-baseline gap-1.5">
        <RollingNumber
          value={totals.calories}
          className="font-sans-semibold text-4xl leading-tight"
        />
        <Text className="text-muted">kcal</Text>
      </View>
      <Text className="mt-1 text-sm text-muted">
        Protein <Text className="font-sans-semibold text-sm">{totals.proteinG}g</Text> · Carbs{' '}
        <Text className="font-sans-semibold text-sm">{totals.carbsG}g</Text> · Fat{' '}
        <Text className="font-sans-semibold text-sm">{totals.fatG}g</Text>
      </Text>

      <Animated.View layout={LAYOUT} className="mt-4 overflow-hidden rounded-2xl bg-card">
        {entries.map((e, i) => (
          <Animated.View
            key={e.key}
            entering={FadeInDown.duration(260)}
            exiting={FadeOut.duration(150)}
            layout={LAYOUT}
          >
            <MealItemRow
              entry={e}
              first={i === 0}
              expanded={expanded === e.key}
              canRemove={entries.length > 1}
              onToggle={() => setExpanded(expanded === e.key ? null : e.key)}
              onScale={(s) => onScale(e.key, s)}
              onRemove={() => {
                setExpanded(null);
                onRemove(e.key);
              }}
            />
          </Animated.View>
        ))}
        <AddFoodRow onAdd={onAdd} />
      </Animated.View>

      {/* Off-diet food: honest calorie tracking still happens, but no challenge credit. */}
      {warnings.length > 0 ? (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut.duration(180)}
          layout={LAYOUT}
          className="mt-4 gap-1.5 rounded-xl bg-accent-soft p-3"
          accessibilityLiveRegion="polite"
        >
          {warnings.map((w) => (
            <View key={w} className="flex-row items-start gap-2">
              <TriangleAlert size={16} color={colors.accent} />
              <Text className="flex-1 text-sm">{w}</Text>
            </View>
          ))}
        </Animated.View>
      ) : (
        <Animated.Text layout={LAYOUT} className="mt-4 font-sans text-sm text-ink">
          {comment}
        </Animated.Text>
      )}

      {credits.length > 0 && warnings.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          layout={LAYOUT}
          className="mt-4 flex-row flex-wrap items-center gap-2"
        >
          <Text className="text-sm text-muted">Counts toward</Text>
          {credits.map((c) => (
            <View key={c.challengeId} className="rounded-full bg-primary-soft px-3 py-1">
              <Text className="font-sans-semibold text-sm text-primary">
                {c.label}
                {c.unit ? ` +${fmt(c.amount)} ${c.unit}` : ''}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}
    </Animated.View>
  );
}
