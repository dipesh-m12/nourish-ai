import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Camera, Check, ImageIcon, TriangleAlert } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, LinearTransition } from 'react-native-reanimated';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import {
  PhotoPermissionError,
  pickPhoto,
  PROOF_PHOTO,
  type Photo,
  type PhotoSource,
} from '@/lib/photo';
import type {
  ActivityCard,
  AgentAction,
  ChallengeCard,
  ChangeCard,
  MealCard,
  RemoveCard,
  SleepCard,
} from '@/types/agent';
import type { ConfirmInput } from '@/api/agent';
import { MealEstimate } from '@/components/dashboard/meal-estimate';
import { scaledItem, toEntry, type ItemEntry } from '@/utils/meal-items';
import { ChallengeAction } from './challenge-action';

const KIND_LABEL: Record<AgentAction['kind'], string> = {
  log_meal: 'Meal',
  log_activity: 'Workout',
  log_challenge: 'Challenge',
  log_sleep: 'Sleep',
  change_challenges: 'Your challenges',
  remove_last: 'Undo',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The diet/allergy note for one food on a meal card, if it has one. */
const conflictFor = (card: MealCard, name: string) =>
  card.conflicts.find((c) => c.item === name)?.message ?? null;

interface Props {
  action: AgentAction;
  date: string;
  initialPhoto?: Photo;
  /** Resolves to a note when the photo wasn't accepted (the card stays open). */
  onConfirm: (
    photo?: Photo,
    amount?: number,
    items?: ConfirmInput['items'],
  ) => Promise<string | null>;
  onCancel: () => Promise<void>;
}

/**
 * What the assistant wants to do, as a card the user can read before anything changes. Logs
 * need a photo first (the AI checks it, same as everywhere else in the app).
 */
export function ActionCard({ action, date, initialPhoto, onConfirm, onCancel }: Props) {
  // A newly analysed photo may arrive after the thread cache renders its card.
  const [pickedPhoto, setPhoto] = useState<Photo | null | undefined>(undefined);
  const photo = pickedPhoto === undefined ? (initialPhoto ?? null) : pickedPhoto;
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState<'confirm' | 'cancel' | 'photo' | null>(null);
  const [amount, setAmount] = useState<number | null>(null);
  const challengeCard =
    action.kind === 'log_challenge' ? (action.payload as unknown as ChallengeCard) : null;
  const chosenAmount = amount ?? challengeCard?.amount;
  const open = action.status === 'proposed';
  // A meal card is editable like the dashboard's meal sheet: same entries, same editor.
  const mealCard = action.kind === 'log_meal' ? (action.payload as unknown as MealCard) : null;
  const [entries, setEntries] = useState<ItemEntry[]>(() =>
    mealCard ? mealCard.items.map((i) => toEntry(i, conflictFor(mealCard, i.name))) : [],
  );
  const warnings = [...new Set(entries.flatMap((e) => (e.warning ? [e.warning] : [])))];
  const ready = (!action.needsPhoto || Boolean(photo)) && (!mealCard || entries.length > 0);

  const choose = async (source: PhotoSource) => {
    setNote(null);
    try {
      setWorking('photo');
      const p = await pickPhoto(source, PROOF_PHOTO);
      if (p) setPhoto(p);
    } catch (err) {
      setNote(err instanceof PhotoPermissionError ? err.message : 'Couldn’t open the photo.');
    } finally {
      setWorking(null);
    }
  };

  const confirm = async () => {
    setNote(null);
    setWorking('confirm');
    try {
      const items = mealCard
        ? entries.map(scaledItem).map(({ name, portion, proteinG, carbsG, fatG }) => ({
            name,
            portion,
            proteinG,
            carbsG,
            fatG,
          }))
        : undefined;
      const rejected = await onConfirm(photo ?? undefined, chosenAmount, items);
      if (rejected) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNote(rejected);
        setPhoto(null); // try a different one
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Something went wrong. Try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <Animated.View
      entering={FadeInDown.duration(320)}
      layout={LinearTransition.duration(220)}
      className="mt-2 w-full overflow-hidden rounded-2xl border border-line bg-card"
    >
      <View className="px-4 pb-3 pt-3.5">
        <Text className="font-sans-semibold text-xs uppercase tracking-wider text-muted">
          {KIND_LABEL[action.kind]}
        </Text>
        {challengeCard ? (
          <ChallengeAction
            card={challengeCard}
            date={date}
            amount={chosenAmount!}
            onAmount={setAmount}
            editable={open && working === null}
          />
        ) : mealCard && open ? (
          <View className="mt-1.5">
            <MealEstimate
              title={mealCard.title}
              entries={entries}
              comment={mealCard.comment}
              credits={mealCard.credits}
              warnings={warnings}
              onScale={(key, scale) =>
                setEntries((list) => list.map((e) => (e.key === key ? { ...e, scale } : e)))
              }
              onRemove={(key) => {
                const next = entries.filter((e) => e.key !== key);
                if (warnings.length && !next.some((e) => e.warning)) {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }
                setEntries(next);
              }}
              onAdd={(item, warning) => setEntries((list) => [...list, toEntry(item, warning)])}
            />
          </View>
        ) : (
          <CardBody action={action} />
        )}
      </View>

      {open && action.needsPhoto && (
        <View className="border-t border-line px-4 py-3">
          {photo ? (
            <Animated.View entering={FadeIn} className="flex-row items-center gap-3">
              <Image
                source={{ uri: `data:${photo.mimeType};base64,${photo.base64}` }}
                className="h-12 w-12 rounded-lg"
                contentFit="cover"
              />
              <Text className="flex-1 text-sm text-muted">
                Photo added. Our AI checks it when you confirm.
              </Text>
              <Pressable
                onPress={() => setPhoto(null)}
                disabled={working !== null}
                className="min-h-12 justify-center px-2"
                accessibilityRole="button"
                accessibilityLabel="Change photo"
              >
                <Text className="text-sm font-sans-semibold text-primary">Change</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View className="gap-2">
              <PhotoButton
                icon="camera"
                label="Take photo"
                onPress={() => choose('camera')}
                disabled={working !== null}
              />
              <PhotoButton
                icon="gallery"
                label="Gallery"
                onPress={() => choose('library')}
                disabled={working !== null}
              />
            </View>
          )}
        </View>
      )}

      {note && (
        <Animated.View
          entering={FadeIn}
          className="mx-4 mb-3 flex-row items-start gap-2 rounded-xl bg-accent-soft p-3"
        >
          <TriangleAlert size={14} color={colors.accent} />
          <Text className="flex-1 text-sm">{note}</Text>
        </Animated.View>
      )}

      {open ? (
        <View className="flex-row items-center justify-end gap-4 border-t border-line px-4 py-3">
          <Pressable
            onPress={async () => {
              setWorking('cancel');
              try {
                await onCancel();
              } catch (err) {
                setNote(err instanceof Error ? err.message : 'Couldn’t cancel. Please try again.');
              } finally {
                setWorking(null);
              }
            }}
            disabled={working !== null}
            className="min-h-12 justify-center px-2"
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text className="text-sm text-muted">Cancel</Text>
          </Pressable>
          <PressableScale
            onPress={confirm}
            disabled={!ready || working !== null}
            accessibilityRole="button"
            accessibilityLabel={action.kind === 'remove_last' ? 'Remove' : 'Confirm'}
            className={cn(
              'min-h-12 min-w-28 flex-row items-center justify-center gap-1.5 rounded-full px-5 py-3',
              action.kind === 'remove_last' ? 'bg-danger' : 'bg-ink',
              (!ready || working !== null) && 'opacity-40',
            )}
          >
            {working === 'confirm' ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text className="font-sans-semibold text-sm text-white">
                {action.kind === 'remove_last'
                  ? 'Remove'
                  : action.needsPhoto && !photo
                    ? 'Add a photo'
                    : 'Confirm'}
              </Text>
            )}
          </PressableScale>
        </View>
      ) : (
        <StatusRow status={action.status} />
      )}
    </Animated.View>
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'camera' | 'gallery';
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const Icon = icon === 'camera' ? Camera : ImageIcon;
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      containerClassName="w-full"
      accessibilityState={{ disabled }}
      className={cn(
        'min-h-14 flex-row items-center justify-center gap-3 rounded-xl bg-bg px-4 py-3',
        disabled && 'opacity-40',
      )}
    >
      <Icon size={22} color={colors.ink} />
      <Text className="font-sans-semibold">{label}</Text>
    </PressableScale>
  );
}

function StatusRow({ status }: { status: AgentAction['status'] }) {
  const done = status === 'confirmed';
  const label = done
    ? 'Done'
    : status === 'cancelled'
      ? 'Cancelled'
      : status === 'expired'
        ? 'Expired · ask again'
        : 'Didn’t go through';
  return (
    <View className="flex-row items-center gap-1.5 border-t border-line px-4 py-2.5">
      {done && <Check size={14} color={colors.primary} strokeWidth={3} />}
      <Text className={cn('text-sm', done ? 'font-sans-semibold text-primary' : 'text-muted')}>
        {label}
      </Text>
    </View>
  );
}

/** The numbers on each card come from the server (computed in code, never by the model). */
function CardBody({ action }: { action: AgentAction }) {
  // The payload's shape follows the kind; the server builds it.
  const p = action.payload as unknown;
  switch (action.kind) {
    case 'log_meal': {
      const m = p as MealCard;
      return (
        <View className="mt-1.5">
          <Text className="font-sans-semibold" numberOfLines={2}>
            {m.title}
          </Text>
          <View className="mt-2 gap-1">
            {m.items.map((i, n) => (
              <View key={n} className="flex-row items-baseline gap-2">
                <Text className="flex-1 text-sm" numberOfLines={1}>
                  {i.name} <Text className="text-sm text-muted">· {i.portion}</Text>
                </Text>
                <Text className="font-sans-semibold text-sm">{i.calories}</Text>
              </View>
            ))}
          </View>
          <View className="mt-2.5 flex-row items-baseline gap-1">
            <Text className="font-sans-semibold text-2xl">{m.totals.calories}</Text>
            <Text className="text-sm text-muted">
              kcal · P {m.totals.proteinG}g · C {m.totals.carbsG}g · F {m.totals.fatG}g
            </Text>
          </View>
          {m.conflicts.length > 0 && (
            <Text className="mt-2 text-sm text-accent">{m.conflicts[0]!.message}</Text>
          )}
        </View>
      );
    }
    case 'log_activity': {
      const a = p as ActivityCard;
      return (
        <Summary
          title={cap(a.label)}
          detail={a.minutes ? `${a.minutes} min` : `${a.calories} kcal from your tracker`}
          value={a.previewKcal}
          unit="kcal burned"
        />
      );
    }
    case 'log_sleep': {
      const z = p as SleepCard;
      return (
        <Summary
          title="Sleep"
          detail={`${z.hours} hours`}
          value={z.previewKcal}
          unit="kcal while asleep"
        />
      );
    }
    case 'change_challenges': {
      const ch = p as ChangeCard;
      return (
        <View className="mt-1.5 gap-1">
          {ch.accept.map((c) => (
            <Text key={c.id} className="text-sm">
              <Text className="font-sans-semibold text-primary">+ </Text>
              {c.title}
            </Text>
          ))}
          {ch.drop.map((c) => (
            <Text key={c.id} className="text-sm text-muted">
              <Text className="font-sans-semibold">− </Text>
              {c.title}
            </Text>
          ))}
        </View>
      );
    }
    case 'remove_last': {
      const r = p as RemoveCard;
      return (
        <Summary
          title={`Remove ${r.title}`}
          detail={r.target === 'meal' ? 'Meal' : 'Activity'}
          value={-r.calories}
          unit="kcal"
        />
      );
    }
    default:
      return null;
  }
}

function Summary({
  title,
  detail,
  value,
  unit,
}: {
  title: string;
  detail: string;
  value: number | null;
  unit: string;
}) {
  return (
    <View className="mt-1.5">
      <Text className="font-sans-semibold">{title}</Text>
      <Text className="text-sm text-muted">{detail}</Text>
      <View className="mt-2 flex-row items-baseline gap-1">
        {value !== null && <Text className="font-sans-semibold text-2xl">{value}</Text>}
        <Text className="text-sm text-muted">{unit}</Text>
      </View>
    </View>
  );
}
