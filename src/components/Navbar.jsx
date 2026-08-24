export default function Navbar({ title }) {
  return (
    <div
      className="d-flex align-items-center px-4 bg-white border-bottom"
      style={{ height: '64px' }}
    >
      <h5 className="mb-0 fw-semibold text-dark">{title}</h5>
      <div className="ms-auto d-flex align-items-center gap-3">
        <span
          className="badge rounded-pill"
          style={{ backgroundColor: '#00838A' }}
        >
          <i
            className="bi bi-circle-fill me-1"
            style={{ fontSize: '8px' }}
          ></i>
          Online
        </span>
      </div>
    </div>
  );
}