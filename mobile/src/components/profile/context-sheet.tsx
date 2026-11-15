import { View } from 'react-native';
import { useAgentContext } from '@/api/agent';
import { Button } from '@/components/ui/button';
import { DraggableSheet } from '@/components/ui/draggable-sheet';
import { SkeletonBlock } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { localDate } from '@/utils/date';

/**
 * "What Nourish knows": the exact context the assistant and Mochi work from, in plain words
 * (server: agent/context-summary.ts), so nothing about the PA is a black box.
 */
export function ContextSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const context = useAgentContext(localDate(), visible);

  return (
    <DraggableSheet visible={visible} onClose={onClose} title="What Nourish knows" tall>
      <Text className="mb-4 text-sm text-muted">
        Used for your tips, nudges and chat. Never shared.
      </Text>

      {context.isPending && (
        <View className="gap-3" accessible accessibilityLabel="Loading">
          <SkeletonBlock className="h-32 w-full rounded-2xl" />
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
        </View>
      )}

      {context.isError && (
        <View className="items-center gap-3 py-6">
          <Text className="text-center text-muted">{context.error.message}</Text>
          <Button variant="secondary" label="Try again" onPress={() => context.refetch()} />
        </View>
      )}

      {context.data?.sections.map((s) => (
        <View key={s.title} className="mb-5">
          <Text className="mb-2 font-sans-semibold text-xs uppercase tracking-wider text-muted">
            {s.title}
          </Text>
          <View className="overflow-hidden rounded-2xl bg-card">
            {s.rows.map((r, i) => (
              <View
                key={`${r.label}-${i}`}
                className={`flex-row gap-3 px-4 py-3 ${i ? 'border-t border-line' : ''}`}
                accessible
                accessibilityLabel={r.value ? `${r.label}: ${r.value}` : r.label}
              >
                <Text className={r.value ? 'w-28 text-muted' : 'flex-1'}>{r.label}</Text>
                {r.value ? <Text className="flex-1 font-sans-medium">{r.value}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </DraggableSheet>
  );
}
