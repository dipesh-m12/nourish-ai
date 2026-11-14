import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { TriangleAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAnalyzeMeal, useSaveMeal } from '@/api/meals';
import { Button } from '@/components/ui/button';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import {
  PhotoPermissionError,
  pickPhoto,
  PROOF_PHOTO,
  type Photo,
  type PhotoSource,
} from '@/lib/photo';
import { useToast } from '@/store/toast';
import type { MealAnalysis } from '@/types/meal';
import { scaledItem, toEntry, totalsOf, type ItemEntry } from '@/utils/meal-items';
import { ScanOverlay } from './scan-overlay';
import { MealEstimate } from './meal-estimate';

/** Why the sheet opened: the camera on the calorie card, or "+" on a food challenge. */
export interface MealSheetRequest {
  challengeId?: string;
  challengeLabel?: string;
}

interface Props {
  request: MealSheetRequest | null;
  date: string;
  onClose: () => void;
}

/**
 * One way to log food, wherever it starts: a photo → AI reads the plate → user fixes anything
 * wrong → save. Saving moves the calorie ring and every challenge the meal counts toward.
 */
export function MealSheet({ request, date, onClose }: Props) {
  const analyze = useAnalyzeMeal(date);
  const save = useSaveMeal(date);
  const toast = useToast((s) => s.show);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preparing, setPreparing] = useState(false);
  // The camera opens by itself; its fallback buttons appear only once it has been tried
  // (cancelled or failed), so there's no flash of a "take a photo" screen first.
  const [tried, setTried] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The plate under review: AI items (with how much was really eaten) plus anything typed in.
  const [entries, setEntries] = useState<ItemEntry[]>([]);

  const result = analyze.data?.isFood ? analyze.data : null;
  const items = entries.map(scaledItem);
  // Live: only foods still on the plate can block challenge credit.
  const warnings = [...new Set(entries.flatMap((e) => (e.warning ? [e.warning] : [])))];
  const busy = preparing || analyze.isPending;

  const close = () => {
    if (save.isPending) return;
    reset();
    save.reset();
    setTried(false);
    onClose();
  };

  /** Back to the start: no photo, no estimate. */
  const reset = () => {
    setPhoto(null);
    setProblem(null);
    setEntries([]);
    analyze.reset();
  };

  /** Load the AI's items into the review, or explain why not. */
  const review = (r: MealAnalysis) => {
    if (!r.isFood) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setProblem(r.comment);
      return;
    }
    const warningFor = new Map(r.conflicts.map((c) => [c.item, c.message]));
    setEntries(r.items.map((i) => toEntry(i, warningFor.get(i.name) ?? null)));
  };

  const take = async (source: PhotoSource) => {
    reset();
    setTried(true);
    try {
      setPreparing(true);
      const picked = await pickPhoto(source, PROOF_PHOTO);
      setPreparing(false);
      if (!picked) return; // cancelled
      setPhoto(picked);
      analyze.mutate(
        { photo: picked, challengeId: request?.challengeId },
        {
          onSuccess: review,
          onError: (err) => setProblem(err.message),
        },
      );
    } catch (err) {
      setPreparing(false);
      setProblem(
        err instanceof PhotoPermissionError
          ? err.message
          : 'Couldn’t open the photo. Please try again.',
      );
    }
  };

  const confirm = () => {
    if (!result || !items.length) return;
    save.mutate(
      {
        title: result.title,
        challengeId: request?.challengeId,
        items,
        comment: result.comment,
        // Off-diet food still counts as calories, never as challenge progress.
        credits: warnings.length ? [] : result.credits,
        photo: photo ?? undefined,
      },
      {
        onSuccess: ({ meal, credits }) => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast(
            credits.length
              ? `+${meal.calories} kcal · ${credits.map((c) => c.label).join(', ')} updated`
              : `+${meal.calories} kcal logged`,
          );
          close();
        },
      },
    );
  };

  // Open → camera straight away (the sheet's buttons are the fallback if it's cancelled).
  // A short delay lets the sheet slide in first, so the camera doesn't feel like a jump cut.
  useEffect(() => {
    // Browsers block a file dialog that no tap opened, so web keeps the buttons.
    if (!request || Platform.OS === 'web') return;
    const id = setTimeout(() => void take('camera'), 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const kcal = totalsOf(items).calories;

  return (
    <DraggableSheet
      visible={Boolean(request)}
      onClose={close}
      title="Log a meal"
      footer={
        result ? (
          <>
            {save.isError && (
              <Text className="mb-2 text-center text-sm text-danger">{save.error.message}</Text>
            )}
            <Button label={`Add ${kcal} kcal`} onPress={confirm} loading={save.isPending} />
            <Button
              className="mt-2"
              variant="ghost"
              label="Retake photo"
              onPress={() => take('camera')}
              disabled={save.isPending}
            />
          </>
        ) : undefined
      }
    >
      {photo && (
        <View className="mb-4">
          <Image
            source={{ uri: `data:${photo.mimeType};base64,${photo.base64}` }}
            className="h-40 w-full rounded-2xl"
            contentFit="cover"
            accessibilityLabel="Your meal photo"
          />
          {analyze.isPending && <ScanOverlay />}
        </View>
      )}

      {/* Waiting on the camera or the AI: the shape of what's coming, not a sentence. */}
      {!photo && (preparing || !tried) && Platform.OS !== 'web' && (
        <SkeletonGroup
          accessible
          accessibilityLabel="Opening the camera"
          accessibilityState={{ busy: true }}
        >
          <SkeletonBlock className="h-40 w-full rounded-2xl" />
        </SkeletonGroup>
      )}
      {photo && analyze.isPending && <EstimateSkeleton />}

      {!busy && problem && (
        <Animated.View
          entering={FadeIn}
          className="flex-row items-start gap-2 rounded-xl bg-accent-soft p-3"
          accessibilityLiveRegion="assertive"
        >
          <TriangleAlert size={16} color={colors.accent} />
          <Text className="flex-1 text-sm">{problem}</Text>
        </Animated.View>
      )}

      {!busy && result && (
        <MealEstimate
          title={result.title}
          entries={entries}
          comment={result.comment}
          credits={result.credits}
          startedFit={result.startedFit}
          warnings={warnings}
          onScale={(key, scale) =>
            setEntries((list) => list.map((e) => (e.key === key ? { ...e, scale } : e)))
          }
          onRemove={(key) => {
            // Functional update: a note can remove several foods in one go.
            setEntries((list) => {
              const next = list.filter((e) => e.key !== key);
              // Removing the last off-plan food unlocks challenge credit: mark the moment.
              if (list.some((e) => e.warning) && !next.some((e) => e.warning)) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              return next;
            });
          }}
          onAdd={(item, warning) => {
            setEntries((list) => [...list, toEntry(item, warning)]);
          }}
        />
      )}

      {!busy && !result && (tried || Platform.OS === 'web') && (
        <View className="mt-5 gap-2">
          <Button
            label={problem ? 'Try another photo' : 'Take a photo'}
            onPress={() => take('camera')}
          />
          <Button label="Choose from gallery" variant="secondary" onPress={() => take('library')} />
        </View>
      )}
    </DraggableSheet>
  );
}

/** The shape of the estimate while the AI reads the plate: title, big number, three foods. */
function EstimateSkeleton() {
  return (
    <SkeletonGroup
      accessible
      accessibilityLabel="Reading your plate"
      accessibilityState={{ busy: true }}
      accessibilityLiveRegion="polite"
    >
      <SkeletonBlock className="h-3.5 w-1/3" />
      <SkeletonBlock className="mt-2 h-9 w-28" />
      <SkeletonBlock className="mt-2 h-3.5 w-2/3" />
      <View className="mt-4 overflow-hidden rounded-2xl bg-card">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className={`flex-row items-center gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}
          >
            <View className="flex-1 gap-1.5">
              <SkeletonBlock className="h-4 w-1/2" />
              <SkeletonBlock className="h-3 w-1/4" />
            </View>
            <SkeletonBlock className="h-4 w-10" />
          </View>
        ))}
      </View>
    </SkeletonGroup>
  );
}
