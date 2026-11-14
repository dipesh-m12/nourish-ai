import { Bell, Footprints, MessageCircleHeart, Sprout, type LucideIcon } from 'lucide-react-native';

export interface WhatsNewPoint {
  icon: LucideIcon;
  title: string;
  /** One short line. */
  body: string;
}

/** Shown once per version (preferences.whatsNewSeen). Newest first; the app shows the first. */
export const WHATS_NEW: { version: string; points: WhatsNewPoint[] }[] = [
  {
    version: '1.1.0',
    points: [
      { icon: Bell, title: 'Nourish nudges you', body: 'Water, walks, meals. Right on time.' },
      {
        icon: MessageCircleHeart,
        title: 'Say what you want',
        body: 'Talk, type or share a report.',
      },
      {
        icon: Footprints,
        title: 'Every habit, its own way',
        body: 'Pour water, breathe, walk the map.',
      },
      { icon: Sprout, title: 'Is it working?', body: 'Your week and your reports, at a glance.' },
    ],
  },
];
