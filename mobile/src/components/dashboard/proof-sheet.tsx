import * as Haptics from 'expo-haptics';
import { ShieldCheck, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLogProgress } from '@/api/today';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { PhotoPermissionError, pickPhoto, PROOF_PHOTO, type PhotoSource } from '@/lib/photo';
import { useToast } from '@/store/toast';
import type { TodayChallenge } from '@/types/today';
import { AmountPicker } from './amount-picker';
import { fmt } from './challenge-widgets';

interface Props {
  challenge: TodayChallenge | null;
  date: string;
  onClose: () => void;
}

/**
 * Logging progress needs proof: the user snaps or picks a photo, the server's AI checks it,
 * and only a verified photo counts. Rejections explain what would work and offer a retry.
 */
export function ProofSheet({ challenge, date, onClose }: Props) {
  const log = useLogProgress(date);
  const toast = useToast((s) => s.show);
  const [problem, setProblem] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  // null = untouched: one tap's worth (the card's default "+0.25 L").
  const [chosen, setChosen] = useState<number | null>(null);
  const busy = preparing || log.isPending;
  const isAmount = challenge?.tracking.kind === 'amount';
  const amount = chosen ?? challenge?.tracking.step ?? 1;

  const close = () => {
    if (busy) return;
    setProblem(null);
    setChosen(null);
    log.reset();
    onClose();
  };

  const submit = async (source: PhotoSource) => {
    if (!challenge) return;
    setProblem(null);
    try {
      setPreparing(true);
      const photo = await pickPhoto(source, PROOF_PHOTO);
      setPreparing(false);
      if (!photo) return; // cancelled
      log.mutate(
        { challengeId: challenge.id, photo, amount: isAmount ? amount : undefined },
        {
          onSuccess: (result) => {
            if (result.verified) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              const { kind, unit } = challenge.tracking;
              const progress =
                kind === 'check'
                  ? 'done for today'
                  : `+${fmt(result.amount)}${unit ? ` ${unit}` : ''}`;
              // Food proof is saved as a meal, so say the calories moved too.
              toast(
                result.meal
                  ? `+${result.meal.calories} kcal · ${progress}`
                  : result.burned
                    ? `${progress} · ${result.burned.calories} kcal burned`
                    : `Verified · ${progress}`,
              );
              close();
            } else {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              setProblem(result.note);
            }
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
    <BottomSheet visible={Boolean(challenge)} onClose={close} title="Add proof">
      {challenge && (
        <View>
          <Text className="font-sans-semibold">{challenge.title}</Text>
          <View className="mt-3 flex-row items-start gap-2 rounded-xl bg-bg p-3">
            <ShieldCheck size={16} color={colors.primary} />
            <Text className="flex-1 text-sm text-muted">
              Snap a photo of {challenge.tracking.proof}. Our AI checks it before it counts.
            </Text>
          </View>

          {isAmount && !busy && (
            <AmountPicker challenge={challenge} value={amount} onChange={setChosen} />
          )}

          {busy && (
            <Animated.View
              entering={FadeIn}
              className="items-center gap-3 py-8"
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

          {!busy && (
            <View className="mt-5 gap-2">
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
          )}
        </View>
      )}
    </BottomSheet>
  );
}
