"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle, MapPin, Navigation, Search, X } from "lucide-react";

import { reverseGeocode, searchCities } from "@/services/openMeteo";

import { hydrateLocationStore, useLocationStore } from "@/store/locationStore";

type CitySearchProps = {
  compact?: boolean;
};

export function CitySearch({ compact = false }: CitySearchProps) {
  const selectedCity = useLocationStore((state) => state.selectedCity);
  const setSelectedCity = useLocationStore((state) => state.setSelectedCity);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedTerm, setDebouncedTerm] = useState("");
  const [selectionMade, setSelectionMade] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const selectedCityLabel = selectedCity
    ? [selectedCity.name, selectedCity.country].filter(Boolean).join(", ")
    : "";
  const displayedSearchTerm =
    !isOpen && selectedCity ? selectedCityLabel : searchTerm;

  useEffect(() => {
    hydrateLocationStore();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedTerm(searchTerm.trim());
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [searchTerm]);

  const {
    data: cities = [],
    isFetching,
    isError,
  } = useQuery({
    queryKey: ["city-search", debouncedTerm],
    queryFn: () => searchCities(debouncedTerm),
    enabled: debouncedTerm.length >= 2 && !selectionMade && isOpen,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });


  function handleSelect(city: (typeof cities)[number]) {
    setSelectedCity(city);

    setSearchTerm([city.name, city.country].filter(Boolean).join(", "));

    setSelectionMade(true);
    setIsOpen(false);
    setActiveIndex(0);
    setLocationError("");
  }

  function handleChange(value: string) {
    setSearchTerm(value);
    setActiveIndex(0);
    setSelectionMade(false);
    setIsOpen(true);
    setLocationError("");
  }

  function clearSearch() {
    setSearchTerm("");
    setDebouncedTerm("");
    setSelectionMade(false);
    setIsOpen(false);
    setActiveIndex(0);
  }

  async function handleUseLocation() {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError("Location services are not supported by this browser.");
      return;
    }

    setIsLocating(true);

    try {
      const position = await new Promise<GeolocationPosition>(
        (resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000,
          });
        },
      );

      const { latitude, longitude } = position.coords;

      let city = null;

      try {
        city = await reverseGeocode(latitude, longitude);
      } catch {
        city = null;
      }

      const location = city
        ? {
            ...city,
            latitude,
            longitude,
          }
        : {
            id: -1,
            name: "Current location",
            country: "",
            latitude,
            longitude,
          };

      setSelectedCity(location);

      setSearchTerm(
        [location.name, location.country].filter(Boolean).join(", "),
      );

      setSelectionMade(true);
      setIsOpen(false);
    } catch (error) {
      const geoError = error as GeolocationPositionError;

      if (geoError.code === 1) {
        setLocationError(
          "Location permission was denied. Allow location access in your browser.",
        );
      } else if (geoError.code === 2) {
        setLocationError("Your current location could not be determined.");
      } else if (geoError.code === 3) {
        setLocationError("Location request timed out. Please try again.");
      } else {
        setLocationError("Unable to access your current location.");
      }
    } finally {
      setIsLocating(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (!isOpen || cities.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) =>
        current >= cities.length - 1 ? 0 : current + 1,
      );
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? cities.length - 1 : current - 1,
      );
    }

    if (event.key === "Enter") {
      event.preventDefault();
      handleSelect(cities[activeIndex] ?? cities[0]);
    }
  }

  return (
    <div
      className={`city-search-container ${compact ? "city-search-compact" : ""}`}
    >
      <form
        className="city-search"
        onSubmit={(event) => {
          event.preventDefault();

          if (cities.length > 0 && isOpen) {
            handleSelect(cities[activeIndex] ?? cities[0]);
          } else {
            setIsOpen(true);
          }
        }}
      >
        <MapPin className="search-location-icon" size={18} />

        <input
          role="combobox"
          aria-label="Search for a city worldwide"
          aria-expanded={isOpen && cities.length > 0}
          aria-autocomplete="list"
          aria-controls="city-search-results"
          autoComplete="off"
          placeholder="Search any city worldwide..."
          value={displayedSearchTerm}
          onFocus={() => {
            if (selectedCity) {
              setSelectionMade(true);
            } else {
              setIsOpen(true);
            }
          }}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          className="city-location-button"
          aria-label="Use my current location"
          title="Use my current location"
          onClick={handleUseLocation}
          disabled={isLocating}
        >
          {isLocating ? (
            <LoaderCircle size={17} className="location-loading-icon" />
          ) : (
            <Navigation size={17} />
          )}
          {!compact && <span>My Location</span>}
        </button>

        {searchTerm && (
          <button
            type="button"
            className="city-search-clear"
            aria-label="Clear search"
            onClick={clearSearch}
          >
            <X size={15} />
          </button>
        )}

        <button type="submit" aria-label="Search city">
          <Search size={16} />
          <span>Explore</span>
        </button>
      </form>

      {locationError && (
        <div className="city-location-error" role="alert">
          {locationError}
        </div>
      )}

      {isOpen && !selectionMade && searchTerm.trim().length >= 2 && (
        <div
          className="city-search-results"
          id="city-search-results"
          role="listbox"
        >
          {isFetching && (
            <div className="city-search-feedback">Searching locations...</div>
          )}

          {!isFetching && cities.length === 0 && !isError && (
            <div className="city-search-feedback">
              No matching locations found.
            </div>
          )}

          {isError && (
            <div className="city-search-feedback">
              Location search is temporarily unavailable. Try again.
            </div>
          )}

          {!isFetching &&
            cities.map((city, index) => (
              <button
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                className={`city-search-result ${
                  activeIndex === index ? "is-active" : ""
                }`}
                key={`${city.id}-${city.latitude}-${city.longitude}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelect(city)}
              >
                <span className="city-result-icon">
                  <MapPin size={16} />
                </span>

                <span className="city-result-copy">
                  <strong>{city.name}</strong>
                  <small>
                    {[city.admin1, city.country].filter(Boolean).join(", ")}
                  </small>
                </span>

                <span className="city-result-coordinates">
                  {city.latitude.toFixed(2)}°, {city.longitude.toFixed(2)}°
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
