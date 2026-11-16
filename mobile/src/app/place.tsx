import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronLeft, Search } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, Switch, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSetPlace } from '@/api/challenges';
import { useLogProgress, useToday } from '@/api/today';
import { PlaceMap } from '@/components/formats/place-map';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import {
  autoCheckInOn,
  disableAutoCheckIn,
  enableAutoCheckIn,
  syncGeofences,
} from '@/lib/place-task';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { searchPlaces } from '@/lib/place-search';
import { localDate } from '@/utils/date';
import { formatDistance, metresBetween, type LngLat } from '@/utils/geo';

const STAMP = require('@/assets/images/world/flower-bloom.webp');

/**
 * "Get there" challenges (gym, park, temple): pin the spot once (tap it on the map, or use where
 * you stand), then the map shows how far you are, and Check in unlocks when you're there.
 * Showing up is the whole habit.
 */
export default function PlaceScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const date = localDate();
  const today = useToday(date);
  const challenge = today.data?.challenges.find((c) => c.id === id);
  const [auto, setAuto] = useState(false);
  const setPlace = useSetPlace();
  const log = useLogProgress(date);
  const [here, setHere] = useState<LngLat | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** A spot tapped on the map (or found by search), waiting for "Pin here". */
  const [draft, setDraft] = useState<LngLat | null>(null);
  /** Where the map flies to (a search result). */
  const [focus, setFocus] = useState<LngLat | null>(null);
  const [query, setQuery] = useState('');
  const typed = useDebouncedValue(query.trim(), 400);
  const search = useQuery({
    queryKey: ['place-search', typed],
    queryFn: () => searchPlaces(typed, here ?? place),
    enabled: typed.length >= 3,
    staleTime: 5 * 60_000,
    retry: false,
  });
  const doneToday = challenge?.progress.done === true;

  const place: LngLat | null = challenge?.place ? [challenge.place.lng, challenge.place.lat] : null;
  const radius = challenge?.place?.radiusM ?? 150;
  const away = place && here ? metresBetween(here, place) : null;
  const arrived = away !== null && away <= radius;

  // Follow the phone while this screen is open (foreground only).
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let live = true;
    void Location.requestForegroundPermissionsAsync().then(async (p) => {
      if (!live) return;
      setAllowed(p.granted);
      if (!p.granted) return;
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 4000 },
        ({ coords }) => live && setHere([coords.longitude, coords.latitude]),
      );
    });
    return () => {
      live = false;
      sub?.remove();
    };
  }, []);

  /** Saves the pin (a tapped spot or where you stand). */
  const pin = (at: LngLat | null) => {
    if (!challenge || !at) return;
    setPlace.mutate(
      { id: challenge.id, place: { lat: at[1], lng: at[0], radiusM: 150 } },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDraft(null);
          setFocus(null);
          setNote(null);
          // Auto check-in watches the old spot until the regions are refreshed.
          void today.refetch().then((r) => r.data && syncGeofences(r.data.challenges));
        },
        onError: (e) => setNote(e.message),
      },
    );
  };

  // Auto check-in (geofence) needs "Allow all the time": asked only when switched on.
  useEffect(() => {
    void autoCheckInOn().then(setAuto);
  }, []);
  const toggleAuto = async (on: boolean) => {
    Haptics.selectionAsync();
    if (!on) {
      setAuto(false);
      return disableAutoCheckIn();
    }
    const ok = await enableAutoCheckIn(today.data?.challenges ?? []);
    setAuto(ok);
    setNote(ok ? null : 'Choose “Allow all the time” for location, then switch this on again.');
  };

  const checkIn = () => {
    if (!challenge) return;
    log.mutate(
      { challengeId: challenge.id, source: 'place' },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setDone(true);
        },
        onError: (e) => setNote(e.message),
      },
    );
  };

  if (done) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg px-8">
        <Animated.View entering={FadeIn.duration(400)} className="items-center">
          <View className="h-40 w-40 items-center justify-center rounded-3xl border-4 border-dashed border-accent bg-card">
            <Animated.Image
              source={STAMP}
              style={{ width: 80, height: 100 }}
              resizeMode="contain"
            />
          </View>
          <Heading className="mt-5 text-center">You showed up.</Heading>
        </Animated.View>
        <Button className="mt-8 self-stretch" label="Done" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <PlaceMap
        place={place}
        locate={allowed === true}
        draft={draft}
        focus={focus}
        onPick={(at) => {
          Haptics.selectionAsync();
          setDraft(at);
        }}
      />

      <SafeAreaView edges={['top']} className="absolute left-4 top-0">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="mt-2 h-10 w-10 items-center justify-center rounded-full bg-card"
        >
          <ChevronLeft size={22} color={colors.ink} />
        </Pressable>
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} className="rounded-t-3xl bg-card px-6 pb-4 pt-5">
        <Text className="text-sm text-muted" numberOfLines={1}>
          {challenge?.title ?? 'Place'}
        </Text>
        <Text className="mt-1 font-serif-bold text-3xl">
          {draft
            ? 'Pin it here?'
            : !place
              ? 'Where is it?'
              : arrived
                ? 'You’re here'
                : away !== null
                  ? `${formatDistance(away)} away`
                  : 'Finding you…'}
        </Text>
        {!draft && (
          <Text className="mt-1 text-sm text-muted">
            {place
              ? 'Search or tap the map to move the pin.'
              : 'Search, or tap the map on the spot.'}
          </Text>
        )}

        {/* Find it by name instead of standing there (OpenStreetMap places near you). */}
        {!draft && (
          <View className="mt-3 h-12 flex-row items-center gap-2 rounded-2xl bg-bg px-4">
            <Search size={18} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search a gym, park…"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              accessibilityLabel="Search for a place"
              className="flex-1 font-sans text-base text-ink"
              style={{ includeFontPadding: false }}
            />
          </View>
        )}
        {!draft && typed.length >= 3 && (
          <View className="mt-2 overflow-hidden rounded-2xl bg-bg">
            {search.isPending && <Text className="px-4 py-3 text-sm text-muted">Searching…</Text>}
            {search.isError && (
              <Text className="px-4 py-3 text-sm text-danger">{search.error.message}</Text>
            )}
            {search.isSuccess && search.data.length === 0 && (
              <Text className="px-4 py-3 text-sm text-muted">
                Nothing found nearby. Tap the map instead.
              </Text>
            )}
            {search.data?.map((hit, i) => (
              <Pressable
                key={hit.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  Keyboard.dismiss();
                  setQuery('');
                  setDraft(hit.at);
                  setFocus(hit.at);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${hit.name}, ${hit.detail}`}
                className={`min-h-12 justify-center px-4 py-2 ${i > 0 ? 'border-t border-line' : ''}`}
              >
                <Text className="font-sans-semibold" numberOfLines={1}>
                  {hit.name}
                </Text>
                {hit.detail ? (
                  <Text className="text-xs text-muted" numberOfLines={1}>
                    {hit.detail}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}
        {(note || allowed === false) && (
          <Text className="mt-2 text-sm text-danger">
            {note ?? 'Location is off. Allow it to check in.'}
          </Text>
        )}

        <View className="mt-4 gap-2">
          {draft ? (
            <>
              <Button label="Pin here" onPress={() => pin(draft)} loading={setPlace.isPending} />
              <Button
                variant="ghost"
                label="Cancel"
                onPress={() => {
                  setDraft(null);
                  setFocus(null);
                }}
              />
            </>
          ) : !place ? (
            <Button
              label="Pin where I am now"
              onPress={() => pin(here)}
              disabled={!here}
              loading={setPlace.isPending}
            />
          ) : (
            <>
              {doneToday ? (
                <View className="h-12 flex-row items-center justify-center gap-2 rounded-full bg-primary-soft">
                  <Check size={18} color={colors.primary} />
                  <Text className="font-sans-semibold text-primary">Checked in today</Text>
                </View>
              ) : (
                <Button
                  label="Check in"
                  onPress={checkIn}
                  disabled={!arrived}
                  loading={log.isPending}
                />
              )}
              {Platform.OS !== 'web' && (
                <View className="mt-1 flex-row items-center gap-3 rounded-2xl bg-bg px-4 py-2">
                  <Text className="flex-1 font-sans-semibold">Check in automatically</Text>
                  <Switch
                    value={auto}
                    onValueChange={(v) => void toggleAuto(v)}
                    trackColor={{ true: colors.primary, false: colors.line }}
                    thumbColor="#fff"
                    accessibilityLabel="Check in automatically when you arrive, even with the app closed"
                  />
                </View>
              )}
              <Button
                variant="ghost"
                label="Move the pin to where I am"
                onPress={() => pin(here)}
                disabled={!here || setPlace.isPending}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
