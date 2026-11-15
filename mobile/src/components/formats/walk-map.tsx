import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  UserLocation,
  useCurrentPosition,
} from '@maplibre/maplibre-react-native';
import { LocateFixed } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { colors } from '@/constants/colors';
import type { LngLat } from '@/utils/geo';

/** OpenFreeMap: free vector tiles, no API key (Google Maps needs billing). Light, calm style. */
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const ZOOM = 17;
/** After the user pans away, follow the dot again on its own after this long. */
const REFOLLOW_MS = 8000;
/** A live fix worse than this isn't drawn onto the line (it would zig-zag). */
const LINE_ACCURACY_M = 25;

interface Props {
  path: LngLat[];
  /** Location permission granted: show the blue dot and follow it. */
  locate: boolean;
  /** The walk is running: the line runs on to where the phone is right now. */
  live: boolean;
}

/**
 * The walk, live: the camera keeps the blue dot in view as it moves, and the route so far is a
 * bold sage line with a white edge (readable on any street), starting at a sage dot.
 * Panning the map pauses the follow; the locate button (or a few seconds) brings it back.
 */
export function WalkMap({ path, locate, live }: Props) {
  const camera = useRef<CameraRef>(null);
  const position = useCurrentPosition({ enabled: locate });
  const [following, setFollowing] = useState(true);
  const first = useRef(true);
  const lng = position?.coords.longitude;
  const lat = position?.coords.latitude;
  const here: LngLat | null = lng !== undefined && lat !== undefined ? [lng, lat] : null;

  // Every fix moves the camera to the dot (the first one jumps there from the country view).
  useEffect(() => {
    if (lng === undefined || lat === undefined || !following) return;
    if (first.current) {
      first.current = false;
      camera.current?.jumpTo({ center: [lng, lat], zoom: ZOOM });
    } else camera.current?.easeTo({ center: [lng, lat], duration: 800, easing: 'ease' });
  }, [lng, lat, following]);

  // Panned away: come back to the dot on its own after a while.
  useEffect(() => {
    if (following) return;
    const timer = setTimeout(() => setFollowing(true), REFOLLOW_MS);
    return () => clearTimeout(timer);
  }, [following]);

  const accurate = (position?.coords.accuracy ?? Infinity) <= LINE_ACCURACY_M;
  const line = live && here && accurate && path.length > 0 ? [...path, here] : path;

  return (
    <View className="flex-1">
      <Map
        mapStyle={STYLE}
        style={{ flex: 1 }}
        logo={false}
        compass={false}
        touchPitch={false}
        onRegionWillChange={(e) => {
          if (e.nativeEvent.userInteraction) setFollowing(false);
        }}
      >
        <Camera ref={camera} initialViewState={{ center: [78.9629, 20.5937], zoom: 3.5 }} />
        {locate && <UserLocation animated accuracy />}
        {line.length > 1 && (
          <GeoJSONSource
            id="walk-path"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: line },
            }}
          >
            <Layer
              id="walk-line-edge"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': '#FFFFFF', 'line-width': 10 }}
            />
            <Layer
              id="walk-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.primary, 'line-width': 6 }}
            />
          </GeoJSONSource>
        )}
        {path.length > 0 && (
          <GeoJSONSource
            id="walk-start"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: path[0]! },
            }}
          >
            <Layer
              id="walk-start-dot"
              type="circle"
              paint={{
                'circle-radius': 7,
                'circle-color': colors.primary,
                'circle-stroke-width': 3,
                'circle-stroke-color': '#FFFFFF',
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {locate && !following && (
        <Pressable
          onPress={() => setFollowing(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Show my location"
          className="absolute h-12 w-12 items-center justify-center rounded-full bg-card"
          style={{ right: 16, bottom: 32, elevation: 3 }}
        >
          <LocateFixed size={22} color={colors.ink} />
        </Pressable>
      )}
    </View>
  );
}
