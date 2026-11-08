import * as Haptics from 'expo-haptics';
import { Mic } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import {
  MAX_VOICE_MS,
  MicPermissionError,
  useVoiceNote,
  type VoiceNote,
} from '@/hooks/use-voice-note';

const SIZE = 72;

interface Props {
  disabled?: boolean;
  onNote: (note: VoiceNote) => void;
  /** A problem to show: permission off, too short, recorder error. */
  onProblem: (message: string) => void;
}

const clock = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, '0')}`;

/**
 * Hold to talk, release to send. A soft halo grows with your voice so it's obvious the mic is
 * hearing you; haptics mark start and stop.
 */
export function VoiceButton({ disabled, onNote, onProblem }: Props) {
  const voice = useVoiceNote();

  // Halo follows the mic level while recording; settles back when idle.
  const halo = useDerivedValue(() =>
    voice.recording
      ? withSpring(1.15 + voice.level * 0.55, { damping: 14, stiffness: 180 })
      : withTiming(1, { duration: 200 }),
  );
  const shown = useDerivedValue(() =>
    withTiming(voice.recording ? 1 : 0, { duration: 180, easing: Easing.out(Easing.cubic) }),
  );
  const haloStyle = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: halo.get() }],
  }));
  const buttonStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 - shown.get() * 0.06 }] }));

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
      if (!note) {
        onProblem('Hold the mic while you speak, then let go.');
        return;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onNote(note);
    } catch {
      onProblem('That recording didn’t save. Please try again.');
    }
  };

  return (
    <View className="items-center">
      <View
        style={{ width: SIZE * 1.9, height: SIZE * 1.9 }}
        className="items-center justify-center"
      >
        <Animated.View
          pointerEvents="none"
          style={[haloStyle, { width: SIZE, height: SIZE, backgroundColor: colors.accentSoft }]}
          className="absolute rounded-full"
        />
        <Animated.View style={buttonStyle}>
          <Pressable
            onPressIn={pressIn}
            onPressOut={pressOut}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Hold to say what you ate"
            accessibilityHint="Press and hold, speak, then release to send"
            className="items-center justify-center rounded-full"
            style={{
              width: SIZE,
              height: SIZE,
              backgroundColor: voice.recording ? colors.accent : colors.ink,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            <Mic size={28} color="#fff" />
          </Pressable>
        </Animated.View>
      </View>
      <Text className="-mt-2 text-sm text-muted" accessibilityLiveRegion="polite">
        {voice.recording
          ? `${clock(voice.durationMs)} of ${clock(MAX_VOICE_MS)} · release to send`
          : 'Hold to say it'}
      </Text>
    </View>
  );
}
