"use client";

import { useEffect } from "react";
import {
  hydrateThemeStore,
  useThemeStore,
  useThemeStoreHydrated,
} from "@/store/themeStore";

export function ThemeSync() {
  const theme = useThemeStore((state) => state.theme);
  const hydrated = useThemeStoreHydrated();

  useEffect(() => {
    hydrateThemeStore();
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    document.documentElement.dataset.theme = theme;
  }, [theme, hydrated]);

  return null;
}
