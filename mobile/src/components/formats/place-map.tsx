import { Camera, type CameraRef, Map, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLivePosition } from '@/hooks/use-live-position';
import { colors } from '@/constants/colors';
import type { LngLat } from '@/utils/geo';

/** Same free, key-less OpenFreeMap style as the walk map. */
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const ZOOM = 16;

interface Props {
  /** The pinned place, if any. */
  place: LngLat | null;
  /** Where the phone is (the map opens on it when there's no place yet). */
  locate: boolean;
  /** A spot tapped on the map, not saved yet (drawn as an outlined pin). */
  draft?: LngLat | null;
  /** Tapping the map picks that spot (to pin it, or to move the pin). */
  onPick?: (at: LngLat) => void;
  /** Fly here (a place picked from search). */
  focus?: LngLat | null;
}

/**
 * The place and the blue dot on one map: you can see how far you are from where you're going.
 * Tap anywhere to pick a spot (the gym across town, not only where you stand).
 */
export function PlaceMap({ place, locate, draft, onPick, focus }: Props) {
  const camera = useRef<CameraRef>(null);
  // Camera moves before the map has loaded are dropped, so nothing moves until it has.
  const [ready, setReady] = useState(false);
  const position = useLivePosition(locate && !place);
  const lng = position?.coords.longitude;
  const lat = position?.coords.latitude;
  const centred = useRef(false);

  // The pinned place, or else the phone once its first fix arrives: open on the street, not
  // the whole country. Keyed on the pin's numbers, not the array (rebuilt every render): the
  // camera must only move when the pin itself moves, never while the user pans to pick a spot.
  const [pinLng, pinLat] = place ?? [];
  useEffect(() => {
    if (!ready) return;
    if (pinLng !== undefined && pinLat !== undefined)
      camera.current?.jumpTo({ center: [pinLng, pinLat], zoom: 15 });
    else if (lng !== undefined && lat !== undefined && !centred.current) {
      centred.current = true;
      camera.current?.jumpTo({ center: [lng, lat], zoom: ZOOM });
    }
  }, [ready, pinLng, pinLat, lng, lat]);

  // A search result: go there (the user didn't tap it on the map, so it may be off-screen).
  const [focusLng, focusLat] = focus ?? [];
  useEffect(() => {
    if (!ready || focusLng === undefined || focusLat === undefined) return;
    camera.current?.flyTo({ center: [focusLng, focusLat], zoom: ZOOM, duration: 900 });
  }, [ready, focusLng, focusLat]);

  return (
    <View className="flex-1">
      <Map
        mapStyle={STYLE}
        style={{ flex: 1 }}
        logo={false}
        compass={false}
        touchPitch={false}
        onDidFinishLoadingMap={() => setReady(true)}
        onPress={(e) => onPick?.(e.nativeEvent.lngLat)}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: place ?? [78.9629, 20.5937], zoom: place ? 15 : 3.5 }}
        />
        {locate && <UserLocation animated accuracy />}
        {draft && (
          <Marker id="draft" lngLat={draft} anchor="bottom">
            <View className="h-11 w-11 items-center justify-center rounded-full border-2 border-accent bg-card">
              <MapPin size={22} color={colors.accent} />
            </View>
          </Marker>
        )}
        {place && (
          <Marker id="place" lngLat={place} anchor="bottom">
            <View className="items-center">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent">
                <MapPin size={22} color="#fff" />
              </View>
            </View>
          </Marker>
        )}
      </Map>
    </View>
  );
}
