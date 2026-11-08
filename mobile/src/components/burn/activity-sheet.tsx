import * as Haptics from 'expo-haptics';
import { ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { useLogActivity } from '@/api/activities';
import { Button } from '@/components/ui/button';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RollingNumber } from '@/components/ui/rolling-number';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import { ACTIVITIES, previewKcal } from '@/constants/activities';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { PhotoPermissionError, pickPhoto, PROOF_PHOTO, type PhotoSource } from '@/lib/photo';
import { useToast } from '@/store/toast';

type Unit = 'minutes' | 'kcal';

const RANGE = {
  minutes: { min: 5, max: 300, step: 5, initial: 30 },
  kcal: { min: 10, max: 2000, step: 10, initial: 150 },
} as const;

/** A library exercise to log directly (no activity picker; its own intensity is used). */
export interface PresetExercise {
  id: string;
  name: string;
  met: number;
}

interface Props {
  visible: boolean;
  date: string;
  kg: number;
  onClose: () => void;
  exercise?: PresetExercise;
}

/**
 * Log an activity: pick what, say how long (or the kcal your watch shows), add a photo. The AI
 * checks the photo; the burn card and week chart update as soon as it counts.
 */
export function ActivitySheet({ visible, date, kg, onClose, exercise }: Props) {
  const log = useLogActivity(date);
  const toast = useToast((s) => s.show);
  const [kindIndex, setKindIndex] = useState(0);
  const [unit, setUnit] = useState<Unit>('minutes');
  const [amounts, setAmounts] = useState({ minutes: 30, kcal: 150 });
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const activity = ACTIVITIES[kindIndex]!;
  const value = amounts[unit];
  const estimate = previewKcal(exercise?.met ?? activity.met, amounts.minutes, kg);
  const busy = preparing || log.isPending;

  const close = () => {
    if (busy) return;
    setProblem(null);
    log.reset();
    onClose();
  };

  const submit = async (source: PhotoSource) => {
    setProblem(null);
    try {
      setPreparing(true);
      const photo = await pickPhoto(source, PROOF_PHOTO);
      setPreparing(false);
      if (!photo) return;
      log.mutate(
        {
          ...(exercise ? { exerciseId: exercise.id } : { kind: activity.kind }),
          ...(unit === 'minutes' ? { minutes: value } : { calories: value }),
          photo,
        },
        {
          onSuccess: (r) => {
            if (!r.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setProblem(r.note);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            toast(`+${r.activity.calories} kcal · ${r.activity.label}`);
            close();
          },
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

  return (
    <DraggableSheet
      visible={visible}
      onClose={close}
      // A library exercise is its own title; no extra label above it.
      title={exercise?.name ?? 'Log activity'}
      footer={
        busy ? undefined : (
          <View className="gap-2">
            <Button
              label={problem ? 'Try another photo' : 'Take a photo'}
              onPress={() => submit('camera')}
            />
            <Button
              label="Choose from gallery"
              variant="secondary"
              onPress={() => submit('library')}
            />
          </View>
        )
      }
    >
      {!exercise && (
        <View className="flex-row flex-wrap gap-2">
          {ACTIVITIES.map((a, i) => {
            const selected = i === kindIndex;
            return (
              <PressableScale
                key={a.kind}
                onPress={() => {
                  Haptics.selectionAsync();
                  setKindIndex(i);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={a.label}
                className={cn(
                  'h-10 justify-center rounded-full border px-4',
                  selected ? 'border-ink bg-ink' : 'border-line bg-card',
                )}
              >
                <Text
                  className={cn('font-sans-semibold text-sm', selected ? 'text-white' : 'text-ink')}
                >
                  {a.label}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}

      <Animated.View layout={LinearTransition.duration(220)} className={exercise ? 'mt-1' : 'mt-6'}>
        <View className="mb-2 flex-row items-center justify-between">
          <Text className="text-sm text-muted">How much?</Text>
          <SegmentedControl
            options={[
              { value: 'minutes', label: 'Minutes' },
              { value: 'kcal', label: 'kcal' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        </View>
        <Stepper
          key={unit} // fresh roll direction when switching units
          value={value}
          onChange={(v) => setAmounts((a) => ({ ...a, [unit]: v }))}
          min={RANGE[unit].min}
          max={RANGE[unit].max}
          step={RANGE[unit].step}
          unit={unit === 'minutes' ? 'min' : 'kcal'}
          label={unit === 'minutes' ? 'Minutes of activity' : 'Calories burned'}
        />

        {/* Live estimate from the user's own weight; the watch path trusts their number. */}
        <View className="mt-3 flex-row items-baseline justify-center gap-1">
          {unit === 'minutes' ? (
            <>
              <Text className="text-sm text-muted">About</Text>
              <RollingNumber value={estimate} className="font-sans-semibold text-base" />
              <Text className="text-sm text-muted">kcal active, for your {Math.round(kg)} kg</Text>
            </>
          ) : (
            <Text className="text-sm text-muted">The number from your watch or tracker</Text>
          )}
        </View>
      </Animated.View>

      <View className="mt-5 flex-row items-start gap-2 rounded-xl bg-card p-3">
        <ShieldCheck size={16} color={colors.primary} />
        <Text className="flex-1 text-sm text-muted">
          Snap you moving, the place, your gear or a tracker screen. Our AI checks it first.
        </Text>
      </View>

      {busy && (
        <Animated.View
          entering={FadeIn}
          className="items-center gap-3 py-6"
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator color={colors.primary} />
          <Text className="text-sm text-muted">
            {preparing ? 'Preparing your photo…' : 'Checking your photo…'}
          </Text>
        </Animated.View>
      )}

      {!busy && problem && (
        <Animated.View
          entering={FadeIn}
          className="mt-4 flex-row items-start gap-2 rounded-xl bg-accent-soft p-3"
          accessibilityLiveRegion="assertive"
        >
          <TriangleAlert size={16} color={colors.accent} />
          <Text className="flex-1 text-sm">{problem}</Text>
        </Animated.View>
      )}
    </DraggableSheet>
  );
}
