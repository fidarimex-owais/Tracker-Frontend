import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getAdminDashboard } from '../../services/adminService';

const ROLE_LABELS = {
  subadmin: 'Sub-Admin',
  vendor: 'Vendor',
  supervisor: 'Supervisor',
};

const STATUS_CLASSES = {
  pending: 'bg-orange-50 text-orange-700 ring-orange-200',
  processing: 'bg-amber-50 text-amber-700 ring-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  rejected: 'bg-red-50 text-red-700 ring-red-200',
};

const EMPTY_DASHBOARD = {
  summary: {
    totalUsers: 0,
    pendingSignupRequests: 0,
    qrRecords: 0,
    recoverySheets: 0,
  },
  userSummary: {
    subadmins: 0,
    vendors: 0,
    supervisors: 0,
  },
  brandSummary: [],
  signupTrend: [],
  recentSignupRequests: [],
};

export default function AdminDashboard() {
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      try {
        const result = await getAdminDashboard();

        if (active) {
          setDashboard(result.data || EMPTY_DASHBOARD);
        }
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load Admin Dashboard'
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDashboard();

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

  const { summary, userSummary } = dashboard;

  const summaryCards = [
    { label: 'Total Users', value: summary.totalUsers },
    { label: 'Signup Requests', value: summary.pendingSignupRequests },
    { label: 'QR Records', value: summary.qrRecords },
    { label: 'Recovery Sheets', value: summary.recoverySheets },
  ];

  return (
    <section className="w-full min-w-0 space-y-3 pb-5 sm:space-y-5 sm:pb-8">
      <div className="flex flex-col gap-3 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-orange-600 sm:text-sm">
            Admin Dashboard
          </p>

          <h2 className="mt-0.5 text-[22px] font-extrabold leading-tight tracking-tight text-slate-900 min-[360px]:text-2xl sm:mt-1 sm:text-3xl">
            Welcome, Admin
          </h2>

          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
            Here&apos;s what&apos;s happening across your system.
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
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid min-w-0 gap-3 sm:gap-5 xl:grid-cols-[0.9fr_1.15fr_1.25fr]">
        <DashboardPanel title="User Summary">
          <UserSummary
            total={summary.totalUsers}
            data={userSummary}
            loading={loading}
          />
        </DashboardPanel>

        <DashboardPanel title="Brand Summary">
          <BrandSummary
            rows={dashboard.brandSummary}
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

      <DashboardPanel
        title="Recent Signup Requests"
        action={
          <Link
            to="/admin/signup-requests"
            className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1.5 text-[10px] font-bold text-orange-600 transition hover:bg-orange-50 sm:px-3 sm:text-xs"
          >
            View All
          </Link>
        }
      >
        <RecentRequests
          requests={dashboard.recentSignupRequests}
          loading={loading}
        />
      </DashboardPanel>
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
        {loading ? '—' : value.toLocaleString()}
      </p>
    </article>
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

      <div className="min-w-0">
        {children}
      </div>
    </section>
  );
}

function UserSummary({ total, data, loading }) {
  const safeTotal = Math.max(total, 1);
  const subadminDegrees = (data.subadmins / safeTotal) * 360;
  const vendorDegrees = (data.vendors / safeTotal) * 360;
  const supervisorDegrees = (data.supervisors / safeTotal) * 360;

  const donutStyle = {
    background: loading || total === 0
      ? '#f1f5f9'
      : `conic-gradient(
          #f97316 0deg ${subadminDegrees}deg,
          #fb923c ${subadminDegrees}deg ${subadminDegrees + vendorDegrees}deg,
          #fdba74 ${subadminDegrees + vendorDegrees}deg ${subadminDegrees + vendorDegrees + supervisorDegrees}deg
        )`,
  };

  const items = [
    ['Sub-Admins', data.subadmins, 'bg-orange-500'],
    ['Vendors', data.vendors, 'bg-orange-400'],
    ['Supervisors', data.supervisors, 'bg-orange-300'],
  ];

  return (
    <div className="grid min-w-0 grid-cols-[104px_minmax(0,1fr)] items-center gap-4 min-[390px]:grid-cols-[116px_minmax(0,1fr)] sm:flex sm:flex-row sm:gap-5 xl:flex-col 2xl:flex-row">
      <div
        className="relative h-[104px] w-[104px] shrink-0 rounded-full min-[390px]:h-[116px] min-[390px]:w-[116px] sm:h-36 sm:w-36"
        style={donutStyle}
      >
        <div className="absolute inset-[21px] flex flex-col items-center justify-center rounded-full bg-white min-[390px]:inset-6 sm:inset-7">
          <strong className="text-xl font-extrabold text-slate-900 sm:text-2xl">
            {loading ? '—' : total}
          </strong>
          <span className="text-[10px] text-slate-500 sm:text-xs">
            Total
          </span>
        </div>
      </div>

      <div className="min-w-0 space-y-2 sm:w-full sm:space-y-3">
        {items.map(([label, value, dot]) => (
          <div
            key={label}
            className="flex min-w-0 items-center justify-between gap-2 text-[11px] sm:text-sm"
          >
            <span className="flex min-w-0 items-center gap-1.5 text-slate-600 sm:gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full sm:h-2.5 sm:w-2.5 ${dot}`} />
              <span className="truncate">{label}</span>
            </span>

            <strong className="shrink-0 text-slate-900">
              {loading ? '—' : value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandSummary({ rows, loading }) {
  const displayRows = loading ? [] : rows;

  if (loading) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        Loading...
      </div>
    );
  }

  if (displayRows.length === 0) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        No brand data yet.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 sm:hidden">
        {displayRows.map((row) => (
          <div
            key={row.brandName}
            className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="min-w-0 truncate text-xs text-slate-800">
                {row.brandName}
              </strong>
              <span className="shrink-0 rounded-md bg-orange-50 px-2 py-1 text-[10px] font-extrabold text-orange-600">
                Total {row.totalUsers}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
              <span>
                Vendors <strong className="text-slate-800">{row.vendors}</strong>
              </span>
              <span>
                Supervisors <strong className="text-slate-800">{row.supervisors}</strong>
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-slate-600">
              <th className="rounded-l-lg px-3 py-2.5">Brand</th>
              <th className="px-3 py-2.5 text-center">Vendors</th>
              <th className="px-3 py-2.5 text-center">Supervisors</th>
              <th className="rounded-r-lg px-3 py-2.5 text-center">Total</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {displayRows.map((row) => (
              <tr key={row.brandName}>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {row.brandName}
                </td>
                <td className="px-3 py-3 text-center text-slate-600">
                  {row.vendors}
                </td>
                <td className="px-3 py-3 text-center text-slate-600">
                  {row.supervisors}
                </td>
                <td className="px-3 py-3 text-center font-bold text-orange-600">
                  {row.totalUsers}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
  const step = points.length > 1
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
        aria-label="Signup requests during the last seven days"
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
            <circle
              cx={point.x}
              cy={point.y}
              r="4"
              fill="#f97316"
            />

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

      <div className="mt-1 flex min-w-0 items-center gap-2 text-[10px] text-slate-500 sm:text-xs">
        <span className="h-0.5 w-4 shrink-0 bg-orange-500 sm:w-5" />
        <span className="truncate">Signup Requests (Last 7 Days)</span>
      </div>
    </div>
  );
}

function RecentRequests({ requests, loading }) {
  if (loading) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        Loading requests...
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="py-7 text-center text-xs text-slate-400 sm:py-10 sm:text-sm">
        No signup requests yet.
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
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-800">
                  {request.userName}
                </p>
                <p className="mt-0.5 truncate text-[10px] text-slate-500">
                  {request.email}
                </p>
              </div>

              <span
                className={`inline-flex shrink-0 rounded-full px-2 py-1 text-[9px] font-bold capitalize ring-1 ring-inset ${
                  STATUS_CLASSES[request.status] ||
                  'bg-slate-50 text-slate-600 ring-slate-200'
                }`}
              >
                {request.status}
              </span>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span className="truncate">
                Brand: <strong className="text-slate-700">{request.brandName || '—'}</strong>
              </span>
              <span className="truncate">
                Role: <strong className="text-slate-700">{ROLE_LABELS[request.role] || request.role}</strong>
              </span>
              <span className="col-span-2">
                Requested: <strong className="text-slate-700">{formatDateTime(request.createdAt)}</strong>
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-2 py-2.5">Name</th>
              <th className="px-2 py-2.5">Brand</th>
              <th className="px-2 py-2.5">Role</th>
              <th className="px-2 py-2.5">Email</th>
              <th className="px-2 py-2.5">Requested</th>
              <th className="px-2 py-2.5">Status</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {requests.map((request) => (
              <tr key={request.id}>
                <td className="px-2 py-3 font-semibold text-slate-800">
                  {request.userName}
                </td>
                <td className="px-2 py-3 text-slate-600">
                  {request.brandName || '—'}
                </td>
                <td className="px-2 py-3 text-slate-600">
                  {ROLE_LABELS[request.role] || request.role}
                </td>
                <td className="px-2 py-3 text-slate-600">
                  {request.email}
                </td>
                <td className="px-2 py-3 text-slate-600">
                  {formatDateTime(request.createdAt)}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold capitalize ring-1 ring-inset ${
                      STATUS_CLASSES[request.status] ||
                      'bg-slate-50 text-slate-600 ring-slate-200'
                    }`}
                  >
                    {request.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function formatDateTime(value) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function IconBase({ children, className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function CalendarIcon() {
  return (
    <IconBase className="h-3.5 w-3.5 text-orange-500 sm:h-4 sm:w-4">
      <path d="M6 2v4" />
      <path d="M18 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </IconBase>
  );
}
