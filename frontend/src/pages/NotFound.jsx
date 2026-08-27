// frontend/src/pages/NotFound.jsx

import { Link, useNavigate } from 'react-router-dom';

import { roleHome } from '../auth/roleHome';
import { useAuth } from '../auth/useAuth';
import fidarLogo from '../assets/fidar-imex-logo.png';
import ThemeToggle from '../components/ThemeToggle';

export default function NotFound() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const homePath = user ? roleHome(user.role) : '/';
  const homeLabel = user ? 'Go to Dashboard' : 'Go to Home';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fffaf5] px-4 py-8 text-slate-950 sm:px-6 sm:py-10">
      <section className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl sm:p-8 lg:p-10">
        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle compact />
        </div>

        <header className="flex justify-center pr-12 sm:pr-0">
          <Link
            to={homePath}
            aria-label="Fidar Imex home"
          >
            <img
              src={fidarLogo}
              alt="Fidar Imex Private Limited"
              className="h-auto w-36 sm:w-44"
            />
          </Link>
        </header>

        <div className="mt-8 text-center sm:mt-10">
          <div className="inline-flex items-center gap-3 rounded-full border border-orange-200 bg-orange-50 px-5 py-2.5">
            <span className="text-3xl font-black leading-none tracking-tight text-orange-600 sm:text-4xl">
              404
            </span>
            <span className="border-l border-orange-200 pl-3 text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600 sm:text-sm">
              Page Not Found
            </span>
          </div>

          <h1 className="mx-auto mt-6 max-w-2xl text-3xl font-black tracking-[-0.03em] text-slate-950 sm:text-4xl">
            We couldn&apos;t find this page.
          </h1>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            The page may have been moved, deleted, or the address may be incorrect.
            Use one of the options below to continue.
          </p>
        </div>

        <div className="mx-auto mt-8 grid max-w-xl gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-extrabold text-slate-800 transition hover:border-orange-400 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            Go Back
          </button>

          <Link
            to={homePath}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-orange-500 px-5 text-sm font-extrabold text-white shadow-lg shadow-orange-100 transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200"
          >
            {homeLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
