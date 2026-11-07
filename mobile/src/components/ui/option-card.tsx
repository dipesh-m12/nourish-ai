import * as Haptics from 'expo-haptics';
import { Check, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

interface Props {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  selected: boolean;
  onPress: () => void;
  className?: string;
}

/** Big tappable answer card used across onboarding — one tap answers the question. */
export function OptionCard({ label, hint, icon: Icon, selected, onPress, className = '' }: Props) {
  return (
    <PressableScale
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={hint ? `${label}. ${hint}` : label}
      className={`flex-row items-center gap-4 rounded-2xl border-2 p-4 ${
        selected ? 'border-primary bg-primary-soft' : 'border-line bg-card'
      } ${className}`}
    >
      {Icon && (
        <View
          className={`h-11 w-11 items-center justify-center rounded-xl ${
            selected ? 'bg-primary' : 'bg-bg'
          }`}
        >
          <Icon size={22} color={selected ? '#fff' : colors.ink} />
        </View>
      )}
      <View className="flex-1">
        <Text className="font-sans-semibold">{label}</Text>
        {hint && <Text className="mt-0.5 text-sm text-muted">{hint}</Text>}
      </View>
      {selected && <Check size={20} color={colors.primary} />}
    </PressableScale>
  );
}
