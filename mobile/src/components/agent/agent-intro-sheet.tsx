import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { AgentLottie } from './agent-lottie';

interface Props {
  visible: boolean;
  busy: boolean;
  onAdd: () => void;
  onLater: () => void;
}

/**
 * First meeting with the assistant: the Lottie does the talking, one line explains, two choices.
 * Shown once; the profile screen can change the answer later.
 */
export function AgentIntroSheet({ visible, busy, onAdd, onLater }: Props) {
  return (
    <BottomSheet visible={visible} onClose={onLater} title="Meet Nourish" minHeightRatio={0.72}>
      <View className="flex-1 justify-between">
        <View className="items-center">
          <AgentLottie size={260} />
          <Animated.View entering={FadeInDown.delay(150).duration(400)} className="mt-2">
            <Heading className="text-center text-2xl">Still tapping buttons?</Heading>
            <Text className="mt-1.5 text-center text-muted">
              Just tell me. I’ll log it and do the maths.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(320).duration(380)} className="mt-6 gap-2">
          <Button label="Let’s talk" onPress={onAdd} loading={busy} />
          <Button label="Not now" variant="ghost" onPress={onLater} disabled={busy} />
        </Animated.View>
      </View>
    </BottomSheet>
  );
}
