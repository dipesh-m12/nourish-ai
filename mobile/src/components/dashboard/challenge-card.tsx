import { View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import type { TodayChallenge } from '@/types/today';
import { fmt, WIDGETS } from './challenge-widgets';

/** "+0.25 L", "+5 min", "Done". The proof photo is implied (the sheet explains it). */
function actionLabel(c: TodayChallenge) {
  const { kind, step, unit } = c.tracking;
  if (kind === 'check') return 'Done';
  return `+${fmt(step)}${unit ? ` ${unit}` : ''}`;
}

const shortLabel = (c: TodayChallenge) =>
  c.tracking.label ?? c.title.split(' ').slice(0, 2).join(' ');

interface Props {
  challenge: TodayChallenge;
  onLog: (challenge: TodayChallenge) => void;
}

/**
 * One challenge tile: tinted by category (no icons), a 1–2 word label, the AI-chosen chart,
 * and one action. Streak shows as a small "5d" only when there is one.
 */
export function ChallengeCard({ challenge: c, onLog }: Props) {
  const theme = CATEGORY_THEME[c.category];
  const Widget = WIDGETS[c.tracking.widget];
  const canLog = c.tracking.kind === 'amount' || !c.progress.done;
  const label = shortLabel(c);

  return (
    <View
      className="flex-1 justify-between gap-4 rounded-3xl p-4"
      style={{ backgroundColor: theme.tint }}
      accessible={false}
    >
      <View className="flex-row items-start justify-between gap-2">
        <Text className="flex-1 font-sans-semibold" numberOfLines={1}>
          {label}
        </Text>
        {c.progress.streak > 0 && (
          <View
            className="rounded-full bg-card/70 px-2 py-0.5"
            accessibilityLabel={`${c.progress.streak} day streak`}
          >
            <Text className="font-sans-semibold text-[11px]">{c.progress.streak}d</Text>
          </View>
        )}
      </View>

      <View
        accessible
        accessibilityLabel={`${c.title}: ${fmt(c.progress.value)} of ${fmt(c.progress.goal)}${
          c.tracking.unit ? ` ${c.tracking.unit}` : ''
        }${c.progress.missed ? `, missed ${c.progress.missed} days` : ''}`}
      >
        <Widget c={c} />
      </View>

      <PressableScale
        onPress={() => onLog(c)}
        disabled={!canLog}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel(c)} for ${c.title}. Needs a photo.`}
        // Ink pill on every tint: white-on-coral/mustard would fail 4.5:1 contrast.
        className={
          canLog
            ? 'h-10 items-center justify-center rounded-full bg-ink'
            : 'h-10 items-center justify-center rounded-full bg-card/60'
        }
      >
        <Text
          className={
            canLog
              ? 'font-sans-semibold text-sm text-white'
              : 'font-sans-semibold text-sm text-muted'
          }
        >
          {canLog ? actionLabel(c) : 'Done today'}
        </Text>
      </PressableScale>
    </View>
  );
}
