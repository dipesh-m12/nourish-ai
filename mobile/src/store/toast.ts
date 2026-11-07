import { create } from 'zustand';

interface ToastState {
  message: string | null;
  /** Changes on every show, so the same message twice still re-animates. */
  id: number;
  show: (message: string) => void;
  hide: () => void;
}

/** App-wide brief confirmation ("Logged out", "Account deleted"). One at a time. */
export const useToast = create<ToastState>()((set) => ({
  message: null,
  id: 0,
  show: (message) => set((s) => ({ message, id: s.id + 1 })),
  hide: () => set({ message: null }),
}));
