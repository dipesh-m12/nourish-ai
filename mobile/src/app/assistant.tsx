import { router, useLocalSearchParams } from 'expo-router';
import { ArrowUp, ChevronLeft, ListChecks } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useAgentThread,
  useCancelAgentAction,
  useConfirmAgentAction,
  useSendAgentMessage,
  type ConfirmInput,
} from '@/api/agent';
import { useSubscription } from '@/api/subscription';
import { ActionCard } from '@/components/agent/action-card';
import { AgentLottie } from '@/components/agent/agent-lottie';
import { AskInput } from '@/components/agent/ask-input';
import { ChallengeTools } from '@/components/agent/challenge-tools';
import { TypingDots } from '@/components/agent/typing-dots';
import { Button } from '@/components/ui/button';
import { MicButton } from '@/components/ui/mic-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import type { Photo } from '@/lib/photo';
import { useToast } from '@/store/toast';
import type { AgentMessage } from '@/types/agent';
import { localDate } from '@/utils/date';

/**
 * Chat with Nourish: say or type what you did, answer its quick questions with a tap, confirm
 * its cards (with a photo for logs), and the dashboard updates behind you.
 */
export default function AssistantScreen() {
  const date = localDate();
  const insets = useSafeAreaInsets();
  const toast = useToast((s) => s.show);
  const thread = useAgentThread(date);
  const send = useSendAgentMessage(date);
  const confirm = useConfirmAgentAction(date);
  const cancel = useCancelAgentAction(date);
  const [text, setText] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [showChallenges, setShowChallenges] = useState<boolean | null>(null);
  const [proofPhotos, setProofPhotos] = useState<Record<string, Photo>>({});
  const list = useRef<FlatList<AgentMessage>>(null);

  const messages = thread.data?.messages ?? [];
  const last = messages.at(-1);
  // Quick answers only make sense for the newest question.
  const liveAsk = !send.isPending && last?.role === 'assistant' ? last.ask : null;
  const challengeToolsVisible = showChallenges ?? liveAsk?.kind === 'challenges';

  // Free plan: after the free messages the server answers 402 → show the Club, not an error.
  const club = useSubscription();
  const sendFailed = useCallback(
    (err: Error) => {
      if (err instanceof ApiError && err.status === 402) {
        router.push({ pathname: '/club', params: { reason: 'quota' } });
        return;
      }
      toast(err.message);
    },
    [toast],
  );
  const usage = thread.data?.usage;
  const freeLeft = usage && !club.data?.premium ? Math.max(0, usage.free - usage.sent) : null;

  const submit = (value: string) => {
    const message = value.trim();
    if (!message || send.isPending) return;
    setHint(null);
    setShowChallenges(null);
    setText('');
    send.mutate(message, {
      onError: (err) => {
        setText(message); // keep what they typed
        sendFailed(err);
      },
    });
  };

  // Opened from the dashboard briefing ("Log my sleep"): send that ask once the thread is ready,
  // so the PA picks it up without the user retyping it.
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const promptSent = useRef(false);
  const { mutate: sendMessage } = send; // stable across renders, unlike submit()
  useEffect(() => {
    if (!prompt || promptSent.current || !thread.isSuccess) return;
    promptSent.current = true;
    sendMessage(prompt, { onError: sendFailed });
  }, [prompt, thread.isSuccess, sendMessage, sendFailed]);

  const scrollToEnd = () =>
    requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));

  const submitPhoto = (photo: Photo) => {
    if (send.isPending) return;
    setHint(null);
    send.mutate(
      { text: 'Please review this meal photo.', photo },
      {
        onSuccess: ({ messages }) => {
          const action = messages.at(-1)?.action;
          if (action?.kind === 'log_meal' && action.status === 'proposed') {
            setProofPhotos((old) => ({ ...old, [action.id]: photo }));
          }
        },
        onError: sendFailed,
      },
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <View className="flex-row items-center gap-3 border-b border-line px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
        <AgentLottie size={40} round />
        <View className="flex-1">
          <Heading className="text-xl leading-tight">Nourish</Heading>
          <Text className="text-xs text-muted">
            {send.isPending ? 'Thinking…' : 'Logs it for you, nudges you on time'}
          </Text>
        </View>
        <Pressable
          onPress={() => setShowChallenges(!challengeToolsVisible)}
          accessibilityRole="button"
          accessibilityLabel="Show your challenges in chat"
          accessibilityState={{ expanded: challengeToolsVisible }}
          className="min-h-12 items-center justify-center gap-1 px-2"
        >
          <ListChecks size={20} color={colors.primary} />
          <Text className="text-xs text-primary">Challenges</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView behavior="padding" className="flex-1">
        {thread.isPending ? (
          <ThreadSkeleton />
        ) : thread.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-center text-muted">{thread.error.message}</Text>
            <Button
              className="mt-4 self-stretch"
              label="Try again"
              onPress={() => thread.refetch()}
            />
          </View>
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(m) => m.id}
            contentContainerClassName="gap-3 px-4 pb-4 pt-4"
            onContentSizeChange={scrollToEnd}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            renderItem={({ item }) => (
              <Bubble
                message={item}
                date={date}
                initialPhoto={item.action ? proofPhotos[item.action.id] : undefined}
                onConfirm={async (photo, amount, items) => {
                  const r = await confirm.mutateAsync({
                    id: item.action!.id,
                    photo,
                    amount,
                    items,
                  });
                  return r.ok ? null : r.note;
                }}
                onCancel={async () => {
                  await cancel.mutateAsync(item.action!.id);
                }}
              />
            )}
            ListFooterComponent={
              <View className="gap-3 pt-3">
                {challengeToolsVisible && <ChallengeTools date={date} />}
                {liveAsk && liveAsk.kind !== 'challenges' && !showChallenges && (
                  <AskInput key={last!.id} ask={liveAsk} onAnswer={submit} onPhoto={submitPhoto} />
                )}
                {send.isPending && (
                  <>
                    <UserBubble
                      text={
                        typeof send.variables === 'string' ? send.variables : send.variables?.text
                      }
                    />
                    <TypingDots />
                  </>
                )}
              </View>
            }
          />
        )}

        {/* Composer: type, or hold the mic and speak (sends straight away). */}
        <View
          className="border-t border-line bg-bg px-3 pt-2"
          style={{ paddingBottom: Math.max(insets.bottom, 10) }}
        >
          {hint && <Text className="mb-1.5 px-1 text-sm text-accent">{hint}</Text>}
          {freeLeft !== null && (
            <Pressable
              onPress={() => router.push('/club')}
              accessibilityRole="button"
              accessibilityLabel={`${freeLeft} free messages left. See Mochi's Club`}
              className="mb-1.5 flex-row items-center gap-1 self-center px-2 py-1 active:opacity-70"
            >
              <Text className="text-xs text-muted">
                {freeLeft > 0
                  ? `${freeLeft} free message${freeLeft === 1 ? '' : 's'} left · `
                  : 'Free messages used · '}
              </Text>
              <Text className="font-sans-semibold text-xs text-primary">Mochi’s Club</Text>
            </Pressable>
          )}
          <View className="flex-row items-center gap-2">
            {/* Own the input's padding so native multiline insets don't set the row height. */}
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message Nourish…"
              placeholderTextColor={colors.muted}
              multiline
              textAlignVertical="top"
              maxLength={500}
              accessibilityLabel="Message Nourish"
              className="min-h-11 max-h-28 flex-1 rounded-3xl bg-card px-4 py-2.5 font-sans text-base leading-6 text-ink"
              style={{ includeFontPadding: false }}
            />
            {text.trim() ? (
              <PressableScale
                onPress={() => submit(text)}
                disabled={send.isPending}
                accessibilityRole="button"
                accessibilityLabel="Send"
                className={cn(
                  'h-11 w-11 items-center justify-center rounded-full bg-ink',
                  send.isPending && 'opacity-40',
                )}
              >
                <ArrowUp size={20} color="#fff" />
              </PressableScale>
            ) : (
              <View className="h-11 w-11 items-center justify-center">
                <MicButton label="Hold to talk to Nourish" onText={submit} onProblem={setHint} />
              </View>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface BubbleProps {
  message: AgentMessage;
  date: string;
  initialPhoto?: Photo;
  onConfirm: (
    photo?: Photo,
    amount?: number,
    items?: ConfirmInput['items'],
  ) => Promise<string | null>;
  onCancel: () => Promise<void>;
}

function Bubble({ message: m, date, initialPhoto, onConfirm, onCancel }: BubbleProps) {
  const reducedMotion = useReducedMotion();
  if (m.role === 'user') return <UserBubble text={m.text} />;
  return (
    <View className="w-full items-start">
      <View className="w-full flex-row justify-start">
        <Animated.View
          entering={reducedMotion ? undefined : FadeInDown.duration(300)}
          style={{ maxWidth: '85%' }}
          className="rounded-2xl rounded-tl-md bg-card px-4 py-3"
        >
          <Text className="leading-6">{m.text}</Text>
        </Animated.View>
      </View>
      {m.action && (
        <ActionCard
          key={m.action.id}
          action={m.action}
          date={date}
          initialPhoto={initialPhoto}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </View>
  );
}

function UserBubble({ text }: { text?: string }) {
  const reducedMotion = useReducedMotion();
  return (
    <View className="w-full flex-row justify-end">
      <Animated.View
        entering={reducedMotion ? undefined : FadeInUp.duration(260)}
        style={{ maxWidth: '82%' }}
        className="rounded-2xl rounded-tr-md bg-ink px-4 py-3"
      >
        <Text className="leading-6 text-white">{text}</Text>
      </Animated.View>
    </View>
  );
}

function ThreadSkeleton() {
  return (
    <SkeletonGroup
      className="flex-1 gap-3 px-4 pt-4"
      accessible
      accessibilityLabel="Loading your chat"
      accessibilityState={{ busy: true }}
    >
      <SkeletonBlock className="h-16 w-3/4 rounded-2xl" />
      <View className="flex-row gap-2">
        <SkeletonBlock className="h-10 w-28 rounded-full" />
        <SkeletonBlock className="h-10 w-24 rounded-full" />
      </View>
    </SkeletonGroup>
  );
}
