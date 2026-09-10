import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api/firebase';
import Logo from '../../components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      const role = userDoc.data()?.role;
      if (role === 'admin') {
        navigate('/admin/dashboard');
      } else {
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center sv-aurora py-5">
      {/* Slow-drifting shapes so the screen breathes instead of sitting still */}
      <span className="sv-orb sv-orb-1" aria-hidden="true"></span>
      <span className="sv-orb sv-orb-2" aria-hidden="true"></span>
      <span className="sv-orb sv-orb-3" aria-hidden="true"></span>
      <span className="sv-orb sv-orb-4" aria-hidden="true"></span>

      <div className="container">
        <div className="row justify-content-center">
          <div className="col-11 col-sm-9 col-md-6 col-lg-4 sv-stagger">

            {/* Logo */}
            <div className="text-center mb-4">
              <div
                className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 sv-breathe"
                style={{ width: 96, height: 96, backgroundColor: '#ffffff' }}
              >
                <Logo size={80} alt="Urdaneta City SPED Center" />
              </div>
              <h3
                className="fw-bold mb-1"
                style={{ color: '#00838A', fontFamily: 'Georgia, serif' }}
              >
                SignVibe
              </h3>
              <p className="text-muted small">Web Admin Portal</p>
            </div>

            {/* Card */}
            <div
              className="card border-0 rounded-4 sv-hover-tilt"
              style={{
                boxShadow: '0 18px 44px -18px rgba(0,131,138,.38), 0 6px 18px -10px rgba(16,24,40,.18)',
                backgroundColor: 'rgba(255,255,255,.92)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <div className="card-body p-4 p-sm-4">
                <h5 className="fw-semibold mb-1">Welcome back</h5>
                <p className="text-muted small mb-4">
                  Sign in to your account
                </p>

                {error && (
                  <div className="alert alert-danger py-2 small rounded-3">
                    <i className="bi bi-exclamation-circle me-2"></i>
                    {error}
                  </div>
                )}

                <form onSubmit={handleLogin}>
                  {/* Email */}
                  <div className="mb-3">
                    <label className="form-label small fw-medium">
                      Email Address
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-envelope text-muted"></i>
                      </span>
                      <input
                        type="email"
                        className="form-control border-start-0 ps-0"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-2">
                    <label className="form-label small fw-medium">
                      Password
                    </label>
                    <div className="input-group">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-lock text-muted"></i>
                      </span>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="form-control border-start-0 border-end-0 ps-0"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        className="input-group-text bg-light border-start-0"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} text-muted`}></i>
                      </button>
                    </div>
                  </div>

                  {/* ── Forgot Password link ── */}
                  <div className="text-end mb-4">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      style={{ color: '#00838A', fontSize: 13 }}
                      onClick={() => navigate('/forgot-password')}
                    >
                      <i className="bi bi-key me-1"></i>Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn w-100 fw-semibold text-white py-2 rounded-3 sv-cta"
                    style={{ backgroundColor: '#00838A' }}
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Signing in...
                      </>
                    ) : (
                      <>
                        <i className="bi bi-box-arrow-in-right me-2"></i>
                        Sign In
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>

            <p className="text-center text-muted small mt-3">
              Urdaneta City SPED Center · SignVibe v1.0.0
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
