"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  AirVent,
  Globe2,
  Layers3,
  Map,
  Menu,
  Moon,
  RadioTower,
  Sparkles,
  Sun,
  X,
} from "lucide-react";
import { CitySearch } from "@/components/search/CitySearch";
import { useLocationStore } from "@/store/locationStore";
import {
  useThemeStore,
  useThemeStoreHydrated,
} from "@/store/themeStore";

const navigation = [
  { label: "Overview", href: "/", icon: Activity },
  { label: "Forecast", href: "/forecast", icon: Layers3 },
  { label: "3D Atmosphere", href: "/atmosphere", icon: Globe2 },
  { label: "Radar & Maps", href: "/radar", icon: Map },
  { label: "Air Quality", href: "/air-quality", icon: AirVent },
  { label: "Intelligence", href: "/intelligence", icon: Sparkles },
  { label: "My Places", href: "/places", icon: RadioTower },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const selectedCity = useLocationStore((state) => state.selectedCity);

  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const themeHydrated = useThemeStoreHydrated();

  return (
    <div className="platform-shell">
      {mobileOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <Link
          href="/"
          className="sidebar-brand"
          onClick={() => setMobileOpen(false)}
        >
          <span className="brand-symbol">R</span>
          <span className="brand-wordmark">
            <strong>REZAVANTIS</strong>
            <small>ATMOSPHERIC INTELLIGENCE</small>
          </span>
        </Link>

        <div className="sidebar-section-label">WORKSPACE</div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`sidebar-link ${active ? "sidebar-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={18} strokeWidth={1.7} />
                <span>{item.label}</span>
                {active && <span className="nav-active-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-system">
            <span className="system-dot" />
            <div>
              <strong>DATA ENGINE</strong>
              <small>
                {selectedCity ? "LOCATION SELECTED" : "AWAITING LOCATION"}
              </small>
            </div>
          </div>
          <span className="sidebar-tagline">BEYOND WEATHER.</span>
        </div>
      </aside>

      <div className="platform-main">
        <header className="platform-topbar">
          <button
            className="mobile-menu-button"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <div className="topbar-breadcrumb">
            <span>REZAVANTIS</span>
            <span className="breadcrumb-divider">/</span>
            <strong>
              {navigation.find((item) => item.href === pathname)?.label ??
                "Workspace"}
            </strong>
          </div>

          <div className="topbar-search">
            <CitySearch compact />
          </div>

          <div className="topbar-right">
            <button
              type="button"
              className="theme-toggle"
              onClick={toggleTheme}
              disabled={!themeHydrated}
              aria-label={
                theme === "dark"
                  ? "Switch to light mode"
                  : "Switch to dark mode"
              }
              aria-pressed={theme === "light"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? (
                <Sun size={17} />
              ) : (
                <Moon size={17} />
              )}
            </button>

            <span className="topbar-status">
              <span className="system-dot" />{" "}
              {selectedCity ? "LOCATION ACTIVE" : "SYSTEM STANDBY"}
            </span>

            <span className="topbar-index">ATMOSPHERE / 01</span>
          </div>
        </header>

        <main className="workspace-content" key={pathname}>
          {children}
        </main>
      </div>
    </div>
  );
}
