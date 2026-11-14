import * as Haptics from 'expo-haptics';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Platform, View } from 'react-native';
import { useLogProgress } from '@/api/today';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { useToast } from '@/store/toast';
import type { LogResult, TodayChallenge } from '@/types/today';
import { SleepLog } from '@/components/formats/sleep-log';
import { TallyLog } from '@/components/formats/tally-log';
import { TimerLog } from '@/components/formats/timer-log';
import { WalkLog } from '@/components/formats/walk-log';
import { WaterLog } from '@/components/formats/water-log';
import { formatFor } from '@/utils/challenge-format';
import { AmountPicker } from './amount-picker';
import { fmt } from './challenge-widgets';

/**
 * Logging a challenge. No photo proof since 1.1: nobody competes, so nobody cheats, and the
 * photo was only friction. Done/not-done challenges log in one tap (useQuickLog); amount
 * challenges open this sheet to pick how much. Food challenges use the meal camera instead.
 */

/**
 * The challenge's "how it'll feel" line, when it is one ("steady energy all afternoon").
 * Older plan challenges carry a full sentence instead; those stay out of the toast.
 */
function feelLine(why: string) {
  const t = why.trim().replace(/\.$/, '');
  if (!t || t.split(/\s+/).length > 8 || /[.!?]/.test(t)) return null;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Finishing the day's goal is rewarded in feelings, not units (the reviewer's point). */
function doneText(challenge: TodayChallenge, result: Extract<LogResult, { verified: true }>) {
  const { kind, unit } = challenge.tracking;
  const { value, goal } = challenge.progress;
  const finishes = kind === 'check' || (value < goal && value + result.amount >= goal);
  const feel = finishes ? feelLine(challenge.why) : null;
  const progress = feel
    ? `Done · ${feel}`
    : kind === 'check'
      ? 'done for today'
      : `+${fmt(result.amount)}${unit ? ` ${unit}` : ''}`;
  return result.burned ? `${progress} · ${result.burned.calories} kcal burned` : progress;
}

/** One tap: logs a done/not-done challenge straight from its card. */
export function useQuickLog(date: string) {
  const log = useLogProgress(date);
  const toast = useToast((s) => s.show);
  return (challenge: TodayChallenge) =>
    log.mutate(
      { challengeId: challenge.id },
      {
        onSuccess: (result) => {
          if (!result.verified) return toast(result.note);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast(doneText(challenge, result));
        },
        onError: (err) => toast(err.message),
      },
    );
}

interface Props {
  challenge: TodayChallenge | null;
  date: string;
  onClose: () => void;
}

/**
 * Logging sheet, one interaction per format: water pours by the glass, timed habits run a
 * breathing session, other amounts pick "how much?". Check challenges never open it.
 */
export function LogSheet({ challenge, date, onClose }: Props) {
  const log = useLogProgress(date);
  const toast = useToast((s) => s.show);
  // null = untouched: one step's worth (the card's default "+0.25 L").
  const [chosen, setChosen] = useState<number | null>(null);
  const amount = chosen ?? challenge?.tracking.step ?? 1;
  // Sleep's time pickers are native dialogs; on web it falls back to "how much?".
  const native = challenge ? formatFor(challenge) : null;
  const format = native === 'sleep' && Platform.OS === 'web' ? 'amount' : native;

  const close = () => {
    if (log.isPending) return;
    setChosen(null);
    log.reset();
    onClose();
  };

  const submit = (value = amount) => {
    if (!challenge) return;
    log.mutate(
      { challengeId: challenge.id, amount: value },
      {
        onSuccess: (result) => {
          if (!result.verified) return toast(result.note);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast(doneText(challenge, result));
          close();
        },
        onError: (err) => toast(err.message),
      },
    );
  };

  return (
    <BottomSheet
      visible={Boolean(challenge)}
      onClose={close}
      title={challenge?.tracking.label ?? challenge?.title ?? ''}
    >
      {challenge && format === 'water' && (
        <View>
          <WaterLog challenge={challenge} date={date} onError={toast} />
          <Button className="mt-5" variant="secondary" label="Done" onPress={close} />
        </View>
      )}
      {challenge && format === 'timer' && (
        <TimerLog challenge={challenge} date={date} onDone={toast} onError={toast} />
      )}
      {challenge && format === 'walk' && (
        <WalkLog
          challenge={challenge}
          pending={log.isPending}
          error={log.error?.message ?? null}
          onStart={() => {
            const id = challenge.id;
            close();
            router.push({ pathname: '/walk', params: { id } } as Href);
          }}
          onLog={submit}
        />
      )}
      {challenge && format === 'place' && (
        <Button
          label="Open the map"
          onPress={() => {
            const id = challenge.id;
            close();
            router.push({ pathname: '/place', params: { id } } as Href);
          }}
        />
      )}
      {challenge && format === 'tally' && (
        <View>
          <TallyLog challenge={challenge} date={date} onError={toast} />
          <Button className="mt-6" variant="secondary" label="Done" onPress={close} />
        </View>
      )}
      {challenge && format === 'sleep' && (
        <SleepLog
          challenge={challenge}
          date={date}
          onDone={(m) => {
            toast(m);
            close();
          }}
          onError={toast}
        />
      )}
      {challenge && format === 'amount' && (
        <View>
          <AmountPicker challenge={challenge} value={amount} onChange={setChosen} />
          {log.error && <Text className="mt-3 text-sm text-danger">{log.error.message}</Text>}
          <Button
            className="mt-5"
            label="Log it"
            loading={log.isPending}
            onPress={() => submit()}
          />
        </View>
      )}
    </BottomSheet>
  );
}
