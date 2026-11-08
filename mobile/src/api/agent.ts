import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { request } from '@/lib/api-client';
import { AI_TIMEOUT_MS } from '@/lib/api-config';
import type { Photo } from '@/lib/photo';
import type { AgentMessage, AgentThread, AgentUsage, ConfirmResult } from '@/types/agent';
import { exerciseKeys } from './exercises';
import { todayKey } from './today';
import { planKeys } from './plan';

const tz = () => -new Date().getTimezoneOffset();
export const agentKey = (date: string) => ['agent', date] as const;

/** Today's thread (the server opens it with a nudge if it's new). */
export function useAgentThread(date: string) {
  return useQuery({
    queryKey: agentKey(date),
    queryFn: () =>
      request<AgentThread>(`/me/agent?date=${date}&tz=${tz()}`, { timeoutMs: AI_TIMEOUT_MS }),
  });
}

/** Writes the server's latest messages into the thread cache. */
function useSetMessages(date: string) {
  const queryClient = useQueryClient();
  return (messages: AgentMessage[], usage?: AgentUsage) =>
    queryClient.setQueryData<AgentThread>(agentKey(date), (old) =>
      old ? { ...old, messages, usage: usage ?? old.usage } : old,
    );
}

export function useSendAgentMessage(date: string) {
  const setMessages = useSetMessages(date);
  return useMutation({
    mutationFn: (input: string | { text: string; photo: Photo }) =>
      request<{ messages: AgentMessage[]; usage: AgentUsage }>('/me/agent/messages', {
        method: 'POST',
        body: {
          date,
          tz: tz(),
          ...(typeof input === 'string'
            ? { text: input }
            : { text: input.text, image: input.photo }),
        },
        timeoutMs: AI_TIMEOUT_MS,
      }),
    onSuccess: (r) => setMessages(r.messages, r.usage),
  });
}

/** What a card sends on confirm: the proof photo plus anything the user adjusted on it. */
export interface ConfirmInput {
  id: string;
  photo?: Photo;
  amount?: number;
  /** A meal card's items after editing (amounts, typed kcal, removed or added foods). */
  items?: { name: string; portion: string; proteinG: number; carbsG: number; fatG: number }[];
}

/** Runs a card. A rejected photo returns ok:false and leaves the card open for another try. */
export function useConfirmAgentAction(date: string) {
  const queryClient = useQueryClient();
  const setMessages = useSetMessages(date);
  return useMutation({
    mutationFn: ({ id, photo, amount, items }: ConfirmInput) =>
      request<ConfirmResult>(`/me/agent/actions/${id}/confirm`, {
        method: 'POST',
        body: { date, tz: tz(), image: photo, amount, items },
        timeoutMs: AI_TIMEOUT_MS,
      }),
    onSuccess: (r) => {
      if (!r.ok) return;
      setMessages(r.messages);
      // Whatever the assistant logged shows on the dashboard straight away.
      queryClient.invalidateQueries({ queryKey: todayKey(date) });
      queryClient.invalidateQueries({ queryKey: exerciseKeys.all });
      queryClient.invalidateQueries({ queryKey: planKeys.plan });
    },
  });
}

export function useCancelAgentAction(date: string) {
  const setMessages = useSetMessages(date);
  return useMutation({
    mutationFn: (id: string) =>
      request<{ messages: AgentMessage[] }>(`/me/agent/actions/${id}/cancel`, { method: 'POST' }),
    onSuccess: (r) => setMessages(r.messages),
  });
}
