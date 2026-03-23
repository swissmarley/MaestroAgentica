import { create } from "zustand";

type Theme = "light" | "dark" | "system";

interface UIState {
  sidebarCollapsed: boolean;
  activeModal: string | null;
  theme: Theme;
}

interface UIActions {
  toggleSidebar: () => void;
  openModal: (name: string) => void;
  closeModal: () => void;
  setTheme: (theme: Theme) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set) => ({
  sidebarCollapsed: false,
  activeModal: null,
  theme: "system",

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  openModal: (name: string) => {
    set({ activeModal: name });
  },

  closeModal: () => {
    set({ activeModal: null });
  },

  setTheme: (theme: Theme) => {
    set({ theme });
  },
}));
