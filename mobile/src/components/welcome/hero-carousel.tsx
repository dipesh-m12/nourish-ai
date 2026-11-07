import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type FlatList, useWindowDimensions, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ImageSlot } from '@/components/ui/image-slot';
import { Heading, Text } from '@/components/ui/text';
import type { WelcomeSlide } from '@/constants/welcome-slides';

interface Props {
  slides: WelcomeSlide[];
  /** Time each slide stays before auto-advancing. */
  intervalMs?: number;
}

/** Illustration height as a share of screen width (status-bar inset is added on top). */
const ART_RATIO = 0.78;

/**
 * Full-bleed, edge-to-edge slideshow for the top of the welcome screen.
 * The art runs under the status bar and ends in a straight edge. It auto-advances,
 * pauses while the user swipes, and stays still when reduced motion is on.
 */
export function HeroCarousel({ slides, intervalMs = 4500 }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const listRef = useRef<FlatList<WelcomeSlide>>(null);
  const scrollX = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.set(e.contentOffset.x);
  });

  // Auto-advance. Restarts after every manual swipe, so the user is never fought mid-gesture.
  useEffect(() => {
    if (reduceMotion || dragging || slides.length < 2) return;
    const timer = setTimeout(() => {
      const next = (index + 1) % slides.length;
      listRef.current?.scrollToOffset({ offset: next * width, animated: true });
      setIndex(next);
    }, intervalMs);
    return () => clearTimeout(timer);
  }, [index, dragging, reduceMotion, slides.length, width, intervalMs]);

  const renderSlide = useCallback(
    ({ item }: { item: WelcomeSlide }) => (
      <View style={{ width }} accessible accessibilityLabel={`${item.title} ${item.body}`}>
        <View
          className="items-center justify-end px-6 pb-4"
          style={{
            height: width * ART_RATIO + insets.top,
            paddingTop: insets.top + 12,
            backgroundColor: item.tint,
          }}
        >
          {item.image ? (
            <Image
              source={item.image}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          ) : (
            <ImageSlot className="w-full flex-1" description={item.imageSpec} />
          )}
        </View>
        <View className="px-6 pt-6">
          <Heading>{item.title}</Heading>
          <Text className="mt-2 text-muted">{item.body}</Text>
        </View>
      </View>
    ),
    [width, insets.top],
  );

  return (
    <View>
      <Animated.FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(s) => s.key}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setDragging(true)}
        onMomentumScrollEnd={(e) => {
          setDragging(false);
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
        }}
        getItemLayout={(_, i) => ({
          length: width,
          offset: width * i,
          index: i,
        })}
      />
      <View
        className="mt-4 flex-row gap-1.5 px-6"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {slides.map((s, i) => (
          <PageDot key={s.key} index={i} scrollX={scrollX} width={width} />
        ))}
      </View>
    </View>
  );
}

/** Pagination dot that stretches into a pill as its slide comes into view (driven by scroll, on the UI thread). */
function PageDot({
  index,
  scrollX,
  width,
}: {
  index: number;
  scrollX: SharedValue<number>;
  width: number;
}) {
  const style = useAnimatedStyle(() => {
    const range = [(index - 1) * width, index * width, (index + 1) * width];
    return {
      width: interpolate(scrollX.get(), range, [8, 24, 8], Extrapolation.CLAMP),
      opacity: interpolate(scrollX.get(), range, [0.35, 1, 0.35], Extrapolation.CLAMP),
    };
  });
  return <Animated.View className="h-2 rounded-full bg-primary" style={style} />;
}
