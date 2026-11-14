import { Activity } from "lucide-react";

export function BrandMark() {
  return (
    <div className="brand-mark" aria-label="REZAVANTIS">
      <span className="brand-symbol">
        <Activity size={23} strokeWidth={1.5} />
      </span>
      <span className="brand-wordmark">
        <strong>
          REZA<span>VANTIS</span>
        </strong>
        <small>ATMOSPHERIC INTELLIGENCE</small>
      </span>
    </div>
  );
}
