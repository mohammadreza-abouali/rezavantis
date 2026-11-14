import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SelectedCity = {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

type LocationState = {
  selectedCity: SelectedCity | null;
  favoriteCities: SelectedCity[];
  setSelectedCity: (city: SelectedCity) => void;
  clearSelectedCity: () => void;
  addFavoriteCity: (city: SelectedCity) => void;
  removeFavoriteCity: (city: SelectedCity) => void;
  isFavoriteCity: (city: SelectedCity) => boolean;
};

function sameCity(a: SelectedCity, b: SelectedCity) {
  return (
    Math.abs(a.latitude - b.latitude) < 0.01 &&
    Math.abs(a.longitude - b.longitude) < 0.01
  );
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      selectedCity: null,
      favoriteCities: [],
      setSelectedCity: (city) => set({ selectedCity: city }),
      clearSelectedCity: () => set({ selectedCity: null }),
      addFavoriteCity: (city) =>
        set((state) => ({
          favoriteCities: state.favoriteCities.some((item) =>
            sameCity(item, city),
          )
            ? state.favoriteCities
            : [...state.favoriteCities, city],
        })),
      removeFavoriteCity: (city) =>
        set((state) => ({
          favoriteCities: state.favoriteCities.filter(
            (item) => !sameCity(item, city),
          ),
        })),
      isFavoriteCity: (city) =>
        get().favoriteCities.some((item) => sameCity(item, city)),
    }),
    {
      name: "rezavantis-location",
      skipHydration: true,
      partialize: (state) => ({
        selectedCity: state.selectedCity,
        favoriteCities: state.favoriteCities,
      }),
    },
  ),
);

let hydrationStarted = false;

export function hydrateLocationStore() {
  if (hydrationStarted) return;

  hydrationStarted = true;

  void useLocationStore.persist.rehydrate().catch(() => {
    hydrationStarted = false;
  });
}

export function useLocationStoreHydrated() {
  return useSyncExternalStore(
    (onStoreChange) =>
      useLocationStore.persist.onFinishHydration(onStoreChange),
    () => useLocationStore.persist.hasHydrated(),
    () => false,
  );
}
