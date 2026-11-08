import * as Haptics from 'expo-haptics';
import { ArrowUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Stepper } from '@/components/ui/stepper';
import { Text } from '@/components/ui/text';
import type { Photo } from '@/lib/photo';
import type { AgentAsk } from '@/types/agent';
import { PhotoInput } from './photo-input';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * The assistant's question, answered with a tap: chips for choices, a stepper for numbers.
 * The answer is sent as an ordinary message, so typing instead works just as well.
 */
export function AskInput({
  ask,
  onAnswer,
  onPhoto,
}: {
  ask: AgentAsk;
  onAnswer: (text: string) => void;
  onPhoto: (photo: Photo) => void;
}) {
  const [value, setValue] = useState(ask.initial ?? ask.min ?? 0);

  if (ask.kind === 'photo') return <PhotoInput onPhoto={onPhoto} />;

  if (ask.kind === 'choice' && ask.options?.length) {
    return (
      <View className="mt-2 flex-row flex-wrap gap-2">
        {ask.options.map((o, i) => (
          <Animated.View key={o} entering={FadeInDown.delay(i * 60).duration(260)}>
            <PressableScale
              onPress={() => {
                Haptics.selectionAsync();
                onAnswer(o);
              }}
              accessibilityRole="button"
              accessibilityLabel={o}
              className="h-10 justify-center rounded-full border border-primary/30 bg-primary-soft px-4"
            >
              <Text className="font-sans-semibold text-sm text-primary">{o}</Text>
            </PressableScale>
          </Animated.View>
        ))}
      </View>
    );
  }

  if (ask.kind === 'number') {
    const unit = ask.unit ?? '';
    return (
      <Animated.View
        entering={FadeInDown.duration(280)}
        className="mt-2 flex-row items-center gap-3 self-start rounded-2xl bg-card py-2 pl-3 pr-2"
      >
        <Stepper
          compact
          value={value}
          onChange={setValue}
          min={ask.min ?? 0}
          max={ask.max ?? 100}
          step={ask.step ?? 1}
          unit={unit}
          label={`Answer in ${unit}`}
          format={(n) => `${fmt(n)} ${unit}`.trim()}
        />
        <PressableScale
          onPress={() => onAnswer(`${fmt(value)} ${unit}`.trim())}
          accessibilityRole="button"
          accessibilityLabel={`Send ${fmt(value)} ${unit}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-ink"
        >
          <ArrowUp size={18} color="#fff" />
        </PressableScale>
      </Animated.View>
    );
  }

  return null;
}
