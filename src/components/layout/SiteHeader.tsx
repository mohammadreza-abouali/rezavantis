import Link from "next/link";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandMark } from "@/components/brand/BrandMark";

const navigation = [
  { label: "Overview", href: "#overview" },
  { label: "Forecast", href: "#forecast" },
  { label: "Atmosphere", href: "#atmosphere" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <Link href="/" className="brand-link" aria-label="REZAVANTIS home">
        <BrandMark />
      </Link>

      <nav className="desktop-nav" aria-label="Main navigation">
        {navigation.map((item) => (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="header-actions">
        <a className="header-status" href="#overview">
          <span className="status-dot" />
          SYSTEM ONLINE
        </a>
        <a className="header-link" href="#explore">
          Explore <ArrowUpRight size={15} />
        </a>
        <button className="mobile-menu" type="button" aria-label="Open menu">
          <Menu size={21} />
        </button>
      </div>
    </header>
  );
}
