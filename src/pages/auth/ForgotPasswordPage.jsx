import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { db } from '../../api/firebase';
import Logo from '../../components/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Check if this email belongs to a teacher
      const usersQ = query(
        collection(db, 'users'),
        where('email', '==', email.trim().toLowerCase()),
        where('role', '==', 'teacher')
      );
      const userSnap = await getDocs(usersQ);

      if (userSnap.empty) {
        setError('No teacher account found with this email address.');
        setLoading(false);
        return;
      }

      const teacherDoc = userSnap.docs[0];
      const { full_name } = teacherDoc.data();

      // Check if a pending request already exists for this email
      const existingQ = query(
        collection(db, 'password_reset_requests'),
        where('email', '==', email.trim().toLowerCase()),
        where('status', '==', 'pending')
      );
      const existingSnap = await getDocs(existingQ);

      if (!existingSnap.empty) {
        setError('You already have a pending reset request. Please wait for the admin to process it.');
        setLoading(false);
        return;
      }

      // Save the reset request to Firestore
      await addDoc(collection(db, 'password_reset_requests'), {
        teacher_uid: teacherDoc.id,
        full_name,
        email: email.trim().toLowerCase(),
        status: 'pending', // pending | sent
        requested_at: serverTimestamp(),
      });

      setSubmitted(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center sv-aurora py-5">
      <span className="sv-orb sv-orb-1" aria-hidden="true"></span>
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
              <h3 className="fw-bold mb-1" style={{ color: '#00838A', fontFamily: 'Georgia, serif' }}>
                SignVibe
              </h3>
              <p className="text-muted small">Web Admin Portal</p>
            </div>

            <div className="card border-0 shadow-sm rounded-4">
              <div className="card-body p-4">

                {!submitted ? (
                  <>
                    {/* Header */}
                    <div className="text-center mb-4">
                      <div
                        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                        style={{ width: 56, height: 56, backgroundColor: '#e6f9f9' }}
                      >
                        <i className="bi bi-key-fill fs-4" style={{ color: '#00838A' }}></i>
                      </div>
                      <h5 className="fw-bold mb-1">Forgot Password?</h5>
                      <p className="text-muted small mb-0">
                        Enter your email address and the admin will send you a password reset link.
                      </p>
                    </div>

                    {error && (
                      <div className="alert alert-danger py-2 small rounded-3 mb-3">
                        <i className="bi bi-exclamation-circle me-2"></i>{error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit}>
                      <div className="mb-4">
                        <label className="form-label small fw-medium">Your Email Address</label>
                        <div className="input-group">
                          <span className="input-group-text bg-light border-end-0">
                            <i className="bi bi-envelope text-muted"></i>
                          </span>
                          <input
                            type="email"
                            className="form-control border-start-0 ps-0"
                            placeholder="Enter your teacher email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="btn w-100 fw-semibold text-white py-2 rounded-3 mb-3"
                        style={{ backgroundColor: '#00838A' }}
                        disabled={loading}
                      >
                        {loading ? (
                          <><span className="spinner-border spinner-border-sm me-2"></span>Submitting...</>
                        ) : (
                          <><i className="bi bi-send-fill me-2"></i>Submit Reset Request</>
                        )}
                      </button>

                      <div className="text-center">
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 text-decoration-none text-muted"
                          onClick={() => navigate('/')}
                        >
                          <i className="bi bi-arrow-left me-1"></i>Back to Login
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  /* ── Success state ── */
                  <div className="text-center py-3">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
                      style={{ width: 64, height: 64, backgroundColor: '#e6f9f9' }}
                    >
                      <i className="bi bi-check-circle-fill fs-2" style={{ color: '#00838A' }}></i>
                    </div>
                    <h5 className="fw-bold mb-2" style={{ color: '#00838A' }}>Request Submitted!</h5>
                    <p className="text-muted small mb-4">
                      Your password reset request has been sent to the admin.
                      Please wait — the admin will send a reset link to <strong>{email}</strong> shortly.
                    </p>
                    <button
                      className="btn w-100 fw-semibold text-white py-2 rounded-3"
                      style={{ backgroundColor: '#00838A' }}
                      onClick={() => navigate('/')}
                    >
                      <i className="bi bi-box-arrow-in-right me-2"></i>Back to Login
                    </button>
                  </div>
                )}
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
