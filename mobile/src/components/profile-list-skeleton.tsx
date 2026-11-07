import { View } from 'react-native';
import { SkeletonBlock, SkeletonGroup } from './ui/skeleton';

/** Same shape as the real profile cards, so nothing jumps when data arrives. */
export function ProfileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <SkeletonGroup
      className="gap-3"
      accessible
      accessibilityLabel="Loading profiles"
      accessibilityState={{ busy: true }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View key={i} className="flex-row items-center gap-4 rounded-2xl bg-card p-4">
          <SkeletonBlock className="h-12 w-12 rounded-full" />
          <View className="flex-1 gap-2">
            <SkeletonBlock className="h-4 w-1/2" />
            <SkeletonBlock className="h-3 w-1/3" />
          </View>
        </View>
      ))}
      {/* "New profile" card placeholder */}
      <View className="h-20 rounded-2xl border-2 border-dashed border-line" />
    </SkeletonGroup>
  );
}
