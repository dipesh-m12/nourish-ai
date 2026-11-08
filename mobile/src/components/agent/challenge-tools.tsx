import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useToday } from '@/api/today';
import { ChallengeCard } from '@/components/dashboard/challenge-card';
import { ChallengePickerSheet } from '@/components/dashboard/challenge-picker-sheet';
import { MealSheet, type MealSheetRequest } from '@/components/dashboard/meal-sheet';
import { ProofSheet } from '@/components/dashboard/proof-sheet';
import { Button } from '@/components/ui/button';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import type { TodayChallenge } from '@/types/today';

/** Reads the same accepted challenges and stored widgets as the dashboard. */
export function ChallengeTools({ date }: { date: string }) {
  const today = useToday(date);
  const [proofFor, setProofFor] = useState<TodayChallenge | null>(null);
  const [mealFor, setMealFor] = useState<MealSheetRequest | null>(null);
  const [editing, setEditing] = useState(false);
  const challenges = today.data?.challenges ?? [];
  const rows: TodayChallenge[][] = [];
  for (let i = 0; i < challenges.length; i += 2) rows.push(challenges.slice(i, i + 2));

  const log = (challenge: TodayChallenge) => {
    if (challenge.logsVia === 'meal') {
      setMealFor({
        challengeId: challenge.id,
        challengeLabel: challenge.tracking.label ?? challenge.title,
      });
    } else {
      setProofFor(challenge);
    }
  };

  return (
    <View className="w-full gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text className="flex-1 font-sans-semibold">Your challenges</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh your challenges"
          disabled={today.isFetching}
          onPress={() => void today.refetch()}
          className="min-h-12 justify-center px-2"
        >
          <Text className="text-sm text-primary">{today.isFetching ? 'Updating…' : 'Refresh'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose your challenges"
          onPress={() => setEditing(true)}
          className="min-h-12 justify-center px-2"
        >
          <Text className="text-sm text-primary">Edit</Text>
        </Pressable>
      </View>
      {today.isPending ? (
        <SkeletonBlock className="h-48 rounded-3xl" />
      ) : today.isError ? (
        <View className="gap-3 rounded-2xl bg-card p-4">
          <Text className="text-sm text-muted">{today.error.message}</Text>
          <Button label="Try again" onPress={() => void today.refetch()} />
        </View>
      ) : challenges.length === 0 ? (
        <View className="gap-3 rounded-2xl bg-card p-4">
          <Text className="text-sm text-muted">Choose a few challenges to start your routine.</Text>
          <Button label="Choose challenges" onPress={() => setEditing(true)} />
        </View>
      ) : (
        rows.map((row) => (
          <View key={row.map((c) => c.id).join()} className="flex-row gap-3">
            {row.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} onLog={log} />
            ))}
            {row.length === 1 && <View className="flex-1" />}
          </View>
        ))
      )}
      <ProofSheet
        key={proofFor?.id ?? 'no-proof'}
        challenge={proofFor}
        date={date}
        onClose={() => setProofFor(null)}
      />
      <MealSheet request={mealFor} date={date} onClose={() => setMealFor(null)} />
      <ChallengePickerSheet
        visible={editing}
        onClose={() => setEditing(false)}
        onSaved={() => void today.refetch()}
      />
    </View>
  );
}
