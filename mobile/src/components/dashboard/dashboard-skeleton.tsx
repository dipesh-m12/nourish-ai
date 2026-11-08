import { View } from 'react-native';
import { SkeletonBlock, SkeletonGroup } from '@/components/ui/skeleton';

/**
 * Placeholder in the exact shape of the challenge section (consistency card + 2×2 tiles),
 * shown while the first load runs, which can include the AI setting up tracking (~5–8 s).
 */
export function ChallengesSkeleton() {
  return (
    <SkeletonGroup
      className="gap-3"
      accessible
      accessibilityLabel="Setting up your challenges"
      accessibilityState={{ busy: true }}
    >
      <View className="gap-4 rounded-3xl bg-card p-5">
        <View className="flex-row items-end justify-between">
          <View className="gap-2">
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="h-8 w-24" />
          </View>
          <View className="flex-row gap-5">
            <SkeletonBlock className="h-8 w-10" />
            <SkeletonBlock className="h-8 w-10" />
          </View>
        </View>
        <SkeletonBlock className="h-24 w-full rounded-xl" />
      </View>
      {[0, 1].map((row) => (
        <View key={row} className="flex-row gap-3">
          {[0, 1].map((col) => (
            <View key={col} className="h-48 flex-1 justify-between rounded-3xl bg-card p-4">
              <SkeletonBlock className="h-4 w-16" />
              <SkeletonBlock className="h-16 w-16 self-center rounded-full" />
              <SkeletonBlock className="h-10 w-full rounded-full" />
            </View>
          ))}
        </View>
      ))}
    </SkeletonGroup>
  );
}
