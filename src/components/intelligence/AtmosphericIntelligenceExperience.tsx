"use client";

import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CloudRain,
  Droplets,
  Gauge,
  Leaf,
  RefreshCw,
  ShieldCheck,
  Sun,
  Thermometer,
  Wind,
  type LucideIcon,
} from "lucide-react";

import { getForecast } from "@/services/openMeteo";
import { getAirQuality } from "@/services/airQuality";
import { analyzeAtmosphere } from "@/services/atmosphericIntelligence";
import {
  hydrateLocationStore,
  useLocationStore,
} from "@/store/locationStore";

import "./AtmosphericIntelligence.css";

type Severity = "critical" | "elevated" | "moderate" | "info";
type Direction = "rising" | "falling" | "stable" | "unavailable";

type Signal = {
  id: string;
  title: string;
  description: string;
  value: string;
  severity: Severity;
  icon: LucideIcon;
};

type Trend = {
  label: string;
  value: string;
  baseline: string;
  change: string;
  direction: Direction;
  explanation: string;
};

const severityLabels: Record<Severity, string> = {
  critical: "HIGH PRIORITY",
  elevated: "ELEVATED",
  moderate: "MODERATE",
  info: "INFORMATION",
};

function weatherDescription(code: number) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog conditions";
  if ([51, 53, 55].includes(code)) return "Drizzle";
  if ([56, 57].includes(code)) return "Freezing drizzle";
  if ([61, 63, 65].includes(code)) return "Rain";
  if ([66, 67].includes(code)) return "Freezing rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Variable conditions";
}

function formatTime(value?: string) {
  if (!value) return "—";
  const match = value.match(/T(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getAqiLabel(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return "Unavailable";
  if (value <= 20) return "Good";
  if (value <= 40) return "Fair";
  if (value <= 60) return "Moderate";
  if (value <= 80) return "Poor";
  if (value <= 100) return "Very poor";
  return "Extremely poor";
}

function getAqiSeverity(value?: number): Severity {
  if (value === undefined || !Number.isFinite(value)) return "info";
  if (value > 100) return "critical";
  if (value > 60) return "elevated";
  if (value > 40) return "moderate";
  return "info";
}

function nearestIndex(times: string[], target: string) {
  if (!times.length) return -1;

  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime)) return 0;

  let bestIndex = -1;
  let bestDifference = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const timestamp = new Date(time).getTime();
    if (!Number.isFinite(timestamp)) return;

    const difference = Math.abs(timestamp - targetTime);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function alignedValue(
  times: string[],
  values: number[] | undefined,
  target: string,
): number | undefined {
  if (!values?.length) return undefined;

  const index = nearestIndex(times, target);
  if (index < 0) return undefined;

  const value = values[index];
  return Number.isFinite(value) ? value : undefined;
}

function getTrend(
  label: string,
  times: string[],
  values: number[] | undefined,
  currentTime: string,
  unit: string,
  threshold: number,
): Trend {
  if (!values?.length || !times.length) {
    return {
      label,
      value: "Unavailable",
      baseline: "—",
      change: "No comparable data",
      direction: "unavailable",
      explanation: "The required hourly data is not available.",
    };
  }

  const startIndex = nearestIndex(times, currentTime);
  if (startIndex < 0) {
    return {
      label,
      value: "Unavailable",
      baseline: "—",
      change: "No comparable data",
      direction: "unavailable",
      explanation: "A valid observation timestamp could not be matched.",
    };
  }

  const startValue = values[startIndex];
  const targetTime = new Date(currentTime).getTime() + 6 * 60 * 60 * 1000;

  let endIndex = startIndex;
  let bestDifference = Number.POSITIVE_INFINITY;

  times.forEach((time, index) => {
    const timestamp = new Date(time).getTime();
    if (!Number.isFinite(timestamp) || timestamp < new Date(currentTime).getTime()) return;

    const difference = Math.abs(timestamp - targetTime);
    if (difference < bestDifference) {
      bestDifference = difference;
      endIndex = index;
    }
  });

  const endValue = values[endIndex];

  if (
    !Number.isFinite(startValue) ||
    !Number.isFinite(endValue) ||
    startValue === undefined ||
    endValue === undefined
  ) {
    return {
      label,
      value: "Unavailable",
      baseline: "—",
      change: "Incomplete readings",
      direction: "unavailable",
      explanation: "The comparison period contains missing values.",
    };
  }

  const difference = endValue - startValue;
  const direction: Direction =
    difference > threshold
      ? "rising"
      : difference < -threshold
        ? "falling"
        : "stable";

  const sign = difference > 0 ? "+" : "";
  const change = `${sign}${difference.toFixed(1)} ${unit}`;

  const explanation =
    direction === "rising"
      ? "The indicator is increasing over the comparison period."
      : direction === "falling"
        ? "The indicator is decreasing over the comparison period."
        : "No material change was detected over the comparison period.";

  return {
    label,
    value: `${endValue.toFixed(1)} ${unit}`,
    baseline: `${startValue.toFixed(1)} ${unit}`,
    change,
    direction,
    explanation,
  };
}

function Metric({
  label,
  value,
  unit,
  icon: Icon,
  detail,
}: {
  label: string;
  value: string;
  unit?: string;
  icon: LucideIcon;
  detail: string;
}) {
  return (
    <div className="intelligence-metric">
      <div className="intelligence-metric-top">
        <span>{label}</span>
        <Icon size={17} strokeWidth={1.6} />
      </div>
      <div className="intelligence-metric-value">
        <strong>{value}</strong>
        {unit && <span>{unit}</span>}
      </div>
      <p>{detail}</p>
    </div>
  );
}

function SignalCard({ signal }: { signal: Signal }) {
  const Icon = signal.icon;

  return (
    <article className={`intelligence-signal signal-${signal.severity}`}>
      <div className="signal-icon">
        <Icon size={19} strokeWidth={1.7} />
      </div>
      <div className="signal-content">
        <div className="signal-heading">
          <h3>{signal.title}</h3>
          <span className={`signal-badge badge-${signal.severity}`}>
            {severityLabels[signal.severity]}
          </span>
        </div>
        <p>{signal.description}</p>
        <strong className="signal-value">{signal.value}</strong>
      </div>
    </article>
  );
}

function TrendCard({ trend }: { trend: Trend }) {
  const Icon =
    trend.direction === "rising"
      ? ArrowUpRight
      : trend.direction === "falling"
        ? ArrowDownRight
        : trend.direction === "stable"
          ? ArrowRight
          : Activity;

  return (
    <article className={`intelligence-trend trend-${trend.direction}`}>
      <div className="intelligence-trend-top">
        <span>{trend.label}</span>
        <Icon size={18} />
      </div>
      <strong>{trend.value}</strong>
      <span className="intelligence-trend-baseline">6H START · {trend.baseline}</span>
      <span className="intelligence-trend-change">{trend.change}</span>
      <p>{trend.explanation}</p>
    </article>
  );
}

export function AtmosphericIntelligenceExperience() {
  const selectedCity = useLocationStore((state) => state.selectedCity);

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  const latitude = selectedCity?.latitude;
  const longitude = selectedCity?.longitude;

  const intelligenceQuery = useQuery({
    queryKey: ["atmospheric-intelligence", latitude, longitude],
    queryFn: async () => {
      if (latitude === undefined || longitude === undefined) {
        throw new Error("Select a location to load atmospheric data.");
      }

      const [forecast, airQuality] = await Promise.all([
        getForecast(latitude, longitude),
        getAirQuality(latitude, longitude),
      ]);

      return { forecast, airQuality };
    },
    enabled: latitude !== undefined && longitude !== undefined,
    staleTime: 10 * 60 * 1000,
    retry: 2,
  });

  const analysis = intelligenceQuery.data;

  const alignedAir = useMemo(() => {
    if (!analysis) return undefined;

    const { forecast, airQuality } = analysis;
    const currentTime = forecast.current.time;
    const hourly = airQuality.hourly;
    const index = nearestIndex(hourly.time, currentTime);

    const nearest = (values?: number[]) => {
      if (!values || index < 0) return undefined;
      const value = values[index];
      return Number.isFinite(value) ? value : undefined;
    };

    return {
      aqi: airQuality.current?.european_aqi ?? nearest(hourly.european_aqi),
      pm25: airQuality.current?.pm2_5 ?? nearest(hourly.pm2_5),
      pm10: airQuality.current?.pm10 ?? nearest(hourly.pm10),
      no2: airQuality.current?.nitrogen_dioxide ?? nearest(hourly.nitrogen_dioxide),
      ozone: airQuality.current?.ozone ?? nearest(hourly.ozone),
      uv: airQuality.current?.uv_index ?? nearest(hourly.uv_index),
      dust: airQuality.current?.dust ?? nearest(hourly.dust),
    };
  }, [analysis]);

  const signals = useMemo<Signal[]>(() => {
    if (!analysis) return [];

    const { forecast } = analysis;
    const current = forecast.current;
    const hourly = forecast.hourly;
    const air = alignedAir;

    const startIndex = Math.max(
      0,
      hourly.time.findIndex((time) => time >= current.time),
    );

    let maxGust = current.wind_gusts_10m;
    let maxRainProbability = 0;
    let maxRainAmount = 0;
    let combinedRainWind = false;
    let combinedRainValue = "";

    for (let offset = 0; offset < 12; offset += 1) {
      const index = startIndex + offset;
      if (index >= hourly.time.length) break;

      const gust = hourly.wind_gusts_10m[index];
      const probability = hourly.precipitation_probability[index];
      const amount = hourly.precipitation[index];

      if (Number.isFinite(gust)) maxGust = Math.max(maxGust, gust);
      if (Number.isFinite(probability)) {
        maxRainProbability = Math.max(maxRainProbability, probability);
      }

      if (
        Number.isFinite(probability) &&
        Number.isFinite(amount) &&
        probability >= 50 &&
        amount >= 2 &&
        Number.isFinite(gust) &&
        gust >= 45
      ) {
        combinedRainWind = true;
        combinedRainValue = `${probability}% rain probability · ${amount.toFixed(1)} mm · ${gust.toFixed(0)} km/h gusts`;
      }

      if (
        Number.isFinite(probability) &&
        Number.isFinite(amount) &&
        probability >= 70 &&
        amount >= maxRainAmount
      ) {
        maxRainAmount = amount;
      }
    }

    const results: Signal[] = [];

    if ([95, 96, 99].includes(current.weather_code)) {
      results.push({
        id: "thunderstorm",
        title: "Thunderstorm conditions",
        description:
          "The current weather code indicates thunderstorm activity. Monitor local official weather guidance.",
        value: weatherDescription(current.weather_code),
        severity: "critical",
        icon: AlertTriangle,
      });
    }

    if (current.temperature_2m >= 35) {
      results.push({
        id: "heat",
        title: "High temperature",
        description:
          "Current air temperature is elevated. Heat exposure may become more significant during outdoor activity.",
        value: `${current.temperature_2m.toFixed(1)} °C`,
        severity: current.temperature_2m >= 40 ? "critical" : "elevated",
        icon: Thermometer,
      });
    } else if (current.temperature_2m <= -10) {
      results.push({
        id: "cold",
        title: "Low temperature",
        description:
          "Current temperature is well below freezing. Consider cold exposure and surface conditions.",
        value: `${current.temperature_2m.toFixed(1)} °C`,
        severity: current.temperature_2m <= -20 ? "critical" : "elevated",
        icon: Thermometer,
      });
    }

    if (maxGust >= 60) {
      results.push({
        id: "wind",
        title: "Strong wind gusts",
        description:
          "Forecast gust values are elevated. Loose objects and exposed outdoor areas may require attention.",
        value: `${maxGust.toFixed(0)} km/h`,
        severity: maxGust >= 85 ? "critical" : "elevated",
        icon: Wind,
      });
    }

    if (combinedRainWind) {
      results.push({
        id: "combined-rain-wind",
        title: "Combined rainfall and wind signal",
        description:
          "A single forecast checkpoint combines notable rainfall probability, precipitation amount and stronger wind gusts. These indicators occur in the same forecast hour.",
        value: combinedRainValue,
        severity: "elevated",
        icon: CloudRain,
      });
    } else if (maxRainProbability >= 70) {
      results.push({
        id: "rain-probability",
        title: "Rain likely",
        description:
          "At least one of the next 12 hourly checkpoints has a high precipitation probability. Check the outlook for timing and expected amount.",
        value: `${maxRainProbability}% maximum probability`,
        severity: "moderate",
        icon: CloudRain,
      });
    }

    if (air?.uv !== undefined && air.uv >= 8) {
      results.push({
        id: "uv",
        title: "High ultraviolet index",
        description:
          "The nearest available UV reading is elevated. Sun protection is advisable during periods of exposure.",
        value: `UV ${air.uv.toFixed(1)}`,
        severity: air.uv >= 11 ? "critical" : "elevated",
        icon: Sun,
      });
    }

    if (air?.aqi !== undefined && air.aqi > 60) {
      results.push({
        id: "aqi",
        title: "Elevated air quality index",
        description:
          "The European AQI is above the platform monitoring threshold. Sensitive individuals may wish to reduce prolonged outdoor exertion.",
        value: `EU AQI ${air.aqi.toFixed(0)} · ${getAqiLabel(air.aqi)}`,
        severity: getAqiSeverity(air.aqi),
        icon: Leaf,
      });
    }

    if (air?.pm25 !== undefined && air.pm25 >= 25) {
      results.push({
        id: "pm25",
        title: "Elevated fine particulate matter",
        description:
          "PM2.5 concentration is above the platform monitoring threshold. This indicator tracks fine particles in the air.",
        value: `${air.pm25.toFixed(1)} µg/m³`,
        severity: air.pm25 >= 50 ? "critical" : "moderate",
        icon: Activity,
      });
    }

    if (
      air?.aqi !== undefined &&
      air.aqi > 60 &&
      air.pm25 !== undefined &&
      air.pm25 >= 20
    ) {
      results.push({
        id: "combined-air",
        title: "Multiple air-quality indicators elevated",
        description:
          "Both the European AQI and PM2.5 are above their configured monitoring thresholds. This is a combined signal, not an official health classification.",
        value: `AQI ${air.aqi.toFixed(0)} · PM2.5 ${air.pm25.toFixed(1)} µg/m³`,
        severity: "elevated",
        icon: Leaf,
      });
    }

    if (results.length === 0) {
      results.push({
        id: "stable",
        title: "No elevated signals detected",
        description:
          "The monitored weather and air-quality indicators are currently below this platform's configured thresholds. This does not guarantee the absence of local hazards.",
        value: "Within monitored thresholds",
        severity: "info",
        icon: ShieldCheck,
      });
    }

    return results;
  }, [analysis, alignedAir]);

  const trends = useMemo<Trend[]>(() => {
    if (!analysis) return [];

    const { forecast, airQuality } = analysis;
    const currentTime = forecast.current.time;

    return [
      getTrend(
        "Air temperature",
        forecast.hourly.time,
        forecast.hourly.temperature_2m,
        currentTime,
        "°C",
        0.5,
      ),
      getTrend(
        "Surface pressure",
        forecast.hourly.time,
        forecast.hourly.surface_pressure,
        currentTime,
        "hPa",
        0.8,
      ),
      getTrend(
        "Wind speed",
        forecast.hourly.time,
        forecast.hourly.wind_speed_10m,
        currentTime,
        "km/h",
        2,
      ),
      getTrend(
        "European AQI",
        airQuality.hourly.time,
        airQuality.hourly.european_aqi,
        currentTime,
        "AQI",
        2,
      ),
      getTrend(
        "PM2.5",
        airQuality.hourly.time,
        airQuality.hourly.pm2_5,
        currentTime,
        "µg/m³",
        1,
      ),
    ];
  }, [analysis]);

  const advancedAnalysis = useMemo(() => {
    if (!analysis) return undefined;

    return analyzeAtmosphere(analysis.forecast, analysis.airQuality);
  }, [analysis]);
  const hourlyOutlook = useMemo(() => {
    if (!analysis) return [];

    const { forecast, airQuality } = analysis;
    const currentTime = forecast.current.time;
    let startIndex = forecast.hourly.time.findIndex(
      (time) => time >= currentTime,
    );

    if (startIndex < 0) startIndex = 0;

    return Array.from({ length: 6 }, (_, index) => {
      const hourIndex = startIndex + index * 3;
      const time = forecast.hourly.time[hourIndex];
      if (!time) return null;

      return {
        time,
        temperature: forecast.hourly.temperature_2m[hourIndex],
        rain: forecast.hourly.precipitation_probability[hourIndex],
        wind: forecast.hourly.wind_speed_10m[hourIndex],
        aqi: alignedValue(
          airQuality.hourly.time,
          airQuality.hourly.european_aqi,
          time,
        ),
      };
    }).filter((item) => item !== null);
  }, [analysis]);

  const dataCoverage = useMemo(() => {
    if (!analysis || !alignedAir) return { available: 0, total: 12, percent: 0 };

    const current = analysis.forecast.current;
    const values = [
      current.temperature_2m,
      current.relative_humidity_2m,
      current.wind_speed_10m,
      current.wind_gusts_10m,
      current.surface_pressure,
      current.cloud_cover,
      current.precipitation,
      current.weather_code,
      alignedAir.aqi,
      alignedAir.pm25,
      alignedAir.pm10,
      alignedAir.uv,
    ];

    const available = values.filter(
      (value) => value !== undefined && Number.isFinite(value),
    ).length;

    return {
      available,
      total: values.length,
      percent: Math.round((available / values.length) * 100),
    };
  }, [analysis, alignedAir]);

  if (!selectedCity) {
    return (
      <div className="intelligence-page">
        <header className="intelligence-page-heading">
          <span className="intelligence-eyebrow"><span /> ATMOSPHERIC ANALYSIS</span>
          <h1>Atmospheric Intelligence</h1>
          <p>Translate atmospheric signals into context, trends and explainable insights.</p>
        </header>
        <section className="intelligence-empty">
          <div className="intelligence-empty-orbit">
            <div className="empty-orbit orbit-a" />
            <div className="empty-orbit orbit-b" />
            <div className="empty-core"><Activity size={31} /></div>
          </div>
          <span className="intelligence-eyebrow">AWAITING LOCATION</span>
          <h2>Your analysis workspace is ready.</h2>
          <p>Select a city from the global search or My Places to begin atmospheric analysis. No sample location or simulated readings are displayed.</p>
        </section>
      </div>
    );
  }

  if (intelligenceQuery.isPending) {
    return (
      <div className="intelligence-page">
        <header className="intelligence-page-heading">
          <span className="intelligence-eyebrow"><span /> ATMOSPHERIC ANALYSIS</span>
          <h1>Atmospheric Intelligence</h1>
          <p>Connecting weather and environmental data streams.</p>
        </header>
        <div className="intelligence-loading">
          <RefreshCw size={21} className="intelligence-spin" />
          <span>ANALYSING ATMOSPHERIC CONDITIONS</span>
        </div>
      </div>
    );
  }

  if (intelligenceQuery.isError || !analysis) {
    return (
      <div className="intelligence-page">
        <header className="intelligence-page-heading">
          <span className="intelligence-eyebrow"><span /> ATMOSPHERIC ANALYSIS</span>
          <h1>Atmospheric Intelligence</h1>
          <p>Unable to complete the current analysis.</p>
        </header>
        <section className="intelligence-error">
          <AlertTriangle size={24} />
          <h2>Data connection interrupted</h2>
          <p>One or more data sources could not be reached. Check your connection and try again.</p>
          <button type="button" onClick={() => void intelligenceQuery.refetch()}>
            <RefreshCw size={15} /> Retry analysis
          </button>
        </section>
      </div>
    );
  }

  const { forecast } = analysis;
  const current = forecast.current;
  const air = alignedAir;

  const highestPriority = signals.some((signal) => signal.severity === "critical");
  const elevatedCount = signals.filter(
    (signal) => signal.severity !== "info",
  ).length;

  return (
    <div className="intelligence-page">
      <header className="intelligence-page-heading">
        <span className="intelligence-eyebrow"><span /> ATMOSPHERIC ANALYSIS</span>
        <div className="intelligence-title-row">
          <div>
            <h1>Atmospheric Intelligence</h1>
            <p>Explainable insights from live weather and environmental indicators.</p>
          </div>
          <button className="intelligence-refresh" type="button" onClick={() => void intelligenceQuery.refetch()} aria-label="Refresh atmospheric analysis">
            <RefreshCw size={16} /><span>Refresh</span>
          </button>
        </div>
      </header>

      <section className="intelligence-location-banner">
        <div className="location-banner-icon"><Activity size={21} /></div>
        <div className="location-banner-copy">
          <span>ACTIVE ANALYSIS LOCATION</span>
          <strong>{selectedCity.name}{selectedCity.country ? `, ${selectedCity.country}` : ""}</strong>
          <small>{selectedCity.latitude.toFixed(3)}° / {selectedCity.longitude.toFixed(3)}°</small>
        </div>
        <div className="location-banner-status"><span className="live-indicator" /> LIVE DATA</div>
      </section>

      <section className="intelligence-summary-grid">
        <Metric label="AIR TEMPERATURE" value={current.temperature_2m.toFixed(1)} unit="°C" icon={Thermometer} detail={`Feels like ${current.apparent_temperature.toFixed(1)} °C`} />
        <Metric label="EUROPEAN AQI" value={air?.aqi !== undefined ? air.aqi.toFixed(0) : "—"} icon={Leaf} detail={getAqiLabel(air?.aqi)} />
        <Metric label="WIND GUSTS" value={current.wind_gusts_10m.toFixed(1)} unit="km/h" icon={Wind} detail={`Sustained ${current.wind_speed_10m.toFixed(1)} km/h`} />
        <Metric label="UV INDEX" value={air?.uv !== undefined ? air.uv.toFixed(1) : "—"} icon={Sun} detail="Current or nearest available reading" />
      </section>

      <section className="intelligence-section">
        <div className="intelligence-section-heading">
          <div>
            <span className="intelligence-overline">01 / SIGNAL DETECTION</span>
            <h2>Atmospheric signals</h2>
            <p>Conditions identified from current observations and the near-term forecast.</p>
          </div>
          <div className={`signal-overview ${highestPriority ? "overview-alert" : ""}`}>
            <strong>{elevatedCount.toString().padStart(2, "0")}</strong>
            <span>Active signals</span>
          </div>
        </div>
        <div className="intelligence-signal-list">
          {signals.map((signal) => <SignalCard key={signal.id} signal={signal} />)}
        </div>
      </section>

      <section className="intelligence-section intelligence-analysis-section">
        <div className="intelligence-section-heading">
          <div>
            <span className="intelligence-overline">02 / TREND ANALYSIS</span>
            <h2>Atmospheric movement</h2>
            <p>Approximate six-hour change, calculated from the nearest available hourly forecast checkpoints.</p>
          </div>
        </div>
        <div className="intelligence-trend-grid">
          {trends.map((trend) => <TrendCard key={trend.label} trend={trend} />)}
        </div>
      </section>

      <section className="intelligence-lower-grid">
        <div className="intelligence-panel">
          <div className="intelligence-panel-heading">
            <div><span className="intelligence-overline">03 / ENVIRONMENT</span><h2>Air composition</h2></div>
            <Leaf size={19} />
          </div>
          <div className="aqi-display">
            <div>
              <span>EUROPEAN AQI</span>
              <strong>{air?.aqi !== undefined ? air.aqi.toFixed(0) : "—"}</strong>
              <small>{getAqiLabel(air?.aqi)}</small>
            </div>
            <div className={`aqi-state state-${getAqiSeverity(air?.aqi)}`}>
              <span />{getAqiSeverity(air?.aqi) === "info" ? "MONITORED" : "ATTENTION"}
            </div>
          </div>
          <div className="pollutant-row"><span>PM2.5</span><strong>{air?.pm25 !== undefined ? `${air.pm25.toFixed(1)} µg/m³` : "—"}</strong></div>
          <div className="pollutant-row"><span>PM10</span><strong>{air?.pm10 !== undefined ? `${air.pm10.toFixed(1)} µg/m³` : "—"}</strong></div>
          <div className="pollutant-row"><span>Nitrogen dioxide</span><strong>{air?.no2 !== undefined ? `${air.no2.toFixed(1)} µg/m³` : "—"}</strong></div>
          <div className="pollutant-row"><span>Ozone</span><strong>{air?.ozone !== undefined ? `${air.ozone.toFixed(1)} µg/m³` : "—"}</strong></div>
          <div className="pollutant-row"><span>Dust</span><strong>{air?.dust !== undefined ? `${air.dust.toFixed(1)} µg/m³` : "—"}</strong></div>
          <p className="intelligence-panel-footnote">Values use current or nearest timestamp-matched air-quality readings. Missing readings are not estimated.</p>
        </div>

        <div className="intelligence-panel">
          <div className="intelligence-panel-heading">
            <div><span className="intelligence-overline">04 / WEATHER STATE</span><h2>Current conditions</h2></div>
            <Gauge size={19} />
          </div>
          <div className="weather-state-main">
            <div><span>OBSERVED CONDITION</span><strong>{weatherDescription(current.weather_code)}</strong></div>
            <span className="weather-state-temperature">{current.temperature_2m.toFixed(1)}°</span>
          </div>
          <div className="pollutant-row"><span>Relative humidity</span><strong>{current.relative_humidity_2m}%</strong></div>
          <div className="pollutant-row"><span>Cloud cover</span><strong>{current.cloud_cover}%</strong></div>
          <div className="pollutant-row"><span>Surface pressure</span><strong>{current.surface_pressure.toFixed(1)} hPa</strong></div>
          <div className="pollutant-row"><span>Precipitation</span><strong>{current.precipitation.toFixed(1)} mm</strong></div>
          <p className="intelligence-panel-footnote">Observation time: {formatTime(current.time)} · {forecast.timezone}</p>
        </div>
      </section>

      <section className="intelligence-section">
        <div className="intelligence-section-heading">
          <div>
            <span className="intelligence-overline">05 / SHORT-TERM OUTLOOK</span>
            <h2>Next 18 hours</h2>
            <p>Forecast checkpoints combining temperature, precipitation, wind and timestamp-aligned air-quality data.</p>
          </div>
        </div>
        <div className="intelligence-outlook">
          {hourlyOutlook.map((item) => (
            <article className="outlook-card" key={item.time}>
              <span className="outlook-time">{formatTime(item.time)}</span>
              <strong className="outlook-temperature">{item.temperature.toFixed(0)}°</strong>
              <div className="outlook-detail"><Droplets size={14} /><span>{item.rain}%</span></div>
              <div className="outlook-detail"><Wind size={14} /><span>{item.wind.toFixed(0)} km/h</span></div>
              <div className="outlook-detail"><Leaf size={14} /><span>{item.aqi !== undefined ? `AQI ${item.aqi.toFixed(0)}` : "—"}</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="intelligence-section intelligence-coverage-section">
        <div className="intelligence-section-heading">
          <div>
            <span className="intelligence-overline">06 / DATA QUALITY</span>
            <h2>Observation coverage</h2>
            <p>Availability of the monitored fields used by this analysis. Coverage is not a measure of forecast accuracy.</p>
          </div>
          <div className="intelligence-coverage-score">
            <strong>{dataCoverage.percent}%</strong>
            <span>FIELD COVERAGE</span>
          </div>
        </div>
        <div className="intelligence-coverage-track">
          <span style={{ width: `${dataCoverage.percent}%` }} />
        </div>
        <div className="intelligence-coverage-meta">
          <span>{dataCoverage.available} of {dataCoverage.total} monitored fields available</span>
          <span>Weather + air quality</span>
        </div>
      </section>

      <section className="intelligence-section intelligence-advanced-section">
        <div className="intelligence-section-heading">
          <div>
            <span className="intelligence-overline">07 / ADVANCED ANALYSIS</span>
            <h2>Anomalies & atmospheric relationships</h2>
            <p>
              Short-range forecast outliers, multi-factor patterns and
              statistical relationships across matched hourly data.
            </p>
          </div>
          <div className="intelligence-advanced-window">
            <strong>{advancedAnalysis?.evaluatedHours ?? 0}H</strong>
            <span>ANALYSIS WINDOW</span>
          </div>
        </div>

        <div className="intelligence-advanced-grid">
          <article className="intelligence-advanced-panel">
            <div className="intelligence-advanced-panel-heading">
              <div>
                <span className="intelligence-overline">01 / OUTLIER DETECTION</span>
                <h3>Forecast anomalies</h3>
              </div>
              <Activity size={19} />
            </div>

            {advancedAnalysis?.anomalies.length ? (
              <div className="intelligence-advanced-list">
                {advancedAnalysis.anomalies.map((item) => (
                  <div className="intelligence-advanced-card" key={item.id}>
                    <div className="intelligence-advanced-card-top">
                      <strong>{item.metric}</strong>
                      <span className={`signal-badge badge-${item.severity}`}>
                        {item.severity.toUpperCase()}
                      </span>
                    </div>
                    <p>{item.description}</p>
                    <span className="intelligence-advanced-evidence">{item.evidence}</span>
                    <div className="intelligence-evidence-score">
                      <span>Evidence confidence · heuristic</span>
                      <strong>{item.confidence}%</strong>
                    </div>
                    <span className="intelligence-advanced-time">
                      Forecast checkpoint · {formatTime(item.time)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="intelligence-advanced-empty">
                No short-range forecast outliers met the detection criteria.
                This does not imply that all conditions are risk-free.
              </p>
            )}
          </article>

          <article className="intelligence-advanced-panel">
            <div className="intelligence-advanced-panel-heading">
              <div>
                <span className="intelligence-overline">02 / MULTI-FACTOR ANALYSIS</span>
                <h3>Compound patterns</h3>
              </div>
              <AlertTriangle size={19} />
            </div>

            {advancedAnalysis?.compoundPatterns.length ? (
              <div className="intelligence-advanced-list">
                {advancedAnalysis.compoundPatterns.map((item) => (
                  <div className="intelligence-advanced-card" key={item.id}>
                    <div className="intelligence-advanced-card-top">
                      <strong>{item.title}</strong>
                      <span className={`signal-badge badge-${item.severity}`}>
                        {item.severity.toUpperCase()}
                      </span>
                    </div>
                    <p>{item.description}</p>
                    <span className="intelligence-advanced-evidence">{item.evidence}</span>
                    <div className="intelligence-evidence-score">
                      <span>Evidence confidence · heuristic</span>
                      <strong>{item.confidence}%</strong>
                    </div>
                    <span className="intelligence-advanced-time">
                      Matched checkpoint · {formatTime(item.time)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="intelligence-advanced-empty">
                No monitored multi-factor pattern was detected in the
                available forecast window.
              </p>
            )}
          </article>

          <article className="intelligence-advanced-panel intelligence-correlation-panel">
            <div className="intelligence-advanced-panel-heading">
              <div>
                <span className="intelligence-overline">03 / CORRELATION ENGINE</span>
                <h3>Forecast relationships</h3>
              </div>
              <Activity size={19} />
            </div>

            {advancedAnalysis?.correlations.length ? (
              <div className="intelligence-advanced-list">
                {advancedAnalysis.correlations.map((item) => (
                  <div className="intelligence-advanced-card" key={item.id}>
                    <div className="intelligence-advanced-card-top">
                      <strong>{item.title}</strong>
                      <span className="intelligence-correlation-value">
                        {item.coefficient > 0 ? "+" : ""}
                        {item.coefficient.toFixed(2)}
                      </span>
                    </div>
                    <p>{item.description}</p>
                    <div className="intelligence-correlation-meta">
                      <span>{item.strength.toUpperCase()} ASSOCIATION</span>
                      <span>{item.sampleCount} MATCHED HOURS</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="intelligence-advanced-empty">
                No sufficiently strong relationship was found in the
                available matched hourly samples.
              </p>
            )}
          </article>
        </div>

        <p className="intelligence-advanced-note">
          Methodology: forecast outliers are compared with nearby hourly
          checkpoints using robust local statistics. Correlations require
          at least eight matched samples and a coefficient magnitude of
          0.65 or higher. Evidence confidence is a heuristic score, not a
          calibrated probability. Correlation does not establish causation.
          No historical climate baseline is used.
        </p>
      </section>
      <section className="intelligence-disclaimer">
        <div><ShieldCheck size={18} /><strong>Explainable analysis</strong></div>
        <p>Signals are generated from Open-Meteo forecast and air-quality datasets using transparent platform thresholds. Trend values compare approximate hourly checkpoints. These are analytical indicators, not official government alerts or medical advice.</p>
        <div className="intelligence-source">
          <span>DATA SOURCES</span>
          <strong>Open-Meteo Weather API</strong>
          <strong>Open-Meteo Air Quality API</strong>
        </div>
      </section>

      <footer className="intelligence-footer">
        <span>ANALYSIS DATE · {formatDate(current.time)} · {formatTime(current.time)}</span>
        <span>
          {intelligenceQuery.isFetching ? (
            <><RefreshCw size={12} className="intelligence-spin" /> UPDATING</>
          ) : (
            <><span className="live-indicator" /> DATA SYNCHRONISED</>
          )}
        </span>
      </footer>
    </div>
  );
}
