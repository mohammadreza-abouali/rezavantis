"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,

  Droplets,
  Eye,
  Gauge,
  RefreshCw,
  Sunrise,
  Sunset,
  Sun,
  Thermometer,
  Wind,
} from "lucide-react";

import { getForecast } from "@/services/openMeteo";
import { useLocationStore } from "@/store/locationStore";
import AtmosphericGlobe from "@/components/visualization/AtmosphericGlobe";

function weatherDescription(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Atmospheric conditions";
}

function WeatherIcon({ code, size = 20 }: { code: number; size?: number }) {
  if (code === 0 || code === 1) return <Sun size={size} />;
  if ([2, 3].includes(code)) return <Cloud size={size} />;
  if ([45, 48].includes(code)) return <CloudFog size={size} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle size={size} />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <CloudRain size={size} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={size} />;
  if ([95, 96, 99].includes(code)) return <CloudLightning size={size} />;
  return <Cloud size={size} />;
}

function formatApiTime(value: string, options: Intl.DateTimeFormatOptions) {
  const [datePart, timePart = "00:00"] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);

  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));

  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function formatApiDate(value: string, options: Intl.DateTimeFormatOptions) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return new Intl.DateTimeFormat("en", {
    ...options,
    timeZone: "UTC",
  }).format(date);
}

function windDirection(degrees: number) {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return directions[Math.round(degrees / 45) % 8];
}

function visibilityLabel(meters: number) {
  if (!Number.isFinite(meters)) return "Unavailable";
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

function uvDescription(value: number) {
  if (value <= 2) return "Low";
  if (value <= 5) return "Moderate";
  if (value <= 7) return "High";
  if (value <= 10) return "Very high";
  return "Extreme";
}

function MetricChart({
  title,
  description,
  values,
  unit,
  latest,
  icon,
  color,
}: {
  title: string;
  description: string;
  values: number[];
  unit: string;
  latest: number;
  icon: React.ReactNode;
  color: string;
}) {
  const validValues = values.filter(Number.isFinite);
  const min = Math.min(...validValues);
  const max = Math.max(...validValues);
  const spread = max - min || 1;

  const points = validValues
    .map((value, index) => {
      const x = 12 + (index / Math.max(1, validValues.length - 1)) * 296;
      const y = 91 - ((value - min) / spread) * 70;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <article className="forecast-chart-card">
      <div className="forecast-chart-top">
        <div className="forecast-chart-icon" style={{ color }}>
          {icon}
        </div>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="forecast-chart-value">
        <strong>{Number.isFinite(latest) ? latest.toFixed(1) : "—"}</strong>
        <span>{unit}</span>
      </div>
      <svg
        className="forecast-chart-svg"
        viewBox="0 0 320 112"
        role="img"
        aria-label={`${title} trend over the next 24 hours`}
      >
        <line x1="12" y1="21" x2="308" y2="21" />
        <line x1="12" y1="56" x2="308" y2="56" />
        <line x1="12" y1="91" x2="308" y2="91" />
        {validValues.length > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <div className="forecast-chart-axis">
        <span>NOW</span>
        <span>+6H</span>
        <span>+12H</span>
        <span>+18H</span>
        <span>+24H</span>
      </div>
    </article>
  );
}

function ForecastSkeleton() {
  return (
    <div className="forecast-skeleton">
      <div className="forecast-skeleton-heading" />
      <div className="forecast-skeleton-hours">
        {Array.from({ length: 8 }).map((_, index) => (
          <div className="forecast-skeleton-card" key={index} />
        ))}
      </div>
      <div className="forecast-skeleton-days">
        {Array.from({ length: 7 }).map((_, index) => (
          <div className="forecast-skeleton-day" key={index} />
        ))}
      </div>
    </div>
  );
}

export default function ForecastExperience() {
  const selectedCity = useLocationStore((state) => state.selectedCity);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: [
      "weather-forecast",
      selectedCity?.latitude,
      selectedCity?.longitude,
    ],
    queryFn: () => getForecast(selectedCity!.latitude, selectedCity!.longitude),
    enabled: selectedCity !== null,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const cityLabel = selectedCity
    ? [selectedCity.name, selectedCity.country].filter(Boolean).join(", ")
    : "";

  if (!selectedCity) {
    return (
      <div className="module-page forecast-page">
        <div className="module-page-heading">
          <span className="eyebrow">
            <span className="eyebrow-line" /> FORECAST
          </span>
          <div className="module-page-title-row">
            <div>
              <h1>Weather Forecast</h1>
              <p>
                Explore hourly conditions and the atmospheric outlook for the
                week ahead.
              </p>
            </div>
            <div className="module-page-icon">
              <Cloud size={25} strokeWidth={1.4} />
            </div>
          </div>
        </div>
        <div className="forecast-empty">
          <div className="forecast-empty-icon">
            <Cloud size={30} />
          </div>
          <span className="eyebrow">LOCATION REQUIRED</span>
          <h2>Your forecast begins with a place.</h2>
          <p>
            Select a city using the search field above to retrieve its real
            hourly and daily forecast.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="module-page forecast-page">
      <div className="module-page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" /> ATMOSPHERIC OUTLOOK / 001
        </span>
        <div className="module-page-title-row">
          <div>
            <h1>Weather Forecast</h1>
            <p>
              Hour-by-hour conditions and a seven-day outlook for {cityLabel}.
            </p>
          </div>
          <button
            className="forecast-refresh"
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="Refresh forecast"
          >
            <RefreshCw
              size={16}
              className={isFetching ? "forecast-spinning" : ""}
            />
            <span>{isFetching ? "UPDATING" : "REFRESH DATA"}</span>
          </button>
        </div>
      </div>

      {isLoading ? (
        <ForecastSkeleton />
      ) : isError || !data?.hourly || !data.daily ? (
        <div className="forecast-error">
          <CloudLightning size={27} />
          <h2>Forecast data unavailable</h2>
          <p>
            We could not retrieve forecast information for {cityLabel}. Check
            your connection and try again.
          </p>
          <button type="button" onClick={() => refetch()}>
            Retry connection
          </button>
        </div>
      ) : (
        <>
          {(() => {
            const startIndex = Math.max(
              0,
              data.hourly.time.findIndex(
                (time) => time >= data.current.time.slice(0, 13),
              ),
            );
            const hours = data.hourly.time.slice(startIndex, startIndex + 24);
            const currentIndex = startIndex;
            const hourly = data.hourly;
            const daily = data.daily;
            const uv = daily.uv_index_max[0];
            const chartValues = (values: number[]) =>
              values.slice(startIndex, startIndex + 24);

            return (
              <>
                <section className="forecast-current-summary">
                  <div className="forecast-summary-heading">
                    <div>
                      <span className="eyebrow">CURRENT CONDITIONS</span>
                      <h2>Atmospheric snapshot</h2>
                      <p>Live conditions reported for {cityLabel}</p>
                    </div>
                    
                  </div>

                  <div className="forecast-space-stage">
                    <div className="forecast-space-globe-wrap">
                      <AtmosphericGlobe
                        rotation={true}
                        atmosphere={true}
                        clouds={true}
                        orbits={true}
                        weather={data.current}
                        latitude={selectedCity.latitude}
                        longitude={selectedCity.longitude}
                        cinematic
                      />
                    </div>

                    <div className="forecast-space-overlay-top">
                      <span>REZAVANTIS / ORBITAL WEATHER VIEW</span>
                      <span>LIVE ATMOSPHERIC DATA</span>
                    </div>

                    
                  </div>

                    <div className="forecast-space-info-bar">
                      <div className="forecast-space-location">
                        <span className="forecast-space-label">DESTINATION LOCKED</span>
                        <strong>{cityLabel}</strong>
                        <small>
                          {selectedCity.latitude.toFixed(2)}° N / {selectedCity.longitude.toFixed(2)}° E
                        </small>
                      </div>

                      <div className="forecast-space-live">
                        <div className="forecast-space-condition">
                          <WeatherIcon code={data.current.weather_code} size={19} />
                          <span>{weatherDescription(data.current.weather_code)}</span>
                        </div>
                        <strong>{Math.round(data.current.temperature_2m)}°C</strong>
                        <span>
                          FEELS LIKE {Math.round(data.current.apparent_temperature)}°C
                        </span>
                      </div>
                    </div>
                  <div className="forecast-current-grid">
                    <div className="forecast-current-metric">
                      <Thermometer size={17} />
                      <span>Temperature</span>
                      <strong>
                        {Math.round(data.current.temperature_2m)}°C
                      </strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Activity size={17} />
                      <span>Feels like</span>
                      <strong>
                        {Math.round(data.current.apparent_temperature)}°C
                      </strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Droplets size={17} />
                      <span>Humidity</span>
                      <strong>{data.current.relative_humidity_2m}%</strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Wind size={17} />
                      <span>Wind</span>
                      <strong>
                        {Math.round(data.current.wind_speed_10m)} km/h
                      </strong>
                      <small>
                        {windDirection(data.current.wind_direction_10m)} · gusts{" "}
                        {Math.round(data.current.wind_gusts_10m)} km/h
                      </small>
                    </div>
                    <div className="forecast-current-metric">
                      <Gauge size={17} />
                      <span>Surface pressure</span>
                      <strong>
                        {Math.round(data.current.surface_pressure)} hPa
                      </strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Eye size={17} />
                      <span>Visibility</span>
                      <strong>
                        {visibilityLabel(hourly.visibility[currentIndex])}
                      </strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Cloud size={17} />
                      <span>Cloud cover</span>
                      <strong>{data.current.cloud_cover}%</strong>
                    </div>
                    <div className="forecast-current-metric">
                      <Sun size={17} />
                      <span>UV index · today</span>
                      <strong>
                        {Number.isFinite(uv) ? uv.toFixed(1) : "—"}
                      </strong>
                      <small>
                        {Number.isFinite(uv)
                          ? uvDescription(uv)
                          : "Unavailable"}
                      </small>
                    </div>
                  </div>

                  <div className="forecast-sun-cycle">
                    <div className="forecast-sun-item">
                      <Sunrise size={21} />
                      <div>
                        <span>Sunrise</span>
                        <strong>
                          {formatApiTime(daily.sunrise[0], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </strong>
                      </div>
                    </div>
                    <div className="forecast-sun-divider" />
                    <div className="forecast-sun-item">
                      <Sunset size={21} />
                      <div>
                        <span>Sunset</span>
                        <strong>
                          {formatApiTime(daily.sunset[0], {
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </strong>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="forecast-section">
                  <div className="forecast-section-heading">
                    <div>
                      <span className="eyebrow">NEXT 24 HOURS</span>
                      <h2>Hourly forecast</h2>
                      <p>Temperature, precipitation and wind through the day</p>
                    </div>
                    <span className="forecast-section-index">01 / 03</span>
                  </div>

                  <div className="hourly-forecast-track">
                    {hours.map((time, offset) => {
                      const index = startIndex + offset;
                      const isFirst = offset === 0;

                      return (
                        <article
                          className={`hourly-forecast-card ${isFirst ? "hourly-forecast-current" : ""}`}
                          key={time}
                        >
                          <span className="hourly-time">
                            {isFirst
                              ? "NOW"
                              : formatApiTime(time, { hour: "numeric" })}
                          </span>
                          <span className="hourly-weather-icon">
                            <WeatherIcon
                              code={hourly.weather_code[index]}
                              size={23}
                            />
                          </span>
                          <strong className="hourly-temperature">
                            {Math.round(hourly.temperature_2m[index])}°
                          </strong>
                          <span className="hourly-condition">
                            {weatherDescription(hourly.weather_code[index])}
                          </span>
                          <div className="hourly-detail">
                            <Droplets size={12} />
                            <span>
                              {hourly.precipitation_probability[index] ?? 0}%
                            </span>
                          </div>
                          <div className="hourly-detail">
                            <CloudRain size={12} />
                            <span>
                              {(hourly.precipitation[index] ?? 0).toFixed(1)} mm
                            </span>
                          </div>
                          <div className="hourly-detail">
                            <Wind size={12} />
                            <span>
                              {Math.round(hourly.wind_speed_10m[index])} km/h
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                  <p className="forecast-scroll-hint">
                    SCROLL TO EXPLORE THE HOURS <span>→</span>
                  </p>
                </section>

                <section className="forecast-section">
                  <div className="forecast-section-heading">
                    <div>
                      <span className="eyebrow">ATMOSPHERIC TRENDS</span>
                      <h2>Next 24-hour analysis</h2>
                      <p>Hourly changes across four atmospheric indicators</p>
                    </div>
                    <span className="forecast-section-index">02 / 03</span>
                  </div>

                  <div className="forecast-chart-grid">
                    <MetricChart
                      title="Temperature"
                      description="Near-surface air temperature"
                      values={chartValues(hourly.temperature_2m)}
                      latest={hourly.temperature_2m[currentIndex]}
                      unit="°C"
                      icon={<Thermometer size={17} />}
                      color="#68c8ed"
                    />
                    <MetricChart
                      title="Humidity"
                      description="Relative humidity"
                      values={chartValues(hourly.relative_humidity_2m)}
                      latest={hourly.relative_humidity_2m[currentIndex]}
                      unit="%"
                      icon={<Droplets size={17} />}
                      color="#66b9df"
                    />
                    <MetricChart
                      title="Wind speed"
                      description="10-metre wind speed"
                      values={chartValues(hourly.wind_speed_10m)}
                      latest={hourly.wind_speed_10m[currentIndex]}
                      unit="km/h"
                      icon={<Wind size={17} />}
                      color="#a3d8e9"
                    />
                    <MetricChart
                      title="Surface pressure"
                      description="Atmospheric surface pressure"
                      values={chartValues(hourly.surface_pressure)}
                      latest={hourly.surface_pressure[currentIndex]}
                      unit="hPa"
                      icon={<Gauge size={17} />}
                      color="#d7bd88"
                    />
                  </div>
                </section>

                <section className="forecast-section forecast-daily-section">
                  <div className="forecast-section-heading">
                    <div>
                      <span className="eyebrow">SEVEN DAY OUTLOOK</span>
                      <h2>The week ahead</h2>
                      <p>Daily temperature range, precipitation and wind</p>
                    </div>
                    <span className="forecast-section-index">03 / 03</span>
                  </div>

                  <div className="daily-forecast-list">
                    {daily.time.map((date, index) => (
                      <article className="daily-forecast-row" key={date}>
                        <div className="daily-date">
                          <strong>
                            {index === 0
                              ? "Today"
                              : formatApiDate(date, { weekday: "short" })}
                          </strong>
                          <span>
                            {formatApiDate(date, {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        </div>

                        <div className="daily-condition">
                          <span className="daily-weather-icon">
                            <WeatherIcon
                              code={daily.weather_code[index]}
                              size={23}
                            />
                          </span>
                          <span>
                            {weatherDescription(daily.weather_code[index])}
                          </span>
                        </div>

                        <div className="daily-rain">
                          <Droplets size={14} />
                          <span>
                            {daily.precipitation_probability_max[index] ?? 0}%
                          </span>
                        </div>

                        <div className="daily-temperature-range">
                          <span>
                            {Math.round(daily.temperature_2m_min[index])}°
                          </span>
                          <div className="daily-range-track">
                            <span
                              style={{
                                left: `${Math.max(0, Math.min(100, ((daily.temperature_2m_min[index] + 20) / 70) * 100))}%`,
                                right: `${Math.max(0, Math.min(100, 100 - ((daily.temperature_2m_max[index] + 20) / 70) * 100))}%`,
                              }}
                            />
                          </div>
                          <strong>
                            {Math.round(daily.temperature_2m_max[index])}°
                          </strong>
                        </div>

                        <div className="daily-wind">
                          <Wind size={14} />
                          <span>
                            {Math.round(daily.wind_speed_10m_max[index])} km/h
                          </span>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <div className="forecast-data-footer">
                  <span>
                    <span className="weather-status-dot" /> DATA RETRIEVED
                  </span>
                  <span>LOCAL TIME · {data.timezone}</span>
                  <span>
                    SOURCE:{" "}
                    <a
                      href="https://open-meteo.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      OPEN-METEO
                    </a>
                  </span>
                </div>
              </>
            );
          })()}
        </>
      )}
    </div>
  );
}
