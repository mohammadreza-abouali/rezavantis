export type RadarFrame = {
  time: number;
  path: string;
};

export type RadarResponse = {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RadarFrame[];
  };
};

export async function getRadarFrames(): Promise<RadarResponse> {
  const response = await fetch(
    "https://api.rainviewer.com/public/weather-maps.json",
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    },
  );

  if (!response.ok) {
    throw new Error(`Radar service returned ${response.status}`);
  }

  const data = (await response.json()) as RadarResponse;

  if (!data.host || !Array.isArray(data.radar?.past)) {
    throw new Error("Radar service returned an invalid response.");
  }

  return data;
}
