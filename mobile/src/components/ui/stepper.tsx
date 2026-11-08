import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { usePressRepeat } from '@/hooks/use-press-repeat';
import { cn } from '@/lib/cn';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  label: string;
  /** How much one tap changes the value (default 1). */
  step?: number;
  /** How the number is shown, e.g. 0.25 → "0.25", 1.5 → "×1.5". */
  format?: (value: number) => string;
  /** Smaller variant for inline rows (meal items). */
  compact?: boolean;
}

/** Avoids 0.1 + 0.2 = 0.30000000000000004 drifting into the display. */
const tidy = (n: number) => Math.round(n * 1000) / 1000;

/**
 * − value + control. Tap for one step, hold to keep going. The number rolls in the direction
 * of change (up when adding), which makes each tap feel physical.
 */
export function Stepper({
  value,
  onChange,
  min,
  max,
  unit,
  label,
  step = 1,
  format = String,
  compact,
}: Props) {
  // Holding fires faster than React re-renders, so track the latest value in a ref.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  /** Applies one step; returns false at a limit so press-and-hold stops. */
  const change = (delta: number) => {
    const next = tidy(Math.min(max, Math.max(min, valueRef.current + delta)));
    if (next === valueRef.current) return false;
    valueRef.current = next;
    Haptics.selectionAsync();
    onChange(next);
    return true;
  };

  const decrement = usePressRepeat(() => change(-step));
  const increment = usePressRepeat(() => change(step));

  return (
    <View
      className={cn(
        'flex-row items-center justify-between',
        compact ? 'gap-2' : 'rounded-2xl bg-card p-3',
      )}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${format(value)} ${unit}` }}
      onAccessibilityAction={(e) => change(e.nativeEvent.actionName === 'increment' ? step : -step)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    >
      <StepButton {...decrement} disabled={value <= min} compact={compact}>
        <Minus size={compact ? 16 : 22} color={colors.ink} />
      </StepButton>
      <View className={cn('items-center', compact && 'min-w-14')}>
        <RollingNumber
          value={value}
          format={format}
          className={compact ? 'font-sans-semibold text-base' : 'font-serif-bold text-4xl'}
        />
        {!compact && <Text className="text-sm text-muted">{unit}</Text>}
      </View>
      <StepButton {...increment} disabled={value >= max} compact={compact}>
        <Plus size={compact ? 16 : 22} color={colors.ink} />
      </StepButton>
    </View>
  );
}

interface StepButtonProps {
  children: React.ReactNode;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled: boolean;
  compact?: boolean;
}

function StepButton({ children, onPressIn, onPressOut, disabled, compact }: StepButtonProps) {
  return (
    <PressableScale
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      scaleTo={0.9}
      hitSlop={8}
      className={cn(
        'items-center justify-center bg-bg',
        compact ? 'h-9 w-9 rounded-lg' : 'h-14 w-14 rounded-xl',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </PressableScale>
  );
}
