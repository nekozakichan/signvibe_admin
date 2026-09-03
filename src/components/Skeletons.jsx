/**
 * Shimmering placeholders used while data is in flight.
 * They mirror the shape of the real content, so the page doesn't jump
 * when the data lands.
 */

export function StatGridSkeleton({ count = 4 }) {
  return (
    <div className="row g-3 mb-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="col-xl-3 col-md-6">
          <div className="card border-0 shadow-sm rounded-4 h-100">
            <div className="card-body d-flex align-items-center gap-3">
              <div className="sv-skel sv-skel-icon"></div>
              <div className="flex-grow-1">
                <div className="sv-skel sv-skel-line short"></div>
                <div className="sv-skel sv-skel-line mid mb-0"></div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 220 }) {
  return (
    <div className="card border-0 shadow-sm rounded-4">
      <div className="card-body p-4">
        <div className="sv-skel sv-skel-title"></div>
        <div className="sv-skel sv-skel-line mid"></div>
        <div className="sv-skel mt-4" style={{ height }}></div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 5 }) {
  return (
    <div className="py-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="d-flex align-items-center gap-3 py-3">
          <div className="sv-skel" style={{ width: 40, height: 40, borderRadius: '50%' }}></div>
          <div className="flex-grow-1">
            <div className="sv-skel sv-skel-line mid"></div>
            <div className="sv-skel sv-skel-line short mb-0"></div>
          </div>
        </div>
      ))}
    </div>
  );
}
