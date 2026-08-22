import { useEffect, useState } from 'react';
import {
  NavLink,
  Outlet,
  useNavigate,
} from 'react-router-dom';

import { useAuth } from '../auth/useAuth';

import {
  SIGNUP_REQUESTS_CHANGED_EVENT,
  getSignupRequestCount,
} from '../services/adminService';

const links = {
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/create-id', label: 'Create ID' },
    { to: '/admin/users', label: 'User' },
    {
      to: '/admin/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    { to: '/admin/qr-generator', label: 'Generate QR' },
    { to: '/admin/qr-scanner', label: 'QR Scanner' },
    { to: '/admin/recovery-sheets', label: 'Recovery Sheet' },
  ],
  subadmin: [
    { to: '/sub-admin', label: 'Dashboard', end: true },
    { to: '/sub-admin/create-id', label: 'Create ID' },
    {
      to: '/sub-admin/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    { to: '/sub-admin/users', label: 'User' },
    { to: '/sub-admin/qr-generator', label: 'Generate QR' },
    { to: '/sub-admin/recovery-sheets', label: 'Recovery Sheet' },
  ],
  vendor: [
    { to: '/vendor', label: 'Dashboard', end: true },
    { to: '/vendor/create-id', label: 'Create ID' },
    {
      to: '/vendor/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    { to: '/vendor/users', label: 'User' },
    { to: '/vendor/recovery-sheets', label: 'Recovery Sheet' },
  ],
  supervisor: [
    { to: '/supervisor', label: 'Dashboard', end: true },
    { to: '/supervisor/recovery-sheets', label: 'Recovery Sheet' },
  ],
};

const portalName = (role) =>
  role === 'subadmin'
    ? 'Sub-Admin'
    : role.charAt(0).toUpperCase() + role.slice(1);

const canReviewSignupRequests = (role) =>
  ['admin', 'subadmin', 'vendor'].includes(role);

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingSignupCount, setPendingSignupCount] = useState(0);

  useEffect(() => {
    if (!canReviewSignupRequests(user.role)) {
      return undefined;
    }

    let active = true;

    const refreshCount = async () => {
      try {
        const result = await getSignupRequestCount(user.role);

        if (active) {
          setPendingSignupCount(result.count || 0);
        }
      } catch {
        if (active) {
          setPendingSignupCount(0);
        }
      }
    };

    refreshCount();

    const intervalId = window.setInterval(refreshCount, 5000);

    window.addEventListener(
      SIGNUP_REQUESTS_CHANGED_EVENT,
      refreshCount
    );

    return () => {
      active = false;
      window.clearInterval(intervalId);

      window.removeEventListener(
        SIGNUP_REQUESTS_CHANGED_EVENT,
        refreshCount
      );
    };
  }, [user.role]);

  const handleLogout = async () => {
    await logout();

    navigate('/login', {
      replace: true,
    });
  };

  const renderNavLinks = (onNavigate) =>
    (links[user.role] || []).map((link) => (
      <NavLink
        key={link.to}
        to={link.to}
        end={link.end}
        onClick={onNavigate}
        className={({ isActive }) =>
          `flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-semibold transition sm:min-h-11 sm:py-2.5 sm:text-sm ${
            isActive
              ? 'bg-orange-500 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`
        }
      >
        <span className="truncate">{link.label}</span>

        {link.showPendingCount && pendingSignupCount > 0 && (
          <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white sm:min-w-6 sm:text-xs">
            {pendingSignupCount}
          </span>
        )}
      </NavLink>
    ));

  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 w-full max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:min-h-16 sm:gap-3 sm:px-5 sm:py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[8px] font-extrabold uppercase tracking-[0.14em] text-orange-600 min-[360px]:text-[9px] sm:text-xs sm:tracking-[0.18em]">
              QR Operations
            </p>

            <h1 className="truncate text-sm font-extrabold leading-tight text-slate-900 min-[360px]:text-[15px] sm:text-lg">
              {portalName(user.role)} Portal
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
            <div className="hidden max-w-64 text-right md:block">
              <p className="truncate text-sm font-medium text-slate-800">
                {user.email}
              </p>

              <p className="text-xs text-slate-500">
                {portalName(user.role)}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMobileNavOpen((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100 active:scale-95 md:hidden"
              aria-label="Toggle portal navigation"
              aria-expanded={mobileNavOpen}
            >
              <span className="text-lg leading-none">
                {mobileNavOpen ? '×' : '☰'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100 active:scale-95 min-[360px]:px-3 min-[360px]:text-xs sm:h-10 sm:text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <div className="border-t border-slate-200 bg-white px-3 py-2.5 shadow-lg md:hidden">
            <nav className="mx-auto grid max-w-7xl grid-cols-2 gap-1.5 max-[340px]:grid-cols-1 sm:grid-cols-3">
              {renderNavLinks(() => setMobileNavOpen(false))}
            </nav>
          </div>
        )}
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-3 px-2.5 py-3 min-[360px]:px-3 sm:gap-4 sm:px-5 sm:py-6 md:grid-cols-[190px_minmax(0,1fr)] md:gap-5 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-6">
        <aside className="hidden h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block">
          <nav className="flex flex-col gap-2">
            {renderNavLinks()}
          </nav>
        </aside>

        <main className="min-w-0 w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
