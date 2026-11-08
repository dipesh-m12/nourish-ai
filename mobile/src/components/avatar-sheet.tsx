import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useUpdateAvatar } from '@/api/profiles';
import { ProfileAvatar } from '@/components/profile-avatar';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { AVATAR_PHOTO, PhotoPermissionError, pickPhoto, type PhotoSource } from '@/lib/photo';
import { useToast } from '@/store/toast';
import type { Profile } from '@/types/profile';

interface Props {
  visible: boolean;
  profile: Profile;
  onClose: () => void;
}

/** Change or remove the profile photo: camera, gallery (square crop), or remove. */
export function AvatarSheet({ visible, profile, onClose }: Props) {
  const update = useUpdateAvatar();
  const toast = useToast((s) => s.show);
  const [preparing, setPreparing] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const busy = preparing || update.isPending;

  const close = () => {
    if (busy) return;
    setProblem(null);
    update.reset();
    onClose();
  };

  const done = (message: string) => {
    toast(message);
    setProblem(null);
    onClose();
  };

  const choose = async (source: PhotoSource) => {
    setProblem(null);
    try {
      setPreparing(true);
      const photo = await pickPhoto(source, AVATAR_PHOTO);
      setPreparing(false);
      if (!photo) return; // cancelled
      update.mutate(photo, {
        onSuccess: () => done('Photo updated'),
        onError: (err) => setProblem(err.message),
      });
    } catch (err) {
      setPreparing(false);
      setProblem(err instanceof PhotoPermissionError ? err.message : 'Couldn’t open the photo.');
    }
  };

  const remove = () =>
    update.mutate(null, {
      onSuccess: () => done('Photo removed'),
      onError: (err) => setProblem(err.message),
    });

  return (
    <BottomSheet visible={visible} onClose={close} title="Profile photo">
      <View className="items-center">
        <View>
          <ProfileAvatar
            name={profile.name}
            color={profile.avatarColor}
            imageUrl={profile.avatarUrl}
            imageKey={profile.avatarKey}
            size={112}
          />
          {busy && (
            <View className="absolute inset-0 items-center justify-center rounded-full bg-black/35">
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
        {problem && (
          <Text className="mt-3 text-center text-sm text-danger" accessibilityLiveRegion="polite">
            {problem}
          </Text>
        )}
      </View>

      <View className="mt-6 gap-2">
        <Button label="Take a photo" onPress={() => choose('camera')} disabled={busy} />
        <Button
          label="Choose from gallery"
          variant="secondary"
          onPress={() => choose('library')}
          disabled={busy}
        />
        {profile.avatarUrl && (
          <Button label="Remove photo" variant="ghost" onPress={remove} disabled={busy} />
        )}
      </View>
      {busy && (
        <Text className="mt-2 text-center text-xs" style={{ color: colors.muted }}>
          {preparing ? 'Preparing…' : 'Uploading…'}
        </Text>
      )}
    </BottomSheet>
  );
}
