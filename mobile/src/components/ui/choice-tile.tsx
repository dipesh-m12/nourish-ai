import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

interface Props {
  label: string;
  /** Optional: without it the label is centred alone. */
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
}

/** Compact choice (icon above label) for 2–3 options side by side. Tiles in a row share one height. */
export function ChoiceTile({ label, icon: Icon, selected, onPress }: Props) {
  return (
    <PressableScale
      containerClassName="flex-1"
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      className={cn(
        'flex-1 items-center justify-center gap-3 rounded-2xl border-2 px-2 py-5',
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-card',
      )}
    >
      {Icon && (
        <View
          className={cn(
            'h-12 w-12 items-center justify-center rounded-full',
            selected ? 'bg-primary' : 'bg-bg',
          )}
        >
          <Icon size={24} color={selected ? '#fff' : colors.ink} />
        </View>
      )}
      <Text className={cn('text-center font-sans-semibold', Icon ? 'text-sm' : 'text-base')}>
        {label}
      </Text>
    </PressableScale>
  );
}
