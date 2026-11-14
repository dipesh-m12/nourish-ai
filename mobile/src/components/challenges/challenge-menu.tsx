import * as Haptics from 'expo-haptics';
import { AlarmClock, Bell, ChevronRight, Trash2, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useFinishChallenge, useSetReminder, useUpdateExpiry } from '@/api/challenges';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Text } from '@/components/ui/text';
import { TimePill, toHHMM } from '@/components/ui/time-pill';
import { colors } from '@/constants/colors';
import { enablePush } from '@/hooks/use-device-registration';
import { cn } from '@/lib/cn';
import { ALARM_SUPPORTED, setPhoneAlarm } from '@/lib/alarm';
import { pickTime } from '@/lib/pick-date';
import { useToast } from '@/store/toast';
import type { TodayChallenge } from '@/types/today';
import { ExpiryChips } from './expiry-chips';

const PUSH_OFF = 'Notifications are off. Turn them on in Settings.';
const NATIVE = Platform.OS !== 'web';

interface Props {
  challenge: TodayChallenge | null;
  date: string;
  onClose: () => void;
}

/**
 * One challenge's settings, from its card's ⋯: grouped like a phone's settings so it reads at a
 * glance. Reminder = one row with the same time pill as the Reminders sheet (tap to set,
 * x to turn off); a real phone alarm; how long it runs; remove (confirmed).
 */
export function ChallengeMenu({ challenge: c, date, onClose }: Props) {
  const setReminder = useSetReminder();
  const expiry = useUpdateExpiry();
  const finish = useFinishChallenge();
  const toast = useToast((s) => s.show);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const saveTime = (remindAt: string | null) => {
    if (!c) return;
    setReminder.mutate(
      { id: c.id, remindAt },
      {
        onSuccess: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          if (remindAt && !(await enablePush())) toast(PUSH_OFF);
        },
        onError: (e) => toast(e.message),
      },
    );
  };

  /** Ask for a time (prefilled with the current one, else 8 am) and save it. */
  const chooseTime = async () => {
    if (!c) return;
    const [h, m] = (c.remindAt ?? '08:00').split(':').map(Number);
    const picked = await pickTime(h!, m!);
    if (picked) saveTime(toHHMM(picked));
  };

  /** A real alarm in the Clock app, prefilled with the reminder time (or 6:30 am). */
  const alarm = async () => {
    if (!c) return;
    const [h, m] = (c.remindAt ?? '06:30').split(':').map(Number);
    const picked = await pickTime(h!, m!);
    if (!picked) return;
    if (!(await setPhoneAlarm(picked.hour, picked.minute, c.title)))
      toast('No clock app found to set the alarm.');
  };

  const on = Boolean(c?.remindAt);

  return (
    <>
      <BottomSheet visible={Boolean(c) && !confirmRemove} onClose={onClose} title={c?.title ?? ''}>
        {c && (
          <View className="gap-6">
            <Section label="Remind me">
              {/* One row: tap the time to set or change it; the small x turns it off. */}
              <Row
                icon={<Bell size={20} color={on ? colors.primary : colors.muted} />}
                title="Daily reminder"
                right={
                  <View className="flex-row items-center">
                    <TimePill
                      value={c.remindAt}
                      label={c.title}
                      onPress={NATIVE ? () => void chooseTime() : undefined}
                    />
                    {on && (
                      <Pressable
                        onPress={() => saveTime(null)}
                        disabled={setReminder.isPending}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Turn the reminder off"
                        className="-mr-2 h-12 w-10 items-center justify-center active:opacity-60"
                      >
                        <X size={18} color={colors.muted} />
                      </Pressable>
                    )}
                  </View>
                }
              />
              {ALARM_SUPPORTED && (
                <Pressable
                  onPress={() => void alarm()}
                  accessibilityRole="button"
                  accessibilityLabel="Set a phone alarm for this"
                  className="active:opacity-70"
                >
                  <Row
                    divider
                    icon={<AlarmClock size={20} color={colors.ink} />}
                    title="Phone alarm"
                    right={<ChevronRight size={18} color={colors.muted} />}
                  />
                </Pressable>
              )}
            </Section>
            {!NATIVE && (
              <Text className="-mt-4 text-xs text-muted">Reminders work in the app.</Text>
            )}

            <Section label="How long" plain>
              <ExpiryChips
                today={date}
                value={c.endsOn}
                onChange={(endsOn) =>
                  expiry.mutate(
                    { id: c.id, date, endsOn },
                    { onSuccess: () => toast('Updated'), onError: (e) => toast(e.message) },
                  )
                }
              />
            </Section>

            <Pressable
              onPress={() => setConfirmRemove(true)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${c.title}`}
              className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-card active:opacity-70"
            >
              <Trash2 size={18} color={colors.danger} />
              <Text className="font-sans-semibold text-danger">Remove challenge</Text>
            </Pressable>
          </View>
        )}
      </BottomSheet>
      <ConfirmDialog
        visible={confirmRemove}
        title={`Remove ${c?.title ?? 'this'}?`}
        message="Its history stays."
        confirmLabel="Remove"
        destructive
        loading={finish.isPending}
        onConfirm={() =>
          c &&
          finish.mutate(c.id, {
            onSuccess: () => {
              setConfirmRemove(false);
              onClose();
              toast('Removed');
            },
            onError: (e) => toast(e.message),
          })
        }
        onCancel={() => setConfirmRemove(false)}
      />
    </>
  );
}

/** A small uppercase label over a grouped card (or bare content when `plain`). */
function Section({
  label,
  plain,
  children,
}: {
  label: string;
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <View>
      <Text className="mb-2 px-1 font-sans-semibold text-xs uppercase tracking-wider text-muted">
        {label}
      </Text>
      {plain ? children : <View className="overflow-hidden rounded-2xl bg-card">{children}</View>}
    </View>
  );
}

/** One 56 dp row: optional icon (decorative), a title, and a control on the right. */
function Row({
  icon,
  title,
  right,
  divider,
}: {
  icon?: ReactNode;
  title: string;
  right: ReactNode;
  divider?: boolean;
}) {
  return (
    <View
      className={cn('min-h-14 flex-row items-center gap-3 px-4', divider && 'border-t border-line')}
    >
      {icon ? (
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          {icon}
        </View>
      ) : (
        // Keep titles lined up with the rows that have an icon.
        <View className="w-5" />
      )}
      <Text className="flex-1 font-sans-semibold">{title}</Text>
      {right}
    </View>
  );
}
