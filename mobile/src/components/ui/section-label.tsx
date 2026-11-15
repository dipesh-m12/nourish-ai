import { Text } from './text';

/**
 * The dashboard's section header ("CHALLENGES", "MOVE"): one component, so every section
 * label has the same font, size, colour and tracking.
 */
export function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      className="font-sans-semibold text-sm uppercase tracking-wider text-muted"
      accessibilityRole="header"
    >
      {children}
    </Text>
  );
}
