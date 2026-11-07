import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
}

/**
 * Pick-one list in a single grouped card (settings style). Calmer than a stack of
 * separate cards, and each row can explain itself with a short hint.
 * Full-width rows highlight their background on press rather than scaling (expo-animation skill).
 */
export function RadioList<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View
      className="overflow-hidden rounded-2xl border border-line bg-card"
      accessibilityRole="radiogroup"
    >
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (!selected) Haptics.selectionAsync();
              onChange(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.hint ? `${o.label}. ${o.hint}` : o.label}
            className={cn(
              'min-h-14 flex-row items-center gap-3 px-4 py-3 active:bg-bg',
              i > 0 && 'border-t border-line',
              selected && 'bg-primary-soft active:bg-primary-soft',
            )}
          >
            <View className="flex-1">
              <Text className={cn('font-sans-medium', selected && 'text-primary-dark')}>
                {o.label}
              </Text>
              {o.hint && <Text className="mt-0.5 text-sm text-muted">{o.hint}</Text>}
            </View>
            <RadioDot selected={selected} />
          </Pressable>
        );
      })}
    </View>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <View
      className={cn(
        'h-5 w-5 items-center justify-center rounded-full border-2',
        selected ? 'border-primary' : 'border-line',
      )}
    >
      {selected && <View className="h-2.5 w-2.5 rounded-full bg-primary" />}
    </View>
  );
}
