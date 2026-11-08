import * as Haptics from 'expo-haptics';
import { ArrowUp, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useEstimateItem } from '@/api/meals';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import type { MealItem } from '@/types/meal';

interface Props {
  onAdd: (item: MealItem, dietWarning: string | null) => void;
}

/**
 * For food the photo missed: type it the way you'd say it ("2 boiled eggs") and the AI
 * estimates the portion and macros. Lives at the bottom of the item list.
 */
export function AddFoodRow({ onAdd }: Props) {
  const estimate = useEstimateItem();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [problem, setProblem] = useState<string | null>(null);
  const canSend = text.trim().length >= 2 && !estimate.isPending;

  const send = () => {
    if (!canSend) return;
    setProblem(null);
    estimate.mutate(text.trim(), {
      onSuccess: (r) => {
        if (!r.isFood) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          setProblem('That doesn’t look like a food. Try “1 bowl curd”.');
          return;
        }
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onAdd(r.item, r.dietWarning);
        setText('');
        setOpen(false);
      },
      onError: (err) => setProblem(err.message),
    });
  };

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Add a food the photo missed"
        className="flex-row items-center gap-2 border-t border-line px-4 py-3 active:opacity-70"
      >
        <Plus size={16} color={colors.primary} />
        <Text className="font-sans-semibold text-sm text-primary">Add food</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View entering={FadeIn.duration(200)} className="border-t border-line px-4 py-3">
      <View className="flex-row items-center gap-2">
        <TextInput
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          placeholder="e.g. 2 boiled eggs"
          placeholderTextColor={colors.muted}
          autoFocus
          returnKeyType="send"
          maxLength={80}
          editable={!estimate.isPending}
          accessibilityLabel="Food to add"
          className="h-10 flex-1 rounded-lg border border-line bg-bg px-3 font-sans text-base text-ink"
        />
        <PressableScale
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Estimate and add"
          className={cn(
            'h-10 w-10 items-center justify-center rounded-full bg-ink',
            !canSend && 'opacity-30',
          )}
        >
          {estimate.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ArrowUp size={18} color="#fff" />
          )}
        </PressableScale>
      </View>

      {/* Shape of the row that's about to appear, so the wait reads as "making it". */}
      {estimate.isPending && (
        <Animated.View entering={FadeIn} exiting={FadeOut}>
          <SkeletonGroup
            className="mt-3 flex-row items-center gap-3"
            accessible
            accessibilityLabel="Estimating"
            accessibilityState={{ busy: true }}
          >
            <View className="flex-1 gap-1.5">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-3 w-1/4" />
            </View>
            <SkeletonBlock className="h-4 w-10" />
          </SkeletonGroup>
        </Animated.View>
      )}

      {problem && !estimate.isPending && (
        <Text className="mt-2 text-sm text-danger" accessibilityLiveRegion="polite">
          {problem}
        </Text>
      )}
    </Animated.View>
  );
}
