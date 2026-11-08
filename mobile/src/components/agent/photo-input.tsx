import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import {
  PhotoPermissionError,
  pickPhoto,
  PROOF_PHOTO,
  type Photo,
  type PhotoSource,
} from '@/lib/photo';

/** A model-requested photo still requires the user's explicit camera/gallery tap. */
export function PhotoInput({ onPhoto }: { onPhoto: (photo: Photo) => void }) {
  const [busy, setBusy] = useState<PhotoSource | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const choose = async (source: PhotoSource) => {
    if (busy) return;
    setBusy(source);
    setProblem(null);
    try {
      const photo = await pickPhoto(source, PROOF_PHOTO);
      if (photo) onPhoto(photo);
    } catch (err) {
      setProblem(
        err instanceof PhotoPermissionError
          ? err.message
          : 'Couldn’t open the photo. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };
  return (
    <View className="gap-2 rounded-2xl bg-card p-3">
      <Button
        label="Take a photo"
        onPress={() => choose('camera')}
        disabled={busy !== null}
        loading={busy === 'camera'}
      />
      <Button
        label="Choose from gallery"
        variant="secondary"
        onPress={() => choose('library')}
        disabled={busy !== null}
        loading={busy === 'library'}
      />
      {problem && (
        <Text accessibilityLiveRegion="polite" className="text-sm text-danger">
          {problem}
        </Text>
      )}
    </View>
  );
}
