import { Check, TriangleAlert, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition } from 'react-native-reanimated';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import { colors, macroColors } from '@/constants/colors';
import type { MealCredit, MealItem } from '@/types/meal';
import { scaledItem, totalsOf, type ItemEntry } from '@/utils/meal-items';
import { AddFoodRow } from './add-food-row';
import { fmt } from './challenge-widgets';
import { MealItemRow } from './meal-item-row';

const LAYOUT = LinearTransition.duration(220);
const MACROS = [
  { key: 'proteinG', label: 'protein' },
  { key: 'carbsG', label: 'carbs' },
  { key: 'fatG', label: 'fat' },
] as const;

interface Props {
  title: string;
  entries: ItemEntry[];
  /** Kept for the save call; not shown (it was a sentence nobody needed). */
  comment?: string;
  credits: MealCredit[];
  /** The challenge this was snapped for, and whether the plate counts for it. */
  startedFit?: { label: string; fits: boolean; note: string | null } | null;
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
  credits,
  startedFit,
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
      {/* Same macro colours as the dashboard bars: a dot beside each, the name in text. */}
      <View className="mt-2 flex-row gap-4">
        {MACROS.map((m) => (
          <View key={m.key} className="flex-row items-center gap-1.5">
            <View
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: macroColors[m.key].fill }}
            />
            <Text className="text-sm text-muted">
              <Text className="font-sans-semibold text-sm text-ink">{totals[m.key]}g</Text>{' '}
              {m.label}
            </Text>
          </View>
        ))}
      </View>

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

      {/* Off-diet food still counts as calories, never as challenge credit: say which, briefly. */}
      {warnings.length > 0 && (
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
              <Text className="flex-1 text-sm" numberOfLines={2}>
                {w}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* What this meal moves, as chips: no sentence to read. */}
      {credits.length > 0 && warnings.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          layout={LAYOUT}
          className="mt-4 flex-row flex-wrap gap-2"
          accessible
          accessibilityLabel={`Counts toward ${credits.map((c) => c.label).join(', ')}`}
        >
          {credits.map((c) => (
            <View
              key={c.challengeId}
              className="flex-row items-center gap-1 rounded-full bg-primary-soft px-3 py-1"
            >
              <Check size={14} color={colors.primary} strokeWidth={3} />
              <Text className="font-sans-semibold text-sm text-primary">
                {c.label}
                {c.unit ? ` +${fmt(c.amount)} ${c.unit}` : ''}
              </Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* Snapped for a challenge that this plate doesn't satisfy: say so, kindly, in one line.
          The calories still count; only that challenge isn't ticked. */}
      {startedFit && !startedFit.fits && warnings.length === 0 && (
        <Animated.View
          entering={FadeInDown.duration(260)}
          layout={LAYOUT}
          className="mt-3 flex-row items-center gap-2 rounded-xl bg-bg px-3 py-2.5"
          accessible
          accessibilityLabel={`Doesn't count for ${startedFit.label}${
            startedFit.note ? `: ${startedFit.note}` : ''
          }`}
        >
          <X size={14} color={colors.muted} strokeWidth={3} />
          <Text className="flex-1 text-sm text-muted">
            <Text className="font-sans-semibold text-sm text-ink">{startedFit.label}</Text>
            {startedFit.note ? ` · ${startedFit.note}` : ' · doesn’t count'}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}
