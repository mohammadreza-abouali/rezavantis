"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import AtmosphericGlobe from "@/components/visualization/AtmosphericGlobe";
import { getCurrentWeather } from "@/services/openMeteo";
import { hydrateLocationStore, useLocationStore } from "@/store/locationStore";

function weatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather conditions";
}

function windDirectionLabel(degrees: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function formatCoordinate(value: number): string {
  return Math.abs(value).toFixed(2) + "°" + (value >= 0 ? "N" : "S");
}

function formatLongitude(value: number): string {
  return Math.abs(value).toFixed(2) + "°" + (value >= 0 ? "E" : "W");
}


function SceneControl({
  title,
  enabled,
  onClick,
}: {
  title: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`atmosphere-control${enabled ? " active" : ""}`}
      aria-pressed={enabled}
      onClick={onClick}
    >
      <span className="control-indicator" aria-hidden="true" />
      <span>{title}</span>
      <span className="atmosphere-control-status">
        {enabled ? "ON" : "OFF"}
      </span>
    </button>
  );
}
export default function AtmosphereExperience() {
  const [rotation, setRotation] = useState(true);
  const [atmosphere, setAtmosphere] = useState(true);
  const [clouds, setClouds] = useState(true);
  const [orbits, setOrbits] = useState(true);

  const selectedCity = useLocationStore((state) => state.selectedCity);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  const weatherQuery = useQuery({
    queryKey: [
      "atmosphere-weather",
      selectedCity?.latitude,
      selectedCity?.longitude,
    ],
    queryFn: () => {
      if (!selectedCity) {
        throw new Error("No location selected");
      }

      return getCurrentWeather(
        selectedCity.latitude,
        selectedCity.longitude,
      );
    },
    enabled: selectedCity !== null,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  const weather = weatherQuery.data?.current ?? null;
  const cityName = selectedCity
    ? [selectedCity.name, selectedCity.country].filter(Boolean).join(", ")
    : null;

  const statusText = !selectedCity
    ? "NO LOCATION SELECTED"
    : weatherQuery.isLoading
      ? "ACQUIRING LIVE CONDITIONS"
      : weatherQuery.isError
        ? "LIVE DATA UNAVAILABLE"
        : "LIVE CONDITIONS CONNECTED";

  const statusDetail = !selectedCity
    ? "SELECT A CITY TO BEGIN"
    : weatherQuery.isLoading
      ? "CONNECTING TO OPEN-METEO"
      : weatherQuery.isError
        ? "CHECK CONNECTION AND RETRY"
        : "OPEN-METEO / CURRENT WEATHER";

  return (
    <section className="atmosphere-experience">
      <div className="atmosphere-heading">
        <div>
          <div className="atmosphere-eyebrow">
            <span className="status-pulse" />
            SPATIAL VISUALIZATION ENGINE
          </div>

          <h1>
            The <span>Living</span> Atmosphere
          </h1>

          <p>
            A real-time atmospheric visualization driven by current
            environmental observations for your selected location.
          </p>
        </div>

        <div className="atmosphere-version">
          <span>ENGINE</span>
          <strong>03D / 03</strong>
          <small>LIVE DATA LINK</small>
        </div>
      </div>

            <div className="atmosphere-visual-layout">
        <div className="atmosphere-stage">
        <div className="atmosphere-stage-grid" />

        <div className="atmosphere-stage-glow" />

        <div className="atmosphere-corner atmosphere-corner-top">
          <span>REZAVANTIS / SPATIAL SYSTEM</span>
          <span>PLANETARY VIEW</span>
        </div>

        <div className="atmosphere-globe-wrap">
          <AtmosphericGlobe
            rotation={rotation}
            atmosphere={atmosphere}
            clouds={clouds}
            orbits={orbits}
            weather={weather}
            latitude={selectedCity?.latitude ?? null}
            longitude={selectedCity?.longitude ?? null}
          />
        </div>

        <div className="atmosphere-orbit-label orbit-label-one">
          <span className="orbit-label-dot" />
          ATMOSPHERIC SHELL
        </div>

        <div className="atmosphere-orbit-label orbit-label-two">
          <span className="orbit-label-dot gold" />
          ORBITAL TRAJECTORY
        </div>

        <div className="atmosphere-coordinate">
          <span>SELECTED LOCATION</span>
          <strong>
            {selectedCity ? selectedCity.name.toUpperCase() : "—"}
          </strong>
          <small>
            {selectedCity
              ? formatCoordinate(selectedCity.latitude) +
                " / " +
                formatLongitude(selectedCity.longitude)
              : "LOCATION NOT SET"}
          </small>
        </div>

        <div className="atmosphere-corner atmosphere-corner-bottom">
          <span>{statusText}</span>
          <span>{statusDetail}</span>
        </div>
      </div>

        <aside className="atmosphere-controls">
        <div className="atmosphere-controls-heading">
          <div>
            <span className="atmosphere-section-index">01 / DISPLAY SYSTEM</span>
            <h2>Scene controls</h2>
            <p>Customize the planetary view and atmospheric layers.</p>
          </div>

          <span className="atmosphere-controls-count">
            {[rotation, clouds, atmosphere, orbits].filter(Boolean).length}
            <small> / 04 ACTIVE</small>
          </span>
        </div>

                <div className="atmosphere-control-list">
          <SceneControl
            title="Rotation"
            enabled={rotation}
            onClick={() => setRotation((value) => !value)}
          />

          <SceneControl
            title="Cloud layer"
            enabled={clouds}
            onClick={() => setClouds((value) => !value)}
          />

          <SceneControl
            title="Atmosphere"
            enabled={atmosphere}
            onClick={() => setAtmosphere((value) => !value)}
          />

          <SceneControl
            title="Orbital rings"
            enabled={orbits}
            onClick={() => setOrbits((value) => !value)}
          />
        </div>
      </aside>
      </div>
<div className="atmosphere-live-panel">
        <div className="atmosphere-live-heading">
          <div>
            <span className="atmosphere-live-eyebrow">
              CURRENT ENVIRONMENT
            </span>
            <h2>{cityName ?? "Awaiting selected location"}</h2>
          </div>

          <span
            className={
              weather
                ? "atmosphere-live-status connected"
                : "atmosphere-live-status"
            }
          >
            <span />
            {weather ? "LIVE DATA" : selectedCity ? "CONNECTING" : "STANDBY"}
          </span>
        </div>

        {weatherQuery.isLoading && selectedCity && (
          <div className="atmosphere-data-message">
            Retrieving current atmospheric conditions...
          </div>
        )}

        {weatherQuery.isError && selectedCity && (
          <div className="atmosphere-data-message error">
            Current weather could not be retrieved.{" "}
            <button
              type="button"
              onClick={() => void weatherQuery.refetch()}
            >
              Retry connection
            </button>
          </div>
        )}

        {!selectedCity && (
          <div className="atmosphere-data-message">
            Search for a city in the top navigation to load its live
            atmospheric conditions.
          </div>
        )}

        {weather && (
          <>
            <div className="atmosphere-current-condition">
              <strong>{weather.temperature_2m.toFixed(1)}°C</strong>
              <div>
                <span>{weatherDescription(weather.weather_code)}</span>
                <small>
                  Feels like {weather.apparent_temperature.toFixed(1)}°C
                </small>
              </div>
            </div>

            <div className="atmosphere-metrics">
              <div className="atmosphere-metric">
                <span>HUMIDITY</span>
                <strong>{weather.relative_humidity_2m}%</strong>
              </div>

              <div className="atmosphere-metric">
                <span>CLOUD COVER</span>
                <strong>{weather.cloud_cover}%</strong>
              </div>

              <div className="atmosphere-metric">
                <span>WIND</span>
                <strong>
                  {weather.wind_speed_10m.toFixed(1)}
                  <small> km/h</small>
                </strong>
                <small>
                  {windDirectionLabel(weather.wind_direction_10m)} ·{" "}
                  {Math.round(weather.wind_direction_10m)}°
                </small>
              </div>

              <div className="atmosphere-metric">
                <span>PRECIPITATION</span>
                <strong>
                  {weather.precipitation.toFixed(1)}
                  <small> mm</small>
                </strong>
              </div>

              <div className="atmosphere-metric">
                <span>PRESSURE</span>
                <strong>
                  {Math.round(weather.surface_pressure)}
                  <small> hPa</small>
                </strong>
              </div>

              <div className="atmosphere-metric">
                <span>WIND GUSTS</span>
                <strong>
                  {weather.wind_gusts_10m.toFixed(1)}
                  <small> km/h</small>
                </strong>
              </div>
            </div>

            <div className="atmosphere-live-footer">
              <span>OBSERVATION TIME · {weather.time.replace("T", " ")}</span>
              <span>TIMEZONE · {weatherQuery.data?.timezone ?? "LOCAL"}</span>
            </div>
          </>
        )}
      </div>

      <div className="atmosphere-note">
        <span className="note-mark">i</span>
        <p>
          Live measurements are retrieved for the selected location.
          Cloud formations are a procedural 3D visualization whose density,
          drift and appearance respond to those measurements; they are not
          georeferenced satellite imagery or a live global cloud map.
        </p>
      </div>
    </section>
  );
}