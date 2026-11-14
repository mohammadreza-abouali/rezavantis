import axios from "axios";

export type GeocodingResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
  timezone?: string;
};

export type GeocodingResponse = {
  results?: GeocodingResult[];
};

export type CurrentWeather = {
  time: string;
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  weather_code: number;
  cloud_cover: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
  surface_pressure: number;
};

export type HourlyForecast = {
  time: string[];
  temperature_2m: number[];
  apparent_temperature: number[];
  relative_humidity_2m: number[];
  precipitation_probability: number[];
  precipitation: number[];
  weather_code: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  surface_pressure: number[];
  visibility: number[];
  cloud_cover: number[];
};

export type DailyForecast = {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
  precipitation_sum: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
};

export type WeatherResponse = {
  current: CurrentWeather;
  current_units: Record<string, string>;
  timezone: string;
};

export type ForecastResponse = WeatherResponse & {
  hourly: HourlyForecast;
  hourly_units: Record<string, string>;
  daily: DailyForecast;
  daily_units: Record<string, string>;
};

export async function searchCities(query: string): Promise<GeocodingResult[]> {
  const response = await axios.get<GeocodingResponse>(
    "https://geocoding-api.open-meteo.com/v1/search",
    {
      params: {
        name: query,
        count: 10,
        language: "en",
        format: "json",
      },
      timeout: 10000,
    },
  );

  const results = response.data.results ?? [];
  const uniqueCities = new Map<string, GeocodingResult>();

  for (const city of results) {
    const key = [
      city.name.trim().toLowerCase(),
      city.country.trim().toLowerCase(),
      city.latitude.toFixed(2),
      city.longitude.toFixed(2),
    ].join("-");

    if (!uniqueCities.has(key)) {
      uniqueCities.set(key, city);
    }
  }

  return Array.from(uniqueCities.values());
}

type ReverseGeocodingResponse = {
  city?: string;
  locality?: string;
  principalSubdivision?: string;
  countryName?: string;
};

export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<GeocodingResult | null> {
  const response = await axios.get<ReverseGeocodingResponse>(
    "https://api.bigdatacloud.net/data/reverse-geocode-client",
    {
      params: {
        latitude,
        longitude,
        localityLanguage: "en",
      },
      timeout: 10000,
    },
  );

  const result = response.data;
  const cityName = result.city || result.locality;

  if (!cityName) return null;

  return {
    id: 0,
    name: cityName,
    latitude,
    longitude,
    country: result.countryName ?? "",
    admin1: result.principalSubdivision,
  };
}

export async function getCurrentWeather(
  latitude: number,
  longitude: number,
): Promise<WeatherResponse> {
  const response = await axios.get<WeatherResponse>(
    "https://api.open-meteo.com/v1/forecast",
    {
      params: {
        latitude,
        longitude,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "weather_code",
          "cloud_cover",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "surface_pressure",
        ].join(","),
        timezone: "auto",
        forecast_days: 1,
      },
      timeout: 15000,
    },
  );

  return response.data;
}

export async function getForecast(
  latitude: number,
  longitude: number,
): Promise<ForecastResponse> {
  const response = await axios.get<ForecastResponse>(
    "https://api.open-meteo.com/v1/forecast",
    {
      params: {
        latitude,
        longitude,
        current: [
          "temperature_2m",
          "relative_humidity_2m",
          "apparent_temperature",
          "is_day",
          "precipitation",
          "weather_code",
          "cloud_cover",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "surface_pressure",
        ].join(","),
        hourly: [
          "temperature_2m",
          "apparent_temperature",
          "relative_humidity_2m",
          "precipitation_probability",
          "precipitation",
          "weather_code",
          "wind_speed_10m",
          "wind_direction_10m",
          "wind_gusts_10m",
          "surface_pressure",
          "visibility",
          "cloud_cover",
        ].join(","),
        daily: [
          "weather_code",
          "temperature_2m_max",
          "temperature_2m_min",
          "sunrise",
          "sunset",
          "uv_index_max",
          "precipitation_sum",
          "precipitation_probability_max",
          "wind_speed_10m_max",
          "wind_gusts_10m_max",
        ].join(","),
        timezone: "auto",
        forecast_days: 7,
        wind_speed_unit: "kmh",
      },
      timeout: 20000,
    },
  );

  return response.data;
}
