import { Bell } from 'lucide-react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { useMe, useSetReminders } from '@/api/profiles';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { enablePush } from '@/hooks/use-device-registration';
import { useToast } from '@/store/toast';

/**
 * Asked once, where it makes sense (by the water glass), never at app start. Yes also asks
 * Android for notification permission. Either answer is saved; Profile can change it later.
 */
export function ReminderAsk() {
  const me = useMe().data;
  const setReminders = useSetReminders();
  const toast = useToast((s) => s.show);
  if (!me || me.preferences.reminders?.water !== undefined) return null;

  const answer = (water: boolean) =>
    setReminders.mutate(
      { water },
      {
        onSuccess: async () => {
          if (!water) return;
          const ok = await enablePush();
          toast(ok ? 'I’ll nudge you to sip' : 'Notifications are off. Turn them on in Settings.');
        },
        onError: (e) => toast(e.message),
      },
    );

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      exiting={FadeOut.duration(200)}
      className="mt-5 w-full flex-row items-center gap-3 rounded-2xl bg-primary-soft p-3"
    >
      <Bell size={18} color={colors.primary} />
      <Text className="flex-1 font-sans-semibold">Remind me to sip?</Text>
      <PressableScale
        onPress={() => answer(false)}
        disabled={setReminders.isPending}
        accessibilityRole="button"
        accessibilityLabel="No water reminders"
        className="h-9 justify-center rounded-full px-3"
      >
        <Text className="font-sans-semibold text-sm text-muted">No</Text>
      </PressableScale>
      <PressableScale
        onPress={() => answer(true)}
        disabled={setReminders.isPending}
        accessibilityRole="button"
        accessibilityLabel="Yes, remind me to drink water"
        className="h-9 justify-center rounded-full bg-ink px-4"
      >
        <Text className="font-sans-semibold text-sm text-white">Yes</Text>
      </PressableScale>
    </Animated.View>
  );
}
