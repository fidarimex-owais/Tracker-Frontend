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
    {
      label: 'Total Users',
      value: summary.totalUsers,
    },
    {
      label: 'Signup Requests',
      value: summary.pendingSignupRequests,
    },
    {
      label: 'QR Records',
      value: summary.qrRecords,
    },
    {
      label: 'Recovery Sheets',
      value: summary.recoverySheets,
    },
  ];

  return (
    <section className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-600">
            Admin Dashboard
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome, Admin
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here&apos;s what&apos;s happening across your system.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm">
          <CalendarIcon />
          {today}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.15fr_1.25fr]">
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
            className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-600 transition hover:bg-orange-50"
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
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">

        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-slate-900">
            {loading ? '—' : value.toLocaleString()}
          </p>
        </div>
      </div>
    </article>
  );
}

function DashboardPanel({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold uppercase tracking-wide text-slate-900">
            {title}
          </h3>
          <div className="mt-2 h-0.5 w-8 bg-orange-500" />
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function UserSummary({ total, data, loading }) {
  const safeTotal = Math.max(total, 1);
  const subadminDegrees = (data.subadmins / safeTotal) * 360;
  const vendorDegrees = (data.vendors / safeTotal) * 360;
  const supervisorDegrees = (data.supervisors / safeTotal) * 360;

  const donutStyle = {
    background: loading
      ? '#f1f5f9'
      : total === 0
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
    <div className="flex flex-col items-center gap-5 sm:flex-row xl:flex-col 2xl:flex-row">
      <div
        className="relative h-36 w-36 shrink-0 rounded-full"
        style={donutStyle}
      >
        <div className="absolute inset-7 flex flex-col items-center justify-center rounded-full bg-white">
          <strong className="text-2xl font-extrabold text-slate-900">
            {loading ? '—' : total}
          </strong>
          <span className="text-xs text-slate-500">Total</span>
        </div>
      </div>

      <div className="w-full space-y-3">
        {items.map(([label, value, dot]) => (
          <div key={label} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-slate-600">
              <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
              {label}
            </span>
            <strong className="text-slate-900">
              {loading ? '—' : value}
            </strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function BrandSummary({ rows, loading }) {
  const displayRows = loading
    ? []
    : rows;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <th className="rounded-l-lg px-3 py-2.5">Brand</th>
            <th className="px-3 py-2.5 text-center">Vendors</th>
            <th className="px-3 py-2.5 text-center">Supervisors</th>
            <th className="rounded-r-lg px-3 py-2.5 text-center">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td colSpan="4" className="px-3 py-10 text-center text-slate-400">
                Loading...
              </td>
            </tr>
          ) : displayRows.length === 0 ? (
            <tr>
              <td colSpan="4" className="px-3 py-10 text-center text-slate-400">
                No brand data yet.
              </td>
            </tr>
          ) : (
            displayRows.map((row) => (
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
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SignupTrend({ points, loading }) {
  if (loading) {
    return (
      <div className="flex h-44 items-center justify-center text-sm text-slate-400">
        Loading trend...
      </div>
    );
  }

  const values = points.map((point) => point.count);
  const maxValue = Math.max(...values, 1);
  const width = 420;
  const height = 155;
  const paddingX = 14;
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
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
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

        {area && (
          <polygon
            points={area}
            fill="#fff7ed"
          />
        )}

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
              fontSize="10"
              fill="#64748b"
            >
              {point.label}
            </text>
          </g>
        ))}
      </svg>

      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
        <span className="h-0.5 w-5 bg-orange-500" />
        Signup Requests (Last 7 Days)
      </div>
    </div>
  );
}

function RecentRequests({ requests, loading }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-[720px] w-full text-sm">
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
          {loading ? (
            <tr>
              <td colSpan="6" className="px-2 py-10 text-center text-slate-400">
                Loading requests...
              </td>
            </tr>
          ) : requests.length === 0 ? (
            <tr>
              <td colSpan="6" className="px-2 py-10 text-center text-slate-400">
                No signup requests yet.
              </td>
            </tr>
          ) : (
            requests.map((request) => (
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
            ))
          )}
        </tbody>
      </table>
    </div>
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
    <IconBase className="h-4 w-4 text-orange-500">
      <path d="M6 2v4" />
      <path d="M18 2v4" />
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
    </IconBase>
  );
}
