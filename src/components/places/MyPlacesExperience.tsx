"use client";

import { useEffect, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  Activity,
  Check,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Heart,
  LoaderCircle,
  MapPin,
  Navigation,
  Plus,
  Search,
  Star,
  Trash2,
  Wind,
} from "lucide-react";
import {
  getCurrentWeather,
  searchCities,
  type GeocodingResult,
} from "@/services/openMeteo";
import {
  hydrateLocationStore,
  useLocationStore,
  useLocationStoreHydrated,
  type SelectedCity,
} from "@/store/locationStore";

function weatherDescription(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Mainly clear";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Atmospheric conditions";
}

function WeatherIcon({ code }: { code: number }) {
  if ([0, 1, 2].includes(code)) return <Cloud size={23} />;
  if ([45, 48].includes(code)) return <CloudFog size={23} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle size={23} />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return <CloudRain size={23} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow size={23} />;
  if ([95, 96, 99].includes(code)) return <CloudLightning size={23} />;
  return <Cloud size={23} />;
}

function cityLabel(city: SelectedCity) {
  return [city.name, city.country].filter(Boolean).join(", ");
}

function toSelectedCity(city: GeocodingResult): SelectedCity {
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    admin1: city.admin1,
    latitude: city.latitude,
    longitude: city.longitude,
    timezone: city.timezone,
  };
}

export function MyPlacesExperience() {
  const selectedCity = useLocationStore((state) => state.selectedCity);
  const favoriteCities = useLocationStore((state) => state.favoriteCities);
  const setSelectedCity = useLocationStore((state) => state.setSelectedCity);
  const addFavoriteCity = useLocationStore((state) => state.addFavoriteCity);
  const removeFavoriteCity = useLocationStore(
    (state) => state.removeFavoriteCity,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const hydrated = useLocationStoreHydrated();

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedTerm(searchTerm.trim()),
      350,
    );
    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const {
    data: searchResults = [],
    isFetching: searching,
    isError: searchError,
  } = useQuery({
    queryKey: ["places-city-search", debouncedTerm],
    queryFn: () => searchCities(debouncedTerm),
    enabled: debouncedTerm.length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  const weatherQueries = useQueries({
    queries: favoriteCities.map((city) => ({
      queryKey: ["place-weather", city.latitude, city.longitude],
      queryFn: () => getCurrentWeather(city.latitude, city.longitude),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })),
  });


  function isFavorite(city: SelectedCity) {
    return favoriteCities.some(
      (item) =>
        Math.abs(item.latitude - city.latitude) < 0.01 &&
        Math.abs(item.longitude - city.longitude) < 0.01,
    );
  }

  function addCity(city: GeocodingResult) {
    addFavoriteCity(toSelectedCity(city));
    setSearchTerm("");
    setDebouncedTerm("");
  }

  return (
    <div className="module-page places-page">
      <div className="module-page-heading">
        <span className="eyebrow">
          <span className="eyebrow-line" /> PERSONAL LOCATIONS
        </span>
        <div className="module-page-title-row">
          <div>
            <h1>My Places</h1>
            <p>
              Build your personal network of locations and compare atmospheric
              conditions across the world.
            </p>
          </div>
          <div className="module-page-icon">
            <Navigation size={25} strokeWidth={1.4} />
          </div>
        </div>
      </div>

      <section className="places-overview">
        <div className="places-overview-copy">
          <span className="panel-overline">YOUR LOCATION NETWORK</span>
          <h2>Every place. One perspective.</h2>
          <p>
            Save the cities that matter to you. Their latest weather conditions
            will be collected here for quick comparison.
          </p>
        </div>
        <div className="places-stat">
          <strong>{hydrated ? favoriteCities.length : "—"}</strong>
          <span>SAVED PLACES</span>
        </div>
        <div className="places-stat">
          <strong>{selectedCity ? "01" : "—"}</strong>
          <span>ACTIVE LOCATION</span>
        </div>
      </section>

      <section className="places-search-panel">
        <div className="places-section-heading">
          <div>
            <span className="panel-overline">DISCOVER LOCATIONS</span>
            <h2>Add a place</h2>
          </div>
          <span className="places-section-index">01 / SEARCH</span>
        </div>

        <div className="places-search-box">
          <Search size={19} />
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) =>
                  Math.min(current + 1, searchResults.length - 1),
                );
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) => Math.max(current - 1, 0));
              }

              if (event.key === "Enter") {
                event.preventDefault();
                const city = searchResults[activeIndex];

                if (city) {
                  const selected = toSelectedCity(city);

                  if (isFavorite(selected)) {
                    setSelectedCity(selected);
                    setSearchTerm("");
                    setDebouncedTerm("");
                  } else {
                    addCity(city);
                  }
                }
              }

              if (event.key === "Escape") {
                setSearchTerm("");
                setDebouncedTerm("");
                setActiveIndex(0);
              }
            }}
            placeholder="Search any city worldwide..."
            role="combobox"
            aria-label="Search cities to add to My Places"
            aria-autocomplete="list"
            aria-controls="places-search-results"
            aria-expanded={searchTerm.trim().length >= 2}
            autoComplete="off"
          />
          {searching && (
            <LoaderCircle className="places-search-loader" size={18} />
          )}
        </div>

        {searchTerm.trim().length >= 2 && (
          <div id="places-search-results" className="places-search-results">
            {searching && (
              <p className="places-feedback">Searching global locations...</p>
            )}
            {!searching && searchError && (
              <p className="places-feedback">
                Location search is unavailable. Please try again.
              </p>
            )}
            {!searching && !searchError && searchResults.length === 0 && (
              <p className="places-feedback">No matching cities found.</p>
            )}
            {!searching &&
              searchResults.map((city, index) => {
                const saved = isFavorite(toSelectedCity(city));
                return (
                  <div
                    className={`places-search-result ${index === activeIndex ? "is-keyboard-active" : ""}`}
                    key={`${city.id}-${city.latitude}-${city.longitude}`}
                    aria-selected={index === activeIndex}
                  >
                    <div className="places-result-icon">
                      <MapPin size={17} />
                    </div>
                    <div className="places-result-name">
                      <strong>{city.name}</strong>
                      <span>
                        {[city.admin1, city.country].filter(Boolean).join(", ")}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={`places-add-button ${saved ? "is-saved" : ""}`}
                      onClick={() => addCity(city)}
                      disabled={saved}
                    >
                      {saved ? <Check size={15} /> : <Plus size={15} />}
                      {saved ? "Saved" : "Add place"}
                    </button>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      <section className="places-saved-section">
        <div className="places-section-heading">
          <div>
            <span className="panel-overline">PERSONAL COLLECTION</span>
            <h2>Saved places</h2>
          </div>
          <span className="places-section-index">
            {String(favoriteCities.length).padStart(2, "0")} / LOCATIONS
          </span>
        </div>

        {!hydrated ? (
          <div className="places-empty-state">
            <LoaderCircle size={25} className="places-search-loader" />
            <p>Loading your saved locations...</p>
          </div>
        ) : favoriteCities.length === 0 ? (
          <div className="places-empty-state">
            <div className="places-empty-symbol">
              <Star size={25} />
            </div>
            <span className="panel-overline">YOUR COLLECTION STARTS HERE</span>
            <h3>No saved places yet</h3>
            <p>
              Search for a city above and add it to create your personal
              atmospheric dashboard.
            </p>
          </div>
        ) : (
          <div className="places-grid">
            {favoriteCities.map((city, index) => {
              const weather = weatherQueries[index]?.data?.current;
              const loading = weatherQueries[index]?.isLoading;
              const error = weatherQueries[index]?.isError;
              const active =
                selectedCity &&
                Math.abs(selectedCity.latitude - city.latitude) < 0.01 &&
                Math.abs(selectedCity.longitude - city.longitude) < 0.01;

              return (
                <article
                  className={`place-card ${active ? "place-card-active" : ""}`}
                  key={`${city.latitude}-${city.longitude}`}
                >
                  <div className="place-card-topline">
                    <span className="place-card-number">
                      LOCATION / {String(index + 1).padStart(2, "0")}
                    </span>
                    {active && (
                      <span className="place-active-label">
                        <span className="system-dot" /> ACTIVE
                      </span>
                    )}
                  </div>

                  <div className="place-card-heading">
                    <div>
                      <h3>{city.name}</h3>
                      <p>{city.country || city.admin1 || "Saved location"}</p>
                    </div>
                    <div className="place-weather-icon">
                      {weather ? (
                        <WeatherIcon code={weather.weather_code} />
                      ) : (
                        <Cloud size={23} />
                      )}
                    </div>
                  </div>

                  <div className="place-card-weather">
                    {loading ? (
                      <span className="place-loading">
                        <LoaderCircle size={16} /> Loading conditions
                      </span>
                    ) : weather ? (
                      <>
                        <strong>{Math.round(weather.temperature_2m)}°</strong>
                        <span>{weatherDescription(weather.weather_code)}</span>
                      </>
                    ) : error ? (
                      <span className="place-weather-error">
                        Weather data unavailable
                      </span>
                    ) : (
                      <span>Awaiting weather data</span>
                    )}
                  </div>

                  {weather && (
                    <div className="place-card-metrics">
                      <div>
                        <Activity size={14} />
                        <span>
                          Feels like{" "}
                          <strong>
                            {Math.round(weather.apparent_temperature)}°
                          </strong>
                        </span>
                      </div>
                      <div>
                        <Wind size={14} />
                        <span>
                          Wind{" "}
                          <strong>
                            {Math.round(weather.wind_speed_10m)} km/h
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="place-card-actions">
                    <button
                      type="button"
                      className={`place-select-button ${active ? "is-active" : ""}`}
                      onClick={() => setSelectedCity(city)}
                      disabled={!!active}
                    >
                      {active ? <Check size={15} /> : <Navigation size={15} />}
                      {active ? "Current location" : "Set as active"}
                    </button>
                    <button
                      type="button"
                      className="place-remove-button"
                      aria-label={`Remove ${cityLabel(city)} from saved places`}
                      title="Remove saved place"
                      onClick={() => removeFavoriteCity(city)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="places-comparison">
        <div className="places-section-heading">
          <div>
            <span className="panel-overline">CROSS-LOCATION ANALYSIS</span>
            <h2>City comparison</h2>
          </div>
          <span className="places-section-index">LIVE WEATHER</span>
        </div>

        {favoriteCities.length < 2 ? (
          <div className="places-comparison-empty">
            <Heart size={20} />
            <p>
              Save at least two cities to compare their current atmospheric
              conditions side by side.
            </p>
          </div>
        ) : (
          <div className="places-comparison-table-wrap">
            <table className="places-comparison-table">
              <thead>
                <tr>
                  <th>LOCATION</th>
                  <th>CONDITIONS</th>
                  <th>TEMPERATURE</th>
                  <th>FEELS LIKE</th>
                  <th>HUMIDITY</th>
                  <th>WIND</th>
                </tr>
              </thead>
              <tbody>
                {favoriteCities.map((city, index) => {
                  const current = weatherQueries[index]?.data?.current;
                  const pending = weatherQueries[index]?.isLoading;
                  return (
                    <tr key={`${city.latitude}-${city.longitude}`}>
                      <td>
                        <strong>{city.name}</strong>
                        <span>{city.country}</span>
                      </td>
                      <td>
                        {pending ? (
                          "Loading..."
                        ) : current ? (
                          <span className="places-table-condition">
                            <WeatherIcon code={current.weather_code} />
                            {weatherDescription(current.weather_code)}
                          </span>
                        ) : (
                          "Unavailable"
                        )}
                      </td>
                      <td>
                        {current
                          ? `${Math.round(current.temperature_2m)}°`
                          : "—"}
                      </td>
                      <td>
                        {current
                          ? `${Math.round(current.apparent_temperature)}°`
                          : "—"}
                      </td>
                      <td>
                        {current
                          ? `${Math.round(current.relative_humidity_2m)}%`
                          : "—"}
                      </td>
                      <td>
                        {current
                          ? `${Math.round(current.wind_speed_10m)} km/h`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="places-data-note">
        <span className="system-dot" />
        WEATHER DATA BY OPEN-METEO
        <span>·</span>
        SAVED LOCATIONS ARE STORED IN THIS BROWSER
      </div>
    </div>
  );
}
