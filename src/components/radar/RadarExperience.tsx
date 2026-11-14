"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CloudRain,
  Clock3,
  Layers3,
  LoaderCircle,
  MapPin,
  Pause,
  Play,
  Radar,
  RefreshCw,
  Wind,
} from "lucide-react";
import { getCurrentWeather } from "@/services/openMeteo";
import { getRadarFrames } from "@/services/radar";
import {
  hydrateLocationStore,
  useLocationStore,
  useLocationStoreHydrated,
} from "@/store/locationStore";

const RadarMap = dynamic(() => import("./RadarMap"), {
  ssr: false,
  loading: () => (
    <div className="radar-map-loading">
      <LoaderCircle size={28} />
      <span>INITIALIZING GEOSPATIAL ENGINE</span>
    </div>
  ),
});

function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Atmospheric conditions";
}

function frameTime(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function RadarExperience() {
  const selectedCity = useLocationStore((state) => state.selectedCity);
  const favoriteCities = useLocationStore((state) => state.favoriteCities);

  const hydrated = useLocationStoreHydrated();
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showRadar, setShowRadar] = useState(true);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  const radarQuery = useQuery({
    queryKey: ["rainviewer-radar-frames"],
    queryFn: getRadarFrames,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  const weatherQuery = useQuery({
    queryKey: [
      "radar-location-weather",
      selectedCity?.latitude,
      selectedCity?.longitude,
    ],
    queryFn: () =>
      getCurrentWeather(selectedCity!.latitude, selectedCity!.longitude),
    enabled: hydrated && !!selectedCity,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
    retry: 1,
  });

  const frames = radarQuery.data?.radar.past ?? [];
  const safeIndex = Math.min(frameIndex, Math.max(frames.length - 1, 0));
  const activeFrame = frames[safeIndex] ?? null;

  const mapCenter = useMemo<[number, number] | null>(() => {
    if (!selectedCity) return null;
    return [selectedCity.latitude, selectedCity.longitude];
  }, [selectedCity]);


  useEffect(() => {
    if (!playing || frames.length < 2) return;

    const timer = window.setInterval(() => {
      setFrameIndex((current) => (current + 1) % frames.length);
    }, 850);

    return () => window.clearInterval(timer);
  }, [playing, frames.length]);


  const current = weatherQuery.data?.current;

  function toggleRadar() {
    setShowRadar((value) => !value);
    setPlaying(false);
  }

  return (
    <div className="module-page radar-page">
      <div className="module-page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" /> GEOSPATIAL WEATHER SYSTEM
        </span>

        <div className="module-page-title-row">
          <div>
            <h1>Radar &amp; Maps</h1>
            <p>
              Explore precipitation radar and your saved locations through an
              interactive global map.
            </p>
          </div>
          <div className="module-page-icon">
            <Radar size={26} strokeWidth={1.4} />
          </div>
        </div>
      </div>

      <section className="radar-command-panel">
        <div>
          <span className="panel-overline">GEOSPATIAL ENGINE</span>
          <h2>Atmosphere, mapped.</h2>
          <p>
            Track observed precipitation patterns and explore the locations
            connected to your personal weather network.
          </p>
        </div>

        <div className="radar-command-status">
          <span
            className={`radar-status-dot ${radarQuery.isError ? "is-error" : ""}`}
          />
          <div>
            <strong>
              {radarQuery.isError ? "RADAR UNAVAILABLE" : "RADAR SERVICE"}
            </strong>
            <small>
              {radarQuery.isSuccess
                ? "DATA CONNECTION READY"
                : radarQuery.isLoading
                  ? "CONNECTING..."
                  : "CONNECTION REQUIRED"}
            </small>
          </div>
        </div>
      </section>

      <section className="radar-workspace">
        <div className="radar-map-panel">
          <div className="radar-map-toolbar">
            <div className="radar-map-heading">
              <span className="radar-live-indicator" />
              <div>
                <strong>PRECIPITATION RADAR</strong>
                <small>GLOBAL MAP · INTERACTIVE VIEW</small>
              </div>
            </div>

            <div className="radar-map-actions">
              <button
                type="button"
                className={`radar-layer-button ${showRadar ? "is-active" : ""}`}
                onClick={toggleRadar}
              >
                <Layers3 size={15} />
                {showRadar ? "Radar on" : "Radar off"}
              </button>

              <button
                type="button"
                className="radar-refresh-button"
                onClick={() => radarQuery.refetch()}
                disabled={radarQuery.isFetching}
                aria-label="Refresh radar data"
                title="Refresh radar data"
              >
                <RefreshCw
                  size={16}
                  className={radarQuery.isFetching ? "radar-spinning" : ""}
                />
              </button>
            </div>
          </div>

          <div className="radar-map-stage">
            {radarQuery.isError ? (
              <div className="radar-map-error">
                <AlertCircle size={30} />
                <strong>Radar data is temporarily unavailable</strong>
                <p>
                  The base map and saved locations can still be used. Try
                  refreshing the radar connection.
                </p>
                <button type="button" onClick={() => radarQuery.refetch()}>
                  Retry connection
                </button>
              </div>
            ) : (
              <RadarMap
                center={mapCenter}
                selectedCity={selectedCity}
                favoriteCities={favoriteCities}
                radarHost={radarQuery.data?.host ?? null}
                radarFrame={activeFrame}
                showRadar={showRadar}
              />
            )}

            <div className="radar-map-overlay">
              <span>REZAVANTIS / GEO-01</span>
              <span>
                {selectedCity ? selectedCity.name.toUpperCase() : "GLOBAL VIEW"}
              </span>
            </div>
          </div>

          <div className="radar-timeline">
            <div className="radar-timeline-top">
              <div>
                <span className="panel-overline">RADAR TIMELINE</span>
                <strong>
                  {activeFrame
                    ? frameTime(activeFrame.time) + " UTC"
                    : "Waiting for frames"}
                </strong>
              </div>

              <button
                type="button"
                className="radar-play-button"
                onClick={() => setPlaying((value) => !value)}
                disabled={frames.length < 2 || !showRadar}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
                {playing ? "Pause" : "Play"}
              </button>
            </div>

            <input
              className="radar-timeline-slider"
              type="range"
              min={0}
              max={Math.max(frames.length - 1, 0)}
              value={safeIndex}
              onChange={(event) => {
                setPlaying(false);
                setFrameIndex(Number(event.target.value));
              }}
              disabled={frames.length < 2}
              aria-label="Select radar time frame"
            />

            <div className="radar-timeline-labels">
              <span>{frames.length ? frameTime(frames[0].time) : "--:--"}</span>
              <span>
                {frames.length
                  ? `${frames.length} available frames`
                  : "No frames"}
              </span>
              <span>
                {frames.length
                  ? frameTime(frames[frames.length - 1].time)
                  : "--:--"}
              </span>
            </div>
          </div>
        </div>

        <aside className="radar-side-panel">
          <div className="radar-side-heading">
            <span className="panel-overline">LOCATION INTELLIGENCE</span>
            <h2>Local conditions</h2>
          </div>

          {!hydrated ? (
            <div className="radar-side-empty">
              <LoaderCircle size={22} />
              <p>Loading location preferences...</p>
            </div>
          ) : !selectedCity ? (
            <div className="radar-side-empty">
              <MapPin size={25} />
              <strong>No active location</strong>
              <p>
                Search for a city in the top bar or choose one from My Places to
                display its current atmospheric conditions.
              </p>
            </div>
          ) : (
            <>
              <div className="radar-location-name">
                <span>{selectedCity.country}</span>
                <strong>{selectedCity.name}</strong>
                <small>
                  {selectedCity.latitude.toFixed(2)}° N /{" "}
                  {selectedCity.longitude.toFixed(2)}° E
                </small>
              </div>

              {weatherQuery.isLoading ? (
                <div className="radar-side-empty">
                  <LoaderCircle size={22} />
                  <p>Collecting local conditions...</p>
                </div>
              ) : weatherQuery.isError ? (
                <div className="radar-side-empty">
                  <AlertCircle size={22} />
                  <p>Weather data is currently unavailable.</p>
                  <button type="button" onClick={() => weatherQuery.refetch()}>
                    Retry
                  </button>
                </div>
              ) : current ? (
                <>
                  <div className="radar-current-weather">
                    <strong>{Math.round(current.temperature_2m)}°</strong>
                    <span>{weatherLabel(current.weather_code)}</span>
                    <small>
                      Feels like {Math.round(current.apparent_temperature)}°
                    </small>
                  </div>

                  <div className="radar-metric-list">
                    <div>
                      <Wind size={16} />
                      <span>Wind speed</span>
                      <strong>{Math.round(current.wind_speed_10m)} km/h</strong>
                    </div>
                    <div>
                      <Activity size={16} />
                      <span>Wind direction</span>
                      <strong>{Math.round(current.wind_direction_10m)}°</strong>
                    </div>
                    <div>
                      <CloudRain size={16} />
                      <span>Precipitation</span>
                      <strong>{current.precipitation} mm</strong>
                    </div>
                    <div>
                      <Layers3 size={16} />
                      <span>Cloud cover</span>
                      <strong>{current.cloud_cover}%</strong>
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}

          <div className="radar-saved-locations">
            <div className="radar-saved-heading">
              <span className="panel-overline">YOUR NETWORK</span>
              <strong>
                {favoriteCities.length.toString().padStart(2, "0")}
              </strong>
            </div>

            {favoriteCities.length === 0 ? (
              <p>No saved locations yet.</p>
            ) : (
              favoriteCities.slice(0, 5).map((city) => (
                <div
                  className="radar-saved-location"
                  key={`${city.latitude}-${city.longitude}`}
                >
                  <MapPin size={14} />
                  <span>{city.name}</span>
                  <small>{city.country}</small>
                </div>
              ))
            )}
          </div>
        </aside>
      </section>

      <section className="radar-information-strip">
        <div>
          <Clock3 size={17} />
          <span>
            {radarQuery.data
              ? `RADAR FRAMES · ${frames.length} AVAILABLE`
              : "RADAR FRAMES · WAITING"}
          </span>
        </div>
        <p>
          Radar imagery represents historical observations, not a precipitation
          forecast. Coverage and availability vary by region.
        </p>
      </section>

      <div className="radar-attribution">
        <span className="system-dot" />
        MAP DATA © OPENSTREETMAP CONTRIBUTORS
        <span>·</span>
        RADAR DATA BY RAINVIEWER
        <span>·</span>
        WEATHER DATA BY OPEN-METEO
      </div>
    </div>
  );
}
