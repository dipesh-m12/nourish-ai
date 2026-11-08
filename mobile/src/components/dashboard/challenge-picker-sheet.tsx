import { useState } from 'react';
import { View } from 'react-native';
import { useAcceptChallenges, useGeneratePlan, usePlan } from '@/api/plan';
import { ChallengeRow } from '@/components/plan/challenge-row';
import { Button } from '@/components/ui/button';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/store/toast';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Called after saving, so the dashboard can refresh. */
  onSaved: () => void;
}

/**
 * Pick (or change) challenges from the plan's AI suggestions, the same choice as at the end of
 * onboarding. If there's no plan yet (e.g. an older profile), it offers to create suggestions.
 */
export function ChallengePickerSheet({ visible, onClose, onSaved }: Props) {
  const plan = usePlan(visible);
  const generate = useGeneratePlan();
  const accept = useAcceptChallenges();
  const toast = useToast((s) => s.show);
  // null = untouched: show what's already accepted. Edits create an override until close/save.
  const [edited, setEdited] = useState<Set<string> | null>(null);

  const challenges = plan.data?.challenges ?? generate.data?.challenges ?? [];
  const noPlan = plan.error instanceof ApiError && plan.error.status === 404 && !generate.data;
  const picked = edited ?? new Set(challenges.filter((c) => c.accepted).map((c) => c.id));

  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setEdited(next);
  };

  const close = () => {
    setEdited(null);
    onClose();
  };

  const save = () =>
    accept.mutate([...picked], {
      onSuccess: () => {
        onSaved();
        close();
        toast(
          picked.size
            ? `${picked.size} challenge${picked.size > 1 ? 's' : ''} on your day`
            : 'Challenges cleared',
        );
      },
    });

  return (
    <DraggableSheet
      visible={visible}
      onClose={close}
      title="Your challenges"
      footer={
        challenges.length ? (
          <>
            {accept.isError && (
              <Text className="mb-2 text-center text-sm text-danger">{accept.error.message}</Text>
            )}
            <Button
              label={
                picked.size ? `Save ${picked.size} challenge${picked.size > 1 ? 's' : ''}` : 'Save'
              }
              onPress={save}
              loading={accept.isPending}
            />
          </>
        ) : undefined
      }
    >
      <Text className="mb-4 text-muted">Pick what you’ll take on. Start with two or three.</Text>

      {(plan.isPending || generate.isPending) && (
        <View>
          {generate.isPending && (
            <Text className="mb-3 text-sm text-muted">Finding challenges that fit you…</Text>
          )}
          <ChallengeRowsSkeleton />
        </View>
      )}

      {noPlan && !generate.isPending && (
        <View className="items-center gap-3 rounded-2xl bg-card p-5">
          <Text className="text-center">We haven’t suggested challenges for you yet.</Text>
          <Button
            className="self-stretch"
            label="Suggest challenges"
            onPress={() => generate.mutate()}
          />
          {generate.isError && (
            <Text className="text-sm text-danger">{generate.error.message}</Text>
          )}
        </View>
      )}

      <View className="gap-3">
        {challenges.map((c) => (
          <ChallengeRow
            key={c.id}
            challenge={c}
            selected={picked.has(c.id)}
            onToggle={() => toggle(c.id)}
          />
        ))}
      </View>
    </DraggableSheet>
  );
}

/** Placeholder rows in the shape of ChallengeRow (icon, two text lines, checkbox). */
function ChallengeRowsSkeleton() {
  return (
    <SkeletonGroup
      className="gap-3"
      accessible
      accessibilityLabel="Loading challenges"
      accessibilityState={{ busy: true }}
    >
      {[0, 1, 2, 3].map((i) => (
        <View key={i} className="flex-row gap-3 rounded-2xl border-2 border-line bg-card p-4">
          <SkeletonBlock className="h-10 w-10 rounded-xl" />
          <View className="flex-1 gap-2">
            <SkeletonBlock className="h-4 w-2/3" />
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-3 w-full" />
          </View>
          <SkeletonBlock className="h-6 w-6 rounded-md" />
        </View>
      ))}
    </SkeletonGroup>
  );
}
