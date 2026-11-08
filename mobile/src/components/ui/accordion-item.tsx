import * as Haptics from 'expo-haptics';
import { ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { Text } from './text';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface Props {
  title: string;
  children: string;
  /** Draw a hairline above (every item but the first in a grouped list). */
  divider?: boolean;
}

/**
 * One question that opens to its answer. Tap the row; the chevron turns and the answer fades
 * in (the parent's layout transition grows the card). Screen readers hear expanded/collapsed.
 */
export function AccordionItem({ title, children, divider }: Props) {
  const [open, setOpen] = useState(false);
  const turn = useDerivedValue(() => withTiming(open ? 1 : 0, { duration: 220, easing: EASE_OUT }));
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.get() * 180}deg` }] }));

  return (
    <View className={cn(divider && 'border-t border-line')}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setOpen((o) => !o);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        className="min-h-14 flex-row items-center gap-3 px-4 py-3.5 active:opacity-70"
      >
        <Text className="flex-1 font-sans-semibold">{title}</Text>
        <Animated.View style={chevron}>
          <ChevronDown size={18} color={colors.muted} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(120)}
          className="px-4 pb-4"
        >
          <Text className="text-sm leading-5 text-muted">{children}</Text>
        </Animated.View>
      )}
    </View>
  );
}
