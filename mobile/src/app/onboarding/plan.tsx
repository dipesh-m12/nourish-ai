import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import { useGeneratePlan } from '@/api/plan';
import { useCompleteOnboarding } from '@/api/profiles';
import { BuildingPlan } from '@/components/plan/building-plan';
import { PlanReveal } from '@/components/plan/plan-reveal';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { toOnboardingPayload, useOnboarding } from '@/store/onboarding';

/**
 * Last onboarding step: save answers → AI writes the plan (with a waiting screen) → reveal,
 * where the user picks which challenges to take on.
 */
export default function PlanStep() {
  const { draft, reset } = useOnboarding();
  const complete = useCompleteOnboarding();
  const generate = useGeneratePlan();
  const started = useRef(false);
  const payload = toOnboardingPayload(draft);

  const buildPlan = () => generate.mutate();
  const saveAndBuild = () => {
    if (!payload) return;
    complete.mutate(payload, { onSuccess: buildPlan });
  };

  useEffect(() => {
    if (started.current) return; // run once, even if React mounts the effect twice
    started.current = true;
    saveAndBuild();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!payload) {
    // Draft was lost (e.g. storage cleared): restart instead of showing a broken screen.
    return (
      <Problem
        title="Some answers are missing"
        body="Let’s go through the questions once more."
        action={{ label: 'Start again', onPress: () => router.replace('/onboarding/about') }}
      />
    );
  }

  if (complete.isError) {
    return (
      <Problem
        title="We couldn’t save your answers"
        body={complete.error.message}
        action={{ label: 'Try again', onPress: saveAndBuild }}
        secondary={{ label: 'Edit my answers', onPress: () => router.back() }}
      />
    );
  }

  if (generate.isError) {
    return (
      <Problem
        title="We couldn’t build your plan"
        body={generate.error.message}
        action={{ label: 'Try again', onPress: buildPlan }}
      />
    );
  }

  if (!generate.data) return <BuildingPlan name={complete.data?.name} />;

  return (
    <PlanReveal
      name={complete.data?.name ?? ''}
      plan={generate.data}
      onDone={() => {
        reset();
        router.replace('/dashboard');
      }}
    />
  );
}

interface ProblemProps {
  title: string;
  body: string;
  action: { label: string; onPress: () => void };
  secondary?: { label: string; onPress: () => void };
}

function Problem({ title, body, action, secondary }: ProblemProps) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Heading className="text-center text-2xl">{title}</Heading>
      <Text className="mt-2 text-center text-muted">{body}</Text>
      <Button className="mt-6 self-stretch" label={action.label} onPress={action.onPress} />
      {secondary && (
        <Button
          className="mt-2 self-stretch"
          variant="ghost"
          label={secondary.label}
          onPress={secondary.onPress}
        />
      )}
    </View>
  );
}
