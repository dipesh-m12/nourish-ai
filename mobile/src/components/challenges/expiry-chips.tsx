import { View } from 'react-native';
import { Chip } from '@/components/ui/chip';
import { PICK_DATE_SUPPORTED, pickDate } from '@/lib/pick-date';
import { addDays, shortDate } from '@/utils/date';

/** Preset spans. "Today" ends tonight; N days counts today. */
const PRESETS = [
  { label: 'Today', days: 1 },
  { label: '7 days', days: 7 },
  { label: '21 days', days: 21 },
] as const;

interface Props {
  today: string;
  /** Last day (inclusive), null = ongoing, undefined = not chosen yet. */
  value: string | null | undefined;
  onChange: (endsOn: string | null) => void;
}

/** "How long?" in one row of chips: Today · 7 days · 21 days · Always · a picked date. */
export function ExpiryChips({ today, value, onChange }: Props) {
  const presetDays = PRESETS.map((p) => addDays(today, p.days - 1));
  const custom = typeof value === 'string' && !presetDays.includes(value);

  const pickCustom = async () => {
    const picked = await pickDate(today, typeof value === 'string' ? value : addDays(today, 13));
    if (picked) onChange(picked);
  };

  return (
    <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
      {PRESETS.map((p, i) => (
        <Chip
          key={p.label}
          role="radio"
          label={p.label}
          selected={value === presetDays[i]}
          onPress={() => onChange(presetDays[i]!)}
        />
      ))}
      <Chip role="radio" label="Always" selected={value === null} onPress={() => onChange(null)} />
      {PICK_DATE_SUPPORTED && (
        <Chip
          role="radio"
          label={custom ? `Till ${shortDate(value)}` : 'Pick a date'}
          selected={custom}
          onPress={() => void pickCustom()}
        />
      )}
    </View>
  );
}
