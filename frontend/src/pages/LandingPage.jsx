import { Link } from 'react-router-dom';
import fidarLogo from '../assets/fidar-imex-logo.png';
import fruitHero from '../assets/fidar-fruit-hero.jpg';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#fbfaf7] text-slate-900 lg:h-[100dvh] lg:min-h-0 lg:overflow-hidden">
      <section className="mx-auto grid min-h-screen max-w-[1800px] lg:h-full lg:min-h-0 lg:grid-cols-[48%_52%]">
        <div className="relative z-10 flex items-center px-6 py-10 sm:px-10 lg:h-full lg:min-h-0 lg:px-[clamp(2.5rem,5vw,6rem)] lg:py-[clamp(1.25rem,3vh,2.75rem)]">
          <div className="w-full max-w-[680px]">
            <img
              src={fidarLogo}
              alt="Fidar Imex"
              className="mb-8 h-auto w-[300px] max-w-full object-contain object-left sm:w-[360px] lg:mb-[clamp(3.25rem,3vh,2.5rem)] lg:w-[clamp(300px,27vw,440px)]"
            />

            <h1 className="max-w-[600px] text-[clamp(2.8rem,9vw, 2rem)] font-bold leading-[1.03] tracking-[-0.045em] text-[#1f2529] sm:text-[clamp(3.2rem,7vw,3rem)] lg:text-[clamp(3.2rem,4vw,4.3rem)]">
              Import and Export of All Dry and Fresh Fruits

              
            </h1>

            <div className="mt-6 h-1 w-20 rounded-full bg-[#ff6a00] lg:mt-[clamp(2.5rem,2.5vh,1.75rem)]" />

            <p className="mt-6 max-w-[500px] text-xl font-medium leading-[1.4] text-[#555b61] sm:text-2xl lg:mt-[clamp(1rem,2.5vh,1.75rem)] lg:text-[clamp(1.2rem,1.55vw,1.75rem)]">
              {/* Global sourcing and distribution of premium quality dry and fresh fruits, ensuring freshness, taste, and nutritional value for our customers worldwide. */}
            </p>
            <br />
            <div className="mt-9 flex flex-col gap-4 sm:flex-row lg:mt-[clamp(1.5rem,4vh,2.75rem)] lg:flex-nowrap">
              <Link
                to="/login"
                className="group inline-flex min-h-[68px] w-full items-center justify-center gap-3 rounded-xl bg-[#ff6a00] px-7 text-xl font-bold text-white shadow-[0_12px_28px_rgba(255,106,0,0.22)] transition hover:-translate-y-0.5 hover:bg-[#ef6100] focus:outline-none focus:ring-4 focus:ring-orange-200 sm:w-auto sm:min-w-[210px] lg:min-h-[68px] lg:min-w-[220px]"
              >
                <SignInIcon />
                <span>Sign In</span>
              </Link>

              <Link
                to="/signup"
                className="group inline-flex min-h-[68px] w-full items-center justify-center gap-3 rounded-xl border-2 border-[#ff6a00] bg-white/90 px-7 text-xl font-bold text-[#ff6a00] transition hover:-translate-y-0.5 hover:bg-orange-50 focus:outline-none focus:ring-4 focus:ring-orange-100 sm:w-auto sm:min-w-[210px] lg:min-h-[68px] lg:min-w-[220px]"
              >
                <SignUpIcon />
                <span>Sign Up</span>
              </Link>
            </div>
          </div>
        </div>

        <div className="relative min-h-[360px] overflow-hidden sm:min-h-[430px] lg:h-full lg:min-h-0">
          <div className="absolute inset-y-0 -left-24 z-10 hidden w-44 bg-gradient-to-r from-[#fbfaf7] via-[#fbfaf7]/85 to-transparent lg:block" />

          <img
            src={fruitHero}
            alt="Fresh fruits"
            className="h-full min-h-[360px] w-full object-cover object-center sm:min-h-[430px] lg:min-h-0"
          />

          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#fbfaf7]/45 via-transparent to-transparent lg:from-[#fbfaf7]/18" />
        </div>
      </section>
    </main>
  );
}

function SignInIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 fill-none stroke-current"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 3h4a3 3 0 013 3v12a3 3 0 01-3 3h-4" />
    </svg>
  );
}

function SignUpIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-7 w-7 fill-none stroke-current"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 20a6 6 0 00-12 0" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8v6" />
      <path d="M16 11h6" />
    </svg>
  );
}
