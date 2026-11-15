import { Share2 } from 'lucide-react-native';
import { type RefObject, useState } from 'react';
import { ActivityIndicator, Platform, Pressable } from 'react-native';
import { colors } from '@/constants/colors';
import { shareView } from '@/lib/share-image';
import { useToast } from '@/store/toast';

/**
 * A round share icon for a screen's header: turns `target` into a picture and opens the phone's
 * share sheet. Web can't capture views, so it isn't shown there.
 */
export function ShareButton({ target, title }: { target: RefObject<unknown>; title: string }) {
  const toast = useToast((s) => s.show);
  const [busy, setBusy] = useState(false);
  if (Platform.OS === 'web') return null;

  const share = async () => {
    setBusy(true);
    const problem = await shareView(target, title);
    setBusy(false);
    if (problem) toast(problem);
  };

  return (
    <Pressable
      onPress={share}
      disabled={busy}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={`Share ${title}`}
      className="h-10 w-10 items-center justify-center rounded-full bg-card active:opacity-80"
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.ink} />
      ) : (
        <Share2 size={18} color={colors.ink} />
      )}
    </Pressable>
  );
}
