import type { ForecastResponse } from "@/services/openMeteo";
import type { AirQualityResponse } from "@/services/airQuality";

export type ForecastAnomaly = {
  id: string;
  metric: string;
  time: string;
  description: string;
  evidence: string;
  deviation: number;
  unit: string;
  severity: "moderate" | "elevated";
  confidence: number;
  kind: "point" | "sustained";
  durationHours: number;
};

export type ForecastCorrelation = {
  id: string;
  title: string;
  description: string;
  coefficient: number;
  sampleCount: number;
  strength: "notable" | "strong";
};

export type CompoundPattern = {
  id: string;
  title: string;
  description: string;
  evidence: string;
  time: string;
  confidence: number;
  severity: "moderate" | "elevated";
};

export type AtmosphericEngineResult = {
  evaluatedHours: number;
  anomalies: ForecastAnomaly[];
  correlations: ForecastCorrelation[];
  compoundPatterns: CompoundPattern[];
};

type Series = {
  id: string;
  metric: string;
  unit: string;
  times: string[];
  values?: number[];
  minimumDeviation: number;
};

function isValid(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function nearestIndex(
  times: string[],
  target: string,
  maximumGapMs = 90 * 60 * 1000,
): number {
  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime) || !times.length) return -1;

  let bestIndex = -1;
  let bestDifference = Infinity;

  times.forEach((time, index) => {
    const timestamp = new Date(time).getTime();
    if (!Number.isFinite(timestamp)) return;

    const difference = Math.abs(timestamp - targetTime);
    if (difference < bestDifference) {
      bestDifference = difference;
      bestIndex = index;
    }
  });

  return bestDifference <= maximumGapMs ? bestIndex : -1;
}


function exactTimeValue(
  times: string[],
  values: number[] | undefined,
  target: string,
): number | undefined {
  if (!values?.length) return undefined;

  const targetTime = new Date(target).getTime();
  if (!Number.isFinite(targetTime)) return undefined;

  const index = times.findIndex((time) => {
    const timestamp = new Date(time).getTime();
    return Number.isFinite(timestamp) && timestamp === targetTime;
  });

  if (index < 0) return undefined;

  const value = values[index];
  return isValid(value) ? value : undefined;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function standardDeviation(values: number[], center: number): number {
  const variance =
    values.reduce((sum, value) => sum + (value - center) ** 2, 0) /
    values.length;

  return Math.sqrt(variance);
}

function detectSustainedAnomalies(
  series: Series[],
  currentTime: string,
): ForecastAnomaly[] {
  const findings: ForecastAnomaly[] = [];
  const maximumGapMs = 90 * 60 * 1000;

  for (const item of series) {
    if (!item.values?.length || !item.times.length) continue;

    const startIndex = nearestIndex(item.times, currentTime);
    if (startIndex < 0) continue;

    const endIndex = Math.min(
      startIndex + 24,
      item.times.length,
      item.values.length,
    );

    let bestFinding: ForecastAnomaly | undefined;

    // Require at least three consecutive hourly forecast checkpoints.
    // Compare the candidate run against three observations on each side.
    const maximumRunLength = Math.min(12, endIndex - startIndex - 6);

    for (
      let runLength = maximumRunLength;
      runLength >= 3;
      runLength -= 1
    ) {
      for (
        let runStart = startIndex + 3;
        runStart + runLength + 3 <= endIndex;
        runStart += 1
      ) {
        const runEnd = runStart + runLength;
        const contextStart = runStart - 3;
        const contextEnd = runEnd + 3;

        // Missing, invalid, duplicated or widely separated timestamps
        // must interrupt a candidate instead of being silently bridged.
        let continuous = true;

        for (
          let index = contextStart;
          index < contextEnd;
          index += 1
        ) {
          const timestamp = new Date(item.times[index]).getTime();

          if (!Number.isFinite(timestamp)) {
            continuous = false;
            break;
          }

          if (index > contextStart) {
            const previous = new Date(item.times[index - 1]).getTime();
            const gap = timestamp - previous;

            if (gap <= 0 || gap > maximumGapMs) {
              continuous = false;
              break;
            }
          }
        }

        if (!continuous) continue;

        const contextValues = [
          ...item.values.slice(contextStart, runStart),
          ...item.values.slice(runEnd, contextEnd),
        ];

        if (
          contextValues.length < 4 ||
          !contextValues.every(isValid)
        ) {
          continue;
        }

        const baseline = median(contextValues);
        const baselineMad = median(
          contextValues.map((value) => Math.abs(value - baseline)),
        );

        // Reject unstable surrounding conditions. The baseline must
        // be sufficiently consistent to support a sustained deviation.
        if (baselineMad > Math.max(0.5, item.minimumDeviation * 0.35)) {
          continue;
        }

        const runValues = item.values.slice(runStart, runEnd);

        if (!runValues.every(isValid)) continue;

        const firstDeviation = runValues[0] - baseline;
        const direction = Math.sign(firstDeviation);

        if (direction === 0) continue;

        const deviations = runValues.map((value) => value - baseline);

        const consistentRun = deviations.every(
          (deviation) =>
            Math.sign(deviation) === direction &&
            Math.abs(deviation) >= item.minimumDeviation,
        );

        if (!consistentRun) continue;

        const averageDeviation =
          deviations.reduce((sum, value) => sum + value, 0) /
          deviations.length;

        const peakDeviation = Math.max(
          ...deviations.map(Math.abs),
        );

        const confidence = Math.min(
          94,
          Math.round(
            70 +
              Math.min(runLength, 8) * 2 +
              Math.min(
                10,
                Math.max(0, peakDeviation / item.minimumDeviation - 1) * 3,
              ),
          ),
        );

        const candidate: ForecastAnomaly = {
          id: `${item.id}-sustained-${runStart}-${runLength}`,
          metric: item.metric,
          time: item.times[runStart],
          description:
            `${item.metric} shows a sustained ${direction > 0 ? "positive" : "negative"} ` +
            "departure from its surrounding local forecast baseline. " +
            "This is a persistent short-range forecast pattern, not a climatological anomaly.",
          evidence:
            `${runLength} consecutive hourly checkpoints | ` +
            `Local baseline ${baseline.toFixed(1)} ${item.unit} | ` +
            `Peak deviation ${peakDeviation.toFixed(1)} ${item.unit}`,
          deviation: averageDeviation,
          unit: item.unit,
          severity:
            peakDeviation >= item.minimumDeviation * 2
              ? "elevated"
              : "moderate",
          confidence,
          kind: "sustained",
          durationHours: runLength,
        };

        // Prefer the longest qualifying run. For equal durations,
        // retain the candidate with the larger peak deviation.
        if (
          !bestFinding ||
          candidate.durationHours > bestFinding.durationHours ||
          (
            candidate.durationHours === bestFinding.durationHours &&
            Math.abs(candidate.deviation) > Math.abs(bestFinding.deviation)
          )
        ) {
          bestFinding = candidate;
        }
      }
    }

    if (bestFinding) findings.push(bestFinding);
  }

  return findings;
}

function detectAnomalies(
  series: Series[],
  currentTime: string,
): ForecastAnomaly[] {
  const findings: ForecastAnomaly[] = [];
  const maximumGapMs = 90 * 60 * 1000;

  for (const item of series) {
    if (!item.values?.length || !item.times.length) continue;

    const startIndex = nearestIndex(item.times, currentTime);
    if (startIndex < 0) continue;

    const endIndex = Math.min(
      startIndex + 24,
      item.times.length,
      item.values.length,
    );

    for (let index = startIndex; index < endIndex; index += 1) {
      const value = item.values[index];
      const targetTimestamp = new Date(item.times[index]).getTime();

      if (!isValid(value) || !Number.isFinite(targetTimestamp)) continue;

      // Build a local window that cannot cross invalid, duplicated,
      // reversed or unusually distant timestamps.
      let leftBoundary = index;
      let rightBoundary = index;

      while (leftBoundary > startIndex && index - leftBoundary < 3) {
        const current = new Date(item.times[leftBoundary]).getTime();
        const previous = new Date(item.times[leftBoundary - 1]).getTime();
        const gap = current - previous;

        if (
          !Number.isFinite(current) ||
          !Number.isFinite(previous) ||
          gap <= 0 ||
          gap > maximumGapMs
        ) {
          break;
        }

        leftBoundary -= 1;
      }

      while (rightBoundary < endIndex - 1 && rightBoundary - index < 3) {
        const current = new Date(item.times[rightBoundary]).getTime();
        const next = new Date(item.times[rightBoundary + 1]).getTime();
        const gap = next - current;

        if (
          !Number.isFinite(current) ||
          !Number.isFinite(next) ||
          gap <= 0 ||
          gap > maximumGapMs
        ) {
          break;
        }

        rightBoundary += 1;
      }

      const peerValues: number[] = [];

      for (
        let neighbor = leftBoundary;
        neighbor <= rightBoundary;
        neighbor += 1
      ) {
        if (neighbor === index) continue;

        const peer = item.values[neighbor];
        if (isValid(peer)) peerValues.push(peer);
      }

      // Insufficient local evidence must not generate an alert.
      if (peerValues.length < 4) continue;

      const baseline = median(peerValues);
      const deviation = value - baseline;
      const absoluteDeviation = Math.abs(deviation);

      if (absoluteDeviation < item.minimumDeviation) continue;

      const absoluteDifferences = peerValues.map((peer) =>
        Math.abs(peer - baseline),
      );

      const mad = median(absoluteDifferences);
      const standard = standardDeviation(peerValues, baseline);

      const score =
        mad > 0
          ? (0.6745 * absoluteDeviation) / mad
          : standard > 0
            ? absoluteDeviation / standard
            : 0;

      if (!Number.isFinite(score) || score < 3) continue;

      const confidence = Math.min(
        95,
        Math.round(
          58 +
            Math.min(peerValues.length, 6) * 4 +
            Math.min(16, (score - 3) * 5),
        ),
      );

      findings.push({
        id: `${item.id}-${index}`,
        kind: "point",
        durationHours: 1,
        metric: item.metric,
        time: item.times[index],
        description:
          `${item.metric} is ${deviation > 0 ? "above" : "below"} its local forecast baseline. ` +
          "This is a short-range forecast outlier, not a climatological anomaly.",
        evidence:
          `Forecast ${value.toFixed(1)} ${item.unit} Â· ` +
          `Local baseline ${baseline.toFixed(1)} ${item.unit} Â· ` +
          `Robust deviation ${score.toFixed(1)}Ã—`,
        deviation,
        unit: item.unit,
        severity: score >= 4.5 ? "elevated" : "moderate",
        confidence,
      });
    }
  }

  findings.push(...detectSustainedAnomalies(series, currentTime));

  const strongestByMetric = new Map<string, ForecastAnomaly>();

  for (const finding of findings) {
    const existing = strongestByMetric.get(finding.metric);

    if (
      !existing ||
      (finding.kind === "sustained" && existing.kind !== "sustained") ||
      (
        finding.kind === existing.kind &&
        (
          finding.durationHours > existing.durationHours ||
          (
            finding.durationHours === existing.durationHours &&
            Math.abs(finding.deviation) > Math.abs(existing.deviation)
          )
        )
      )
    ) {
      strongestByMetric.set(finding.metric, finding);
    }
  }

  return Array.from(strongestByMetric.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

function pearsonCorrelation(
  left: Array<number | undefined>,
  right: Array<number | undefined>,
): { coefficient: number; count: number } | undefined {
  const pairs = left
    .map((value, index) => ({ x: value, y: right[index] }))
    .filter(
      (pair): pair is { x: number; y: number } =>
        typeof pair.x === "number" &&
        Number.isFinite(pair.x) &&
        typeof pair.y === "number" &&
        Number.isFinite(pair.y),
    );

  if (pairs.length < 8) return undefined;

  const meanX = pairs.reduce((sum, pair) => sum + pair.x, 0) / pairs.length;
  const meanY = pairs.reduce((sum, pair) => sum + pair.y, 0) / pairs.length;

  const numerator = pairs.reduce(
    (sum, pair) => sum + (pair.x - meanX) * (pair.y - meanY),
    0,
  );

  const denominatorX = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair.x - meanX) ** 2, 0),
  );

  const denominatorY = Math.sqrt(
    pairs.reduce((sum, pair) => sum + (pair.y - meanY) ** 2, 0),
  );

  const denominator = denominatorX * denominatorY;
  if (denominator === 0) return undefined;

  return {
    coefficient: Math.max(-1, Math.min(1, numerator / denominator)),
    count: pairs.length,
  };
}

function detectCorrelations(
  forecast: ForecastResponse,
  airQuality: AirQualityResponse,
  startIndex: number,
): ForecastCorrelation[] {
  const weather = forecast.hourly;
  const air = airQuality.hourly;
  const maximumGapMs = 90 * 60 * 1000;

  const times = weather.time.slice(startIndex, startIndex + 24);
  const aqiValues = air.european_aqi ?? [];
  const pm25Values = air.pm2_5 ?? [];

  const airIndices = times.map((time) =>
    nearestIndex(air.time, time),
  );

  type CorrelationPair = {
    id: string;
    title: string;
    left: Array<number | undefined>;
    right: Array<number | undefined>;
    sourceIndices: number[];
    sourceTimes: string[];
  };

  const weatherSourceIndices = times.map(
    (_, index) => startIndex + index,
  );

  const pairs: CorrelationPair[] = [
    {
      id: "humidity-precipitation",
      title: "Humidity ↔ precipitation probability",
      left: weather.relative_humidity_2m.slice(startIndex, startIndex + 24),
      right: weather.precipitation_probability.slice(startIndex, startIndex + 24),
      sourceIndices: weatherSourceIndices,
      sourceTimes: times,
    },
    {
      id: "cloud-precipitation",
      title: "Cloud cover ↔ precipitation probability",
      left: weather.cloud_cover.slice(startIndex, startIndex + 24),
      right: weather.precipitation_probability.slice(startIndex, startIndex + 24),
      sourceIndices: weatherSourceIndices,
      sourceTimes: times,
    },
    {
      id: "wind-precipitation",
      title: "Wind speed ↔ precipitation probability",
      left: weather.wind_speed_10m.slice(startIndex, startIndex + 24),
      right: weather.precipitation_probability.slice(startIndex, startIndex + 24),
      sourceIndices: weatherSourceIndices,
      sourceTimes: times,
    },
    {
      id: "aqi-pm25",
      title: "European AQI ↔ PM2.5",
      left: airIndices.map((index) =>
        index >= 0 ? aqiValues[index] : undefined,
      ),
      right: airIndices.map((index) =>
        index >= 0 ? pm25Values[index] : undefined,
      ),
      sourceIndices: airIndices,
      sourceTimes: airIndices.map((index) =>
        index >= 0 ? air.time[index] ?? "" : "",
      ),
    },
  ];

  const results: ForecastCorrelation[] = [];

  for (const pair of pairs) {
    const runs: number[][] = [];
    let currentRun: number[] = [];

    for (let index = 0; index < times.length; index += 1) {
      const forecastTimestamp = new Date(times[index]).getTime();
      const sourceTimestamp = new Date(pair.sourceTimes[index]).getTime();

      const leftValue = pair.left[index];
      const rightValue = pair.right[index];
      const sourceIndex = pair.sourceIndices[index];

      const valid =
        Number.isFinite(forecastTimestamp) &&
        Number.isFinite(sourceTimestamp) &&
        sourceIndex !== undefined &&
        sourceIndex >= 0 &&
        isValid(leftValue) &&
        isValid(rightValue);

      if (!valid) {
        if (currentRun.length) runs.push(currentRun);
        currentRun = [];
        continue;
      }

      if (currentRun.length) {
        const previousIndex = currentRun[currentRun.length - 1];
        const previousForecastTimestamp = new Date(
          times[previousIndex],
        ).getTime();
        const previousSourceTimestamp = new Date(
          pair.sourceTimes[previousIndex],
        ).getTime();

        const forecastGap =
          forecastTimestamp - previousForecastTimestamp;

        const sourceGap =
          sourceTimestamp - previousSourceTimestamp;

        const sourceIndexGap =
          sourceIndex - pair.sourceIndices[previousIndex];

        const continuous =
          forecastGap > 0 &&
          forecastGap <= maximumGapMs &&
          sourceGap > 0 &&
          sourceGap <= maximumGapMs &&
          sourceIndexGap === 1;

        if (!continuous) {
          runs.push(currentRun);
          currentRun = [];
        }
      }

      currentRun.push(index);
    }

    if (currentRun.length) runs.push(currentRun);

    if (!runs.length) continue;

    // Use only the longest continuous run. Never combine
    // separate forecast windows into one statistical sample.
    const longestRun = runs.reduce((best, run) =>
      run.length > best.length ? run : best,
    );

    const correlation = pearsonCorrelation(
      longestRun.map((index) => pair.left[index]),
      longestRun.map((index) => pair.right[index]),
    );

    if (!correlation) continue;

    const strength = Math.abs(correlation.coefficient);
    if (strength < 0.65) continue;

    const relationship =
      correlation.coefficient >= 0 ? "positive" : "inverse";

    results.push({
      id: pair.id,
      title: pair.title,
      coefficient: correlation.coefficient,
      sampleCount: correlation.count,
      strength: strength >= 0.8 ? "strong" : "notable",
      description:
        `${relationship === "positive" ? "Both indicators tend to increase together" : "The indicators tend to move in opposite directions"} ` +
        `across ${correlation.count} matched hourly forecast points. ` +
        "This is an observed forecast association, not evidence of causation.",
    });
  }

  return results
    .sort(
      (a, b) =>
        Math.abs(b.coefficient) - Math.abs(a.coefficient),
    )
    .slice(0, 4);
}
function detectCompoundPatterns(
  forecast: ForecastResponse,
  airQuality: AirQualityResponse,
  startIndex: number,
): CompoundPattern[] {
  const weather = forecast.hourly;
  const air = airQuality.hourly;
  const patterns: CompoundPattern[] = [];

  let strongestRainWind: CompoundPattern | undefined;
  let strongestRainProbability = -Infinity;
  let strongestHumidRain: CompoundPattern | undefined;
  let strongestHeatUv: CompoundPattern | undefined;

  const endIndex = Math.min(startIndex + 24, weather.time.length);

  for (let index = startIndex; index < endIndex; index += 1) {
    const time = weather.time[index];

    if (
      typeof time !== "string" ||
      !Number.isFinite(new Date(time).getTime())
    ) {
      continue;
    }

    const probability = weather.precipitation_probability[index];
    const precipitation = weather.precipitation[index];
    const gust = weather.wind_gusts_10m[index];
    const humidity = weather.relative_humidity_2m[index];
    const temperature = weather.temperature_2m[index];

    if (
      isValid(probability) &&
      isValid(precipitation) &&
      isValid(gust) &&
      probability >= 60 &&
      precipitation >= 2 &&
      gust >= 45
    ) {
      const candidate: CompoundPattern = {
        id: `rain-wind-${index}`,
        title: "Rainfall and strong wind overlap",
        description:
          "Rain probability, precipitation amount and wind gusts cross their monitoring thresholds during the same forecast hour.",
        evidence:
          `${probability}% precipitation probability Â· ` +
          `${precipitation.toFixed(1)} mm Â· ${gust.toFixed(0)} km/h gusts`,
        time,
        confidence: 84,
        severity: "elevated",
      };

      if (probability > strongestRainProbability) {
        strongestRainProbability = probability;
        strongestRainWind = candidate;
      }
    }

    if (
      isValid(humidity) &&
      isValid(probability) &&
      isValid(precipitation) &&
      humidity >= 85 &&
      probability >= 60 &&
      precipitation >= 1
    ) {
      strongestHumidRain ??= {
        id: `humid-rain-${index}`,
        title: "High humidity with rainfall potential",
        description:
          "High relative humidity coincides with a meaningful precipitation probability and measurable forecast rainfall.",
        evidence:
          `${humidity}% humidity Â· ${probability}% precipitation probability Â· ${precipitation.toFixed(1)} mm`,
        time,
        confidence: 78,
        severity: "moderate",
      };
    }

    const uv = exactTimeValue(air.time, air.uv_index, time);

    if (
      isValid(temperature) &&
      isValid(uv) &&
      temperature >= 30 &&
      uv >= 6
    ) {
      strongestHeatUv ??= {
        id: `heat-uv-${index}`,
        title: "Heat and ultraviolet exposure overlap",
        description:
          "Elevated forecast temperature and UV index occur at the same hourly checkpoint.",
        evidence: `${temperature.toFixed(1)} Â°C Â· UV ${uv.toFixed(1)}`,
        time,
        confidence: 80,
        severity: "elevated",
      };
    }
  }

  if (strongestRainWind) patterns.push(strongestRainWind);
  if (strongestHumidRain) patterns.push(strongestHumidRain);
  if (strongestHeatUv) patterns.push(strongestHeatUv);

  const currentTime = forecast.current.time;
  const currentTimeMs = new Date(currentTime).getTime();
  const airCurrentTimeMs = airQuality.current?.time
    ? new Date(airQuality.current.time).getTime()
    : Number.NaN;

  const currentSnapshotAligned =
    Number.isFinite(currentTimeMs) &&
    Number.isFinite(airCurrentTimeMs) &&
    Math.abs(currentTimeMs - airCurrentTimeMs) <= 30 * 60 * 1000;

  let currentAqi: number | undefined;
  let currentPm25: number | undefined;

  if (
    currentSnapshotAligned &&
    isValid(airQuality.current?.european_aqi) &&
    isValid(airQuality.current?.pm2_5)
  ) {
    currentAqi = airQuality.current.european_aqi;
    currentPm25 = airQuality.current.pm2_5;
  } else {
    const hourlyIndex = nearestIndex(
      air.time,
      currentTime,
      30 * 60 * 1000,
    );

    if (hourlyIndex >= 0) {
      currentAqi = air.european_aqi?.[hourlyIndex];
      currentPm25 = air.pm2_5?.[hourlyIndex];
    }
  }

  if (
    isValid(currentAqi) &&
    isValid(currentPm25) &&
    currentAqi > 40 &&
    currentPm25 >= 25
  ) {
    patterns.push({
      id: "combined-air-quality",
      title: "Multiple air-quality indicators elevated",
      description:
        "European AQI and fine particulate matter both exceed their configured monitoring thresholds.",
      evidence:
        `European AQI ${currentAqi.toFixed(0)} Â· PM2.5 ${currentPm25.toFixed(1)} Âµg/mÂ³`,
      time: currentTime,
      confidence: 82,
      severity: "moderate",
    });
  }

  return patterns;
}

export function analyzeAtmosphere(
  forecast: ForecastResponse,
  airQuality: AirQualityResponse,
): AtmosphericEngineResult {
  const currentTime = forecast.current.time;
  const weather = forecast.hourly;
  const startIndex = nearestIndex(weather.time, currentTime);

  if (startIndex < 0) {
    return {
      evaluatedHours: 0,
      anomalies: [],
      correlations: [],
      compoundPatterns: [],
    };
  }

  const series: Series[] = [
    {
      id: "temperature",
      metric: "Air temperature",
      unit: "Â°C",
      times: weather.time,
      values: weather.temperature_2m,
      minimumDeviation: 4,
    },
    {
      id: "pressure",
      metric: "Surface pressure",
      unit: "hPa",
      times: weather.time,
      values: weather.surface_pressure,
      minimumDeviation: 4,
    },
    {
      id: "wind",
      metric: "Wind speed",
      unit: "km/h",
      times: weather.time,
      values: weather.wind_speed_10m,
      minimumDeviation: 12,
    },
    {
      id: "humidity",
      metric: "Relative humidity",
      unit: "%",
      times: weather.time,
      values: weather.relative_humidity_2m,
      minimumDeviation: 18,
    },
    {
      id: "precipitation",
      metric: "Precipitation",
      unit: "mm",
      times: weather.time,
      values: weather.precipitation,
      minimumDeviation: 3,
    },
    {
      id: "cloud-cover",
      metric: "Cloud cover",
      unit: "%",
      times: weather.time,
      values: weather.cloud_cover,
      minimumDeviation: 35,
    },
    {
      id: "aqi",
      metric: "European AQI",
      unit: "AQI",
      times: airQuality.hourly.time,
      values: airQuality.hourly.european_aqi,
      minimumDeviation: 20,
    },
    {
      id: "pm25",
      metric: "PM2.5",
      unit: "Âµg/mÂ³",
      times: airQuality.hourly.time,
      values: airQuality.hourly.pm2_5,
      minimumDeviation: 15,
    },
  ];

  return {
    evaluatedHours: Math.min(24, weather.time.length - startIndex),
    anomalies: detectAnomalies(series, currentTime),
    correlations: detectCorrelations(forecast, airQuality, startIndex),
    compoundPatterns: detectCompoundPatterns(
      forecast,
      airQuality,
      startIndex,
    ),
  };
}
