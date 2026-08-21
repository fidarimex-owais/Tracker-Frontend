import { Link } from 'react-router-dom';

import fidarLogo from '../assets/fidar-imex-logo.png';
import fruitHero from '../assets/fidar-fruit-hero.jpg';
import qrHero from '../assets/qr-operations-hero.png';


export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link to="/" aria-label="Fidar Imex home">
            <img
              src={fidarLogo}
              alt="Fidar Imex Private Limited"
              className="h-auto w-44 sm:w-52"
            />
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-bold text-slate-700 lg:flex">
        
            
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className="rounded-xl border border-slate-900 px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:border-orange-500 hover:text-orange-600 sm:px-5"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-600 sm:px-5"
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <section
        id="home"
        className="relative overflow-hidden border-b border-slate-200 bg-[#fffaf5]"
      >
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
          <div className="relative z-20">
            <p className="mb-5 inline-flex rounded-full border border-orange-200 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-orange-600">
              QR Operations Portal
            </p>

            <h1 className="max-w-2xl text-5xl font-black leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-6xl xl:text-7xl">
              Simple QR Management for{' '}
              <span className="text-orange-500">
                Fidar Imex
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Generate QR codes, retrieve stored records and access
              operational Recovery Sheets from one secure portal.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-14 items-center justify-center rounded-xl bg-orange-500 px-7 text-base font-extrabold text-white shadow-xl shadow-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-600"
              >
                Login to Portal
              </Link>

              <Link
                to="/signup"
                className="inline-flex min-h-14 items-center justify-center rounded-xl border border-slate-300 bg-white px-7 text-base font-extrabold text-slate-950 transition hover:border-orange-500 hover:text-orange-600"
              >
                Register
              </Link>
            </div>

            <p className="mt-8 max-w-lg text-sm leading-6 text-slate-500">
              Fidar Imex is a premium agro export company, with this
              portal supporting its QR-based operational workflow.
            </p>
          </div>

          <div className="relative min-h-[480px] lg:min-h-[550px]">
            <div className="absolute inset-0 overflow-hidden rounded-[2rem]">
              <img
                src={fruitHero}
                alt="Fresh produce"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf5] via-white/5 to-transparent" />
            </div>

            <div className="absolute left-[9%] top-[15%] w-[46%] max-w-[300px] -rotate-3 rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-300/40">
              <img
                src={qrHero}
                alt="QR code example"
                className="aspect-square w-full rounded-xl object-contain"
              />

              <img
                src={fidarLogo}
                alt=""
                className="mx-auto mt-4 w-40"
              />
            </div>

            <div className="absolute bottom-[10%] right-[4%] w-[42%] min-w-[210px] max-w-[260px] rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-xl backdrop-blur">
              <SmallStat
                title="Generate"
                text="Create QR-linked records"
              />
              <SmallStat
                title="Scan"
                text="Retrieve stored information"
              />
              <SmallStat
                title="Review"
                text="View Recovery Sheets"
                last
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}


function SmallStat({ title, text, last = false }) {
  return (
    <div
      className={`py-3 ${last ? '' : 'border-b border-slate-200'}`}
    >
      <p className="text-sm font-black text-slate-950">
        {title}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {text}
      </p>
    </div>
  );
}


function IconBase({ children }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}



