import { Camera, type CameraRef, Map, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLivePosition } from '@/hooks/use-live-position';
import type { LngLat } from '@/utils/geo';

/** Same free, key-less OpenFreeMap style as the walk map. */
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const ZOOM = 16;

interface Props {
  /** The pinned place, if any. */
  place: LngLat | null;
  /** Where the phone is (the map opens on it when there's no place yet). */
  locate: boolean;
}

/** The place and the blue dot on one map: you can see how far you are from where you're going. */
export function PlaceMap({ place, locate }: Props) {
  const camera = useRef<CameraRef>(null);
  // Camera moves before the map has loaded are dropped, so nothing moves until it has.
  const [ready, setReady] = useState(false);
  const position = useLivePosition(locate && !place);
  const lng = position?.coords.longitude;
  const lat = position?.coords.latitude;
  const centred = useRef(false);

  // The pinned place, or else the phone once its first fix arrives: open on the street, not
  // the whole country.
  useEffect(() => {
    if (!ready) return;
    if (place) camera.current?.jumpTo({ center: place, zoom: 15 });
    else if (lng !== undefined && lat !== undefined && !centred.current) {
      centred.current = true;
      camera.current?.jumpTo({ center: [lng, lat], zoom: ZOOM });
    }
  }, [ready, place, lng, lat]);

  return (
    <View className="flex-1">
      <Map
        mapStyle={STYLE}
        style={{ flex: 1 }}
        logo={false}
        compass={false}
        touchPitch={false}
        onDidFinishLoadingMap={() => setReady(true)}
      >
        <Camera
          ref={camera}
          initialViewState={{ center: place ?? [78.9629, 20.5937], zoom: place ? 15 : 3.5 }}
        />
        {locate && <UserLocation animated accuracy />}
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
