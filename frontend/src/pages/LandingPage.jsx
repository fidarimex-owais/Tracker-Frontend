// frontend/src/pages/LandingPage.jsx

import { Link } from 'react-router-dom';

import fidarLogo from '../assets/fidar-imex-logo.png';
import fruitHero from '../assets/fidar-fruit-hero.jpg';
import qrHero from '../assets/qr-operations-hero.png';
import ThemeToggle from '../components/ThemeToggle';

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-white text-slate-950">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:min-h-20 sm:gap-4 sm:px-8">
          <Link to="/" className="min-w-0 shrink" aria-label="Fidar Imex home">
            <img
              src={fidarLogo}
              alt="Fidar Imex Private Limited"
              className="h-auto w-28 sm:w-44 lg:w-52"
            />
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle compact />

            <Link
              to="/login"
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-900 px-3 text-xs font-extrabold text-slate-950 transition hover:border-orange-500 hover:text-orange-600 sm:rounded-xl sm:px-5 sm:text-sm"
            >
              Login
            </Link>

            <Link
              to="/signup"
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-orange-500 px-3 text-xs font-extrabold text-white shadow-lg shadow-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-600 sm:rounded-xl sm:px-5 sm:text-sm"
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
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-8 sm:px-8 sm:py-12 lg:min-h-[620px] lg:grid-cols-[0.92fr_1.08fr] lg:gap-10 lg:py-14">
          <div className="relative z-20">
            <p className="mb-4 inline-flex rounded-full border border-orange-200 bg-white px-3 py-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-orange-600 sm:mb-5 sm:px-4 sm:text-xs sm:tracking-[0.18em]">
              QR Operations Portal
            </p>

            <h1 className="max-w-2xl text-3xl font-black leading-[1.08] tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl xl:text-7xl">
              Simple QR Management for{' '}
              <span className="text-orange-500">Fidar Imex</span>
            </h1>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:mt-6 sm:text-lg sm:leading-8">
              Generate QR codes, retrieve stored records and access operational
              Recovery Sheets from one secure portal.
            </p>

            <div className="mt-6 grid gap-3 sm:mt-8 sm:flex sm:flex-row">
              <Link
                to="/login"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-6 text-sm font-extrabold text-white shadow-xl shadow-orange-100 transition hover:-translate-y-0.5 hover:bg-orange-600 sm:min-h-14 sm:px-7 sm:text-base"
              >
                Login to Portal
              </Link>

              <Link
                to="/signup"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-6 text-sm font-extrabold text-slate-950 transition hover:border-orange-500 hover:text-orange-600 sm:min-h-14 sm:px-7 sm:text-base"
              >
                Register
              </Link>
            </div>

            <p className="mt-6 max-w-lg text-xs leading-5 text-slate-500 sm:mt-8 sm:text-sm sm:leading-6">
              Fidar Imex is a premium agro export company, with this portal
              supporting its QR-based operational workflow.
            </p>
          </div>

          <div className="relative min-h-[330px] sm:min-h-[440px] lg:min-h-[550px]">
            <div className="absolute inset-0 overflow-hidden rounded-2xl sm:rounded-[2rem]">
              <img
                src={fruitHero}
                alt="Fresh produce"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf5]/80 via-white/5 to-transparent lg:from-[#fffaf5]" />
            </div>

            <div className="absolute left-[5%] top-[10%] w-[48%] max-w-[280px] -rotate-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300/40 sm:left-[9%] sm:top-[15%] sm:p-5 sm:-rotate-3 sm:rounded-[1.75rem]">
              <img
                src={qrHero}
                alt="QR code example"
                className="aspect-square w-full rounded-lg object-contain sm:rounded-xl"
              />

              <img
                src={fidarLogo}
                alt=""
                className="mx-auto mt-2 w-24 sm:mt-4 sm:w-40"
              />
            </div>

            <div className="absolute bottom-[7%] right-[3%] w-[45%] max-w-[245px] rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur sm:bottom-[10%] sm:right-[4%] sm:rounded-2xl sm:p-5">
              <SmallStat title="Generate" text="Create QR-linked records" />
              <SmallStat title="Scan" text="Retrieve stored information" />
              <SmallStat title="Review" text="View Recovery Sheets" last />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function SmallStat({ title, text, last = false }) {
  return (
    <div className={`py-2 sm:py-3 ${last ? '' : 'border-b border-slate-200'}`}>
      <p className="text-xs font-black text-slate-950 sm:text-sm">{title}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-slate-500 sm:mt-1 sm:text-xs">
        {text}
      </p>
    </div>
  );
}
