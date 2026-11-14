import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import type { Plan } from '@/types/plan';

/** Small uppercase section title used down the plan screen. */
export function SectionTitle({ children }: { children: string }) {
  return (
    <Text className="mb-3 font-sans-semibold text-sm uppercase tracking-wider text-muted">
      {children}
    </Text>
  );
}

/**
 * The three habits that matter most, numbered so they read as priorities. Titles only;
 * tapping one reveals its reason (progressive disclosure keeps the screen short).
 */
export function FocusHabits({ habits }: { habits: Plan['focusHabits'] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      {habits.map((h, i) => (
        <Pressable
          key={h.title}
          onPress={() => setOpen((o) => (o === i ? null : i))}
          accessibilityRole="button"
          accessibilityState={{ expanded: open === i }}
          accessibilityLabel={`${h.title}. ${open === i ? h.why : 'Show why'}`}
          className={i > 0 ? 'border-t border-line p-4 active:bg-bg' : 'p-4 active:bg-bg'}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-7 w-7 items-center justify-center rounded-full bg-primary-soft">
              <Text className="font-sans-semibold text-sm text-primary-dark">{i + 1}</Text>
            </View>
            <Text className="flex-1 font-sans-semibold">{h.title}</Text>
            {open === i ? (
              <ChevronUp size={18} color={colors.muted} />
            ) : (
              <ChevronDown size={18} color={colors.muted} />
            )}
          </View>
          {open === i && (
            <Animated.View entering={FadeIn.duration(200)}>
              <Text className="ml-10 mt-1 text-sm text-muted">{h.why}</Text>
            </Animated.View>
          )}
        </Pressable>
      ))}
    </View>
  );
}

/** Collapsed extras under one "More" row: the plan summary and an example day of meals. */
export function PlanMore({ summary, meals }: { summary: string; meals: Plan['sampleDay'] }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Show less' : 'More about your plan'}
        className="flex-row items-center justify-center gap-1 py-2"
      >
        <Text className="font-sans-semibold text-sm text-primary">{open ? 'Less' : 'More'}</Text>
        {open ? (
          <ChevronUp size={16} color={colors.primary} />
        ) : (
          <ChevronDown size={16} color={colors.primary} />
        )}
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(200)} className="mt-2 gap-4">
          <Text className="leading-relaxed text-muted">{summary}</Text>
          <SampleDay meals={meals} />
        </Animated.View>
      )}
    </View>
  );
}

const SLOT_LABEL = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  snack: 'Snack',
  dinner: 'Dinner',
} as const;

/**
 * One example day of meals. Collapsed by default to keep the screen short
 * (ui-ux-pro-max: truncate long content with an expand option); the header shows the total.
 */
export function SampleDay({ meals }: { meals: Plan['sampleDay'] }) {
  const [open, setOpen] = useState(false);
  const total = meals.reduce((sum, m) => sum + m.kcal, 0);

  return (
    <View className="overflow-hidden rounded-2xl bg-card">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Sample day, ${total} kilocalories. ${open ? 'Hide' : 'Show'} meals`}
        className="flex-row items-center justify-between p-4 active:bg-bg"
      >
        <View>
          <Text className="font-sans-semibold">See a sample day</Text>
          <Text className="mt-0.5 text-sm text-muted">
            {meals.length} meals · {total} kcal
          </Text>
        </View>
        {open ? (
          <ChevronUp size={20} color={colors.muted} />
        ) : (
          <ChevronDown size={20} color={colors.muted} />
        )}
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn.duration(200)}>
          <SampleDayMeals meals={meals} />
        </Animated.View>
      )}
    </View>
  );
}

function SampleDayMeals({ meals }: { meals: Plan['sampleDay'] }) {
  return (
    <View className="border-t border-line">
      {meals.map((m, i) => (
        <View
          key={m.slot}
          className={i > 0 ? 'flex-row gap-3 border-t border-line p-4' : 'flex-row gap-3 p-4'}
        >
          <View className="flex-1">
            <Text className="text-xs uppercase tracking-wider text-muted">
              {SLOT_LABEL[m.slot]}
            </Text>
            <Text className="mt-0.5">{m.meal}</Text>
          </View>
          <Text className="font-sans-medium text-sm text-muted">{m.kcal} kcal</Text>
        </View>
      ))}
    </View>
  );
}
