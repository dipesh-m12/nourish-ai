import { View } from 'react-native';
import { StepScreen } from '@/components/onboarding/step-screen';
import { AddChip } from '@/components/ui/add-chip';
import { Chip } from '@/components/ui/chip';
import { FieldLabel } from '@/components/ui/field-label';
import { RadioList } from '@/components/ui/radio-list';
import { COMMON_ALLERGIES, DIET_OPTIONS } from '@/constants/onboarding';
import { useOnboardingNav } from '@/hooks/use-onboarding-nav';
import { useOnboarding } from '@/store/onboarding';

export default function FoodStep() {
  const { draft, update } = useOnboarding();
  const { goNext } = useOnboardingNav('food');

  // Custom allergies typed by the user show up as chips alongside the common ones.
  const allergyOptions = [...new Set([...COMMON_ALLERGIES, ...draft.allergies])];

  const toggleAllergy = (name: string) => {
    const has = draft.allergies.includes(name);
    update({
      allergies: has ? draft.allergies.filter((a) => a !== name) : [...draft.allergies, name],
    });
  };

  const addAllergy = (name: string) => {
    const exists = draft.allergies.some((a) => a.toLowerCase() === name.toLowerCase());
    if (!exists) update({ allergies: [...draft.allergies, name] });
  };

  return (
    <StepScreen title="What do you eat?" canContinue={Boolean(draft.dietType)} onContinue={goNext}>
      <FieldLabel>Diet</FieldLabel>
      <RadioList
        options={DIET_OPTIONS}
        value={draft.dietType}
        onChange={(dietType) => update({ dietType })}
      />

      <FieldLabel optional className="mt-8">
        Allergies
      </FieldLabel>
      <View className="flex-row flex-wrap gap-2">
        {allergyOptions.map((name) => (
          <Chip
            key={name}
            label={name}
            selected={draft.allergies.includes(name)}
            onPress={() => toggleAllergy(name)}
          />
        ))}
        <AddChip label="Add other" onAdd={addAllergy} />
      </View>
    </StepScreen>
  );
}
