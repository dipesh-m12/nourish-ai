import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { colors } from '@/constants/colors';
import { PressableScale } from './pressable-scale';
import { Text } from './text';

interface Props {
  /** Text on the chip, e.g. "Add other". Also the input's accessible label. */
  label: string;
  onAdd: (value: string) => void;
  maxLength?: number;
}

/**
 * "+ Add other" chip that turns into an inline input in place. Keeps custom entries in the
 * same visual language as the chips, instead of a separate placeholder-only text field.
 */
export function AddChip({ label, onAdd, maxLength = 40 }: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');

  const commit = () => {
    const value = text.trim();
    if (value) onAdd(value);
    setText('');
    setEditing(false);
  };

  if (editing) {
    return (
      <View className="h-11 min-w-36 flex-row items-center rounded-lg border border-primary bg-card px-3">
        <TextInput
          value={text}
          onChangeText={setText}
          autoFocus
          maxLength={maxLength}
          returnKeyType="done"
          onSubmitEditing={commit}
          onBlur={commit}
          accessibilityLabel={label}
          className="min-w-28 font-sans-medium text-sm text-ink"
        />
      </View>
    );
  }

  return (
    <PressableScale
      scaleTo={0.96}
      onPress={() => setEditing(true)}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 flex-row items-center gap-1.5 rounded-lg border border-dashed border-line px-3.5"
    >
      <Plus size={15} color={colors.primary} />
      <Text className="font-sans-medium text-sm text-primary">{label}</Text>
    </PressableScale>
  );
}
