import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

interface Props {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** 'radio' for pick-one groups, 'checkbox' (default) for pick-many. */
  role?: 'radio' | 'checkbox';
}

/**
 * Small selectable tag. Selected = tint + outline + check mark, so state never relies on
 * colour alone (ui-ux-pro-max). 44pt tall to meet the minimum touch target.
 */
export function Chip({ label, selected, onPress, role = 'checkbox' }: Props) {
  return (
    <PressableScale
      scaleTo={0.96}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole={role}
      accessibilityState={role === 'radio' ? { selected } : { checked: selected }}
      accessibilityLabel={label}
      className={cn(
        'h-11 flex-row items-center gap-1.5 rounded-lg border px-3.5',
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-card',
      )}
    >
      {selected && <Check size={15} strokeWidth={2.5} color={colors.primary} />}
      <Text className={cn('font-sans-medium text-sm', selected && 'text-primary-dark')}>
        {label}
      </Text>
    </PressableScale>
  );
}
