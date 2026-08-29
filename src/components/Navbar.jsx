export default function Navbar({ title }) {
  return (
    <div
      className="d-flex align-items-center px-4 bg-white border-bottom"
      style={{ height: '64px' }}
    >
      <h5 className="mb-0 fw-semibold text-dark">{title}</h5>
    </div>
  );
}
