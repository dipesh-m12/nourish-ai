import { Camera, Map, Marker, UserLocation } from '@maplibre/maplibre-react-native';
import { MapPin } from 'lucide-react-native';
import { View } from 'react-native';
import type { LngLat } from '@/utils/geo';

/** Same free, key-less OpenFreeMap style as the walk map. */
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

interface Props {
  /** The pinned place, if any. */
  place: LngLat | null;
  /** Where the phone is (follows the blue dot when there's no place yet). */
  locate: boolean;
}

/** The place and the blue dot on one map: you can see how far you are from where you're going. */
export function PlaceMap({ place, locate }: Props) {
  return (
    <View className="flex-1">
      <Map mapStyle={STYLE} style={{ flex: 1 }} logo={false} compass={false} touchPitch={false}>
        <Camera
          initialViewState={{ center: place ?? [78.9629, 20.5937], zoom: place ? 15 : 3.5 }}
          trackUserLocation={!place && locate ? 'default' : undefined}
          zoom={!place && locate ? 16 : undefined}
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
