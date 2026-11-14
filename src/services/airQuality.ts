import axios from "axios";

export type AirQualityCurrent = {
  time: string;
  interval?: number;
  european_aqi?: number;
  us_aqi?: number;
  pm2_5?: number;
  pm10?: number;
  carbon_monoxide?: number;
  nitrogen_dioxide?: number;
  sulphur_dioxide?: number;
  ozone?: number;
  dust?: number;
  uv_index?: number;
  aerosol_optical_depth?: number;
  ammonia?: number;
  alder_pollen?: number;
  birch_pollen?: number;
  grass_pollen?: number;
  mugwort_pollen?: number;
  olive_pollen?: number;
  ragweed_pollen?: number;
};

export type AirQualityHourly = {
  time: string[];
  european_aqi?: number[];
  us_aqi?: number[];
  pm2_5?: number[];
  pm10?: number[];
  carbon_monoxide?: number[];
  nitrogen_dioxide?: number[];
  sulphur_dioxide?: number[];
  ozone?: number[];
  dust?: number[];
  uv_index?: number[];
  aerosol_optical_depth?: number[];
  ammonia?: number[];
  alder_pollen?: number[];
  birch_pollen?: number[];
  grass_pollen?: number[];
  mugwort_pollen?: number[];
  olive_pollen?: number[];
  ragweed_pollen?: number[];
};

export type AirQualityResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  timezone_abbreviation?: string;
  current?: AirQualityCurrent;
  current_units?: Record<string, string>;
  hourly: AirQualityHourly;
  hourly_units?: Record<string, string>;
};

const currentVariables = [
  "european_aqi",
  "us_aqi",
  "pm2_5",
  "pm10",
  "carbon_monoxide",
  "nitrogen_dioxide",
  "sulphur_dioxide",
  "ozone",
  "dust",
  "uv_index",
  "aerosol_optical_depth",
  "ammonia",
  "alder_pollen",
  "birch_pollen",
  "grass_pollen",
  "mugwort_pollen",
  "olive_pollen",
  "ragweed_pollen",
];

const hourlyVariables = [...currentVariables];

export async function getAirQuality(
  latitude: number,
  longitude: number,
): Promise<AirQualityResponse> {
  const response = await axios.get<AirQualityResponse>(
    "https://air-quality-api.open-meteo.com/v1/air-quality",
    {
      params: {
        latitude,
        longitude,
        current: currentVariables.join(","),
        hourly: hourlyVariables.join(","),
        timezone: "auto",
        forecast_days: 5,
        domains: "auto",
      },
      timeout: 25000,
    },
  );

  return response.data;
}
