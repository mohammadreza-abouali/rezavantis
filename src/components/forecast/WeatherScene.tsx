"use client";

type WeatherSceneProps = {
  code: number;
  isDay: boolean;
};

function getWeatherKind(code: number) {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "cloudy";
}

export default function WeatherScene({ code, isDay }: WeatherSceneProps) {
  const kind = getWeatherKind(code);
  const hasClouds = kind !== "clear";
  const hasPrecipitation = ["drizzle", "rain", "snow", "storm"].includes(kind);

  return (
    <div
      className={`weather-scene weather-scene--${kind} ${
        isDay ? "weather-scene--day" : "weather-scene--night"
      }`}
      role="img"
      aria-label={`${kind} weather, ${isDay ? "daytime" : "nighttime"}`}
    >
      <div className="weather-scene__glow" />

      {(kind === "clear" || kind === "partly") && isDay && (
        <span className="weather-scene__sun" />
      )}

      {!isDay && (
        <span className="weather-scene__moon" />
      )}

      {hasClouds && (
        <div className="weather-scene__clouds">
          <span className="weather-scene__cloud weather-scene__cloud--back" />
          <span className="weather-scene__cloud weather-scene__cloud--main" />
          {["partly", "cloudy", "fog", "drizzle", "rain", "snow", "storm"].includes(kind) && (
            <span className="weather-scene__cloud weather-scene__cloud--front" />
          )}
        </div>
      )}

      {kind === "fog" && (
        <div className="weather-scene__fog">
          <span />
          <span />
          <span />
        </div>
      )}

      {hasPrecipitation && (
        <div className={`weather-scene__precipitation weather-scene__precipitation--${kind}`}>
          {Array.from({ length: 12 }, (_, index) => (
            <i key={index} />
          ))}
        </div>
      )}

      {kind === "storm" && (
        <span className="weather-scene__lightning" />
      )}

      <div className="weather-scene__horizon" />
    </div>
  );
}
