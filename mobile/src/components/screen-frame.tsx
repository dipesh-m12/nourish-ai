import type { ReactNode } from 'react';
import { View } from 'react-native';
import { colors } from '@/constants/colors';
import { useScreenSize } from '@/hooks/use-screen-size';

/**
 * Desktop web: centres its children in a phone-sized frame. Phones (and phone-sized browsers):
 * renders them full-screen, unchanged.
 *
 * Used by the app root and by sheets, because RN modals render outside the root and would
 * otherwise cover the whole browser window. `backdrop` = the page around the frame.
 */
export function ScreenFrame({ children, backdrop }: { children: ReactNode; backdrop?: string }) {
  const { width, height, framed } = useScreenSize();
  if (!framed) return <View style={{ flex: 1 }}>{children}</View>;

  return (
    <View
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: backdrop }}
    >
      <View
        style={{
          width,
          height,
          overflow: 'hidden',
          borderRadius: 32,
          backgroundColor: colors.bg,
          boxShadow: '0 12px 48px rgba(28,35,33,0.18)',
        }}
      >
        {children}
      </View>
    </View>
  );
}
