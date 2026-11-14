import { EarthLoader } from "./EarthLoader";

type AtmosphericLoaderProps = {
  label?: string;
  compact?: boolean;
};

export function AtmosphericLoader({
  label = "Preparing atmospheric intelligence",
  compact = false,
}: AtmosphericLoaderProps) {
  if (compact) {
    return (
      <div className="data-loader" role="status" aria-live="polite">
        <span className="data-loader-orbit" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <div className="cinematic-loader" role="status" aria-live="polite">
      <div className="loader-noise" />
      <div className="loader-brand">
        <span className="brand-symbol">R</span>
        <span>REZAVANTIS</span>
      </div>

      <div className="loader-earth-stage">
        <div className="loader-aura" />
        <EarthLoader />
      </div>

      <div className="loader-copy">
        <span className="loader-eyebrow">
          ATMOSPHERIC INTELLIGENCE PLATFORM
        </span>
        <p>{label}</p>
        <div className="loader-progress">
          <span />
        </div>
      </div>

      <span className="loader-coordinate">EARTH SYSTEM / 001</span>
      <span className="loader-version">BEYOND WEATHER. INTO ATMOSPHERE.</span>
    </div>
  );
}
