import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface UserState {
  user: User | null;
  preferences: {
    theme: "light" | "dark" | "system";
    language: string;
  };
  // Actions
  setUser: (user: User | null) => void;
  updatePreferences: (preferences: Partial<UserState["preferences"]>) => void;
  logout: () => void;
}

export const useUserStore = create<UserState>()(
  devtools(
    persist(
      (set, _get) => ({
        user: null,
        preferences: {
          theme: "system",
          language: "en",
        },
        setUser: (user) => set({ user }, false, "setUser"),
        updatePreferences: (newPreferences) =>
          set(
            (state) => ({
              preferences: { ...state.preferences, ...newPreferences },
            }),
            false,
            "updatePreferences"
          ),
        logout: () =>
          set({ user: null, preferences: { theme: "system", language: "en" } }, false, "logout"),
      }),
      {
        name: "user-storage",
        // Only persist user and preferences, not actions
        partialize: (state) => ({
          user: state.user,
          preferences: state.preferences,
        }),
      }
    ),
    {
      name: "user-store",
    }
  )
);
