import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ProgressRing } from './progress-ring';

export interface Ring {
  key: string;
  /** 0–1 (values above 1 draw as full). */
  progress: number;
  color: string;
  track: string;
}

interface Props {
  rings: Ring[];
  /** Outer diameter. */
  size: number;
  stroke: number;
  /** Space between rings. */
  gap?: number;
  /** Rendered in the middle of the innermost ring. */
  children?: ReactNode;
}

/**
 * Concentric progress rings (outermost first), each animating independently.
 * Built from stacked ProgressRings, so every ring shares the same animation and a11y behaviour.
 */
export function ActivityRings({ rings, size, stroke, gap = 3, children }: Props) {
  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      {rings.map((ring, i) => {
        const ringSize = size - i * 2 * (stroke + gap);
        return (
          <View key={ring.key} style={{ position: 'absolute' }}>
            <ProgressRing
              progress={ring.progress}
              size={ringSize}
              stroke={stroke}
              color={ring.color}
              trackColor={ring.track}
            />
          </View>
        );
      })}
      {children}
    </View>
  );
}
