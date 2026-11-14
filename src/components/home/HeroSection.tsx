import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { CitySearch } from "@/components/search/CitySearch";
import { AtmosphereVisual } from "@/components/home/AtmosphereVisual";

export function HeroSection() {
  return (
    <section className="hero-section" id="overview">
      <div className="hero-copy">
        <div className="eyebrow">
          <span className="eyebrow-line" />A NEW PERSPECTIVE ON WEATHER
        </div>

        <h1>
          Beyond Weather.
          <br />
          <span>Into Atmosphere.</span>
        </h1>

        <p className="hero-description">
          Explore the invisible forces shaping our world. Understand atmospheric
          conditions through a new lens of science, intelligence, and design.
        </p>

        <CitySearch />

        <div className="hero-footnote">
          <ShieldCheck size={15} />
          <span>DATA-DRIVEN. SCIENCE-LED. GLOBALLY CONNECTED.</span>
        </div>
      </div>

      <div className="hero-visual-column">
        <AtmosphereVisual />
        <div className="visual-index">
          <span>01 / 04</span>
          <span>ATMOSPHERIC INTELLIGENCE</span>
        </div>
      </div>

      <a className="scroll-indicator" href="#atmosphere">
        <span>SCROLL TO EXPLORE</span>
        <ArrowDown size={15} />
      </a>

      <a className="hero-corner-link" href="#atmosphere">
        Discover the platform <ArrowUpRight size={15} />
      </a>
    </section>
  );
}
