import { View } from 'react-native';
import { useToday } from '@/api/today';
import { AmountPicker } from '@/components/dashboard/amount-picker';
import { fmt, WIDGETS } from '@/components/dashboard/challenge-widgets';
import { Text } from '@/components/ui/text';
import type { ChallengeCard } from '@/types/agent';

interface Props {
  card: ChallengeCard;
  date: string;
  amount: number;
  onAmount: (value: number) => void;
  editable: boolean;
}

/** The widget and amount controls follow the stored tracking spec, exactly as on the dashboard. */
export function ChallengeAction({ card, date, amount, onAmount, editable }: Props) {
  const today = useToday(date);
  const challenge = today.data?.challenges.find((c) => c.id === card.challengeId) ?? card.challenge;
  const Widget = challenge ? WIDGETS[challenge.tracking.widget] : null;

  return (
    <View className="mt-2 gap-2">
      <Text className="font-sans-semibold">{card.label}</Text>
      <Text className="text-sm text-muted">
        {challenge?.frequency === 'weekly' ? 'This week' : 'Today'}
      </Text>
      {challenge && Widget ? (
        <View
          accessible
          accessibilityLabel={`${card.label}: ${fmt(challenge.progress.value)} of ${fmt(challenge.progress.goal)} ${challenge.tracking.unit ?? ''}`}
        >
          <Widget c={challenge} />
        </View>
      ) : (
        <Text className="text-sm text-muted">
          {fmt(card.progress.value)} of {fmt(card.progress.goal)}
        </Text>
      )}
      {challenge && editable && challenge.tracking.kind === 'amount' ? (
        <AmountPicker challenge={challenge} value={amount} onChange={onAmount} />
      ) : (
        <Text className="text-sm">
          {card.check
            ? 'Mark as done after photo verification'
            : `Add ${fmt(amount)} ${card.unit ?? ''}`.trim()}
        </Text>
      )}
      {editable && challenge && (
        <Text className="text-sm text-muted">Photo proof: {challenge.tracking.proof}.</Text>
      )}
    </View>
  );
}
