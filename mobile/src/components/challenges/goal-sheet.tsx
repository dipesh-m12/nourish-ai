import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  Camera,
  Check,
  ChevronRight,
  FileText,
  ImagePlus,
  ListChecks,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useCreateChallenges, useProposeChallenges, type ProposeResult } from '@/api/challenges';
import { useToday } from '@/api/today';
import { SuggestedChallenges } from '@/components/dashboard/suggested-challenges';
import { Button } from '@/components/ui/button';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { MicButton } from '@/components/ui/mic-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import {
  PROOF_PHOTO,
  PhotoPermissionError,
  pickPhoto,
  type Photo,
  type PhotoSource,
} from '@/lib/photo';
import { pickReport, ReportTooBigError, type Report } from '@/lib/report';
import { useToast } from '@/store/toast';
import { ExpiryChips } from './expiry-chips';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
  /** Opens the list of running challenges (view, add back, remove). */
  onManage?: () => void;
}

interface Draft {
  keep: boolean;
  /** undefined = the user still has to say how long. */
  endsOn: string | null | undefined;
}

/**
 * "What do you want to achieve?" Say it, type it, or show a photo (a report, a plate).
 * The PA proposes 1–3 challenges with how they'll feel; the user keeps some and says how long.
 */
export function GoalSheet({ visible, date, onClose, onManage }: Props) {
  const active = useToday(date).data?.challenges ?? [];
  const propose = useProposeChallenges();
  const create = useCreateChallenges();
  const toast = useToast((s) => s.show);
  const [text, setText] = useState('');
  // A camera photo, or a report (PDF or image) from the file picker.
  const [photo, setPhoto] = useState<Photo | Report | null>(null);
  const [result, setResult] = useState<ProposeResult | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);

  const reset = () => {
    setText('');
    setPhoto(null);
    setResult(null);
    setDrafts([]);
    propose.reset();
    create.reset();
  };
  const close = () => {
    reset();
    onClose();
  };

  const send = (said = text) => {
    const words = said.trim();
    if (!words && !photo) return;
    propose.mutate(
      { date, ...(words && { text: words }), ...(photo && { image: photo }) },
      {
        onSuccess: (r) => {
          setResult(r);
          setDrafts(r.proposals.map((p) => ({ keep: true, endsOn: p.ask ? undefined : p.endsOn })));
        },
      },
    );
  };

  const chooseReport = async () => {
    try {
      const r = await pickReport();
      if (r) setPhoto(r);
    } catch (err) {
      toast(err instanceof ReportTooBigError ? err.message : 'Couldn’t open that file.');
    }
  };

  const choose = async (source: PhotoSource) => {
    try {
      const p = await pickPhoto(source, PROOF_PHOTO);
      if (p) setPhoto(p);
    } catch (err) {
      toast(err instanceof PhotoPermissionError ? err.message : 'Couldn’t open the photo.');
    }
  };

  const kept = result ? result.proposals.filter((_, i) => drafts[i]?.keep) : [];
  const missingExpiry = drafts.some((d) => d.keep && d.endsOn === undefined);
  // The shared choice shows as selected only when every kept idea has the same end.
  const keptEnds = [...new Set(drafts.filter((d) => d.keep).map((d) => d.endsOn))];
  const sharedEnd = keptEnds.length === 1 ? keptEnds[0] : undefined;

  const save = () => {
    if (!result) return;
    const items = result.proposals.flatMap(({ ask: _ask, ...p }, i) =>
      drafts[i]?.keep ? [{ ...p, endsOn: drafts[i]!.endsOn ?? null }] : [],
    );
    create.mutate(
      { date, items },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          toast(items.length > 1 ? `${items.length} challenges on your day` : 'On your day');
          close();
        },
      },
    );
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  const reviewing = result !== null;

  return (
    <DraggableSheet
      visible={visible}
      onClose={close}
      tall
      title={reviewing ? (result?.reply ?? 'Here’s a start') : 'What do you want to achieve?'}
      footer={
        reviewing ? (
          <View className="gap-2">
            {create.isError && (
              <Text className="text-center text-sm text-danger">{create.error.message}</Text>
            )}
            {kept.length > 0 ? (
              <Button
                label={
                  missingExpiry
                    ? 'Pick how long'
                    : `Start ${kept.length === 1 ? 'it' : `all ${kept.length}`}`
                }
                onPress={save}
                disabled={missingExpiry}
                loading={create.isPending}
              />
            ) : (
              <Button label="Try something else" onPress={() => setResult(null)} />
            )}
          </View>
        ) : (
          <View className="gap-2">
            {propose.isError && (
              <Text className="text-center text-sm text-danger">{propose.error.message}</Text>
            )}
            <Button
              label="Plan it"
              onPress={() => send()}
              disabled={!text.trim() && !photo}
              loading={propose.isPending}
            />
          </View>
        )
      }
    >
      {!reviewing ? (
        <Animated.View entering={FadeIn.duration(250)} className="gap-4">
          {active.length > 0 && onManage && (
            <Pressable
              onPress={onManage}
              accessibilityRole="button"
              accessibilityLabel={`Your challenges, ${active.length}. View or change`}
              className="min-h-14 flex-row items-center gap-3 rounded-2xl bg-card px-4 active:opacity-80"
            >
              <ListChecks size={20} color={colors.ink} />
              <Text className="flex-1 font-sans-semibold">Your challenges</Text>
              <Text className="text-muted">{active.length}</Text>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          )}

          <View className="rounded-3xl bg-card p-4">
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Say it, type it, or add a report…"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={600}
              textAlignVertical="top"
              accessibilityLabel="What do you want to achieve?"
              className="min-h-20 font-sans text-base leading-6 text-ink"
              style={{ includeFontPadding: false }}
            />
            {photo && (
              <View className="mt-3 self-start">
                {photo.mimeType === 'application/pdf' ? (
                  <View
                    className="items-center justify-center gap-1 rounded-xl bg-accent-soft"
                    // Exact size as a style: arbitrary size classes get dropped (the tile shrank).
                    style={{ width: 72, height: 72 }}
                    accessibilityLabel="PDF report you added"
                  >
                    <FileText size={24} color={colors.accent} />
                    <Text className="text-[10px] font-sans-semibold">PDF</Text>
                  </View>
                ) : (
                  <Image
                    source={{ uri: `data:${photo.mimeType};base64,${photo.base64}` }}
                    style={{ width: 72, height: 72, borderRadius: 12 }}
                    contentFit="cover"
                    accessibilityLabel="Photo you added"
                  />
                )}
                <Pressable
                  onPress={() => setPhoto(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Remove photo"
                  className="absolute -right-2 -top-2 h-6 w-6 items-center justify-center rounded-full bg-ink"
                >
                  <X size={14} color="#fff" />
                </Pressable>
              </View>
            )}
            <View className="mt-3 flex-row items-center gap-2">
              <MicButton
                onText={(said) => setText((t) => (t ? `${t} ${said}` : said))}
                onProblem={toast}
              />
              <IconButton label="Take a photo" onPress={() => void choose('camera')}>
                <Camera size={20} color={colors.ink} />
              </IconButton>
              <IconButton label="Add a photo or report" onPress={() => void choose('library')}>
                <ImagePlus size={20} color={colors.ink} />
              </IconButton>
              <IconButton
                label="Add a health report, PDF or image"
                onPress={() => void chooseReport()}
              >
                <FileText size={20} color={colors.ink} />
              </IconButton>
            </View>
          </View>

          <SuggestedChallenges active={active} />
        </Animated.View>
      ) : (
        <View className="gap-3">
          {result.full && (
            <Text className="text-sm text-danger">Your day is full. Finish one to add more.</Text>
          )}
          {/* Each idea: name and amount on one line, how it'll feel under it. Tap to keep/drop. */}
          {result.proposals.map((p, i) => {
            const d = drafts[i];
            return (
              <Animated.View
                key={`${p.title}-${i}`}
                entering={FadeInDown.delay(i * 80).duration(300)}
              >
                <Pressable
                  onPress={() => update(i, { keep: !d?.keep })}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: d?.keep }}
                  accessibilityLabel={`${p.title}, ${p.target}. ${p.why}`}
                  className={cn(
                    'flex-row items-center gap-3 rounded-2xl border-2 bg-card px-4 py-3.5',
                    d?.keep ? 'border-primary' : 'border-line opacity-60',
                  )}
                >
                  <View className="flex-1">
                    <Text className="font-sans-semibold text-base" numberOfLines={1}>
                      {p.title}{' '}
                      <Text className="font-sans-medium text-primary-dark">· {p.target}</Text>
                    </Text>
                    <Text className="text-sm text-muted" numberOfLines={1}>
                      {p.why}
                    </Text>
                  </View>
                  <View
                    className={cn(
                      'h-6 w-6 items-center justify-center rounded-md border-2',
                      d?.keep ? 'border-primary bg-primary' : 'border-line',
                    )}
                  >
                    {d?.keep && <Check size={14} strokeWidth={3} color="#fff" />}
                  </View>
                </Pressable>
              </Animated.View>
            );
          })}

          {/* One "how long" for everything kept, not a chip row per card. */}
          {kept.length > 0 && (
            <View className="mt-2">
              <Text className="mb-2 px-1 font-sans-semibold text-xs uppercase tracking-wider text-muted">
                How long
              </Text>
              <ExpiryChips
                today={date}
                value={sharedEnd}
                onChange={(endsOn) =>
                  setDrafts((all) => all.map((x) => (x.keep ? { ...x, endsOn } : x)))
                }
              />
            </View>
          )}

          <Pressable
            onPress={() => setResult(null)}
            accessibilityRole="button"
            accessibilityLabel="Say something else"
            className="min-h-11 items-center justify-center self-center"
          >
            <Text className="font-sans-semibold text-sm text-primary">Say something else</Text>
          </Pressable>
        </View>
      )}
    </DraggableSheet>
  );
}

function IconButton({
  label,
  onPress,
  children,
}: {
  label: string;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <PressableScale
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-11 w-11 items-center justify-center rounded-full bg-bg"
    >
      {children}
    </PressableScale>
  );
}
