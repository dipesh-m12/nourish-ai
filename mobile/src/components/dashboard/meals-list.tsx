import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { useDeleteMeal } from '@/api/meals';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useToast } from '@/store/toast';
import type { Meal } from '@/types/meal';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function timeOf(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Today's meals, folded into one line ("Your meals · 3") so the card stays calm. Tap to open;
 * tapping a meal offers to remove it (and the progress it gave).
 */
export function MealsList({ meals, date }: { meals: Meal[]; date: string }) {
  const remove = useDeleteMeal(date);
  const toast = useToast((s) => s.show);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Meal | null>(null);

  const progress = useDerivedValue(() =>
    withTiming(open ? 1 : 0, { duration: 240, easing: EASE_OUT }),
  );
  const chevron = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.get() * 180}deg` }],
  }));

  if (!meals.length) return null;

  const toggle = () => {
    Haptics.selectionAsync();
    setOpen((o) => !o);
  };

  const confirm = () => {
    if (!pending) return;
    remove.mutate(pending.id, {
      onSuccess: () => {
        setPending(null);
        toast('Meal removed');
      },
    });
  };

  return (
    <Animated.View layout={LinearTransition.duration(250).easing(EASE_OUT)}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Your meals, ${meals.length}. ${open ? 'Hide' : 'Show'}`}
        className="flex-row items-center gap-2 active:opacity-70"
      >
        <Text className="flex-1 text-sm text-muted">
          Your meals · <Text className="font-sans-semibold text-sm">{meals.length}</Text>
        </Text>
        <Animated.View style={chevron}>
          <ChevronDown size={18} color={colors.muted} />
        </Animated.View>
      </Pressable>

      {open && (
        <View className="mt-2 gap-1">
          {meals.map((m, i) => (
            <Animated.View
              key={m.id}
              entering={FadeInDown.delay(i * 50)
                .duration(260)
                .easing(EASE_OUT)}
              exiting={FadeOut.duration(150)}
              layout={LinearTransition.duration(250)}
            >
              <Pressable
                onPress={() => setPending(m)}
                accessibilityRole="button"
                accessibilityLabel={`${m.title}, ${m.calories} kilocalories at ${timeOf(m.createdAt)}. Tap to remove.`}
                className="flex-row items-center gap-3 rounded-xl py-1.5 active:opacity-70"
              >
                {m.photoUrl ? (
                  <Image
                    source={{ uri: m.photoUrl, cacheKey: m.photoKey ?? undefined }}
                    className="h-10 w-10 rounded-lg bg-bg"
                    contentFit="cover"
                  />
                ) : (
                  <View className="h-10 w-10 rounded-lg bg-bg" />
                )}
                <View className="flex-1">
                  <Text className="font-sans-medium text-sm" numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text className="text-xs text-muted">{timeOf(m.createdAt)}</Text>
                </View>
                <Text className="font-sans-semibold text-sm">{m.calories}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      )}

      <ConfirmDialog
        visible={Boolean(pending)}
        title="Remove this meal?"
        message="Its calories and any challenge progress it gave come off today."
        confirmLabel="Remove"
        destructive
        loading={remove.isPending}
        error={remove.isError ? remove.error.message : null}
        onConfirm={confirm}
        onCancel={() => {
          setPending(null);
          remove.reset();
        }}
      />
    </Animated.View>
  );
}
