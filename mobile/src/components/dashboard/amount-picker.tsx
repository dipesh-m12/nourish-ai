import * as Haptics from 'expo-haptics';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/cn';
import type { TodayChallenge } from '@/types/today';
import { fmt } from './challenge-widgets';

interface Props {
  challenge: TodayChallenge;
  value: number;
  onChange: (value: number) => void;
}

const isHours = (unit: string | null) => /^(h|hrs?|hours?)$/i.test(unit ?? '');

/**
 * Stepper range. Most challenges move in their own tap step up to the goal. Hours (sleep) are
 * often stored as "one tap = the whole goal", which would lock the stepper, so they move in
 * half hours up to 14 h: the burn uses the real hours even when progress caps at the goal.
 */
export function pickerRange(c: TodayChallenge) {
  const { step, target, unit } = c.tracking;
  return isHours(unit) ? { step: 0.5, max: 14 } : { step, max: target };
}

/** Quick picks: one tap, a couple of taps, and "everything left today" (deduped, within goal). */
function presets(c: TodayChallenge) {
  const { step, target } = c.tracking;
  const left = Math.max(0, c.progress.goal - c.progress.value);
  const picks = [step, step * 2, step * 4].filter((v) => v < left);
  const values = [...new Set([...picks, left].filter((v) => v > 0 && v <= target))];
  return values.map((v) => ({
    value: v,
    label: v === left ? `All left · ${fmt(v)}` : `+${fmt(v)}`,
  }));
}

/**
 * How much this photo covers. Defaults to one tap's worth (+0.25 L), but someone who drank 1 L
 * across the day can say so in one move instead of four photos.
 */
export function AmountPicker({ challenge, value, onChange }: Props) {
  const { unit } = challenge.tracking;
  const { step, max } = pickerRange(challenge);
  const options = isHours(unit) ? [] : presets(challenge);

  const pick = (v: number) => {
    Haptics.selectionAsync();
    onChange(v);
  };

  return (
    <Animated.View entering={FadeIn.duration(250)} className="mt-4">
      <Text className="mb-2 text-sm text-muted">How much?</Text>
      <Stepper
        value={value}
        onChange={onChange}
        min={step}
        max={max}
        step={step}
        unit={unit ?? ''}
        label={`Amount for ${challenge.title}`}
        format={fmt}
      />
      {options.length > 1 && (
        <View className="mt-2 flex-row flex-wrap gap-2">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <PressableScale
                key={o.value}
                onPress={() => pick(o.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${o.label} ${unit ?? ''}`}
                className={cn(
                  'h-9 justify-center rounded-full border px-3.5',
                  selected ? 'border-ink bg-ink' : 'border-line bg-card',
                )}
              >
                <Text
                  className={cn('font-sans-semibold text-sm', selected ? 'text-white' : 'text-ink')}
                >
                  {o.label}
                  {unit ? ` ${unit}` : ''}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </Animated.View>
  );
}
