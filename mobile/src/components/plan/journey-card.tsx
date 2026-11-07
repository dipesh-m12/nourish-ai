import { ArrowRight, SquareArrowOutUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { bandFor } from '@/constants/bmi';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { BmiSheet } from './bmi-sheet';
import type { BmiCategory, Plan } from '@/types/plan';
import type { GoalType } from '@/types/profile';

/**
 * Kind wording: describes the number, never the person. The dot uses the same colours as the
 * BMI scale (constants/bmi.ts) and is always backed by text, not colour alone.
 */
const BMI_LABEL: Record<BmiCategory, string> = {
  underweight: 'Below healthy range',
  healthy: 'Healthy range',
  overweight: 'Slightly above healthy range',
  obese: 'Above healthy range',
};

const GOAL_LABEL: Record<GoalType, string> = {
  lose_weight: 'Lose weight',
  gain_muscle: 'Build muscle',
  maintain: 'Stay where you are',
  eat_healthier: 'Eat healthier',
};

/** Where you are → where you're going, how long it takes, and your BMI for context. */
export function JourneyCard({
  metrics,
  goalType,
}: {
  metrics: Plan['metrics'];
  goalType: GoalType;
}) {
  const { startWeightKg, targetWeightKg, estimatedWeeks, bmi, bmiCategory } = metrics;
  const bmiLabel = BMI_LABEL[bmiCategory];
  const [bmiOpen, setBmiOpen] = useState(false);

  return (
    <View className="rounded-2xl bg-card p-5">
      <View className="flex-row items-center justify-between">
        <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
          {GOAL_LABEL[goalType]}
        </Text>
        {estimatedWeeks && (
          <View className="rounded-md bg-primary-soft px-2.5 py-1">
            <Text className="font-sans-semibold text-xs text-primary-dark">
              ~{estimatedWeeks} weeks
            </Text>
          </View>
        )}
      </View>

      <View className="mt-4 flex-row items-end">
        <Stat label="Now" value={`${startWeightKg}`} unit="kg" />
        {targetWeightKg != null && (
          <>
            <View className="mx-4 mb-2">
              <ArrowRight size={20} color={colors.muted} />
            </View>
            <Stat label="Goal" value={`${targetWeightKg}`} unit="kg" highlight />
          </>
        )}
      </View>

      {/* Whole row opens the BMI scale; the ↗ icon signals "there's more here". */}
      <Pressable
        onPress={() => setBmiOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`BMI ${bmi}, ${bmiLabel}. Open BMI scale`}
        className="mt-5 flex-row items-center gap-2 border-t border-line pt-4 active:opacity-70"
      >
        <Text className="font-sans-semibold">BMI {bmi}</Text>
        <View
          className="ml-1 h-2 w-2 rounded-full"
          style={{ backgroundColor: bandFor(bmi).color }}
        />
        <Text className="flex-1 text-sm text-muted">{bmiLabel}</Text>
        <SquareArrowOutUpRight size={18} color={colors.muted} />
      </Pressable>

      <BmiSheet
        visible={bmiOpen}
        onClose={() => setBmiOpen(false)}
        bmi={bmi}
        weightKg={startWeightKg}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <View>
      <Text className="text-sm text-muted">{label}</Text>
      <Text className={cn('font-serif-bold text-4xl', highlight && 'text-primary')}>
        {value}
        <Text className="font-sans text-base text-muted"> {unit}</Text>
      </Text>
    </View>
  );
}
