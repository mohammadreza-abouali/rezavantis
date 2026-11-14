import {
  AirVent,
  ArrowUpRight,
  CloudSun,
  Globe2,

  Map,
  RadioTower,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { CitySearch } from "@/components/search/CitySearch";
import WeatherOverview from "@/components/weather/WeatherOverview";

const modules = [
  {
    title: "Forecast",
    description: "Explore hourly conditions and extended atmospheric outlooks.",
    href: "/forecast",
    icon: CloudSun,
    number: "01",
  },
  {
    title: "3D Atmosphere",
    description: "Explore atmospheric systems through a spatial perspective.",
    href: "/atmosphere",
    icon: Globe2,
    number: "02",
  },
  {
    title: "Radar & Maps",
    description: "A dedicated workspace for atmospheric maps and radar layers.",
    href: "/radar",
    icon: Map,
    number: "03",
  },
  {
    title: "Air Quality",
    description:
      "Understand air quality, particulate matter and UV conditions.",
    href: "/air-quality",
    icon: AirVent,
    number: "04",
  },
  {
    title: "Intelligence",
    description:
      "Discover patterns, trends and meaningful atmospheric insights.",
    href: "/intelligence",
    icon: Sparkles,
    number: "05",
  },
  {
    title: "My Places",
    description: "Build a personal collection of locations around the world.",
    href: "/places",
    icon: RadioTower,
    number: "06",
  },
];

export default function HomePage() {
  return (
    <div className="overview-page">
      <section className="overview-hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-line" /> ATMOSPHERIC INTELLIGENCE PLATFORM
          </span>
          <h1>
            Beyond Weather.
            <br />
            <em>Into Atmosphere.</em>
          </h1>
          <p>
            A deeper perspective on the forces shaping our atmosphere. Explore
            the science behind every shift, pattern and possibility.
          </p>
          <div className="hero-actions">
            <Link href="/atmosphere" className="primary-action">
              Explore 3D atmosphere <ArrowUpRight size={17} />
            </Link>
            <span className="hero-note">A NEW PERSPECTIVE ON OUR PLANET</span>
          </div>
          <div className="overview-search">
            <span className="overview-search-label">EXPLORE A LOCATION</span>
            <CitySearch />
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-visual-orbit orbit-a" />
          <div className="hero-visual-orbit orbit-b" />
          <div className="hero-globe">
            <div className="globe-shine" />
            <div className="globe-continent continent-a" />
            <div className="globe-continent continent-b" />
            <div className="globe-atmosphere" />
          </div>
          <span className="visual-coordinate coordinate-a">GLOBAL VIEW</span>
          <span className="visual-coordinate coordinate-b">
            ATMOSPHERIC SYSTEM / 001
          </span>
          <span className="visual-crosshair">+</span>
        </div>

        <div className="hero-bottom-line">
          <span>ATMOSPHERE IS ALWAYS IN MOTION</span>
          <span>SCIENCE · DATA · PERSPECTIVE</span>
        </div>
      </section>

      <WeatherOverview />

      <section className="modules-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">THE PLATFORM</span>
            <h2>Explore the dimensions</h2>
          </div>
          <span className="section-index">06 MODULES / ONE PLATFORM</span>
        </div>

        <div className="module-grid">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                href={module.href}
                key={module.href}
                className="module-card"
              >
                <div className="module-card-top">
                  <span className="module-number">{module.number}</span>
                  <Icon size={21} strokeWidth={1.5} />
                </div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
                <span className="module-card-arrow">
                  <ArrowUpRight size={17} />
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <footer className="platform-footer">
        <span>REZAVANTIS © 2026</span>
        <span>BEYOND WEATHER. INTO ATMOSPHERE.</span>
      </footer>
    </div>
  );
}
