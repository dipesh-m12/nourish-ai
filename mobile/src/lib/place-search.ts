import type { LngLat } from '@/utils/geo';

/**
 * Finds a gym, park or any named place by text, for pinning a "get there" challenge without
 * standing there. Photon (OpenStreetMap data, free, no key), biased towards where the phone
 * is. Only what the user typed and that rough position are sent, and only when they search.
 */
const URL = 'https://photon.komoot.io/api/';
const TIMEOUT_MS = 8000;

export interface PlaceHit {
  id: string;
  name: string;
  /** "Street, area, city": enough to tell two "Cult" gyms apart. */
  detail: string;
  at: LngLat;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    osm_type?: string;
    osm_id?: number;
    name?: string;
    street?: string;
    locality?: string;
    district?: string;
    city?: string;
    state?: string;
  };
}

/**
 * Search boxes around the user, in degrees (~55 km, then ~165 km). Photon's own location bias
 * loses to famous names ("cult gym" gave Telangana, Brisbane, LA), so results are kept near:
 * a gym across the world is worse than "nothing found, tap the map".
 */
const NEAR_BOXES = [0.5, 1.5];

export async function searchPlaces(query: string, near: LngLat | null): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (!near) return searchOnce(q, null, null);
  for (const d of NEAR_BOXES) {
    const hits = await searchOnce(q, near, d);
    if (hits.length) return hits;
  }
  return [];
}

async function searchOnce(q: string, near: LngLat | null, box: number | null) {
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
  if (near) {
    params.set('lon', String(near[0]));
    params.set('lat', String(near[1]));
    if (box)
      params.set(
        'bbox',
        [near[0] - box, near[1] - box, near[0] + box, near[1] + box]
          .map((n) => n.toFixed(4))
          .join(','),
      );
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${URL}?${params}`, { signal: controller.signal });
    if (!res.ok) throw new Error('Search isn’t working right now. Tap the map instead.');
    const body = (await res.json()) as { features?: PhotonFeature[] };
    const seen = new Set<string>();
    return (body.features ?? [])
      .filter((f) => f.properties.name)
      .map((f) => {
        const p = f.properties;
        return {
          id: `${p.osm_type ?? ''}${p.osm_id ?? `${f.geometry.coordinates.join(',')}`}`,
          name: p.name!,
          detail: [p.street, p.locality ?? p.district, p.city ?? p.state]
            .filter((x, i, all) => x && all.indexOf(x) === i)
            .join(', '),
          at: f.geometry.coordinates,
        };
      })
      .filter((h) => !seen.has(h.id) && seen.add(h.id))
      .slice(0, 5);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError')
      throw new Error('Search took too long. Try again, or tap the map.');
    throw err instanceof Error && err.message.includes('Tap the map')
      ? err
      : new Error('Couldn’t search. Check your connection, or tap the map.');
  } finally {
    clearTimeout(timer);
  }
}
