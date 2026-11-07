import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import {
  BMI_BANDS,
  bandIndexFor,
  HEALTHY_BMI,
  healthyWeightRange,
  positionInBand,
} from '@/constants/bmi';
import { cn } from '@/lib/cn';

const ROW = 46; // height of one band = one legend row, so they line up exactly
const BAR = 12;
const POINTER_COL = 64;
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

// Highest band on top, like a thermometer.
const BANDS_TOP_DOWN = [...BMI_BANDS].reverse();

interface Props {
  visible: boolean;
  onClose: () => void;
  bmi: number;
  weightKg: number;
}

/**
 * BMI explained in a bottom sheet: a vertical scale with each band's legend beside it and a
 * pointer at the user's exact value. Other bands are light tints; the user's band is full colour.
 */
export function BmiSheet({ visible, onClose, bmi, weightKg }: Props) {
  const userBand = bandIndexFor(bmi);
  const healthy = healthyWeightRange(bmi, weightKg);
  const toGo =
    bmi > HEALTHY_BMI.max
      ? weightKg - healthy.max
      : bmi < HEALTHY_BMI.min
        ? healthy.min - weightKg
        : 0;

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Your BMI">
      <View
        className="flex-row"
        accessible
        accessibilityLabel={`BMI ${bmi}, ${BMI_BANDS[userBand]!.label}.`}
      >
        <Pointer bmi={bmi} visible={visible} />

        {/* Scale: one segment per band, user's band in full colour */}
        <View style={{ width: BAR }} className="overflow-hidden rounded-full">
          {BANDS_TOP_DOWN.map((b) => {
            const mine = b.key === BMI_BANDS[userBand]!.key;
            return (
              <View
                key={b.key}
                style={{ height: ROW, backgroundColor: b.color, opacity: mine ? 1 : 0.3 }}
                className="border-b-2 border-card"
              />
            );
          })}
        </View>

        {/* Legend, aligned row-for-row with the scale */}
        <View className="ml-4 flex-1">
          {BANDS_TOP_DOWN.map((b) => {
            const mine = b.key === BMI_BANDS[userBand]!.key;
            return (
              <View
                key={b.key}
                style={{ height: ROW }}
                className="flex-row items-center justify-between"
              >
                <Text className={cn('text-sm', mine ? 'font-sans-semibold' : 'text-muted')}>
                  {b.label}
                </Text>
                <Text className={cn('text-sm', mine ? 'font-sans-semibold' : 'text-muted')}>
                  {b.range}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="mt-6 rounded-2xl bg-bg p-4">
        <Text className="text-sm">
          Healthy for your height:{' '}
          <Text className="font-sans-semibold text-sm">
            {healthy.min}–{healthy.max} kg
          </Text>
          {toGo > 0 && <Text className="text-sm text-muted"> · {Math.round(toGo)} kg to go</Text>}
        </Text>
        <Text className="mt-1 text-xs text-muted">
          BMI is a rough guide. It doesn’t tell muscle from fat.
        </Text>
      </View>
    </BottomSheet>
  );
}

/** "You 27.5 ▸" label that slides up the scale to the user's exact value. */
function Pointer({ bmi, visible }: { bmi: number; visible: boolean }) {
  const reduceMotion = useReducedMotion();
  const fromTop = BANDS_TOP_DOWN.length - 1 - bandIndexFor(bmi);
  const target = (fromTop + (1 - positionInBand(bmi))) * ROW;
  const y = useSharedValue(BANDS_TOP_DOWN.length * ROW);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion) {
      y.set(target);
      return;
    }
    y.set(BANDS_TOP_DOWN.length * ROW);
    y.set(withDelay(250, withTiming(target, { duration: 800, easing: EASE_OUT })));
  }, [visible, target, y, reduceMotion]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() - 14 }] }));

  return (
    <View style={{ width: POINTER_COL }}>
      <Animated.View style={style} className="absolute right-1 flex-row items-center">
        <View className="items-end">
          <Text className="text-[10px] uppercase tracking-wider text-muted">You</Text>
          <Text className="font-sans-semibold text-sm">{bmi}</Text>
        </View>
        <View
          className="ml-1"
          style={{
            width: 0,
            height: 0,
            borderTopWidth: 6,
            borderBottomWidth: 6,
            borderLeftWidth: 8,
            borderTopColor: 'transparent',
            borderBottomColor: 'transparent',
            borderLeftColor: colors.ink,
          }}
        />
      </Animated.View>
    </View>
  );
}
