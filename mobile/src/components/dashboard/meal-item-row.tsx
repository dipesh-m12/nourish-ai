import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import {
  MAX_SCALE,
  MIN_SCALE,
  scaledItem,
  scaleForCalories,
  type ItemEntry,
} from '@/utils/meal-items';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const fmtScale = (s: number) => `×${Math.round(s * 100) / 100}`;

interface Props {
  entry: ItemEntry;
  expanded: boolean;
  first: boolean;
  canRemove: boolean;
  onToggle: () => void;
  onScale: (scale: number) => void;
  onRemove: () => void;
}

/**
 * One food on the plate. Collapsed: name, portion, kcal. Tapped open: change how much
 * (×½ steps) or type the calories directly; protein, carbs and fat follow either way.
 */
export function MealItemRow({
  entry,
  expanded,
  first,
  canRemove,
  onToggle,
  onScale,
  onRemove,
}: Props) {
  const item = scaledItem(entry);
  // While typing, show the draft; otherwise always the computed value.
  const [draft, setDraft] = useState<string | null>(null);

  const open = useDerivedValue(() =>
    withTiming(expanded ? 1 : 0, { duration: 220, easing: EASE_OUT }),
  );
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${open.get() * 180}deg` }],
  }));

  const commitCalories = () => {
    const n = Number(draft?.replace(',', '.'));
    if (draft !== null && Number.isFinite(n) && n > 0) onScale(scaleForCalories(entry, n));
    setDraft(null);
  };

  return (
    <View className={cn(!first && 'border-t border-line')}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${item.name}, ${item.portion}, ${item.calories} kilocalories. ${expanded ? 'Collapse' : 'Edit'}`}
        className="flex-row items-center gap-3 px-4 py-3 active:opacity-70"
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            {/* Marks the food behind the diet/allergy warning, so it's clear what to remove. */}
            {entry.warning && (
              <View
                className="h-2 w-2 rounded-full bg-accent"
                accessibilityLabel="Not in your plan"
              />
            )}
            <Text className="flex-shrink font-sans-medium" numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <Text className="text-xs text-muted" numberOfLines={1}>
            {item.portion}
          </Text>
        </View>
        <RollingNumber value={item.calories} className="font-sans-semibold text-sm" />
        <Animated.View style={chevron}>
          <ChevronDown size={16} color={colors.muted} />
        </Animated.View>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(200)} className="gap-3 px-4 pb-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Amount</Text>
            <Stepper
              compact
              value={entry.scale}
              onChange={onScale}
              min={MIN_SCALE}
              max={MAX_SCALE}
              step={0.5}
              unit="portions"
              label={`Amount of ${item.name}`}
              format={fmtScale}
            />
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-sm text-muted">Calories</Text>
            <View className="h-10 w-28 flex-row items-center rounded-lg border border-line bg-bg px-3">
              <TextInput
                value={draft ?? String(item.calories)}
                onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ''))}
                onFocus={() => setDraft(String(item.calories))}
                onBlur={commitCalories}
                onSubmitEditing={commitCalories}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={4}
                selectTextOnFocus
                accessibilityLabel={`Calories for ${item.name}`}
                className="flex-1 font-sans-semibold text-base text-ink"
              />
              <Text className="text-sm text-muted">kcal</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-between">
            <Text className="text-xs text-muted">
              Protein {item.proteinG}g · Carbs {item.carbsG}g · Fat {item.fatG}g
            </Text>
            {canRemove && (
              <Pressable
                onPress={onRemove}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.name}`}
                className="active:opacity-70"
              >
                <Text className="font-sans-semibold text-sm text-danger">Remove</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      )}
    </View>
  );
}
