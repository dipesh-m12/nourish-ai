import { View } from 'react-native';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { Text } from '@/components/ui/text';
import { ACTIVITY_OPTIONS, DIET_OPTIONS, GOAL_OPTIONS, SEX_OPTIONS } from '@/constants/onboarding';
import type { Profile } from '@/types/profile';

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null) =>
  options.find((o) => o.value === value)?.label ?? '—';

/** Everything from onboarding, kept off the profile screen until asked for. */
export function DetailsSheet({
  visible,
  profile,
  onClose,
}: {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
}) {
  const rows: [string, string][] = [
    ['Sex', labelOf(SEX_OPTIONS, profile.sex)],
    ['Age', profile.age ? `${profile.age}` : '—'],
    ['Height', profile.heightCm ? `${profile.heightCm} cm` : '—'],
    ['Weight', profile.weightKg ? `${profile.weightKg} kg` : '—'],
    ['Activity', labelOf(ACTIVITY_OPTIONS, profile.activityLevel)],
    ['Diet', labelOf(DIET_OPTIONS, profile.dietType)],
    ['Allergies', profile.allergies.length ? profile.allergies.join(', ') : 'None'],
  ];
  if (profile.goal) {
    rows.push(['Goal', labelOf(GOAL_OPTIONS, profile.goal.type)]);
    if (profile.goal.targetWeightKg != null)
      rows.push(['Target', `${profile.goal.targetWeightKg} kg`]);
  }

  return (
    <DraggableSheet visible={visible} onClose={onClose} title="Your details">
      <View className="overflow-hidden rounded-2xl bg-card">
        {rows.map(([label, value], i) => (
          <View
            key={label}
            className={`flex-row items-center justify-between gap-4 px-4 py-3.5 ${i ? 'border-t border-line' : ''}`}
          >
            <Text className="text-muted">{label}</Text>
            <Text className="flex-shrink text-right font-sans-medium">{value}</Text>
          </View>
        ))}
      </View>
      {profile.goal?.why && (
        <View className="mt-4 rounded-2xl bg-accent-soft p-4">
          <Text className="text-xs uppercase tracking-wider text-muted">Your why</Text>
          <Text className="mt-1 font-serif text-lg leading-snug">{profile.goal.why}</Text>
        </View>
      )}
    </DraggableSheet>
  );
}
