import {
  Bell,
  MessageCircleHeart,
  PawPrint,
  Sprout,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react-native';

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
      {
        icon: Bell,
        title: 'Nourish checks in',
        body: 'Nudges at the right time, with its own chime.',
      },
      {
        icon: MessageCircleHeart,
        title: 'Say what you want',
        body: 'Talk, type or share a report.',
      },
      { icon: TrendingUp, title: 'Goals that grow', body: 'A great week? Level up in one tap.' },
      { icon: Sprout, title: 'Is it working?', body: 'Your week, your weight, your reports.' },
      { icon: PawPrint, title: 'Mochi’s room', body: 'Good weeks fill it up.' },
    ],
  },
];
