import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../../auth/useAuth';
import { getPortalDashboard } from '../../services/adminService';

const EMPTY = {
  brandName: '',
  summary: {
    totalSupervisors: 0,
    activeSupervisors: 0,
    pendingSignupRequests: 0,
    recoverySheets: 0,
  },
  supervisorSummary: {
    total: 0,
    active: 0,
    inactive: 0,
  },
  signupTrend: [],
  recentSignupRequests: [],
  recentSupervisors: [],
};

export default function VendorDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    getPortalDashboard('vendor')
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
              'Unable to load Vendor Dashboard'
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

  const cards = [
    {
      label: 'Total Supervisors',
      value: dashboard.summary.totalSupervisors,
    },
    {
      label: 'Active Supervisors',
      value: dashboard.summary.activeSupervisors,
    },
    {
      label: 'Signup Requests',
      value: dashboard.summary.pendingSignupRequests,
    },
    {
      label: 'Recovery Sheets',
      value: dashboard.summary.recoverySheets,
    },
  ];

  return (
    <section className="w-full min-w-0 space-y-3 pb-5 sm:space-y-5 sm:pb-8">
      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-orange-600 sm:text-sm">
            Vendor Dashboard
          </p>

          <h2 className="mt-0.5 truncate text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 min-[360px]:text-2xl sm:mt-1 sm:text-3xl">
            Welcome, {user.userName || 'Vendor'}
          </h2>

          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
            Manage Supervisors and signup requests for your assigned brand.
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

      <div className="grid grid-cols-2 gap-2 min-[390px]:gap-3 sm:gap-4 xl:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid min-w-0 gap-3 sm:gap-5 xl:grid-cols-[0.8fr_0.8fr_1.3fr]">
        <DashboardPanel title="Assigned Brand">
          <div className="flex min-h-28 flex-col items-center justify-center rounded-lg bg-orange-50 px-3 py-4 text-center sm:min-h-44 sm:rounded-xl sm:px-5">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white sm:h-14 sm:w-14">
              <BrandIcon />
            </span>
            <p className="mt-2 text-[9px] font-bold uppercase tracking-wide text-slate-500 sm:mt-4 sm:text-xs">
              Your Brand
            </p>
            <p className="mt-0.5 max-w-full truncate text-lg font-extrabold text-slate-900 sm:mt-1 sm:text-2xl">
              {loading ? '—' : dashboard.brandName || 'Not Assigned'}
            </p>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Supervisor Status">
          <SupervisorStatus
            data={dashboard.supervisorSummary}
            loading={loading}
          />
        </DashboardPanel>

        <DashboardPanel title="Signup Request Trend">
          <SignupTrend
            points={dashboard.signupTrend}
            loading={loading}
          />
        </DashboardPanel>
      </div>

      <div className="grid min-w-0 gap-3 sm:gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <DashboardPanel
          title="Recent Supervisor Requests"
          action={
            <Link
              to="/vendor/signup-requests"
              className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 transition hover:bg-orange-50 sm:px-3 sm:text-xs"
            >
              View All
            </Link>
          }
        >
          <RecentRequests
            requests={dashboard.recentSignupRequests}
            loading={loading}
            emptyMessage="No recent Supervisor signup requests."
          />
        </DashboardPanel>

        <DashboardPanel
          title="Recent Supervisors"
          action={
            <Link
              to="/vendor/users"
              className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 transition hover:bg-orange-50 sm:px-3 sm:text-xs"
            >
              View Users
            </Link>
          }
        >
          <RecentSupervisors
            users={dashboard.recentSupervisors}
            loading={loading}
          />
        </DashboardPanel>
      </div>
    </section>
  );
}

function SupervisorStatus({ data, loading }) {
  const safeTotal = Math.max(data.total, 1);
  const activeDegrees = (data.active / safeTotal) * 360;

  const style = {
    background:
      loading || data.total === 0
        ? '#f1f5f9'
        : `conic-gradient(#f97316 0deg ${activeDegrees}deg, #cbd5e1 ${activeDegrees}deg 360deg)`,
  };

  return (
    <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] items-center gap-4 min-[390px]:grid-cols-[116px_minmax(0,1fr)] sm:flex sm:flex-row sm:gap-5 xl:flex-col 2xl:flex-row">
      <div
        className="relative h-[104px] w-[104px] shrink-0 rounded-full min-[390px]:h-[116px] min-[390px]:w-[116px] sm:h-36 sm:w-36"
        style={style}
      >
        <div className="absolute inset-[21px] flex flex-col items-center justify-center rounded-full bg-white min-[390px]:inset-6 sm:inset-7">
          <strong className="text-xl font-extrabold text-slate-900 sm:text-2xl">
            {loading ? '—' : data.total}
          </strong>
          <span className="text-[10px] text-slate-500 sm:text-xs">
            Total
          </span>
        </div>
      </div>

      <div className="min-w-0 space-y-2 sm:w-full sm:space-y-3">
        <StatusRow
          label="Active"
          value={data.active}
          dot="bg-orange-500"
          loading={loading}
        />
        <StatusRow
          label="Inactive"
          value={data.inactive}
          dot="bg-slate-300"
          loading={loading}
        />
      </div>
    </div>
  );
}

function StatusRow({ label, value, dot, loading }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 text-[11px] sm:text-sm">
      <span className="flex min-w-0 items-center gap-1.5 text-slate-600 sm:gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5 ${dot}`} />
        <span className="truncate">{label}</span>
      </span>
      <strong className="shrink-0 text-slate-900">
        {loading ? '—' : value}
      </strong>
    </div>
  );
}

function RecentSupervisors({ users, loading }) {
  if (loading) {
    return (
      <p className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        Loading...
      </p>
    );
  }

  if (users.length === 0) {
    return (
      <p className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        No Supervisors yet.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((supervisor) => (
        <div
          key={supervisor.id}
          className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-slate-100 px-2.5 py-2.5 sm:rounded-xl sm:px-3 sm:py-3"
        >
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-slate-800 sm:text-sm">
              {supervisor.userName || supervisor.email}
            </p>
            <p className="truncate text-[10px] text-slate-500 sm:text-xs">
              {supervisor.email}
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold sm:px-2.5 sm:text-xs ${
              supervisor.isActive
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {supervisor.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>
      ))}
    </div>
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

function SummaryCard({ label, value, loading }) {
  return (
    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-5">
      <p className="truncate text-[9px] font-extrabold uppercase tracking-[0.04em] text-slate-500 min-[360px]:text-[10px] sm:text-xs sm:tracking-wide">
        {label}
      </p>
      <p className="mt-1 text-[22px] font-extrabold leading-none text-slate-900 min-[360px]:text-2xl sm:text-3xl">
        {loading ? '—' : Number(value || 0).toLocaleString()}
      </p>
    </article>
  );
}

function SignupTrend({ points, loading }) {
  if (loading) {
    return (
      <div className="flex h-36 items-center justify-center text-xs text-slate-400 sm:h-44 sm:text-sm">
        Loading trend...
      </div>
    );
  }

  const values = points.map((point) => point.count);
  const maxValue = Math.max(...values, 1);
  const width = 420;
  const height = 150;
  const paddingX = 20;
  const paddingTop = 12;
  const paddingBottom = 28;
  const plotHeight = height - paddingTop - paddingBottom;
  const step =
    points.length > 1
      ? (width - paddingX * 2) / (points.length - 1)
      : 0;

  const chartPoints = points.map((point, index) => ({
    ...point,
    x: paddingX + index * step,
    y: paddingTop + plotHeight - (point.count / maxValue) * plotHeight,
  }));

  const polyline = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const area = chartPoints.length
    ? `${paddingX},${paddingTop + plotHeight} ${polyline} ${chartPoints[chartPoints.length - 1].x},${paddingTop + plotHeight}`
    : '';

  return (
    <div className="min-w-0 overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="block h-auto max-h-40 w-full sm:max-h-44"
        role="img"
        aria-label="Signup request trend"
      >
        {[0, 1, 2, 3].map((line) => {
          const y = paddingTop + (plotHeight / 3) * line;

          return (
            <line
              key={line}
              x1={paddingX}
              x2={width - paddingX}
              y1={y}
              y2={y}
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          );
        })}

        {area && <polygon points={area} fill="#fff7ed" />}

        {polyline && (
          <polyline
            points={polyline}
            fill="none"
            stroke="#f97316"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {chartPoints.map((point) => (
          <g key={point.date}>
            <circle cx={point.x} cy={point.y} r="4" fill="#f97316" />
            <text
              x={point.x}
              y={height - 7}
              textAnchor="middle"
              fontSize="9"
              fill="#64748b"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RecentRequests({
  requests,
  loading,
  emptyMessage = 'No recent signup requests.',
}) {
  if (loading) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        Loading...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {requests.map((request) => (
          <article
            key={request.id}
            className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800">
                {request.userName || '—'}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-slate-500">
                {request.email}
              </p>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span className="truncate">
                Brand: <strong className="text-slate-700">{request.brandName || '—'}</strong>
              </span>
              <span className="truncate">
                Role: <strong className="text-slate-700">{roleLabel(request.role)}</strong>
              </span>
              <span className="col-span-2">
                Requested: <strong className="text-slate-700">{formatDateTime(request.createdAt)}</strong>
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="rounded-l-lg px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5">Role</th>
              <th className="px-3 py-2.5">Email</th>
              <th className="rounded-r-lg px-3 py-2.5">Requested</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {request.userName || '—'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {request.brandName || '—'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {roleLabel(request.role)}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {request.email}
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {formatDateTime(request.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function roleLabel(role) {
  if (role === 'subadmin') return 'Sub-Admin';
  if (!role) return '—';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatDateTime(value) {
  if (!value) return '—';

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

function BrandIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 sm:h-6 sm:w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 21V4l8-2 8 2v17" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}
