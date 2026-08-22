import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';
import { getPortalDashboard } from '../../services/adminService';

const EMPTY = {
  profile: {
    userName: '',
    email: '',
    brandName: '',
    isActive: true,
    role: 'supervisor',
  },
  summary: {
    recoverySheets: 0,
  },
  recentRecoverySheets: [],
};

export default function SupervisorDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getPortalDashboard('supervisor')
      .then((result) => {
        if (active) {
          setDashboard(result.data || EMPTY);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load Supervisor Dashboard'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const today = useMemo(
    () =>
      new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(new Date()),
    []
  );

  const profile = dashboard.profile;

  return (
    <section className="w-full min-w-0 space-y-3 pb-5 sm:space-y-5 sm:pb-8">
      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-orange-600 sm:text-sm">
            Supervisor Dashboard
          </p>

          <h2 className="mt-0.5 truncate text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 min-[360px]:text-2xl sm:mt-1 sm:text-3xl">
            Welcome, {user.userName || 'Supervisor'}
          </h2>

          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
            View your account information and generated Recovery Sheets.
          </p>
        </div>

        <div className="inline-flex h-9 w-fit shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 shadow-sm sm:h-auto sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-sm">
          <CalendarIcon />
          {today}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 sm:rounded-xl sm:px-4 sm:py-3 sm:text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 min-[390px]:gap-3 sm:grid-cols-3 sm:gap-4">
        <SummaryCard
          label="Assigned Brand"
          value={profile.brandName || 'Not Assigned'}
          loading={loading}
          textValue
          className="col-span-2 sm:col-span-1"
        />
        <SummaryCard
          label="Recovery Sheets"
          value={dashboard.summary.recoverySheets}
          loading={loading}
        />
        <SummaryCard
          label="Account Status"
          value={profile.isActive ? 'Active' : 'Inactive'}
          loading={loading}
          textValue
        />
      </div>

      <div className="grid min-w-0 gap-3 sm:gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <DashboardPanel title="Account Information">
          <div className="space-y-2 sm:space-y-3">
            <InfoRow
              label="Name"
              value={profile.userName || '—'}
              loading={loading}
            />
            <InfoRow
              label="Email"
              value={profile.email || '—'}
              loading={loading}
            />
            <InfoRow
              label="Role"
              value="Supervisor"
              loading={loading}
            />
            <InfoRow
              label="Brand"
              value={profile.brandName || 'Not Assigned'}
              loading={loading}
            />
            <InfoRow
              label="Status"
              value={profile.isActive ? 'Active' : 'Inactive'}
              loading={loading}
            />
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Recent Recovery Sheets"
          action={
            <Link
              to="/supervisor/recovery-sheets"
              className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 transition hover:bg-orange-50 sm:px-3 sm:text-xs"
            >
              View All
            </Link>
          }
        >
          <RecoveryTable
            rows={dashboard.recentRecoverySheets}
            loading={loading}
          />
        </DashboardPanel>
      </div>
    </section>
  );
}

function InfoRow({ label, value, loading }) {
  return (
    <div className="grid min-w-0 grid-cols-[78px_minmax(0,1fr)] items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2.5 min-[390px]:grid-cols-[90px_minmax(0,1fr)] sm:flex sm:justify-between sm:gap-4 sm:rounded-xl sm:px-4 sm:py-3">
      <span className="text-[10px] font-semibold text-slate-500 sm:text-sm">
        {label}
      </span>

      <strong className="min-w-0 break-all text-right text-[11px] text-slate-900 sm:max-w-[65%] sm:break-words sm:text-sm">
        {loading ? '—' : value}
      </strong>
    </div>
  );
}

function RecoveryTable({ rows, loading }) {
  if (loading) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        Loading...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        No Recovery Sheets have been generated yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {rows.map((sheet) => (
          <article
            key={sheet.id}
            className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800">
                  {sheet.packagingDate}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {sheet.vendorName}
                </p>
              </div>

              <span className="shrink-0 rounded-md bg-orange-50 px-2 py-1 text-[9px] font-extrabold text-orange-600">
                Line {sheet.lineNumber}
              </span>
            </div>

            <p className="mt-2 text-[10px] text-slate-500">
              Generated:{' '}
              <strong className="text-slate-700">
                {formatDateTime(sheet.generatedAt)}
              </strong>
            </p>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="rounded-l-lg px-3 py-2.5">Packaging Date</th>
              <th className="px-3 py-2.5">Vendor</th>
              <th className="px-3 py-2.5 text-center">Line</th>
              <th className="rounded-r-lg px-3 py-2.5">Generated</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {rows.map((sheet) => (
              <tr key={sheet.id}>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {sheet.packagingDate}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {sheet.vendorName}
                </td>
                <td className="px-3 py-3 text-center text-slate-600">
                  Line {sheet.lineNumber}
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {formatDateTime(sheet.generatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function DashboardPanel({ title, action, children }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm min-[390px]:p-3.5 sm:rounded-2xl sm:p-5">
      <div className="mb-3 flex min-w-0 items-start justify-between gap-2 sm:mb-4 sm:gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-[11px] font-extrabold uppercase tracking-[0.05em] text-slate-900 sm:text-sm sm:tracking-wide">
            {title}
          </h3>
          <div className="mt-1.5 h-0.5 w-7 bg-orange-500 sm:mt-2 sm:w-8" />
        </div>
        {action}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function SummaryCard({
  label,
  value,
  loading,
  textValue = false,
  className = '',
}) {
  return (
    <article className={`min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5 ${className}`}>
      <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.04em] text-slate-500 min-[360px]:text-[10px] sm:text-xs sm:tracking-wide">
        {label}
      </p>

      <p
        className={`mt-1 min-w-0 truncate font-extrabold leading-tight text-slate-900 ${
          textValue
            ? 'text-base min-[390px]:text-lg sm:text-xl'
            : 'text-[22px] min-[360px]:text-2xl sm:text-3xl'
        }`}
      >
        {loading
          ? '—'
          : textValue
            ? value
            : Number(value || 0).toLocaleString()}
      </p>
    </article>
  );
}

function formatDateTime(value) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

function CalendarIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5 text-orange-500 sm:h-4 sm:w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4M8 3v4M3 10h18" />
    </svg>
  );
}
