import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Pressable, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNameAvailability, useSignUp } from '@/api/profiles';
import { NameAvailabilityHint, type NameStatus } from '@/components/name-availability-hint';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useOnboarding } from '@/store/onboarding';

export default function NewProfileScreen() {
  const [name, setName] = useState('');
  const signUp = useSignUp();
  const startOnboarding = useOnboarding((s) => s.start);

  const trimmed = name.trim();
  const debounced = useDebouncedValue(trimmed);
  const availability = useNameAvailability(debounced);

  // Derive one status from "still typing" + the query state.
  const status: NameStatus = !trimmed
    ? 'idle'
    : trimmed !== debounced || availability.isFetching
      ? 'checking'
      : availability.isError
        ? 'unknown' // network hiccup: don't block, the server re-checks on sign-up
        : availability.data?.available === false
          ? 'taken'
          : availability.data?.available
            ? 'available'
            : 'checking';

  const taken = status === 'taken';

  const submit = () => {
    if (!trimmed || taken || signUp.isPending) return;
    signUp.mutate(trimmed, {
      onSuccess: ({ profile }) => {
        startOnboarding(profile.id);
        router.replace('/onboarding/about');
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <KeyboardAvoidingView
        className="flex-1"
        behavior="padding" // Android is edge-to-edge, so it needs padding too
      >
        <View className="flex-row justify-end px-4 pt-2">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            className="h-10 w-10 items-center justify-center rounded-full bg-card"
          >
            <X size={20} color={colors.ink} />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.duration(400)} className="flex-1 px-6 pt-6">
          <Heading>What should we call you?</Heading>
          <Text className="mt-2 text-muted">Just a first name is perfect.</Text>

          <TextInput
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (signUp.isError) signUp.reset(); // clear a stale server error while typing
            }}
            placeholder="Your name"
            placeholderTextColor={colors.muted}
            autoFocus
            autoCapitalize="words"
            autoComplete="given-name"
            maxLength={30}
            returnKeyType="next"
            onSubmitEditing={submit}
            accessibilityLabel="Your name"
            className={`mt-8 h-16 rounded-2xl border-2 bg-card px-4 font-sans-semibold text-xl text-ink ${
              taken || signUp.isError ? 'border-danger' : 'border-line focus:border-primary'
            }`}
          />
          {signUp.isError ? (
            <Text className="mt-2 text-sm text-danger" accessibilityLiveRegion="polite">
              {signUp.error.message}
            </Text>
          ) : (
            <NameAvailabilityHint status={status} />
          )}
        </Animated.View>

        <View className="px-6 pb-4">
          <Button
            label="Continue"
            onPress={submit}
            disabled={!trimmed || taken}
            loading={signUp.isPending}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
