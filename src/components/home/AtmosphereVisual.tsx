import { Globe2, Wind } from "lucide-react";

export function AtmosphereVisual() {
  return (
    <div
      className="visual-stage"
      aria-label="Abstract atmospheric visualization"
    >
      <div className="visual-topline">
        <span>ATMOSPHERIC ENGINE</span>
        <span className="visual-live">
          <i /> VISUAL PREVIEW
        </span>
      </div>

      <div className="planet-scene">
        <div className="scene-glow" />
        <div className="orbit orbit-one" />
        <div className="orbit orbit-two" />
        <div className="orbit orbit-three" />
        <div className="planet">
          <div className="planet-highlight" />
          <div className="planet-shadow" />
          <div className="planet-continent continent-one" />
          <div className="planet-continent continent-two" />
          <div className="planet-cloud cloud-one" />
          <div className="planet-cloud cloud-two" />
        </div>
        <div className="planet-point point-one" />
        <div className="planet-point point-two" />
        <div className="planet-point point-three" />
      </div>

      <div className="visual-bottomline">
        <div className="visual-caption">
          <Globe2 size={17} />
          <span>GLOBAL ATMOSPHERE</span>
        </div>
        <div className="visual-caption muted-caption">
          <Wind size={17} />
          <span>LIVE DATA ENGINE — IN DEVELOPMENT</span>
        </div>
      </div>
    </div>
  );
}
