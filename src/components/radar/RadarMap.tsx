"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { RadarFrame } from "@/services/radar";
import type { SelectedCity } from "@/store/locationStore";

type Props = {
  center: [number, number] | null;
  selectedCity: SelectedCity | null;
  favoriteCities: SelectedCity[];
  radarHost: string | null;
  radarFrame: RadarFrame | null;
  showRadar: boolean;
};

function MapViewport({ center }: { center: [number, number] | null }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.flyTo(center, 6, { duration: 1.2 });
    } else {
      map.setView([20, 0], 2);
    }
  }, [center, map]);

  return null;
}

function sameLocation(a: SelectedCity, b: SelectedCity) {
  return (
    Math.abs(a.latitude - b.latitude) < 0.01 &&
    Math.abs(a.longitude - b.longitude) < 0.01
  );
}

export default function RadarMap({
  center,
  selectedCity,
  favoriteCities,
  radarHost,
  radarFrame,
  showRadar,
}: Props) {
  const locations = [...favoriteCities];

  if (
    selectedCity &&
    !locations.some((city) => sameLocation(city, selectedCity))
  ) {
    locations.unshift(selectedCity);
  }

  const radarUrl =
    radarHost && radarFrame
      ? `${radarHost}${radarFrame.path}/256/{z}/{x}/{y}/2/1_1.png`
      : null;

  return (
    <MapContainer
      center={center ?? [20, 0]}
      zoom={center ? 6 : 2}
      minZoom={2}
      maxZoom={18}
      scrollWheelZoom
      zoomControl
      className="radar-leaflet-map"
      worldCopyJump
    >
      <MapViewport center={center} />

      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      {showRadar && radarUrl && (
        <TileLayer
          key={radarFrame?.time}
          url={radarUrl}
          opacity={0.76}
          maxNativeZoom={7}
          maxZoom={18}
          zIndex={400}
          attribution='Weather radar &copy; <a href="https://www.rainviewer.com/">RainViewer</a>'
        />
      )}

      {locations.map((city) => {
        const active =
          selectedCity !== null && sameLocation(city, selectedCity);

        return (
          <CircleMarker
            key={`${city.latitude}-${city.longitude}`}
            center={[city.latitude, city.longitude]}
            radius={active ? 9 : 6}
            pathOptions={{
              color: active ? "#f2d5a0" : "#8bdcff",
              fillColor: active ? "#f2d5a0" : "#55bde8",
              fillOpacity: 0.95,
              weight: 2,
            }}
          >
            <Popup>
              <strong>{city.name}</strong>
              <br />
              {city.country}
              {active ? " · Active location" : ""}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
