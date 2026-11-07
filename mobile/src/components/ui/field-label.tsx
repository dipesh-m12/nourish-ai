import type { ReactNode } from 'react';
import { View } from 'react-native';
import { cn } from '@/lib/cn';
import { Text } from './text';

interface Props {
  children: string;
  /** Shows "Optional" on the right, instead of a separate explanatory line. */
  optional?: boolean;
  /** Anything else to place on the right (e.g. a unit toggle). */
  right?: ReactNode;
  className?: string;
}

/** Section label used across forms: label left, "Optional" or a control right. */
export function FieldLabel({ children, optional, right, className }: Props) {
  return (
    <View className={cn('mb-3 flex-row items-center justify-between', className)}>
      <Text className="font-sans-semibold">{children}</Text>
      {optional && <Text className="text-sm text-muted">Optional</Text>}
      {right}
    </View>
  );
}
