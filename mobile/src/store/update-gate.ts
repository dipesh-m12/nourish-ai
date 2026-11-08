import { create } from 'zustand';

interface UpdateGateState {
  /** Set when the API refuses this build (426): the whole app is replaced by the update screen. */
  required: { message: string; updateUrl: string | null } | null;
  block: (info: { message: string; updateUrl: string | null }) => void;
}

export const useUpdateGate = create<UpdateGateState>()((set) => ({
  required: null,
  block: (info) => set({ required: info }),
}));
