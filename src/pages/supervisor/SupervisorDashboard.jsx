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

  const cards = [
    {
      label: 'Assigned Brand',
      value: profile.brandName || 'Not Assigned',
      textValue: true,
    },
    {
      label: 'Recovery Sheets',
      value: dashboard.summary.recoverySheets,
    },
    {
      label: 'Account Status',
      value: profile.isActive ? 'Active' : 'Inactive',
      textValue: true,
    },
  ];

  return (
    <section className="space-y-5 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-orange-600">
            Supervisor Dashboard
          </p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
            Welcome, {user.userName || 'Supervisor'}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            View your account information and generated Recovery Sheets.
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <SummaryCard
            key={card.label}
            {...card}
            loading={loading}
          />
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <DashboardPanel title="Account Information">
          <div className="space-y-3">
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
              className="rounded-lg border border-orange-200 px-3 py-1.5 text-xs font-bold text-orange-600 transition hover:bg-orange-50"
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
    <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3">
      <span className="text-sm font-semibold text-slate-500">
        {label}
      </span>
      <strong className="max-w-[65%] break-words text-right text-sm text-slate-900">
        {loading ? '—' : value}
      </strong>
    </div>
  );
}

function RecoveryTable({ rows, loading }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-orange-50 text-left text-xs uppercase tracking-wide text-slate-600">
            <th className="rounded-l-lg px-3 py-2.5">
              Packaging Date
            </th>
            <th className="px-3 py-2.5">
              Vendor
            </th>
            <th className="px-3 py-2.5 text-center">
              Line
            </th>
            <th className="rounded-r-lg px-3 py-2.5">
              Generated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td
                colSpan="4"
                className="px-3 py-10 text-center text-slate-400"
              >
                Loading...
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td
                colSpan="4"
                className="px-3 py-10 text-center text-slate-400"
              >
                No Recovery Sheets have been generated yet.
              </td>
            </tr>
          ) : (
            rows.map((sheet) => (
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
            ))
          )}
        </tbody>
      </table>
    </div>
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

function SummaryCard({
  label,
  value,
  loading,
  textValue = false,
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-4">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
            {label}
          </p>
          <p
            className={`mt-1 font-extrabold text-slate-900 ${
              textValue
                ? 'truncate text-xl'
                : 'text-3xl'
            }`}
          >
            {loading
              ? '—'
              : textValue
                ? value
                : Number(value || 0).toLocaleString()}
          </p>
        </div>
      </div>
    </article>
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
  const step =
    points.length > 1
      ? (width - paddingX * 2) / (points.length - 1)
      : 0;

  const chartPoints = points.map((point, index) => ({
    ...point,
    x: paddingX + index * step,
    y:
      paddingTop +
      plotHeight -
      (point.count / maxValue) * plotHeight,
  }));

  const polyline = chartPoints
    .map((point) => `${point.x},${point.y}`)
    .join(' ');

  const area = chartPoints.length
    ? `${paddingX},${paddingTop + plotHeight} ${polyline} ${
        chartPoints[chartPoints.length - 1].x
      },${paddingTop + plotHeight}`
    : '';

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full"
        role="img"
        aria-label="Signup request trend"
      >
        {[0, 1, 2, 3].map((line) => {
          const y =
            paddingTop + (plotHeight / 3) * line;

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
              y={height - 6}
              textAnchor="middle"
              fontSize="10"
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
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="rounded-l-lg px-3 py-2.5">
              Name
            </th>
            <th className="px-3 py-2.5">Brand</th>
            <th className="px-3 py-2.5">Role</th>
            <th className="px-3 py-2.5">Email</th>
            <th className="rounded-r-lg px-3 py-2.5">
              Requested
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {loading ? (
            <tr>
              <td
                colSpan="5"
                className="px-3 py-10 text-center text-slate-400"
              >
                Loading...
              </td>
            </tr>
          ) : requests.length === 0 ? (
            <tr>
              <td
                colSpan="5"
                className="px-3 py-10 text-center text-slate-400"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            requests.map((request) => (
              <tr key={request.id}>
                <td className="px-3 py-3 font-semibold text-slate-800">
                  {request.userName || '—'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {request.brandName || '—'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {request.role === 'subadmin'
                    ? 'Sub-Admin'
                    : request.role
                      ? request.role.charAt(0).toUpperCase() +
                        request.role.slice(1)
                      : '—'}
                </td>
                <td className="px-3 py-3 text-slate-600">
                  {request.email}
                </td>
                <td className="px-3 py-3 text-slate-500">
                  {formatDateTime(request.createdAt)}
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
      className="h-4 w-4"
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
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M4 21V4l8-2 8 2v17" />
      <path d="M9 8h1M14 8h1M9 12h1M14 12h1M9 16h1M14 16h1" />
    </svg>
  );
}

