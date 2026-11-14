import Constants from 'expo-constants';
import { type Href, Redirect, router } from 'expo-router';
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Compass,
  LogOut,
  MessageSquareWarning,
  Trash2,
  type LucideIcon,
  PawPrint,
  Sparkles,
  UserRound,
} from 'lucide-react-native';
import { Children, type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Switch, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSubscription } from '@/api/subscription';
import { useToday } from '@/api/today';
import type { SubscriptionSummary } from '@/types/subscription';
import { CatFace } from '@/components/companion/cat-face';
import { localDate } from '@/utils/date';
import { useDeleteAccount, useMe, useSetShowAgent } from '@/api/profiles';
import { AvatarSheet } from '@/components/avatar-sheet';
import { FeedbackSheet } from '@/components/feedback-sheet';
import { RemindersSheet } from '@/components/challenges/reminders-sheet';
import { ProfileAvatar } from '@/components/profile-avatar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { GOAL_OPTIONS } from '@/constants/onboarding';
import { DetailsSheet } from '@/components/profile/details-sheet';
import { cn } from '@/lib/cn';
import { useSession } from '@/store/session';
import { useToast } from '@/store/toast';

type Pending = 'logout' | 'delete' | null;

/** Developer section (404 preview). Off for the demo; set true to bring it back in dev builds. */
const SHOW_DEV_TOOLS = false as boolean;

const labelOf = <T extends string>(options: { value: T; label: string }[], value: T | null) =>
  options.find((o) => o.value === value)?.label ?? '—';

/** Leaves the signed-in area entirely and lands on the profile picker with a fresh stack. */
function goToPicker() {
  if (router.canDismiss()) router.dismissAll();
  router.replace('/');
}

export default function ProfileScreen() {
  const { data: profile, isPending } = useMe();
  const signOut = useSession((s) => s.signOut);
  const deleteAccount = useDeleteAccount();
  const toast = useToast((s) => s.show);
  const setShowAgent = useSetShowAgent();
  const billing = useSubscription().data;
  // Mochi's status and mood come with today's data (cached from the dashboard).
  const companion = useToday(localDate()).data?.companion;
  const [pending, setPending] = useState<Pending>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const token = useSession((s) => s.token);
  // Set while we deliberately leave, so the unexpected-sign-out redirect below doesn't race us.
  const [leaving, setLeaving] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const logOut = async () => {
    setLeaving(true);
    setPending(null);
    await signOut();
    goToPicker();
    toast('Logged out');
  };

  // `leaving` is set up front: the hook signs out on success before these callbacks run.
  const confirmDelete = () => {
    setLeaving(true);
    deleteAccount.mutate(undefined, {
      onSuccess: () => {
        setPending(null);
        goToPicker();
        toast('Account deleted');
      },
      onError: () => setLeaving(false),
    });
  };

  // Signed out underneath us (e.g. a 401 from an expired or deleted session).
  if (!token && !leaving) return <Redirect href="/" />;

  if (isPending || !profile) {
    return (
      <View className="flex-1 items-center justify-center bg-bg">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg">
      <View className="flex-row items-center px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerClassName="px-6 pb-10" showsVerticalScrollIndicator={false}>
        <View className="items-center pb-8 pt-2">
          <Animated.View entering={ZoomIn.duration(300)}>
            <Pressable
              onPress={() => setAvatarOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo"
              className="items-center active:opacity-80"
            >
              <ProfileAvatar
                name={profile.name}
                color={profile.avatarColor}
                imageUrl={profile.avatarUrl}
                imageKey={profile.avatarKey}
                club={profile.club}
                size={88}
              />
              <Text className="mt-2 font-sans-semibold text-sm text-primary">
                {profile.avatarUrl ? 'Change photo' : 'Add photo'}
              </Text>
            </Pressable>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(80).duration(350)}>
            <Heading className="mt-4 text-center">{profile.name}</Heading>
            {profile.goal && (
              <Text className="mt-1 text-center text-muted">
                {labelOf(GOAL_OPTIONS, profile.goal.type)} · {profile.goal.dailyCalories} kcal
              </Text>
            )}
          </Animated.View>
        </View>

        <Section delay={140}>
          <ActionRow
            icon={UserRound}
            label="Your details"
            hint="Body, diet, goal"
            onPress={() => setDetailsOpen(true)}
          />
          <Pressable
            onPress={() => router.push('/club')}
            accessibilityRole="button"
            accessibilityLabel="Your plan"
            className="flex-row items-center gap-3 px-4 py-3.5 active:bg-bg"
          >
            <Sparkles size={20} color={billing?.premium ? colors.primary : colors.ink} />
            <View className="flex-1">
              <Text className="font-sans-medium">
                {billing?.premium ? 'Mochi’s Club' : 'Free plan'}
              </Text>
              <Text className="text-sm text-muted" numberOfLines={1}>
                {planLine(billing)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.muted} />
          </Pressable>
          {companion?.status === 'adopted' || companion?.status === 'left' ? (
            <Pressable
              onPress={() => router.push('/adopt')}
              accessibilityRole="button"
              accessibilityLabel={`${companion.name}: ${companion.line ?? ''}`}
              className="flex-row items-center gap-3 px-4 py-3 active:bg-bg"
            >
              <CatFace mood={companion.mood ?? 'normal'} size={36} />
              <Text className="flex-1 font-sans-medium">{companion.name}</Text>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ) : (
            <ActionRow icon={PawPrint} label="Adopt a cat" onPress={() => router.push('/adopt')} />
          )}
        </Section>

        <Section title="Settings" delay={220}>
          <ToggleRow
            label="Nourish on dashboard"
            // Always the saved value: the switch only moves once the server confirms.
            value={Boolean(profile.showAgent)}
            busy={setShowAgent.isPending}
            onChange={(v) =>
              setShowAgent.mutate(v, {
                onSuccess: () => toast(v ? 'Nourish is on your dashboard' : 'Nourish hidden'),
                onError: (err) => toast(err.message),
              })
            }
          />
          <ActionRow icon={Bell} label="Reminders" onPress={() => setRemindersOpen(true)} />
          <ActionRow
            icon={MessageSquareWarning}
            label="Send feedback"
            onPress={() => setFeedbackOpen(true)}
          />
        </Section>

        <Section delay={300}>
          <ActionRow icon={LogOut} label="Log out" onPress={() => setPending('logout')} />
          <ActionRow
            icon={Trash2}
            label="Delete account"
            destructive
            onPress={() => setPending('delete')}
          />
        </Section>

        {/* A quick way to preview the 404 screen and its PostHog error. Hidden for now; flip to show in dev. */}
        {SHOW_DEV_TOOLS && __DEV__ && (
          <Section title="Developer" delay={400}>
            <ActionRow
              icon={Compass}
              label="Open a missing page"
              onPress={() => router.push('/this-page-does-not-exist' as Href)}
            />
          </Section>
        )}

        <Pressable
          onPress={() => router.push('/whats-new')}
          accessibilityRole="button"
          accessibilityLabel="What's new in this version"
          className="mt-10 self-center py-2"
        >
          <Text className="text-center text-xs text-muted">
            Nourish AI · v{Constants.expoConfig?.version ?? '1.0.0'} ·{' '}
            <Text className="text-xs text-primary">What’s new</Text>
          </Text>
        </Pressable>
      </ScrollView>

      <DetailsSheet visible={detailsOpen} profile={profile} onClose={() => setDetailsOpen(false)} />
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
      <RemindersSheet
        visible={remindersOpen}
        date={localDate()}
        onClose={() => setRemindersOpen(false)}
      />
      <AvatarSheet visible={avatarOpen} profile={profile} onClose={() => setAvatarOpen(false)} />
      <ConfirmDialog
        visible={pending === 'logout'}
        title="Log out?"
        message="You can pick your profile again anytime from the welcome screen."
        confirmLabel="Log out"
        onConfirm={logOut}
        onCancel={() => setPending(null)}
      />
      <ConfirmDialog
        visible={pending === 'delete'}
        title="Delete your account?"
        message={`${profile.name}'s profile, plan and challenges will be removed from this app. This can't be undone.`}
        confirmLabel="Delete account"
        destructive
        loading={deleteAccount.isPending}
        error={deleteAccount.error?.message}
        onConfirm={confirmDelete}
        onCancel={() => {
          deleteAccount.reset();
          setPending(null);
        }}
      />
    </SafeAreaView>
  );
}

/** One line under the plan name: what's next for this user's billing. */
function planLine(s?: SubscriptionSummary) {
  if (!s) return '…';
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' }) : '';
  if (s.premium && s.current) {
    return s.current.autoRenew
      ? `Renews ${date(s.current.nextBillAt)}`
      : `Autopay off · until ${date(s.current.nextBillAt)}`;
  }
  return 'Unlimited Nourish in Mochi’s Club';
}

function Section({
  title,
  delay,
  children,
}: {
  title?: string;
  delay: number;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(delay).duration(350)} className="mb-6">
      {title && (
        <Text className="mb-2 px-1 font-sans-semibold text-sm uppercase tracking-wider text-muted">
          {title}
        </Text>
      )}
      {/* Grouped list: one card, rows divided by hairlines (settings pattern). */}
      <View className="overflow-hidden rounded-2xl bg-card">
        {Children.toArray(children).map((child, i) => (
          <View key={i}>
            {i > 0 && <View className="ml-4 h-px bg-line" />}
            {child}
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

/** A settings row with a switch (sage when on). */
function ToggleRow({
  label,
  value,
  busy,
  onChange,
}: {
  label: string;
  value: boolean;
  busy: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Text className="flex-1 font-sans-medium">{label}</Text>
      {/* While saving: locked and greyed, like any disabled control in the app. */}
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={busy}
        trackColor={{ false: colors.line, true: busy ? colors.muted : colors.primary }}
        thumbColor={busy ? colors.line : '#fff'}
        style={{ opacity: busy ? 0.5 : 1 }}
        accessibilityLabel={label}
        accessibilityState={{ disabled: busy, checked: value }}
      />
    </View>
  );
}

function ActionRow({
  icon: Icon,
  label,
  hint,
  destructive,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  hint?: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  const tint = destructive ? colors.danger : colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 px-4 py-4 active:bg-bg"
    >
      <Icon size={20} color={tint} />
      <View className="flex-1">
        <Text className={cn('font-sans-medium', destructive && 'text-danger')}>{label}</Text>
        {hint && <Text className="text-sm text-muted">{hint}</Text>}
      </View>
      {!destructive && <ChevronRight size={18} color={colors.muted} />}
    </Pressable>
  );
}
