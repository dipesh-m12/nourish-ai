import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Mic, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAnalyzeMeal, useSaveMeal, useVoiceMeal } from '@/api/meals';
import { Button } from '@/components/ui/button';
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
import type { VoiceNote } from '@/hooks/use-voice-note';
import { useToast } from '@/store/toast';
import type { MealAnalysis } from '@/types/meal';
import { scaledItem, toEntry, totalsOf, type ItemEntry } from '@/utils/meal-items';
import { MealEstimate } from './meal-estimate';
import { VoiceButton } from './voice-button';

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
 * One way to log food, wherever it starts: a photo or a voice note → AI reads it → user fixes
 * anything wrong → save. Saving moves the calorie ring and every challenge the meal counts toward.
 */
export function MealSheet({ request, date, onClose }: Props) {
  const analyze = useAnalyzeMeal(date);
  const listen = useVoiceMeal(date);
  const save = useSaveMeal(date);
  const toast = useToast((s) => s.show);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // The plate under review: AI items (with how much was really eaten) plus anything typed in.
  const [entries, setEntries] = useState<ItemEntry[]>([]);
  // What we heard, when the meal was said rather than snapped.
  const [transcript, setTranscript] = useState<string | null>(null);

  // Photo and voice land in the same review, so whichever answered last is the result.
  const latest = transcript !== null ? listen.data : analyze.data;
  const result = latest?.isFood ? latest : null;
  const items = entries.map(scaledItem);
  // Live: only foods still on the plate can block challenge credit.
  const warnings = [...new Set(entries.flatMap((e) => (e.warning ? [e.warning] : [])))];
  const busy = preparing || analyze.isPending || listen.isPending;

  const close = () => {
    if (save.isPending) return;
    reset();
    save.reset();
    onClose();
  };

  /** Back to the start: no photo, no voice note, no estimate. */
  const reset = () => {
    setPhoto(null);
    setTranscript(null);
    setProblem(null);
    setEntries([]);
    analyze.reset();
    listen.reset();
  };

  /** Shared by photo and voice: load the AI's items into the review, or explain why not. */
  const review = (r: MealAnalysis) => {
    if (!r.isFood) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      setProblem(r.comment);
      return;
    }
    const warningFor = new Map(r.conflicts.map((c) => [c.item, c.message]));
    setEntries(r.items.map((i) => toEntry(i, warningFor.get(i.name) ?? null)));
  };

  const say = (note: VoiceNote) => {
    reset();
    setTranscript(''); // marks the voice path while it's being heard
    listen.mutate(
      { note, challengeId: request?.challengeId },
      {
        onSuccess: (r) => {
          setTranscript(r.transcript);
          review(r);
        },
        onError: (err) => setProblem(err.message),
      },
    );
  };

  const take = async (source: PhotoSource) => {
    reset();
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
              label={transcript !== null ? 'Start over' : 'Retake photo'}
              onPress={() => (transcript !== null ? reset() : take('camera'))}
              disabled={save.isPending}
            />
          </>
        ) : undefined
      }
    >
      {photo && (
        <Image
          source={{ uri: `data:${photo.mimeType};base64,${photo.base64}` }}
          className="mb-4 h-40 w-full rounded-2xl"
          contentFit="cover"
          accessibilityLabel="Your meal photo"
        />
      )}

      {/* What we heard, quoted, so a mishearing is obvious before saving. */}
      {transcript && !busy && (
        <Animated.View
          entering={FadeIn.duration(250)}
          className="mb-4 flex-row items-start gap-2.5 rounded-2xl bg-card p-4"
        >
          <Mic size={16} color={colors.muted} />
          <Text className="flex-1 italic leading-6">“{transcript}”</Text>
        </Animated.View>
      )}

      {!photo && transcript === null && !busy && (
        <Text className="mb-1 text-muted">
          Snap your plate or say what you ate. We’ll count it
          {request?.challengeLabel ? ` and update ${request.challengeLabel} if it fits` : ''}.
        </Text>
      )}

      {busy && (
        <Animated.View
          entering={FadeIn}
          className="items-center gap-3 py-8"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator color={colors.primary} />
          <Text className="text-sm text-muted">
            {preparing
              ? 'Preparing your photo…'
              : listen.isPending
                ? 'Listening and reading your meal…'
                : 'Reading your plate…'}
          </Text>
        </Animated.View>
      )}

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
          warnings={warnings}
          onScale={(key, scale) =>
            setEntries((list) => list.map((e) => (e.key === key ? { ...e, scale } : e)))
          }
          onRemove={(key) => {
            const next = entries.filter((e) => e.key !== key);
            // Removing the last off-plan food unlocks challenge credit: mark the moment.
            if (warnings.length && !next.some((e) => e.warning)) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            }
            setEntries(next);
          }}
          onAdd={(item, warning) => {
            setEntries((list) => [...list, toEntry(item, warning)]);
          }}
        />
      )}

      {!busy && !result && (
        <View className="mt-5 gap-2">
          <Button
            label={problem ? 'Try another photo' : 'Take a photo'}
            onPress={() => take('camera')}
          />
          <Button label="Choose from gallery" variant="secondary" onPress={() => take('library')} />

          <View className="my-3 flex-row items-center gap-3">
            <View className="h-px flex-1 bg-line" />
            <Text className="text-xs uppercase tracking-wider text-muted">or</Text>
            <View className="h-px flex-1 bg-line" />
          </View>
          <VoiceButton onNote={say} onProblem={setProblem} />
        </View>
      )}
    </DraggableSheet>
  );
}
