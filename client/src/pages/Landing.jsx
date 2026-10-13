import { Link, useNavigate } from 'react-router';

// Small inline stroke icons, so the page needs no image files
const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);
const Check = ({ size = 18, color = 'currentColor', width = 3 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export default function Landing() {
  const navigate = useNavigate();

  // Students have to log in before they can open an exam, so the code box leads there for now
  const handleExamCode = (e) => {
    e.preventDefault();
    navigate('/login');
  };

  return (
    <div className="landing">
      <header className="landing-header">
        <nav className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-logo">
            <span className="landing-logo-mark"><Check color="#2D3748" /></span>
            Online Examination
          </Link>

          <div className="landing-links">
            <button type="button">How it works <Chevron /></button>
            <a href="#">Pricing</a>
            <button type="button">Customers <Chevron /></button>
            <button type="button">Resources <Chevron /></button>
          </div>

          <div className="landing-actions">
            <button type="button" className="landing-lang" aria-label="Language: English">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
              EN
            </button>
            <form className="landing-code" onSubmit={handleExamCode}>
              <input aria-label="Exam code" placeholder="Enter exam code" />
              <button type="submit" aria-label="Join exam">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              </button>
            </form>
            <Link to="/register" className="landing-signup">Sign Up</Link>
            <Link to="/login" className="landing-login">Teacher Login</Link>
          </div>
        </nav>
      </header>

      <svg className="landing-wave" viewBox="0 0 1440 170" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0,0 H1440 V168 C1120,190 640,64 0,74 Z" fill="#F9C07A" />
        <path d="M0,0 H1440 V118 C1120,140 640,20 0,28 Z" fill="#2D3748" />
      </svg>

      <main className="landing-hero">
        <section className="landing-copy">
          <div>
            <p className="landing-kicker">Simply Powerful</p>
            <h1 className="landing-title">Online Exams</h1>
          </div>
          <p className="landing-lead">
            Easy to set up and simple to use. Create secure exams, monitor students in real time, and get results instantly.
          </p>
          <div className="landing-cta">
            <Link to="/register" className="pill pill-dark">Start Free Trial</Link>
            <a href="#" className="pill pill-outline">Book a Demo</a>
          </div>
          <p className="landing-note">30-day free trial. No credit card required</p>
          <div className="landing-trust">
            <span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#E8A13D" stroke="#C9832A" strokeWidth="1.2" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z" /></svg>
              <strong>4.6</strong> rating
            </span>
            <span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F2937" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
              Secure &amp; Private
            </span>
          </div>
        </section>

        {/* Product illustration, built from plain divs */}
        <section className="landing-art" aria-hidden="true">
          <div className="mock mock-teacher">
            <div className="mock-tabs">
              <div className="mock-dots"><i /><i /><i /></div>
              <div className="mock-tab"><span className="mock-tab-icon" /><span className="bar" style={{ width: 70 }} /></div>
            </div>
            <div className="mock-address"><span className="mock-reload" /><div><span className="bar" style={{ width: '42%' }} /></div></div>
            <div className="mock-body">
              <div className="mock-sidebar">
                <span className="bar dark" style={{ width: '80%' }} />
                {[90, 70, 85, 60, 75].map(w => <span key={w} className="bar" style={{ width: `${w}%` }} />)}
              </div>
              <div className="mock-main">
                <div className="mock-subtabs"><b>Monitoring</b><span>Results</span><span>Settings</span></div>
                <div className="mock-pills">
                  <span className="mock-pill live"><i />Live</span>
                  <span className="mock-pill warn"><i />2 need attention</span>
                </div>
                <div className="mock-scores">
                  <div className="mock-score"><span className="bar" style={{ width: '60%' }} /><b>17/21</b><span className="meter"><span style={{ width: '81%', background: '#2F9E62' }} /></span></div>
                  <div className="mock-score"><span className="bar" style={{ width: '50%' }} /><b>4/21</b><span className="meter"><span style={{ width: '19%', background: '#3B76D9' }} /></span></div>
                </div>
                <span className="bar light" style={{ width: '92%' }} />
                <span className="bar light" style={{ width: '78%' }} />
              </div>
            </div>
          </div>

          <div className="mock mock-student">
            <div className="mock-rail"><span className="mock-rail-logo" /><i /><i /><i /></div>
            <div className="mock-paper">
              <div className="mock-paper-head"><b>Question 3</b><span>12:40 left</span></div>
              <div className="mock-q"><b>a)</b><span className="bar" /></div>
              <div className="mock-options">
                <div><span className="box on"><Check size={9} color="#fff" width={4} /></span><span className="bar soft" style={{ width: '55%' }} /></div>
                <div><span className="box" /><span className="bar soft" style={{ width: '45%' }} /></div>
                <div><span className="box on"><Check size={9} color="#fff" width={4} /></span><span className="bar soft" style={{ width: '62%' }} /></div>
              </div>
              <div className="mock-q"><b>b)</b><span className="bar" /></div>
              <div className="mock-input">Photosynthesis<span className="caret" /></div>
              <span className="mock-next">Next</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
