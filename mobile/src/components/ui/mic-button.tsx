import * as Haptics from 'expo-haptics';
import { Mic } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranscribe } from '@/api/voice';
import { colors } from '@/constants/colors';
import { MicPermissionError, useVoiceNote } from '@/hooks/use-voice-note';

const SIZE = 36;

export type MicState = { kind: 'idle' } | { kind: 'recording'; ms: number } | { kind: 'hearing' };

interface Props {
  /** What was said ('' never reaches here: silence becomes a problem instead). */
  onText: (text: string) => void;
  onProblem: (message: string) => void;
  /** Lets the host show "Listening… 0:03" / "Hearing you…" in its own UI. */
  onState?: (state: MicState) => void;
  label?: string;
}

/**
 * Compact hold-to-talk mic for inputs: hold, speak, release. A coral halo grows with your voice
 * while it listens; then the server turns it into text.
 */
export function MicButton({ onText, onProblem, onState, label = 'Hold to speak' }: Props) {
  const voice = useVoiceNote();
  const transcribe = useTranscribe();
  const busy = transcribe.isPending;

  useEffect(() => {
    onState?.(
      voice.recording
        ? { kind: 'recording', ms: voice.durationMs }
        : busy
          ? { kind: 'hearing' }
          : { kind: 'idle' },
    );
  }, [voice.recording, voice.durationMs, busy, onState]);

  const halo = useDerivedValue(() =>
    voice.recording
      ? withSpring(1.25 + voice.level * 0.7, { damping: 14, stiffness: 180 })
      : withTiming(1, { duration: 200 }),
  );
  const shown = useDerivedValue(() =>
    withTiming(voice.recording ? 1 : 0, { duration: 160, easing: Easing.out(Easing.cubic) }),
  );
  const haloStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: halo.get() }],
  }));

  const pressIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await voice.start();
    } catch (err) {
      onProblem(
        err instanceof MicPermissionError
          ? err.message
          : 'Couldn’t start the mic. Please try again.',
      );
    }
  };

  const pressOut = async () => {
    try {
      const note = await voice.stop();
      if (!note) return onProblem('Hold the mic while you speak, then let go.');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      transcribe.mutate(note, {
        onSuccess: ({ text }) =>
          text ? onText(text) : onProblem('We didn’t catch that. Try again, a little closer.'),
        onError: (err) => onProblem(err.message),
      });
    } catch {
      onProblem('That recording didn’t save. Please try again.');
    }
  };

  return (
    <View style={{ width: SIZE, height: SIZE }} className="items-center justify-center">
      <Animated.View
        pointerEvents="none"
        style={[haloStyle, { width: SIZE, height: SIZE, backgroundColor: colors.accentSoft }]}
        className="absolute rounded-full"
      />
      <Pressable
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={busy}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Press and hold, speak, then release"
        className="items-center justify-center rounded-full"
        style={{
          width: SIZE,
          height: SIZE,
          backgroundColor: voice.recording ? colors.accent : colors.primarySoft,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Mic size={18} color={voice.recording ? '#fff' : colors.primary} />
        )}
      </Pressable>
    </View>
  );
}
