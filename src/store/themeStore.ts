import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "dark",

      setTheme: (theme) => set({ theme }),

      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === "dark" ? "light" : "dark",
        })),
    }),
    {
      name: "rezavantis-theme",
      skipHydration: true,
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
);

let hydrationStarted = false;

export function hydrateThemeStore() {
  if (hydrationStarted) return;

  hydrationStarted = true;

  void useThemeStore.persist.rehydrate().catch(() => {
    hydrationStarted = false;
  });
}

export function useThemeStoreHydrated() {
  return useSyncExternalStore(
    (onStoreChange) =>
      useThemeStore.persist.onFinishHydration(onStoreChange),
    () => useThemeStore.persist.hasHydrated(),
    () => false,
  );
}
