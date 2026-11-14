import { Ellipsis } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CATEGORY_THEME } from '@/constants/category-theme';
import { colors } from '@/constants/colors';
import type { TodayChallenge } from '@/types/today';
import { formatFor } from '@/utils/challenge-format';
import { daysBetween, localDate } from '@/utils/date';
import { fmt, WIDGETS } from './challenge-widgets';

/** The one button says what it opens: Pour, Start, Start walk, Log night, +1, Done. */
function actionLabel(c: TodayChallenge) {
  const { step, unit } = c.tracking;
  if (c.logsVia === 'meal') return 'Snap';
  // Left running when the app closed: pick it back up.
  if (c.session) return c.session.kind === 'walk' ? 'Resume walk' : 'Resume';
  switch (formatFor(c)) {
    case 'check':
      return 'Done';
    case 'water':
      return 'Pour';
    case 'timer':
      return /breath|pranayam/i.test(c.title) ? 'Breathe' : 'Start';
    case 'walk':
      return 'Start walk';
    case 'place':
      return c.place ? 'Check in' : 'Pin place';
    case 'sleep':
      return 'Log night';
    case 'tally':
      return '+1';
    default:
      return `+${fmt(step)}${unit ? ` ${unit}` : ''}`;
  }
}

/** "Last day" / "2 days left" only when the end is close; nothing earlier, nothing for ongoing. */
function endsLabel(endsOn: string | null) {
  if (!endsOn) return null;
  const left = daysBetween(localDate(), endsOn);
  if (left < 0 || left > 1) return null;
  return left === 0 ? 'Last day' : `${left + 1} days left`;
}

/** Fits the tallest widget (number + 7 bars) with the title, its note and the button. */
const CARD_HEIGHT = 256;

const shortLabel = (c: TodayChallenge) =>
  c.tracking.label ?? c.title.split(' ').slice(0, 2).join(' ');

interface Props {
  challenge: TodayChallenge;
  onLog: (challenge: TodayChallenge) => void;
  /** Change or remove challenges. Kept apart from logging so a tap never means both. */
  onEdit?: (challenge: TodayChallenge) => void;
}

/**
 * One challenge tile: tinted by category (no icons), a 1–2 word label, the AI-chosen chart,
 * and one action. Streak shows as a small "5d" only when there is one. Editing lives behind ⋯.
 */
export function ChallengeCard({ challenge: c, onLog, onEdit }: Props) {
  const theme = CATEGORY_THEME[c.category];
  const Widget = WIDGETS[c.tracking.widget];
  const canLog = Boolean(c.session) || c.tracking.kind === 'amount' || !c.progress.done;
  const label = shortLabel(c);
  // One quiet note at most: the end date matters more than the streak.
  const note =
    endsLabel(c.endsOn) ?? (c.progress.streak > 1 ? `${c.progress.streak} day streak` : null);

  return (
    <View
      className="flex-1 justify-between gap-3 rounded-3xl p-4"
      // One fixed height for every card (the tallest widget's): a row never jumps, and short
      // widgets (a ring, a tick) sit centred instead of shrinking the card.
      style={{ backgroundColor: theme.tint, height: CARD_HEIGHT }}
      accessible={false}
    >
      <View className="flex-row items-start justify-between gap-2">
        <View className="flex-1">
          <Text className="font-sans-semibold" numberOfLines={1}>
            {label}
          </Text>
          {note && <Text className="text-xs text-muted">{note}</Text>}
        </View>
        {onEdit && (
          <Pressable
            onPress={() => onEdit(c)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${c.title}`}
            className="-mr-1 -mt-0.5 h-6 w-6 items-center justify-center"
          >
            <Ellipsis size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      <View
        className="flex-1 justify-center"
        accessible
        accessibilityLabel={`${note ? `${note}. ` : ''}${c.title}: ${fmt(c.progress.value)} of ${fmt(c.progress.goal)}${
          c.tracking.unit ? ` ${c.tracking.unit}` : ''
        }${c.progress.missed ? `, missed ${c.progress.missed} days` : ''}`}
      >
        <Widget c={c} />
      </View>

      <PressableScale
        onPress={() => onLog(c)}
        disabled={!canLog}
        accessibilityRole="button"
        accessibilityLabel={`${actionLabel(c)}: ${c.title}`}
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
