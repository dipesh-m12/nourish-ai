import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useScreenSize } from '@/hooks/use-screen-size';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { ASSISTANT_INTRO } from '@/constants/assistant-intro';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';

const LAST = ASSISTANT_INTRO.length - 1;

/**
 * First visit to the chat: four slides showing what Nourish does, using real-looking chats.
 * Finishing or skipping calls `onDone` (the screen saves it, so it never shows again).
 */
export function AssistantIntro({ onDone, saving }: { onDone: () => void; saving: boolean }) {
  const { width } = useScreenSize();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList>(null);
  const slide = ASSISTANT_INTRO[page]!;

  const next = () => {
    if (page === LAST) return onDone();
    list.current?.scrollToIndex({ index: page + 1, animated: true });
    setPage(page + 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <View
          className="flex-row gap-1.5"
          accessibilityLabel={`Slide ${page + 1} of ${ASSISTANT_INTRO.length}`}
        >
          {ASSISTANT_INTRO.map((s, i) => (
            <Animated.View
              key={s.key}
              layout={LinearTransition.duration(200)}
              className={cn('h-1.5 rounded-full', i === page ? 'w-5 bg-ink' : 'w-1.5 bg-line')}
            />
          ))}
        </View>
        <Pressable
          onPress={onDone}
          disabled={saving}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Skip the intro"
          className="h-10 justify-center px-2"
        >
          <Text className="font-sans-semibold text-sm text-muted">Skip</Text>
        </Pressable>
      </View>

      {/* Images swipe; the text below follows the current slide. */}
      <FlatList
        ref={list}
        data={ASSISTANT_INTRO}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        className="grow-0"
        renderItem={({ item }) => (
          <View style={{ width }} className="px-5 pt-4">
            <View className="overflow-hidden rounded-3xl bg-card shadow-sm">
              <Image
                source={item.image}
                style={{ width: '100%', aspectRatio: item.aspect }}
                contentFit="contain"
                accessibilityLabel={item.title}
              />
            </View>
          </View>
        )}
      />

      <View className="flex-1 px-6 pt-6">
        <Animated.View key={slide.key} entering={FadeInDown.duration(320)}>
          <Heading className="text-center text-3xl">{slide.title}</Heading>
          <Text className="mt-2 text-center leading-6 text-muted">{slide.body}</Text>
        </Animated.View>
      </View>

      <View className="px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 16) }}>
        <Button
          label={page === LAST ? 'Start chatting' : 'Next'}
          onPress={next}
          loading={saving && page === LAST}
        />
      </View>
    </SafeAreaView>
  );
}
