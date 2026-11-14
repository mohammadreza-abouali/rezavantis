
export function RouteLoading({ label }: { label: string }) {
  return (
    <div className="route-loading" aria-busy="true">
      <div className="route-loading-heading">
        <span className="skeleton skeleton-kicker" />
        <span className="skeleton skeleton-title" />
        <span className="skeleton skeleton-description" />
      </div>

      <div className="route-loading-grid">
        <div className="route-loading-main">
          <div className="skeleton skeleton-panel-large" />
          <div className="route-loading-stats">
            <span className="skeleton skeleton-panel" />
            <span className="skeleton skeleton-panel" />
            <span className="skeleton skeleton-panel" />
          </div>
        </div>
        <div className="route-loading-side">
          <span className="skeleton skeleton-panel-tall" />
          <span className="skeleton skeleton-panel" />
        </div>
      </div>

      <div className="route-loading-status">
        <span className="status-pulse" />
        <span>{label}</span>
      </div>
    </div>
  );
}
