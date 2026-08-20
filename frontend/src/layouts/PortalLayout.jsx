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
    {
      to: '/admin',
      label: 'Dashboard',
      end: true,
    },
    {
      to: '/admin/create-id',
      label: 'Create ID',
    },
    {
      to: '/admin/users',
      label: 'User',
    },
    {
      to: '/admin/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    {
      to: '/admin/qr-generator',
      label: 'Generate QR',
    },
    {
      to: '/admin/recovery-sheets',
      label: 'Recovery Sheet',
    },
  ],

  subadmin: [
    {
      to: '/sub-admin',
      label: 'Dashboard',
      end: true,
    },
    {
      to: '/sub-admin/create-id',
      label: 'Create ID',
    },
    {
      to: '/sub-admin/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    {
      to: '/sub-admin/users',
      label: 'User',
    },
    {
      to: '/sub-admin/qr-generator',
      label: 'Generate QR',
    },
    {
      to: '/sub-admin/recovery-sheets',
      label: 'Recovery Sheet',
    },
  ],

  vendor: [
    {
      to: '/vendor',
      label: 'Dashboard',
      end: true,
    },
    {
      to: '/vendor/create-id',
      label: 'Create ID',
    },
    {
      to: '/vendor/signup-requests',
      label: 'Signup Request',
      showPendingCount: true,
    },
    {
      to: '/vendor/users',
      label: 'User',
    },
    {
      to: '/vendor/recovery-sheets',
      label: 'Recovery Sheet',
    },
  ],

  supervisor: [
    {
      to: '/supervisor',
      label: 'Dashboard',
      end: true,
    },
    {
      to: '/supervisor/recovery-sheets',
      label: 'Recovery Sheet',
    },
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

  const [
    pendingSignupCount,
    setPendingSignupCount,
  ] = useState(0);

  useEffect(() => {
    if (!canReviewSignupRequests(user.role)) {
      return undefined;
    }

    let active = true;

    const refreshCount = async () => {
      try {
        const result = await getSignupRequestCount(
          user.role
        );

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

    const intervalId = window.setInterval(
      refreshCount,
      5000
    );

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

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
              QR Operations
            </p>

            <h1 className="text-lg font-bold text-slate-900">
              {portalName(user.role)} Portal
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-slate-800">
                {user.email}
              </p>

              <p className="text-xs text-slate-500">
                {portalName(user.role)}
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:grid-cols-[210px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="flex gap-2 overflow-x-auto md:flex-col">
            {(links[user.role] || []).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `flex items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${
                    isActive
                      ? 'bg-orange-500 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`
                }
              >
                <span>{link.label}</span>

                {link.showPendingCount &&
                  pendingSignupCount > 0 && (
                    <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white">
                      {pendingSignupCount}
                    </span>
                  )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
