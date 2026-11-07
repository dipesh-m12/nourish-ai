import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { Text } from './text';

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Small two/three-way switch, e.g. cm ↔ ft. */
export function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View className="flex-row self-start rounded-xl bg-line/60 p-1" accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(o.value);
            }}
            className={`rounded-lg px-4 py-1.5 ${active ? 'bg-card' : ''}`}
          >
            <Text className={`font-sans-medium text-sm ${active ? 'text-ink' : 'text-muted'}`}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
