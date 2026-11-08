import * as Haptics from 'expo-haptics';
import { Minus, Plus } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
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
}

/** − value + control for small whole numbers like age. Tap for one step, hold to keep going. */
export function Stepper({ value, onChange, min, max, unit, label }: Props) {
  // Holding fires faster than React re-renders, so track the latest value in a ref.
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  /** Applies one step; returns false at a limit so press-and-hold stops. */
  const change = (delta: number) => {
    const next = Math.min(max, Math.max(min, valueRef.current + delta));
    if (next === valueRef.current) return false;
    valueRef.current = next;
    Haptics.selectionAsync();
    onChange(next);
    return true;
  };

  const decrement = usePressRepeat(() => change(-1));
  const increment = usePressRepeat(() => change(1));

  return (
    <View
      className="flex-row items-center justify-between rounded-2xl bg-card p-3"
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: `${value} ${unit}` }}
      onAccessibilityAction={(e) => change(e.nativeEvent.actionName === 'increment' ? 1 : -1)}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
    >
      <StepButton {...decrement} disabled={value <= min}>
        <Minus size={22} color={colors.ink} />
      </StepButton>
      <View className="items-center">
        <Text className="font-serif-bold text-4xl">{value}</Text>
        <Text className="text-sm text-muted">{unit}</Text>
      </View>
      <StepButton {...increment} disabled={value >= max}>
        <Plus size={22} color={colors.ink} />
      </StepButton>
    </View>
  );
}

interface StepButtonProps {
  children: React.ReactNode;
  onPressIn: () => void;
  onPressOut: () => void;
  disabled: boolean;
}

function StepButton({ children, onPressIn, onPressOut, disabled }: StepButtonProps) {
  return (
    <PressableScale
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      scaleTo={0.9}
      hitSlop={8}
      className={cn(
        'h-14 w-14 items-center justify-center rounded-xl bg-bg',
        disabled && 'opacity-30',
      )}
    >
      {children}
    </PressableScale>
  );
}
