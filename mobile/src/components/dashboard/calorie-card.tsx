import * as Haptics from 'expo-haptics';
import { Camera } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  scrollTo,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import { ActivityRings } from '@/components/ui/activity-rings';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RollingNumber } from '@/components/ui/rolling-number';
import { Text } from '@/components/ui/text';
import { colors, macroColors } from '@/constants/colors';
import type { Meal } from '@/types/meal';
import type { Macros } from '@/types/today';
import { MealsList } from './meals-list';

const MACROS = [
  { key: 'proteinG', label: 'Protein' },
  { key: 'carbsG', label: 'Carbs' },
  { key: 'fatG', label: 'Fat' },
] as const;

/** Both pages share one height, so swiping never makes the card jump. */
const PAGE_H = 172;
// Big rings; leaves ~135 px beside them for a 48 px "2,200".
const RING = 144;
const PAGES = 2;

const thousands = (n: number) => n.toLocaleString('en-IN');

interface Props {
  targets: Macros;
  eaten: Macros;
  meals: Meal[];
  date: string;
  onLogMeal: () => void;
}

/**
 * Food today as two swipeable pages inside one card that stays put:
 * 1. Calories: a thick ring + "860 /2,200 kcal" beside it (Apple Fitness's ring card).
 * 2. Protein / carbs / fat: three concentric rings + a coloured value per macro.
 * Only what's LEFT is shown (no "0 eaten / 2,100" lines): the one number that drives a choice.
 * dataviz skill: one number per chart, hero figure >= 48 px sans, text in ink (colour only on
 * marks), each meter's track a lighter step of its own hue, one hue for all three meters
 * (coral/mustard failed the colour-vision check), named by label not colour.
 * Log meal and the meals list stay below the pages, whichever page is showing.
 */
export function CalorieCard({ targets, eaten, meals, date, onLogMeal }: Props) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const x = useSharedValue(0);
  const scroller = useAnimatedRef<Animated.ScrollView>();
  const lastPage = useRef(0);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.set(e.contentOffset.x);
  });

  const settle = (offset: number) => {
    if (!width) return;
    const p = Math.round(offset / width);
    if (p !== lastPage.current) {
      lastPage.current = p;
      Haptics.selectionAsync();
      setPage(p);
    }
  };

  const goTo = (p: number) => {
    const to = p * width;
    scheduleOnUI(() => {
      'worklet';
      scrollTo(scroller, to, 0, true);
    });
  };

  return (
    <View className="rounded-3xl bg-card py-5">
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 && (
          <Animated.ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
            onMomentumScrollEnd={(e) => settle(e.nativeEvent.contentOffset.x)}
            accessibilityRole="adjustable"
            accessibilityLabel={page === 0 ? 'Calories. Swipe for macros' : 'Macros'}
          >
            <View style={{ width, height: PAGE_H }} className="px-5">
              <CaloriesPage targets={targets} eaten={eaten} />
            </View>
            <View style={{ width, height: PAGE_H }} className="px-5">
              <MacrosPage targets={targets} eaten={eaten} />
            </View>
          </Animated.ScrollView>
        )}
        {width === 0 && <View style={{ height: PAGE_H }} />}
      </View>

      <Dots x={x} width={width} onPick={goTo} />

      <View className="px-5">
        <PressableScale
          onPress={onLogMeal}
          accessibilityRole="button"
          accessibilityLabel="Log a meal with a photo"
          className="mt-4 h-12 flex-row items-center justify-center gap-2 rounded-full bg-ink"
        >
          <Camera size={18} color="#fff" />
          <Text className="font-sans-semibold text-white">Log meal</Text>
        </PressableScale>

        {meals.length > 0 && (
          <>
            <View className="my-4 h-px bg-line" />
            <MealsList meals={meals} date={date} />
          </>
        )}
      </View>
    </View>
  );
}

// Over the goal, the number turns a deeper red that still reads at 5.6:1 on white.
const OVER_TEXT = '#B04532';

/**
 * Page 1, after Apple Fitness's Activity Ring card: a thick ring on the left; on the right a
 * short label, then the value in the ring's own colour, the unit in small caps.
 * The number is eaten so far; the "/2,200 kcal" under it is the goal, so the pair reads as
 * one figure (like "52/120 kcal") instead of two sentences.
 */
function CaloriesPage({ targets, eaten }: { targets: Macros; eaten: Macros }) {
  const over = eaten.calories > targets.calories;
  const tint = over ? OVER_TEXT : colors.primary;
  return (
    <View
      className="flex-1 flex-row items-center gap-4"
      accessible
      accessibilityLabel={`Calories: ${eaten.calories} of ${targets.calories} eaten`}
    >
      <ActivityRings
        rings={[
          {
            key: 'kcal',
            progress: targets.calories ? eaten.calories / targets.calories : 0,
            color: over ? colors.accent : colors.primary,
            track: over ? colors.accentSoft : colors.primarySoft,
          },
        ]}
        size={RING}
        stroke={24}
        startDot
      />
      <View className="flex-1">
        <Text style={[styles.label, styles.labelLarge]}>Calories</Text>
        <RollingNumber
          value={eaten.calories}
          format={thousands}
          className="font-num-bold text-5xl"
          // Follows the ring: green on track, red once over the goal.
          color={tint}
        />
        <Text style={[styles.unit, { color: tint }]}>/{thousands(targets.calories)} kcal</Text>
      </View>
    </View>
  );
}

/**
 * Page 2, the same card with Apple's three concentric rings (Move / Exercise / Stand there,
 * protein / carbs / fat here) and a label + coloured value per ring on the right.
 * Colours validated as a set with the dataviz checker; text shades all >= 4.5:1 on white.
 */
function MacrosPage({ targets, eaten }: { targets: Macros; eaten: Macros }) {
  return (
    <View className="flex-1 flex-row items-center gap-4">
      <ActivityRings
        rings={MACROS.map((m) => ({
          key: m.key,
          progress: targets[m.key] ? eaten[m.key] / targets[m.key] : 0,
          color: macroColors[m.key].fill,
          track: macroColors[m.key].track,
          // Only the outer (protein) ring keeps the stub; carbs and fat start truly empty.
          startDot: m.key === 'proteinG',
        }))}
        size={RING}
        stroke={15}
        startDot
        gap={3}
      />
      <View className="flex-1 gap-3">
        {MACROS.map((m) => (
          <View
            key={m.key}
            accessible
            accessibilityLabel={`${m.label}: ${eaten[m.key]} of ${targets[m.key]} grams`}
          >
            <Text style={styles.label}>{m.label}</Text>
            <Text style={[styles.macro, { color: macroColors[m.key].text }]}>
              {eaten[m.key]}
              {/* The goal part is smaller and a step lighter, so the eaten number leads. */}
              <Text style={[styles.macroUnit, { color: macroColors[m.key].text }]}>
                /{targets[m.key]}g
              </Text>
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Exact sizes as styles: the Text helper merges classes, and arbitrary size classes got lost.
const styles = StyleSheet.create({
  // Page 2: the value is the bold, bigger part; the label is a small quiet tag above it.
  unit: { fontFamily: 'BarlowCondensed_700Bold', fontSize: 15, lineHeight: 18, letterSpacing: 0.5 },
  macro: {
    fontFamily: 'BarlowCondensed_700Bold',
    fontSize: 20,
    lineHeight: 23,
    letterSpacing: 0.3,
  },
  macroUnit: { fontFamily: 'BarlowCondensed_600SemiBold', fontSize: 13 },
  // The label sits right on top of its value (tight line height, no gap).
  label: { fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 13, color: colors.muted },
  // Page 1's label: same style as page 2's, one size up.
  labelLarge: { fontSize: 14, lineHeight: 17 },
});

/** Two dots that follow the finger: the active one stretches into a pill. Tap to jump. */
function Dots({
  x,
  width,
  onPick,
}: {
  x: SharedValue<number>;
  width: number;
  onPick: (page: number) => void;
}) {
  return (
    <View className="mt-3 flex-row justify-center gap-1.5">
      {Array.from({ length: PAGES }, (_, i) => (
        <Pressable
          key={i}
          onPress={() => onPick(i)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={i === 0 ? 'Show calories' : 'Show macros'}
          className="h-4 justify-center"
        >
          <Dot x={x} width={width} index={i} />
        </Pressable>
      ))}
    </View>
  );
}

function Dot({ x, width, index }: { x: SharedValue<number>; width: number; index: number }) {
  const style = useAnimatedStyle(() => {
    const at = width ? x.get() / width : 0;
    const near = Math.max(0, 1 - Math.abs(at - index));
    return {
      width: interpolate(near, [0, 1], [6, 18]),
      opacity: interpolate(near, [0, 1], [0.3, 1]),
    };
  });
  return <Animated.View className="h-1.5 rounded-full bg-ink" style={style} />;
}
