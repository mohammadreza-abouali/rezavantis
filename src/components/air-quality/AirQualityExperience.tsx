"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,

  Atom,
  Clock3,
  Droplets,
  Gauge,
  Leaf,
  RefreshCw,
  Wind,
} from "lucide-react";
import { getAirQuality, type AirQualityResponse } from "@/services/airQuality";
import { hydrateLocationStore, useLocationStore } from "@/store/locationStore";

type Pollutant = {
  key: string;
  label: string;
  short: string;
  description: string;
  unit: string;
};

const pollutants: Pollutant[] = [
  {
    key: "pm2_5",
    label: "Fine particulate matter",
    short: "PM2.5",
    description: "Fine particles that can penetrate deep into the lungs",
    unit: "μg/m³",
  },
  {
    key: "pm10",
    label: "Coarse particulate matter",
    short: "PM10",
    description: "Inhalable particles suspended in the atmosphere",
    unit: "μg/m³",
  },
  {
    key: "nitrogen_dioxide",
    label: "Nitrogen dioxide",
    short: "NO₂",
    description: "A gas commonly associated with combustion and traffic",
    unit: "μg/m³",
  },
  {
    key: "ozone",
    label: "Ground-level ozone",
    short: "O₃",
    description: "A secondary pollutant formed through atmospheric reactions",
    unit: "μg/m³",
  },
  {
    key: "carbon_monoxide",
    label: "Carbon monoxide",
    short: "CO",
    description: "A colourless gas produced by incomplete combustion",
    unit: "μg/m³",
  },
  {
    key: "sulphur_dioxide",
    label: "Sulphur dioxide",
    short: "SO₂",
    description:
      "A gas mainly associated with burning sulphur-containing fuels",
    unit: "μg/m³",
  },
  {
    key: "dust",
    label: "Atmospheric dust",
    short: "DUST",
    description: "Modelled airborne mineral dust concentration",
    unit: "μg/m³",
  },
  {
    key: "ammonia",
    label: "Ammonia",
    short: "NH₃",
    description: "A reactive atmospheric gas",
    unit: "μg/m³",
  },
];

const pollenItems = [
  ["alder_pollen", "Alder"],
  ["birch_pollen", "Birch"],
  ["grass_pollen", "Grass"],
  ["mugwort_pollen", "Mugwort"],
  ["olive_pollen", "Olive"],
  ["ragweed_pollen", "Ragweed"],
] as const;

function numeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function displayValue(value: unknown, digits = 1) {
  return numeric(value) ? value.toFixed(digits) : "—";
}

function europeanLevel(value: number) {
  if (value <= 20) return { label: "Good", detail: "Low pollution", level: 1 };
  if (value <= 40)
    return { label: "Fair", detail: "Acceptable conditions", level: 2 };
  if (value <= 60)
    return { label: "Moderate", detail: "Some pollution present", level: 3 };
  if (value <= 80)
    return { label: "Poor", detail: "Elevated pollution", level: 4 };
  if (value <= 100)
    return { label: "Very poor", detail: "High pollution", level: 5 };
  return { label: "Extremely poor", detail: "Very high pollution", level: 6 };
}

function formatLocalTime(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatLocalDate(value: string, timezone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function MetricCard({
  label,
  value,
  unit,
  icon: Icon,
  note,
}: {
  label: string;
  value: string;
  unit: string;
  icon: typeof Activity;
  note: string;
}) {
  return (
    <article className="aq-metric-card">
      <div className="aq-metric-top">
        <span>{label}</span>
        <Icon size={17} strokeWidth={1.5} />
      </div>
      <div className="aq-metric-value">
        <strong>{value}</strong>
        <span>{unit}</span>
      </div>
      <p>{note}</p>
    </article>
  );
}

function TrendChart({
  title,
  unit,
  values,
  times,
  color,
}: {
  title: string;
  unit: string;
  values?: number[];
  times: string[];
  color: string;
}) {
  const points = useMemo(() => {
    if (!values) return [];

    const valid = values
      .map((value, index) => ({ value, index }))
      .filter((item) => numeric(item.value));

    if (valid.length < 2) return [];

    const min = Math.min(...valid.map((item) => item.value));
    const max = Math.max(...valid.map((item) => item.value));
    const range = max - min || 1;

    return valid.map((item) => ({
      x: 8 + (item.index / Math.max(values.length - 1, 1)) * 284,
      y: 78 - ((item.value - min) / range) * 62,
    }));
  }, [values]);

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const validValues = values?.filter(numeric) ?? [];

  return (
    <article className="aq-chart-card">
      <div className="aq-chart-heading">
        <div>
          <span className="aq-overline">FIVE-DAY SIGNAL</span>
          <h3>{title}</h3>
        </div>
        <span className="aq-chart-unit">{unit}</span>
      </div>

      {points.length > 1 ? (
        <>
          <div className="aq-chart-current">
            <strong>{displayValue(validValues[0])}</strong>
            <span>first forecast value</span>
          </div>
          <svg
            className="aq-chart-svg"
            viewBox="0 0 300 92"
            role="img"
            aria-label={`${title} forecast trend`}
          >
            {[16, 47, 78].map((y) => (
              <line key={y} x1="8" y1={y} x2="292" y2={y} />
            ))}
            <path d={path} stroke={color} />
            {points.length > 0 && (
              <circle cx={points[0].x} cy={points[0].y} r="3.5" fill={color} />
            )}
          </svg>
          <div className="aq-chart-axis">
            <span>{times[0] ? formatLocalDate(times[0], "UTC") : "Start"}</span>
            <span>
              {times[times.length - 1]
                ? formatLocalDate(times[times.length - 1], "UTC")
                : "End"}
            </span>
          </div>
        </>
      ) : (
        <div className="aq-chart-unavailable">Forecast trend unavailable</div>
      )}
    </article>
  );
}

function LoadingState() {
  return (
    <div className="aq-loading" aria-label="Loading air quality data">
      <div className="aq-loading-orbit" />
      <div className="aq-loading-copy">
        <span className="aq-overline">ATMOSPHERIC DATA</span>
        <strong>Reading the atmosphere</strong>
        <span>Connecting to environmental models…</span>
      </div>
      <div className="aq-loading-grid">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="aq-loading-tile" key={index} />
        ))}
      </div>
    </div>
  );
}

export function AirQualityExperience() {
  const selectedCity = useLocationStore((state) => state.selectedCity);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  const query = useQuery<AirQualityResponse>({
    queryKey: ["air-quality", selectedCity?.latitude, selectedCity?.longitude],
    queryFn: () =>
      getAirQuality(selectedCity!.latitude, selectedCity!.longitude),
    enabled: Boolean(selectedCity),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  const data = query.data;
  const current = data?.current;
  const currentTimestamp = current
    ? new Date(current.time).getTime()
    : Number.NEGATIVE_INFINITY;
  const hourly = data?.hourly;
  const aqi = current?.european_aqi;
  const level = numeric(aqi) ? europeanLevel(aqi) : null;

  const pollenAvailable = pollenItems.some(([key]) => numeric(current?.[key]));

  return (
    <div className="aq-page">
      <header className="aq-page-heading">
        <div>
          <span className="aq-eyebrow">
            <span className="aq-eyebrow-line" />
            ENVIRONMENTAL MONITORING
          </span>
          <h1>Air Quality</h1>
          <p>
            Atmospheric composition, pollutant concentrations and environmental
            exposure indicators.
          </p>
        </div>
        <button
          className="aq-refresh-button"
          onClick={() => void query.refetch()}
          disabled={!selectedCity || query.isFetching}
          type="button"
        >
          <RefreshCw size={15} className={query.isFetching ? "aq-spin" : ""} />
          <span>{query.isFetching ? "UPDATING" : "REFRESH DATA"}</span>
        </button>
      </header>

      {!selectedCity && (
        <section className="aq-empty-state">
          <div className="aq-empty-orbit">
            <Atom size={32} strokeWidth={1.2} />
          </div>
          <span className="aq-overline">LOCATION REQUIRED</span>
          <h2>Your air quality workspace is ready.</h2>
          <p>
            Search and select a city from the location search above to load
            atmospheric composition and air quality information.
          </p>
        </section>
      )}

      {selectedCity && query.isLoading && <LoadingState />}

      {selectedCity && query.isError && (
        <section className="aq-error-state">
          <AlertCircle size={24} />
          <div>
            <h2>Air quality data unavailable</h2>
            <p>
              The environmental data service could not be reached. Check your
              connection and try again.
            </p>
          </div>
          <button type="button" onClick={() => void query.refetch()}>
            Retry
          </button>
        </section>
      )}

      {selectedCity && data && current && (
        <>
          <section className="aq-location-strip">
            <div>
              <span className="aq-overline">MONITORING LOCATION</span>
              <strong>
                {selectedCity.name}
                {selectedCity.country ? `, ${selectedCity.country}` : ""}
              </strong>
            </div>
            <div className="aq-location-meta">
              <span>
                <Clock3 size={13} /> {data.timezone}
              </span>
              <span className="aq-live-indicator">
                <span /> MODEL DATA
              </span>
            </div>
          </section>

          <section className="aq-overview-grid">
            <article className="aq-index-card">
              <div className="aq-index-heading">
                <div>
                  <span className="aq-overline">
                    EUROPEAN AIR QUALITY INDEX
                  </span>
                  <h2>Current air quality</h2>
                </div>
                <Activity size={20} />
              </div>

              {level && numeric(aqi) ? (
                <div className="aq-index-content">
                  <div className={`aq-index-number aq-level-${level.level}`}>
                    <strong>{Math.round(aqi)}</strong>
                    <span>EU AQI</span>
                  </div>
                  <div className="aq-index-description">
                    <span
                      className={`aq-level-label aq-level-label-${level.level}`}
                    >
                      {level.label}
                    </span>
                    <h3>{level.detail}</h3>
                    <p>
                      European AQI uses the EEA scale. Higher values indicate
                      higher air pollution.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="aq-index-missing">
                  European AQI is not available for this location.
                </div>
              )}

              <div className="aq-index-scale" aria-label="European AQI scale">
                {[
                  ["Good", "aq-scale-1"],
                  ["Fair", "aq-scale-2"],
                  ["Moderate", "aq-scale-3"],
                  ["Poor", "aq-scale-4"],
                  ["Very poor", "aq-scale-5"],
                  ["Extreme", "aq-scale-6"],
                ].map(([label, className]) => (
                  <div className={className} key={label} title={label} />
                ))}
              </div>
              <div className="aq-scale-labels">
                <span>0 · Good</span>
                <span>100+ · Extremely poor</span>
              </div>
            </article>

            <article className="aq-us-index-card">
              <span className="aq-overline">UNITED STATES AQI</span>
              <div className="aq-us-index-value">
                <strong>
                  {numeric(current.us_aqi) ? Math.round(current.us_aqi) : "—"}
                </strong>
                <span>US AQI</span>
              </div>
              <p>
                A separate index calculated using the United States AQI
                methodology.
              </p>
              <div className="aq-us-index-foot">
                <Gauge size={16} />
                <span>Independent scale · Not interchangeable with EU AQI</span>
              </div>
            </article>
          </section>

          <section className="aq-section">
            <div className="aq-section-heading">
              <div>
                <span className="aq-overline">LIVE MODEL SNAPSHOT</span>
                <h2>Pollutant concentrations</h2>
              </div>
              <span className="aq-section-note">
                μg/m³ unless stated otherwise
              </span>
            </div>

            <div className="aq-pollutant-grid">
              {pollutants.map((pollutant) => {
                const value = current[pollutant.key as keyof typeof current];
                const Icon = pollutant.key === "dust" ? Wind : Atom;

                return (
                  <article className="aq-pollutant-card" key={pollutant.key}>
                    <div className="aq-pollutant-top">
                      <span>{pollutant.short}</span>
                      <Icon size={17} />
                    </div>
                    <div className="aq-pollutant-value">
                      <strong>{displayValue(value)}</strong>
                      <span>{pollutant.unit}</span>
                    </div>
                    <h3>{pollutant.label}</h3>
                    <p>{pollutant.description}</p>
                    {!numeric(value) && (
                      <span className="aq-data-unavailable">NOT AVAILABLE</span>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="aq-section">
            <div className="aq-section-heading">
              <div>
                <span className="aq-overline">ATMOSPHERIC SIGNALS</span>
                <h2>Five-day pollutant trends</h2>
              </div>
              <span className="aq-section-note">
                Forecast resolution depends on model coverage
              </span>
            </div>

            <div className="aq-chart-grid">
              <TrendChart
                title="Fine particles · PM2.5"
                unit="μg/m³"
                values={hourly?.pm2_5}
                times={hourly?.time ?? []}
                color="#72c9e9"
              />
              <TrendChart
                title="Particulate matter · PM10"
                unit="μg/m³"
                values={hourly?.pm10}
                times={hourly?.time ?? []}
                color="#d8b879"
              />
              <TrendChart
                title="Atmospheric dust"
                unit="μg/m³"
                values={hourly?.dust}
                times={hourly?.time ?? []}
                color="#a8a0df"
              />
              <TrendChart
                title="Ground-level ozone · O₃"
                unit="μg/m³"
                values={hourly?.ozone}
                times={hourly?.time ?? []}
                color="#83d4ba"
              />
            </div>
          </section>

          <section className="aq-section">
            <div className="aq-section-heading">
              <div>
                <span className="aq-overline">EXPOSURE INDICATORS</span>
                <h2>UV and pollen outlook</h2>
              </div>
              <Leaf size={19} />
            </div>

            <div className="aq-exposure-grid">
              <MetricCard
                label="Ultraviolet index"
                value={displayValue(current.uv_index)}
                unit="UV"
                icon={Activity}
                note="Current modelled UV index"
              />
              <MetricCard
                label="Aerosol optical depth"
                value={displayValue(current.aerosol_optical_depth, 3)}
                unit="AOD"
                icon={Droplets}
                note="Atmospheric aerosol optical depth"
              />
            </div>

            <div className="aq-pollen-panel">
              <div className="aq-pollen-heading">
                <div>
                  <span className="aq-overline">POLLEN MONITORING</span>
                  <h3>Current pollen concentrations</h3>
                </div>
                <Leaf size={18} />
              </div>

              {pollenAvailable ? (
                <div className="aq-pollen-grid">
                  {pollenItems.map(([key, label]) => {
                    const value = current[key];
                    return (
                      <div className="aq-pollen-item" key={key}>
                        <span>{label}</span>
                        <strong>
                          {numeric(value)
                            ? `${displayValue(value)} μg/m³`
                            : "Unavailable"}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="aq-pollen-unavailable">
                  Pollen data is not currently available for this location or
                  forecast period. Availability depends on regional model
                  coverage and pollen season.
                </p>
              )}
            </div>
          </section>

          <section className="aq-section">
            <div className="aq-section-heading">
              <div>
                <span className="aq-overline">UPCOMING CONDITIONS</span>
                <h2>Air quality forecast</h2>
              </div>
              <span className="aq-section-note">Modelled AQI values</span>
            </div>

            <div className="aq-hourly-list">
              {(hourly?.time ?? [])
                .map((time, index) => ({ time, index }))
                .filter(
                  ({ time }) =>
                    new Date(time).getTime() >=
                    currentTimestamp - 60 * 60 * 1000,
                )
                .slice(0, 12)
                .map(({ time, index }) => {
                  const eu = hourly?.european_aqi?.[index];
                  const us = hourly?.us_aqi?.[index];
                  const pm25 = hourly?.pm2_5?.[index];
                  const itemLevel = numeric(eu) ? europeanLevel(eu) : null;

                  return (
                    <article className="aq-hour-item" key={time}>
                      <span className="aq-hour-time">
                        {formatLocalTime(time, data.timezone)}
                      </span>
                      <div className="aq-hour-index">
                        <strong>{numeric(eu) ? Math.round(eu) : "—"}</strong>
                        <span>EU AQI</span>
                      </div>
                      <div className="aq-hour-status">
                        <span
                          className={
                            itemLevel
                              ? `aq-level-label aq-level-label-${itemLevel.level}`
                              : ""
                          }
                        >
                          {itemLevel?.label ?? "Unavailable"}
                        </span>
                      </div>
                      <div className="aq-hour-detail">
                        <span>PM2.5</span>
                        <strong>{displayValue(pm25)} μg/m³</strong>
                      </div>
                      <div className="aq-hour-detail">
                        <span>US AQI</span>
                        <strong>{numeric(us) ? Math.round(us) : "—"}</strong>
                      </div>
                    </article>
                  );
                })}
            </div>
          </section>

          <footer className="aq-data-footer">
            <div>
              <span className="aq-data-dot" />
              <span>ATMOSPHERIC MODEL DATA · CAMS</span>
            </div>
            <span>
              Updated: {formatLocalTime(current.time, data.timezone)} ·{" "}
              {data.timezone}
            </span>
            <a
              href="https://open-meteo.com/en/docs/air-quality-api"
              target="_blank"
              rel="noreferrer"
            >
              Data by Open-Meteo
            </a>
          </footer>
        </>
      )}
    </div>
  );
}
