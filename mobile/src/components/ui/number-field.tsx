import { TextInput, View } from 'react-native';
import { colors } from '@/constants/colors';
import { Text } from './text';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  unit: string;
  placeholder?: string;
  accessibilityLabel: string;
  error?: string;
  allowDecimal?: boolean;
  autoFocus?: boolean;
}

/** Large numeric input with the unit beside it (e.g. "72  kg"). */
export function NumberField({ value, onChangeText, unit, error, allowDecimal, ...rest }: Props) {
  return (
    <View className="flex-1">
      <View
        className={`h-16 flex-row items-center rounded-2xl border-2 bg-card px-4 ${
          error ? 'border-danger' : 'border-line'
        }`}
      >
        <TextInput
          {...rest}
          value={value}
          onChangeText={(t) => onChangeText(t.replace(allowDecimal ? /[^0-9.,]/g : /[^0-9]/g, ''))}
          keyboardType={allowDecimal ? 'decimal-pad' : 'number-pad'}
          maxLength={5}
          placeholderTextColor={colors.muted}
          className="flex-1 font-sans-semibold text-2xl text-ink"
        />
        <Text className="font-sans-medium text-muted">{unit}</Text>
      </View>
      {error && <Text className="mt-1.5 text-sm text-danger">{error}</Text>}
    </View>
  );
}
