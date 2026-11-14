import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AirVent,
  CloudSun,
  Globe2,
  Layers3,
  Map,
  RadioTower,
  Sparkles,
} from "lucide-react";

const icons: Record<string, LucideIcon> = {
  forecast: CloudSun,
  atmosphere: Globe2,
  radar: Map,
  "air-quality": AirVent,
  intelligence: Sparkles,
  places: RadioTower,
};

const descriptions: Record<string, string> = {
  forecast:
    "A detailed view of changing weather conditions, hourly forecasts and the days ahead.",
  atmosphere:
    "Explore the atmosphere as a living, interconnected system through spatial visualization.",
  radar:
    "Explore the layers and movement of precipitation and atmospheric systems.",
  "air-quality":
    "Understand the composition of the air, environmental indicators and exposure.",
  intelligence:
    "Turn atmospheric signals into useful context, trends and explainable insights.",
  places: "Create a personal collection of the places that matter to you.",
};

const labels: Record<string, string> = {
  forecast: "FORECAST",
  atmosphere: "SPATIAL EXPLORATION",
  radar: "RADAR & CARTOGRAPHY",
  "air-quality": "ENVIRONMENTAL MONITORING",
  intelligence: "ATMOSPHERIC ANALYSIS",
  places: "PERSONAL LOCATIONS",
};

export function ModulePage({ module }: { module: keyof typeof descriptions }) {
  const Icon = icons[module] ?? Activity;
  const title =
    module === "air-quality"
      ? "Air Quality"
      : module.charAt(0).toUpperCase() + module.slice(1);

  return (
    <div className="module-page">
      <div className="module-page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" /> {labels[module]}
        </span>
        <div className="module-page-title-row">
          <div>
            <h1>{title}</h1>
            <p>{descriptions[module]}</p>
          </div>
          <div className="module-page-icon">
            <Icon size={25} strokeWidth={1.4} />
          </div>
        </div>
      </div>

      <section className="module-workspace">
        <div className="workspace-panel workspace-panel-primary">
          <div className="panel-heading">
            <div>
              <span className="panel-overline">WORKSPACE / 001</span>
              <h2>
                {module === "atmosphere"
                  ? "Atmospheric engine"
                  : `${title} workspace`}
              </h2>
            </div>
            <span className="panel-status">
              <span className="system-dot" /> STANDBY
            </span>
          </div>

          <div className="module-visual-placeholder">
            <div className="placeholder-orbit placeholder-orbit-one" />
            <div className="placeholder-orbit placeholder-orbit-two" />
            <div className="placeholder-core">
              <Icon size={34} strokeWidth={1.1} />
            </div>
            <span className="placeholder-coordinate">NO LOCATION SELECTED</span>
            <span className="placeholder-caption">ATMOSPHERIC DATA ENGINE</span>
          </div>

          <div className="module-empty-copy">
            <span className="eyebrow">AWAITING INPUT</span>
            <h3>Your atmospheric workspace is ready.</h3>
            <p>
              Choose a location to begin. Live information will appear here when
              a supported data source is connected.
            </p>
          </div>
        </div>

        <aside className="workspace-panel workspace-panel-secondary">
          <span className="panel-overline">SYSTEM INFORMATION</span>
          <h2>Designed for clarity.</h2>
          <p>
            This module is part of the REZAVANTIS atmospheric intelligence
            platform.
          </p>
          <div className="system-info-row">
            <span>Data connection</span>
            <strong>Not connected</strong>
          </div>
          <div className="system-info-row">
            <span>Location</span>
            <strong>Not selected</strong>
          </div>
          <div className="system-info-row">
            <span>Module status</span>
            <strong>In development</strong>
          </div>
          <div className="secondary-decoration">
            <Layers3 size={19} />
            <span>SCIENCE / DATA / DESIGN</span>
          </div>
        </aside>
      </section>
    </div>
  );
}
