import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSetPlace } from '@/api/challenges';
import { useLogProgress, useToday } from '@/api/today';
import { PlaceMap } from '@/components/formats/place-map';
import { Button } from '@/components/ui/button';
import { Heading, Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { autoCheckInOn, disableAutoCheckIn, enableAutoCheckIn } from '@/lib/place-task';
import { localDate } from '@/utils/date';
import { formatDistance, metresBetween, type LngLat } from '@/utils/geo';

const STAMP = require('@/assets/images/world/flower-bloom.webp');

/**
 * "Get there" challenges (gym, park, temple): pin the spot once, then the map shows how far
 * you are, and Check in unlocks when you're there. Showing up is the whole habit.
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

  const pinHere = () => {
    if (!challenge || !here) return;
    setPlace.mutate(
      { id: challenge.id, place: { lat: here[1], lng: here[0], radiusM: 150 } },
      {
        onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
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
      <PlaceMap place={place} locate={allowed === true} />

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
          {!place
            ? 'Where is it?'
            : arrived
              ? 'You’re here'
              : away !== null
                ? `${formatDistance(away)} away`
                : 'Finding you…'}
        </Text>
        {(note || allowed === false) && (
          <Text className="mt-2 text-sm text-danger">
            {note ?? 'Location is off. Allow it to check in.'}
          </Text>
        )}

        <View className="mt-4 gap-2">
          {!place ? (
            <Button
              label="Pin where I am now"
              onPress={pinHere}
              disabled={!here}
              loading={setPlace.isPending}
            />
          ) : (
            <>
              <Button
                label="Check in"
                onPress={checkIn}
                disabled={!arrived}
                loading={log.isPending}
              />
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
                label="Move the pin here"
                onPress={pinHere}
                disabled={!here || setPlace.isPending}
              />
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}
