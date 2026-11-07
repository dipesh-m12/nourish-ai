import { ActivityIndicator } from 'react-native';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

const containerByVariant: Record<Variant, string> = {
  primary: 'bg-primary',
  secondary: 'bg-card border border-line',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
};

const labelByVariant: Record<Variant, string> = {
  primary: 'text-white',
  secondary: 'text-ink',
  ghost: 'text-primary',
  danger: 'text-white',
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  className = '',
}: Props) {
  const inactive = disabled || loading;
  return (
    <PressableScale
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      // Caller classes are about placement (margins, self-stretch), so they go on the wrapper.
      containerClassName={className}
      className={cn(
        'h-14 flex-row items-center justify-center rounded-2xl px-6',
        containerByVariant[variant],
        disabled && 'opacity-40',
      )}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary}
        />
      ) : (
        <Text className={cn('font-sans-semibold text-base', labelByVariant[variant])}>{label}</Text>
      )}
    </PressableScale>
  );
}
