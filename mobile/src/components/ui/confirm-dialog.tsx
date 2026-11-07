import { Modal, Pressable, View } from 'react-native';
import Animated, { Easing, ZoomIn } from 'react-native-reanimated';
import { Button } from './button';
import { Heading, Text } from './text';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /** Red confirm button for irreversible actions. */
  destructive?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

/**
 * Centred confirmation for destructive actions (ui-ux-pro-max: confirm before delete or
 * irreversible actions). Cancel is the safe, easy choice; the destructive button is red.
 * Centred (not a bottom sheet) on purpose: it interrupts, which is what a confirmation should do.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive,
  loading,
  error,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center px-8">
        <Pressable
          className="absolute inset-0 bg-black/40"
          onPress={loading ? undefined : onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        />
        <Animated.View
          entering={ZoomIn.duration(220).easing(EASE_OUT)}
          className="w-full rounded-3xl bg-card p-6"
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <Heading className="text-2xl">{title}</Heading>
          <Text className="mt-2 leading-relaxed text-muted">{message}</Text>
          {error && <Text className="mt-3 text-sm text-danger">{error}</Text>}

          <View className="mt-6 gap-2">
            <Button
              label={confirmLabel}
              onPress={onConfirm}
              loading={loading}
              variant={destructive ? 'danger' : 'primary'}
            />
            <Button label="Cancel" variant="ghost" onPress={onCancel} disabled={loading} />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}
