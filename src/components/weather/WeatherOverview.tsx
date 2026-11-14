"use client";

import { useQuery } from "@tanstack/react-query";
import { Cloud, Droplets, Gauge, Thermometer, Wind } from "lucide-react";

import { getCurrentWeather } from "@/services/openMeteo";
import { useLocationStore } from "@/store/locationStore";

function getWeatherDescription(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Mainly clear";
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

function WeatherMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
}) {
  return (
    <div className="weather-metric">
      <span className="weather-metric-icon">
        <Icon size={17} strokeWidth={1.6} />
      </span>
      <span className="weather-metric-label">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function WeatherOverview() {
  const selectedCity = useLocationStore((state) => state.selectedCity);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      "current-weather",
      selectedCity?.latitude,
      selectedCity?.longitude,
    ],
    queryFn: () =>
      getCurrentWeather(selectedCity!.latitude, selectedCity!.longitude),
    enabled: selectedCity !== null,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (!selectedCity) {
    return (
      <section className="location-empty-state">
        <div className="empty-state-icon">
          <Cloud size={22} />
        </div>
        <div>
          <span className="eyebrow">YOUR ATMOSPHERIC VIEW</span>
          <h2>Start with a location</h2>
          <p>
            Search for a city above or use your current location to explore real
            atmospheric conditions.
          </p>
        </div>
      </section>
    );
  }

  const cityLabel = [selectedCity.name, selectedCity.country]
    .filter(Boolean)
    .join(", ");

  if (isLoading) {
    return (
      <section className="live-weather-panel weather-loading">
        <div className="weather-panel-heading">
          <div>
            <span className="eyebrow">LIVE ATMOSPHERIC CONDITIONS</span>
            <h2>{cityLabel}</h2>
          </div>
          <span className="weather-live-status">RETRIEVING DATA</span>
        </div>

        <div className="weather-skeleton-grid">
          {Array.from({ length: 5 }).map((_, index) => (
            <div className="weather-skeleton" key={index} />
          ))}
        </div>
      </section>
    );
  }

  if (isError || !data?.current) {
    return (
      <section className="live-weather-panel weather-error">
        <span className="eyebrow">DATA CONNECTION</span>
        <h2>Weather data unavailable</h2>
        <p>
          We could not retrieve current conditions for {cityLabel}. Check your
          connection and try again.
        </p>
        <button type="button" onClick={() => refetch()}>
          Retry connection
        </button>
      </section>
    );
  }

  const current = data.current;

  const updatedTime = new Date(current.time).toLocaleTimeString("en", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: data.timezone,
  });

  return (
    <section className="live-weather-panel">
      <div className="weather-panel-heading">
        <div>
          <span className="eyebrow">
            <span className="weather-status-dot" />
            LIVE ATMOSPHERIC CONDITIONS
          </span>

          <h2>{cityLabel}</h2>

          <p>
            {getWeatherDescription(current.weather_code)} · Updated{" "}
            {updatedTime}
          </p>
        </div>

        <div className="weather-temperature">
          <strong>{Math.round(current.temperature_2m)}°</strong>
          <span>Feels like {Math.round(current.apparent_temperature)}°C</span>
        </div>
      </div>

      <div className="weather-metrics-grid">
        <WeatherMetric
          icon={Droplets}
          label="HUMIDITY"
          value={`${current.relative_humidity_2m}%`}
        />

        <WeatherMetric
          icon={Wind}
          label="WIND SPEED"
          value={`${current.wind_speed_10m} km/h`}
        />

        <WeatherMetric
          icon={Gauge}
          label="PRESSURE"
          value={`${Math.round(current.surface_pressure)} hPa`}
        />

        <WeatherMetric
          icon={Cloud}
          label="CLOUD COVER"
          value={`${current.cloud_cover}%`}
        />

        <WeatherMetric
          icon={Thermometer}
          label="PRECIPITATION"
          value={`${current.precipitation} mm`}
        />
      </div>

      <div className="weather-data-credit">
        Weather data by{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
        <span>·</span>
        {data.timezone}
      </div>
    </section>
  );
}
