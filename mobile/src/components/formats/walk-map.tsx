import { Camera, GeoJSONSource, Layer, Map, UserLocation } from '@maplibre/maplibre-react-native';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import type { LngLat } from '@/utils/geo';

/** OpenFreeMap: free vector tiles, no API key (Google Maps needs billing). Light, calm style. */
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

interface Props {
  path: LngLat[];
  /** Location permission granted: show the blue dot and follow it. */
  locate: boolean;
}

/** The walk, live: a blue dot that follows the phone and a sage line for the path so far. */
export function WalkMap({ path, locate }: Props) {
  return (
    <View className="flex-1">
      <Map mapStyle={STYLE} style={{ flex: 1 }} logo={false} compass={false} touchPitch={false}>
        <Camera
          initialViewState={{ center: [78.9629, 20.5937], zoom: 3.5 }}
          trackUserLocation={locate ? 'default' : undefined}
          zoom={locate ? 16 : undefined}
        />
        {locate && <UserLocation animated accuracy />}
        {path.length > 1 && (
          <GeoJSONSource
            id="walk-path"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: path },
            }}
          >
            <Layer
              id="walk-line"
              type="line"
              layout={{ 'line-cap': 'round', 'line-join': 'round' }}
              paint={{ 'line-color': colors.primary, 'line-width': 5 }}
            />
          </GeoJSONSource>
        )}
      </Map>
    </View>
  );
}
