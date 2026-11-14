import * as Haptics from 'expo-haptics';
import { ArrowUp, Check, Droplets, Minus } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { type ReminderPlan, useReminderPlan, useSaveReminders } from '@/api/challenges';
import { useMe } from '@/api/profiles';
import { useToday } from '@/api/today';
import { Button } from '@/components/ui/button';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { MicButton } from '@/components/ui/mic-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { clockText, TimePill, toHHMM } from '@/components/ui/time-pill';
import { colors } from '@/constants/colors';
import { enablePush } from '@/hooks/use-device-registration';
import { cn } from '@/lib/cn';
import { pickTime } from '@/lib/pick-date';
import { useToast } from '@/store/toast';
import type { TodayChallenge } from '@/types/today';

const PUSH_OFF = 'Notifications are off. Turn them on in Settings.';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
}

/**
 * Every reminder in one sheet (opened from the dashboard, Profile and the assistant):
 * - say it ("walk at 7, water every morning, no sleep one") → the AI plans it → confirm;
 * - or tick challenges (or all) and give them one time, or turn them off;
 * - tap a time to change just that one.
 */
export function RemindersSheet({ visible, date, onClose }: Props) {
  const today = useToday(date);
  const me = useMe();
  const save = useSaveReminders();
  const planner = useReminderPlan();
  const toast = useToast((s) => s.show);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ReminderPlan | null>(null);

  const challenges = today.data?.challenges ?? [];
  const water = me.data?.preferences.reminders?.water === true;
  const allOn = challenges.length > 0 && selected.size === challenges.length;

  const close = () => {
    setSelected(new Set());
    setText('');
    setPlan(null);
    planner.reset();
    onClose();
  };

  /** Saves, then makes sure the phone can actually show them. */
  const apply = (items: { id: string; remindAt: string | null }[], waterOn?: boolean) =>
    save.mutateAsync({ items, water: waterOn }).then(async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const turningOn = items.some((i) => i.remindAt) || waterOn === true;
      if (turningOn && !(await enablePush())) toast(PUSH_OFF);
    });

  const toggle = (id: string) => {
    Haptics.selectionAsync();
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    Haptics.selectionAsync();
    setSelected(allOn ? new Set() : new Set(challenges.map((c) => c.id)));
  };

  /** One time for one challenge, or for everything ticked. */
  const setTime = async (ids: string[], current: string | null) => {
    const [h, m] = (current ?? '08:00').split(':').map(Number);
    const picked = await pickTime(h!, m!);
    if (!picked) return;
    const remindAt = toHHMM(picked);
    await apply(ids.map((id) => ({ id, remindAt })))
      .then(() => {
        setSelected(new Set());
        toast(
          ids.length > 1
            ? `${ids.length} reminders at ${clockText(remindAt)}`
            : clockText(remindAt),
        );
      })
      .catch((e: Error) => toast(e.message));
  };

  const turnOff = (ids: string[]) =>
    apply(ids.map((id) => ({ id, remindAt: null })))
      .then(() => {
        setSelected(new Set());
        toast(ids.length > 1 ? `${ids.length} reminders off` : 'Reminder off');
      })
      .catch((e: Error) => toast(e.message));

  const ask = (said = text) => {
    const words = said.trim();
    if (!words) return;
    planner.mutate(
      { date, text: words },
      {
        onSuccess: (p) => {
          if (!p.changes.length && p.water === null) toast('Nothing to change there.');
          else setPlan(p);
        },
      },
    );
  };

  const confirmPlan = () => {
    if (!plan) return;
    apply(
      plan.changes.map((c) => ({ id: c.id, remindAt: c.remindAt })),
      plan.water ?? undefined,
    )
      .then(() => {
        toast('Reminders set');
        setPlan(null);
        setText('');
      })
      .catch((e: Error) => toast(e.message));
  };

  // Two challenges with the same name ("Water" twice): add the target to tell them apart.
  const counts = new Map<string, number>();
  for (const c of challenges) {
    const n = c.tracking.label ?? c.title;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  const nameOf = (c: TodayChallenge) => {
    const n = c.tracking.label ?? c.title;
    return (counts.get(n) ?? 0) > 1 ? `${n} · ${c.target}` : n;
  };

  const ids = [...selected];
  const footer = plan ? (
    <View className="gap-2">
      <Button label="Set these" onPress={confirmPlan} loading={save.isPending} />
      <Button variant="ghost" label="Change what I said" onPress={() => setPlan(null)} />
    </View>
  ) : ids.length > 0 ? (
    <View className="flex-row gap-3">
      <Button
        className="flex-1"
        variant="secondary"
        label="Turn off"
        disabled={save.isPending}
        onPress={() => void turnOff(ids)}
      />
      <Button
        className="flex-1"
        label={`Set time · ${ids.length}`}
        loading={save.isPending}
        onPress={() => void setTime(ids, null)}
      />
    </View>
  ) : undefined;

  return (
    <DraggableSheet
      visible={visible}
      onClose={close}
      tall
      title={plan ? 'Look right?' : 'Reminders'}
      footer={footer}
    >
      {plan ? (
        <Animated.View entering={FadeIn.duration(220)} className="gap-3">
          <Text className="text-muted">{plan.reply}</Text>
          <View className="overflow-hidden rounded-2xl bg-card">
            {plan.changes.map((c, i) => (
              <Animated.View
                key={c.id}
                entering={FadeInDown.delay(i * 60).duration(260)}
                className={cn(
                  'min-h-14 flex-row items-center gap-3 px-4',
                  i > 0 && 'border-t border-line',
                )}
              >
                <Text className="flex-1 font-sans-semibold" numberOfLines={1}>
                  {c.title}
                </Text>
                <TimePill value={c.remindAt} />
              </Animated.View>
            ))}
            {plan.water !== null && (
              <View
                className={cn(
                  'min-h-14 flex-row items-center gap-3 px-4',
                  plan.changes.length > 0 && 'border-t border-line',
                )}
              >
                <Text className="flex-1 font-sans-semibold">Water sips</Text>
                <TimePill value={plan.water ? 'on' : null} />
              </View>
            )}
          </View>
          {save.isError && <Text className="text-sm text-danger">{save.error.message}</Text>}
        </Animated.View>
      ) : (
        <View className="gap-4">
          {/* Say it: the quickest way to set several at once. */}
          {/* Same height and inset as the rows below; the hint fits on one line. */}
          <View className="min-h-14 flex-row items-center gap-2 rounded-2xl bg-card py-1.5 pl-4 pr-1.5">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Walk at 7, water at 9…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={400}
              textAlignVertical="center"
              accessibilityLabel="Say which reminders you want"
              className="flex-1 py-2 font-sans text-base text-ink"
              style={{ includeFontPadding: false, maxHeight: 120 }}
            />
            <MicButton
              onText={(said) => {
                setText(said);
                ask(said);
              }}
              onProblem={toast}
            />
            <PressableScale
              onPress={() => ask()}
              disabled={!text.trim() || planner.isPending}
              accessibilityRole="button"
              accessibilityLabel="Plan these reminders"
              className={cn(
                'h-11 w-11 items-center justify-center rounded-full',
                text.trim() ? 'bg-primary' : 'bg-line',
              )}
            >
              <ArrowUp size={20} color="#fff" />
            </PressableScale>
          </View>
          {planner.isPending && <SkeletonBlock className="h-14 rounded-2xl" />}
          {planner.isError && (
            <Text className="-mt-3 text-sm text-danger">{planner.error.message}</Text>
          )}

          <View className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-card px-4">
            <Droplets size={20} color={colors.primary} />
            <Text className="flex-1 font-sans-semibold">Water sips</Text>
            <Switch
              value={water}
              disabled={save.isPending || !me.data}
              onValueChange={(v) => void apply([], v).catch((e: Error) => toast(e.message))}
              trackColor={{ true: colors.primary, false: colors.line }}
              thumbColor="#fff"
              accessibilityLabel="Water sip reminders"
            />
          </View>

          <View>
            {/* Inset like the rows, so the select-all box sits right above theirs. */}
            <Pressable
              onPress={toggleAll}
              disabled={!challenges.length}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allOn }}
              accessibilityLabel="Select all challenges"
              className="mb-1 min-h-11 flex-row items-center gap-3 self-start pl-4 pr-3"
            >
              <Box state={allOn ? 'on' : selected.size ? 'some' : 'off'} />
              <Text className="font-sans-semibold text-sm uppercase tracking-wider text-muted">
                Challenges
              </Text>
            </Pressable>

            {today.isPending && <SkeletonBlock className="h-40 rounded-2xl" />}
            {today.isSuccess && challenges.length === 0 && (
              <Text className="text-muted">No challenges yet.</Text>
            )}

            <View className="overflow-hidden rounded-2xl bg-card">
              {challenges.map((c, i) => (
                <View
                  key={c.id}
                  className={cn(
                    'min-h-14 flex-row items-center gap-3 pl-4 pr-2',
                    i > 0 && 'border-t border-line',
                  )}
                >
                  <Pressable
                    onPress={() => toggle(c.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected.has(c.id) }}
                    accessibilityLabel={nameOf(c)}
                    className="min-h-14 flex-1 flex-row items-center gap-3"
                  >
                    <Box state={selected.has(c.id) ? 'on' : 'off'} />
                    <Text className="flex-1 font-sans-semibold" numberOfLines={1}>
                      {nameOf(c)}
                    </Text>
                  </Pressable>
                  <TimePill
                    value={c.remindAt}
                    onPress={
                      Platform.OS === 'web' ? undefined : () => void setTime([c.id], c.remindAt)
                    }
                    label={nameOf(c)}
                  />
                </View>
              ))}
            </View>
          </View>
        </View>
      )}
    </DraggableSheet>
  );
}

/** A square checkbox: ticked, part-ticked (select all with some chosen), or empty. */
function Box({ state }: { state: 'on' | 'some' | 'off' }) {
  return (
    <View
      className={cn(
        'h-6 w-6 items-center justify-center rounded-md border-2',
        state === 'off' ? 'border-line bg-card' : 'border-primary bg-primary',
      )}
    >
      {state === 'on' && <Check size={14} strokeWidth={3} color="#fff" />}
      {state === 'some' && <Minus size={14} strokeWidth={3} color="#fff" />}
    </View>
  );
}
