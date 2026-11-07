import { CircleCheck, CircleX } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';

export type NameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'unknown';

const COPY: Record<Exclude<NameStatus, 'idle'>, string> = {
  checking: 'Checking…',
  available: 'Nice, that name is free',
  taken: 'That name is already used. Try adding a surname or initial.',
  unknown: "Couldn't check right now. We'll confirm when you continue.",
};

/** One line under the name field that says whether the name can be used. Announced to screen readers. */
export function NameAvailabilityHint({ status }: { status: NameStatus }) {
  if (status === 'idle') return <View className="h-7" />; // reserve space, so nothing jumps

  const color =
    status === 'taken' ? 'text-danger' : status === 'available' ? 'text-primary' : 'text-muted';
  return (
    <Animated.View
      key={status}
      entering={FadeIn.duration(150)}
      className="mt-2 min-h-5 flex-row items-center gap-1.5"
      accessibilityLiveRegion="polite"
    >
      {status === 'checking' && <ActivityIndicator size="small" color={colors.muted} />}
      {status === 'available' && <CircleCheck size={16} color={colors.primary} />}
      {status === 'taken' && <CircleX size={16} color={colors.danger} />}
      <Text className={`flex-1 text-sm ${color}`}>{COPY[status]}</Text>
    </Animated.View>
  );
}
