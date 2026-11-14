import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

/** "07:30" → "7:30 am". */
export function clockText(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h! % 12 || 12}:${String(m).padStart(2, '0')} ${h! < 12 ? 'am' : 'pm'}`;
}

export const toHHMM = (p: { hour: number; minute: number }) =>
  `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;

/**
 * One pill for on and off, so rows line up: the time on a soft green fill when set, a quiet
 * outlined "Off" when not. `value` "on" = a switch-like state with no time (water sips).
 */
export function TimePill({
  value,
  onPress,
  label,
}: {
  value: string | null;
  onPress?: () => void;
  label?: string;
}) {
  const on = value !== null;
  const body = (
    <View
      className={cn(
        'h-9 items-center justify-center rounded-full px-3',
        on ? 'bg-primary-soft' : 'border border-line',
      )}
      style={{ minWidth: 88 }}
    >
      <Text className={cn('font-sans-semibold text-sm', on ? 'text-primary-dark' : 'text-muted')}>
        {value === 'on' ? 'On' : on ? clockText(value) : 'Off'}
      </Text>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${label ?? ''} reminder ${
        on && value !== 'on' ? `at ${clockText(value)}` : 'off'
      }. Change time`}
      className="min-h-12 justify-center active:opacity-70"
    >
      {body}
    </Pressable>
  );
}
