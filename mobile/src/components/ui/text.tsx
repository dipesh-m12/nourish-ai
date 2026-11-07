import { Text as RNText, type TextProps } from 'react-native';
import { cn } from '@/lib/cn';

type Props = TextProps & { className?: string };

/** Body text (Inter). Classes passed in override the defaults. */
export function Text({ className, ...props }: Props) {
  return <RNText className={cn('font-sans text-base text-ink', className)} {...props} />;
}

/** Headings (Lora): the serif gives the app a warm, human tone. */
export function Heading({ className, ...props }: Props) {
  return (
    <RNText
      accessibilityRole="header"
      className={cn('font-serif text-3xl leading-tight text-ink', className)}
      {...props}
    />
  );
}
