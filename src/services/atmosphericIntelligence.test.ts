import { describe, expect, it } from "vitest";

import {
  analyzeAtmosphere,
} from "@/services/atmosphericIntelligence";

import type {
  ForecastResponse,
  HourlyForecast,
} from "@/services/openMeteo";

import type {
  AirQualityCurrent,
  AirQualityHourly,
  AirQualityResponse,
} from "@/services/airQuality";

function createTimes(): string[] {
  return Array.from({ length: 24 }, (_, index) =>
    new Date(Date.UTC(2026, 0, 1, index)).toISOString(),
  );
}

function createForecast(
  overrides: Partial<HourlyForecast> = {},
): ForecastResponse {
  const time = createTimes();

  const hourly: HourlyForecast = {
    time,
    temperature_2m: Array(24).fill(15),
    apparent_temperature: Array(24).fill(14),
    relative_humidity_2m: Array(24).fill(50),
    precipitation_probability: Array(24).fill(0),
    precipitation: Array(24).fill(0),
    weather_code: Array(24).fill(0),
    wind_speed_10m: Array(24).fill(5),
    wind_direction_10m: Array(24).fill(180),
    wind_gusts_10m: Array(24).fill(10),
    surface_pressure: Array(24).fill(1013),
    visibility: Array(24).fill(10000),
    cloud_cover: Array(24).fill(20),
    ...overrides,
  };

  return {
    current: {
      time: time[0],
      temperature_2m: 15,
      relative_humidity_2m: 50,
      apparent_temperature: 14,
      is_day: 1,
      precipitation: 0,
      weather_code: 0,
      cloud_cover: 20,
      wind_speed_10m: 5,
      wind_direction_10m: 180,
      wind_gusts_10m: 10,
      surface_pressure: 1013,
    },
    current_units: {},
    timezone: "UTC",
    hourly,
    hourly_units: {},
    daily: {
      time: [time[0]],
      weather_code: [0],
      temperature_2m_max: [18],
      temperature_2m_min: [10],
      sunrise: [time[0]],
      sunset: [time[0]],
      uv_index_max: [3],
      precipitation_sum: [0],
      precipitation_probability_max: [0],
      wind_speed_10m_max: [10],
      wind_gusts_10m_max: [15],
    },
    daily_units: {},
  };
}

function createAirQuality(
  hourlyOverrides: Partial<AirQualityHourly> = {},
  currentOverrides: Partial<AirQualityCurrent> = {},
): AirQualityResponse {
  const time = createTimes();

  const hourly: AirQualityHourly = {
    time,
    european_aqi: Array(24).fill(10),
    us_aqi: Array(24).fill(15),
    pm2_5: Array(24).fill(5),
    pm10: Array(24).fill(8),
    carbon_monoxide: Array(24).fill(100),
    nitrogen_dioxide: Array(24).fill(10),
    sulphur_dioxide: Array(24).fill(2),
    ozone: Array(24).fill(20),
    dust: Array(24).fill(0),
    uv_index: Array(24).fill(2),
    ...hourlyOverrides,
  };

  return {
    latitude: 48.85,
    longitude: 2.35,
    timezone: "UTC",
    current: {
      time: time[0],
      european_aqi: 10,
      us_aqi: 15,
      pm2_5: 5,
      pm10: 8,
      ...currentOverrides,
    },
    hourly,
  };
}

function withValue(index: number, value: number): number[] {
  return Array.from({ length: 24 }, (_, position) =>
    position === index ? value : 0,
  );
}

describe("Atmospheric Intelligence Engine", () => {
  it("returns an empty result when the current timestamp is invalid", () => {
    const forecast = createForecast();
    forecast.current.time = "invalid-timestamp";

    const result = analyzeAtmosphere(
      forecast,
      createAirQuality(),
    );

    expect(result.evaluatedHours).toBe(0);
    expect(result.anomalies).toEqual([]);
    expect(result.correlations).toEqual([]);
    expect(result.compoundPatterns).toEqual([]);
  });

  it("handles missing and non-finite observations without crashing", () => {
    const forecast = createForecast({
      temperature_2m: Array(24).fill(Number.NaN),
    });

    const airQuality = createAirQuality({
      european_aqi: Array(24).fill(Number.NaN),
      pm2_5: Array(24).fill(Number.NaN),
    });

    expect(() =>
      analyzeAtmosphere(forecast, airQuality),
    ).not.toThrow();

    const result = analyzeAtmosphere(forecast, airQuality);

    expect(result.evaluatedHours).toBe(24);
    expect(result.anomalies).toEqual([]);
    expect(result.correlations).toEqual([]);
  });

  it("does not report anomalies or correlations for constant data", () => {
    const result = analyzeAtmosphere(
      createForecast(),
      createAirQuality(),
    );

    expect(result.anomalies).toEqual([]);
    expect(result.correlations).toEqual([]);
  });

  it("detects a severe isolated temperature forecast outlier", () => {
    const temperatures = Array.from(
      { length: 24 },
      (_, index) => [9, 10, 11, 10, 9, 11][index % 6],
    );

    temperatures[12] = 30;

    const result = analyzeAtmosphere(
      createForecast({
        temperature_2m: temperatures,
      }),
      createAirQuality(),
    );

    const anomaly = result.anomalies.find(
      (item) => item.metric === "Air temperature",
    );

    expect(anomaly).toBeDefined();
    expect(anomaly?.deviation).toBe(20);
    expect(anomaly?.severity).toBe("elevated");
    expect(anomaly?.confidence).toBeGreaterThanOrEqual(80);
    expect(anomaly?.description).toContain(
      "not a climatological anomaly",
    );
  });

  it("does not calculate correlation from fewer than eight matched pairs", () => {
    const humidity = Array.from(
      { length: 24 },
      (_, index) => index < 7 ? 20 + index * 10 : Number.NaN,
    );

    const precipitationProbability = Array.from(
      { length: 24 },
      (_, index) => index < 7 ? 10 + index * 10 : Number.NaN,
    );

    const result = analyzeAtmosphere(
      createForecast({
        relative_humidity_2m: humidity,
        precipitation_probability: precipitationProbability,
      }),
      createAirQuality(),
    );

    expect(result.correlations).toEqual([]);
  });

  it("detects a strong correlation when enough matched observations exist", () => {
    const humidity = Array.from(
      { length: 24 },
      (_, index) => 20 + index * 2,
    );

    const precipitationProbability = Array.from(
      { length: 24 },
      (_, index) => 10 + index * 3,
    );

    const result = analyzeAtmosphere(
      createForecast({
        relative_humidity_2m: humidity,
        precipitation_probability: precipitationProbability,
      }),
      createAirQuality(),
    );

    const correlation = result.correlations.find(
      (item) => item.id === "humidity-precipitation",
    );

    expect(correlation).toBeDefined();
    expect(correlation?.coefficient).toBeCloseTo(1, 5);
    expect(correlation?.sampleCount).toBe(24);
    expect(correlation?.strength).toBe("strong");
    expect(correlation?.description).toContain(
      "not evidence of causation",
    );
  });

  it("detects multiple simultaneous compound atmospheric patterns", () => {
    const forecast = createForecast({
      temperature_2m: withValue(5, 32),
      relative_humidity_2m: withValue(5, 90),
      precipitation_probability: withValue(5, 80),
      precipitation: withValue(5, 3),
      wind_gusts_10m: withValue(5, 50),
    });

    const airQuality = createAirQuality(
      {
        uv_index: withValue(5, 7),
      },
      {
        european_aqi: 50,
        pm2_5: 30,
      },
    );

    const result = analyzeAtmosphere(forecast, airQuality);

    const patternIds = result.compoundPatterns.map(
      (pattern) => pattern.id,
    );

    expect(patternIds).toContain("rain-wind-5");
    expect(patternIds).toContain("humid-rain-5");
    expect(patternIds).toContain("heat-uv-5");
    expect(patternIds).toContain("combined-air-quality");
  });

  it("restricts weather correlations to the remaining 24-hour analysis window", () => {
    const forecast = createForecast({
      relative_humidity_2m: Array.from(
        { length: 24 },
        (_, index) => 20 + index * 2,
      ),
      precipitation_probability: Array.from(
        { length: 24 },
        (_, index) => 10 + index * 3,
      ),
    });

    forecast.current.time = createTimes()[12];

    const result = analyzeAtmosphere(forecast, createAirQuality());

    const correlation = result.correlations.find(
      (item) => item.id === "humidity-precipitation",
    );

    expect(correlation).toBeDefined();
    expect(correlation?.sampleCount).toBe(12);
  });

  it("does not align air-quality observations from distant timestamps", () => {
    const distantTimes = createTimes().map((time) =>
      new Date(new Date(time).getTime() + 48 * 60 * 60 * 1000).toISOString(),
    );

    const airQuality = createAirQuality({
      time: distantTimes,
      european_aqi: Array.from({ length: 24 }, (_, index) => 20 + index * 2),
      pm2_5: Array.from({ length: 24 }, (_, index) => 5 + index * 3),
    });

    const result = analyzeAtmosphere(createForecast(), airQuality);

    expect(
      result.correlations.some((item) => item.id === "aqi-pm25"),
    ).toBe(false);
  });

  it("falls back to hourly air-quality values when current values are non-finite", () => {
    const airQuality = createAirQuality(
      {
        european_aqi: Array(24).fill(50),
        pm2_5: Array(24).fill(30),
      },
      {
        european_aqi: Number.NaN,
        pm2_5: Number.NaN,
      },
    );

    const result = analyzeAtmosphere(createForecast(), airQuality);

    expect(
      result.compoundPatterns.some(
        (item) => item.id === "combined-air-quality",
      ),
    ).toBe(true);
  });

  it("selects the rainfall and wind event with the highest probability", () => {
    const probability = Array(24).fill(0);
    const precipitation = Array(24).fill(0);
    const gusts = Array(24).fill(10);

    probability[3] = 70;
    precipitation[3] = 3;
    gusts[3] = 50;

    probability[8] = 90;
    precipitation[8] = 4;
    gusts[8] = 55;

    const result = analyzeAtmosphere(
      createForecast({
        precipitation_probability: probability,
        precipitation,
        wind_gusts_10m: gusts,
      }),
      createAirQuality(),
    );

    const pattern = result.compoundPatterns.find(
      (item) => item.title === "Rainfall and strong wind overlap",
    );

    expect(pattern?.id).toBe("rain-wind-8");
    expect(pattern?.evidence).toContain("90%");
  });

  it("ignores compound patterns with invalid forecast timestamps", () => {
    const times = createTimes();
    times[5] = "invalid-timestamp";

    const probability = Array(24).fill(0);
    const precipitation = Array(24).fill(0);
    const gusts = Array(24).fill(10);

    probability[5] = 90;
    precipitation[5] = 4;
    gusts[5] = 55;

    const result = analyzeAtmosphere(
      createForecast({
        time: times,
        precipitation_probability: probability,
        precipitation,
        wind_gusts_10m: gusts,
      }),
      createAirQuality(),
    );

    expect(
      result.compoundPatterns.some((item) => item.id === "rain-wind-5"),
    ).toBe(false);
  });

  it("handles mismatched hourly array lengths without crashing", () => {
    const result = analyzeAtmosphere(
      createForecast({
        relative_humidity_2m: Array.from(
          { length: 24 },
          (_, index) => 20 + index,
        ),
        precipitation_probability: Array.from(
          { length: 10 },
          (_, index) => 10 + index * 2,
        ),
      }),
      createAirQuality(),
    );

    expect(result.evaluatedHours).toBe(24);
    expect(result.correlations.length).toBeGreaterThan(0);
  });

  it("detects a sustained three-hour temperature deviation", () => {
    const temperatures = Array(24).fill(10);
    temperatures[8] = 25;
    temperatures[9] = 25;
    temperatures[10] = 25;

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality(),
    );

    const anomaly = result.anomalies.find(
      (item) =>
        item.metric === "Air temperature" &&
        item.kind === "sustained",
    );

    expect(anomaly).toBeDefined();
    expect(anomaly?.durationHours).toBe(3);
    expect(anomaly?.description).toContain("persistent short-range forecast pattern");
    expect(anomaly?.evidence).toContain("3 consecutive hourly checkpoints");
  });

  it("does not classify an isolated one-hour spike as sustained", () => {
    const temperatures = Array(24).fill(10);
    temperatures[9] = 30;

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) =>
          item.metric === "Air temperature" &&
          item.kind === "sustained",
      ),
    ).toBe(false);
  });

  it("does not bridge a timestamp gap when detecting sustained deviations", () => {
    const times = createTimes();

    for (let index = 10; index < times.length; index += 1) {
      times[index] = new Date(
        new Date(times[index]).getTime() + 2 * 60 * 60 * 1000,
      ).toISOString();
    }

    const temperatures = Array(24).fill(10);
    temperatures[8] = 25;
    temperatures[9] = 25;
    temperatures[10] = 25;

    const result = analyzeAtmosphere(
      createForecast({
        time: times,
        temperature_2m: temperatures,
      }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) =>
          item.metric === "Air temperature" &&
          item.kind === "sustained",
      ),
    ).toBe(false);
  });

  it("does not flag a smooth gradual temperature trend as sustained deviation", () => {
    const temperatures = Array.from(
      { length: 24 },
      (_, index) => 5 + index * 1.5,
    );

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) =>
          item.metric === "Air temperature" &&
          item.kind === "sustained",
      ),
    ).toBe(false);
  });

  it("does not detect a point anomaly using observations across a timestamp gap", () => {
    const times = createTimes();

    for (let index = 13; index < times.length; index += 1) {
      times[index] = new Date(
        new Date(times[index]).getTime() + 2 * 60 * 60 * 1000,
      ).toISOString();
    }

    const temperatures = Array.from(
      { length: 24 },
      (_, index) => [9, 10, 11, 10, 9, 11][index % 6],
    );

    temperatures[12] = 30;

    const result = analyzeAtmosphere(
      createForecast({
        time: times,
        temperature_2m: temperatures,
      }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) =>
          item.metric === "Air temperature" &&
          item.kind === "point",
      ),
    ).toBe(false);
  });

  it("does not detect a point anomaly when its local timestamp is invalid", () => {
    const times = createTimes();
    times[11] = "invalid-timestamp";

    const temperatures = Array.from(
      { length: 24 },
      (_, index) => [9, 10, 11, 10, 9, 11][index % 6],
    );

    temperatures[12] = 30;

    const result = analyzeAtmosphere(
      createForecast({
        time: times,
        temperature_2m: temperatures,
      }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) =>
          item.metric === "Air temperature" &&
          item.kind === "point",
      ),
    ).toBe(false);
  });

  it("does not combine separate weather forecast windows into one correlation", () => {
    const times = createTimes().map((time, index) =>
      new Date(
        new Date(time).getTime() +
        Math.floor(index / 6) * 2 * 60 * 60 * 1000,
      ).toISOString(),
    );

    const humidity = Array.from(
      { length: 24 },
      (_, index) => 20 + index * 2,
    );

    const probability = Array.from(
      { length: 24 },
      (_, index) => 10 + index * 3,
    );

    const result = analyzeAtmosphere(
      createForecast({
        time: times,
        relative_humidity_2m: humidity,
        precipitation_probability: probability,
      }),
      createAirQuality(),
    );

    expect(
      result.correlations.some(
        (item) => item.id === "humidity-precipitation",
      ),
    ).toBe(false);
  });

  it("does not bridge missing air-quality observations when calculating AQI correlation", () => {
    const airTimes = createTimes().map((time, index) =>
      new Date(
        new Date(time).getTime() +
        Math.floor(index / 6) * 2 * 60 * 60 * 1000,
      ).toISOString(),
    );

    const airQuality = createAirQuality({
      time: airTimes,
      european_aqi: Array.from(
        { length: 24 },
        (_, index) => 20 + index * 2,
      ),
      pm2_5: Array.from(
        { length: 24 },
        (_, index) => 5 + index * 3,
      ),
    });

    const result = analyzeAtmosphere(
      createForecast(),
      airQuality,
    );

    expect(
      result.correlations.some(
        (item) => item.id === "aqi-pm25",
      ),
    ).toBe(false);
  });
  it("does not match UV data from a different hourly timestamp", () => {
    const temperatures = Array(24).fill(15);
    temperatures[5] = 32;

    const shiftedTimes = createTimes().map((time) =>
      new Date(new Date(time).getTime() + 45 * 60 * 1000).toISOString(),
    );

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality({
        time: shiftedTimes,
        uv_index: Array(24).fill(7),
      }),
    );

    expect(
      result.compoundPatterns.some((item) => item.id === "heat-uv-5"),
    ).toBe(false);
  });

  it("does not combine current AQI and PM2.5 from a mismatched timestamp", () => {
    const shiftedCurrentTime = new Date(
      new Date(createTimes()[0]).getTime() + 45 * 60 * 1000,
    ).toISOString();

    const result = analyzeAtmosphere(
      createForecast(),
      createAirQuality(
        {},
        {
          time: shiftedCurrentTime,
          european_aqi: 50,
          pm2_5: 30,
        },
      ),
    );

    expect(
      result.compoundPatterns.some(
        (item) => item.id === "combined-air-quality",
      ),
    ).toBe(false);
  });

  it("does not use hourly AQI and PM2.5 when their timestamps are misaligned", () => {
    const shiftedTimes = createTimes().map((time) =>
      new Date(new Date(time).getTime() + 45 * 60 * 1000).toISOString(),
    );

    const result = analyzeAtmosphere(
      createForecast(),
      createAirQuality(
        {
          time: shiftedTimes,
          european_aqi: Array(24).fill(50),
          pm2_5: Array(24).fill(30),
        },
        {
          european_aqi: Number.NaN,
          pm2_5: Number.NaN,
        },
      ),
    );

    expect(
      result.compoundPatterns.some(
        (item) => item.id === "combined-air-quality",
      ),
    ).toBe(false);
  });
  // SCENARIO_BASED_ATMOSPHERIC_TESTS_V1

  it("does not flag a normal daily temperature cycle as an anomaly", () => {
    const temperatures = Array.from(
      { length: 24 },
      (_, index) => 15 + 3.5 * Math.sin((2 * Math.PI * (index - 6)) / 24),
    );

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) => item.metric === "Air temperature",
      ),
    ).toBe(false);
  });

  it("detects a sustained cold departure from the local temperature baseline", () => {
    const temperatures = Array(24).fill(10);
    temperatures[8] = 0;
    temperatures[9] = 0;
    temperatures[10] = 0;

    const result = analyzeAtmosphere(
      createForecast({ temperature_2m: temperatures }),
      createAirQuality(),
    );

    const anomaly = result.anomalies.find(
      (item) =>
        item.metric === "Air temperature" &&
        item.kind === "sustained",
    );

    expect(anomaly).toBeDefined();
    expect(anomaly?.deviation).toBeLessThan(0);
    expect(anomaly?.durationHours).toBe(3);
    expect(anomaly?.description).toContain("negative");
  });

  it("does not flag a gradual humidity increase as an anomaly", () => {
    const humidity = Array.from(
      { length: 24 },
      (_, index) => 40 + index,
    );

    const result = analyzeAtmosphere(
      createForecast({ relative_humidity_2m: humidity }),
      createAirQuality(),
    );

    expect(
      result.anomalies.some(
        (item) => item.metric === "Relative humidity",
      ),
    ).toBe(false);
  });

  it("detects compound patterns at their configured thresholds", () => {
    const probability = Array(24).fill(0);
    const precipitation = Array(24).fill(0);
    const gusts = Array(24).fill(10);
    const humidity = Array(24).fill(50);
    const temperatures = Array(24).fill(15);
    const uv = Array(24).fill(2);

    probability[6] = 60;
    precipitation[6] = 2;
    gusts[6] = 45;
    humidity[6] = 85;
    temperatures[6] = 30;
    uv[6] = 6;

    const result = analyzeAtmosphere(
      createForecast({
        precipitation_probability: probability,
        precipitation,
        wind_gusts_10m: gusts,
        relative_humidity_2m: humidity,
        temperature_2m: temperatures,
      }),
      createAirQuality({ uv_index: uv }),
    );

    const ids = result.compoundPatterns.map((item) => item.id);

    expect(ids).toContain("rain-wind-6");
    expect(ids).toContain("humid-rain-6");
    expect(ids).toContain("heat-uv-6");
  });

  it("does not trigger compound patterns just below their thresholds", () => {
    const probability = Array(24).fill(0);
    const precipitation = Array(24).fill(0);
    const gusts = Array(24).fill(10);
    const humidity = Array(24).fill(50);
    const temperatures = Array(24).fill(15);
    const uv = Array(24).fill(2);

    probability[6] = 59;
    precipitation[6] = 1.9;
    gusts[6] = 44.9;
    humidity[6] = 84.9;
    temperatures[6] = 29.9;
    uv[6] = 5.9;

    const result = analyzeAtmosphere(
      createForecast({
        precipitation_probability: probability,
        precipitation,
        wind_gusts_10m: gusts,
        relative_humidity_2m: humidity,
        temperature_2m: temperatures,
      }),
      createAirQuality({ uv_index: uv }),
    );

    expect(result.compoundPatterns).toEqual([]);
  });

  it("requires both AQI and PM2.5 to meet their combined thresholds", () => {
    const exactAqiBoundary = analyzeAtmosphere(
      createForecast(),
      createAirQuality({}, {
        european_aqi: 40,
        pm2_5: 25,
      }),
    );

    const belowPmBoundary = analyzeAtmosphere(
      createForecast(),
      createAirQuality({}, {
        european_aqi: 41,
        pm2_5: 24.9,
      }),
    );

    const aboveBothBoundaries = analyzeAtmosphere(
      createForecast(),
      createAirQuality({}, {
        european_aqi: 41,
        pm2_5: 25,
      }),
    );

    const hasCombinedPattern = (result: ReturnType<typeof analyzeAtmosphere>) =>
      result.compoundPatterns.some(
        (item) => item.id === "combined-air-quality",
      );

    expect(hasCombinedPattern(exactAqiBoundary)).toBe(false);
    expect(hasCombinedPattern(belowPmBoundary)).toBe(false);
    expect(hasCombinedPattern(aboveBothBoundaries)).toBe(true);
  });
});
