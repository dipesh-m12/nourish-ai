import { useState } from 'react';
import { View } from 'react-native';
import { StepScreen } from '@/components/onboarding/step-screen';
import { NumberField } from '@/components/ui/number-field';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Text } from '@/components/ui/text';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';
import { cmToFeetInches, feetInchesToCm, parseDecimal } from '@/utils/units';

type HeightUnit = 'cm' | 'ft';

const HEIGHT_RANGE = { min: 100, max: 250 };
const WEIGHT_RANGE = { min: 25, max: 300 };

function rangeError(
  value: number | undefined,
  { min, max }: { min: number; max: number },
  unit: string,
) {
  if (value === undefined) return undefined;
  return value < min || value > max ? `Enter between ${min} and ${max} ${unit}` : undefined;
}

export default function BodyStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('body');

  // Inputs are kept as text so users can type freely; the draft always stores cm/kg.
  const initialFtIn = draft.heightCm ? cmToFeetInches(draft.heightCm) : undefined;
  const [unit, setUnit] = useState<HeightUnit>('cm');
  const [cmText, setCmText] = useState(draft.heightCm ? String(draft.heightCm) : '');
  const [ftText, setFtText] = useState(initialFtIn ? String(initialFtIn.feet) : '');
  const [inText, setInText] = useState(initialFtIn ? String(initialFtIn.inches) : '');
  const [kgText, setKgText] = useState(draft.weightKg ? String(draft.weightKg) : '');

  const heightCm =
    unit === 'cm'
      ? parseDecimal(cmText)
      : ftText
        ? feetInchesToCm(parseDecimal(ftText) ?? 0, parseDecimal(inText) ?? 0)
        : undefined;
  const weightKg = parseDecimal(kgText);

  const heightError = rangeError(heightCm, HEIGHT_RANGE, 'cm');
  const weightError = rangeError(weightKg, WEIGHT_RANGE, 'kg');
  const valid = heightCm !== undefined && weightKg !== undefined && !heightError && !weightError;

  const switchUnit = (next: HeightUnit) => {
    // Carry the value across so switching units never loses what was typed.
    if (next === 'ft' && heightCm) {
      const { feet, inches } = cmToFeetInches(heightCm);
      setFtText(String(feet));
      setInText(String(inches));
    }
    if (next === 'cm' && heightCm) setCmText(String(heightCm));
    setUnit(next);
  };

  return (
    <StepScreen
      title="Your height and weight"
      subtitle="Used to set your daily calories. Only you can see this."
      canContinue={valid}
      onContinue={() => {
        update({ heightCm, weightKg: Math.round(weightKg! * 10) / 10 });
        goNext();
      }}
    >
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-sans-semibold">Height</Text>
        <SegmentedControl
          value={unit}
          onChange={switchUnit}
          options={[
            { value: 'cm', label: 'cm' },
            { value: 'ft', label: 'ft / in' },
          ]}
        />
      </View>
      {unit === 'cm' ? (
        <NumberField
          value={cmText}
          onChangeText={setCmText}
          unit="cm"
          placeholder="170"
          accessibilityLabel="Height in centimetres"
          error={heightError}
          autoFocus
        />
      ) : (
        <View>
          <View className="flex-row gap-3">
            <NumberField
              value={ftText}
              onChangeText={setFtText}
              unit="ft"
              placeholder="5"
              accessibilityLabel="Height, feet"
            />
            <NumberField
              value={inText}
              onChangeText={setInText}
              unit="in"
              placeholder="7"
              accessibilityLabel="Height, inches"
            />
          </View>
          {heightError && (
            <Text className="mt-1.5 text-sm text-danger">
              That height looks off — please check it
            </Text>
          )}
        </View>
      )}

      <Text className="mb-3 mt-8 font-sans-semibold">Weight</Text>
      <NumberField
        value={kgText}
        onChangeText={setKgText}
        unit="kg"
        placeholder="70"
        accessibilityLabel="Weight in kilograms"
        error={weightError}
        allowDecimal
      />
    </StepScreen>
  );
}
