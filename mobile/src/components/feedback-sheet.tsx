import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { type FeedbackType, useSendFeedback } from '@/api/feedback';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { FieldLabel } from '@/components/ui/field-label';
import { Text } from '@/components/ui/text';
import { colors } from '@/constants/colors';
import { cn } from '@/lib/cn';
import { posthog } from '@/lib/posthog';
import { useToast } from '@/store/toast';

const TYPES: { value: FeedbackType; label: string; placeholder: string }[] = [
  {
    value: 'bug',
    label: 'Something’s broken',
    placeholder: 'What happened, and what did you expect?',
  },
  { value: 'idea', label: 'An idea', placeholder: 'What would make the app better for you?' },
  { value: 'other', label: 'Other', placeholder: 'Tell us anything.' },
];

const MIN = 5;
const MAX = 1000;

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Report a problem or share an idea. Device details are attached automatically. */
export function FeedbackSheet({ visible, onClose }: Props) {
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const send = useSendFeedback();
  const toast = useToast((s) => s.show);
  const trimmed = message.trim();
  const placeholder = TYPES.find((t) => t.value === type)!.placeholder;

  const close = () => {
    send.reset();
    onClose();
  };

  const submit = () =>
    send.mutate(
      { type, message: trimmed },
      {
        onSuccess: () => {
          posthog?.capture('feedback_submitted', { type });
          setMessage('');
          close();
          toast('Thanks! We read every message.');
        },
      },
    );

  return (
    <BottomSheet visible={visible} onClose={close} title="Send feedback">
      <FieldLabel>What’s it about?</FieldLabel>
      <View className="flex-row flex-wrap gap-2" accessibilityRole="radiogroup">
        {TYPES.map((t) => (
          <Chip
            key={t.value}
            role="radio"
            label={t.label}
            selected={type === t.value}
            onPress={() => setType(t.value)}
          />
        ))}
      </View>

      <FieldLabel className="mt-5">Details</FieldLabel>
      <TextInput
        value={message}
        onChangeText={(text) => {
          setMessage(text);
          if (send.isError) send.reset();
        }}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        multiline
        maxLength={MAX}
        textAlignVertical="top"
        accessibilityLabel="Feedback details"
        className="min-h-28 rounded-2xl border-2 border-line bg-bg p-4 font-sans text-base leading-relaxed text-ink focus:border-primary"
      />
      <View className="mt-1.5 flex-row justify-between">
        <Text className={cn('text-xs', send.isError ? 'text-danger' : 'text-muted')}>
          {send.isError ? send.error.message : 'Your device and app version are included.'}
        </Text>
        <Text className="text-xs text-muted">
          {message.length}/{MAX}
        </Text>
      </View>

      <Button
        className="mt-5"
        label="Send"
        onPress={submit}
        disabled={trimmed.length < MIN}
        loading={send.isPending}
      />
    </BottomSheet>
  );
}
