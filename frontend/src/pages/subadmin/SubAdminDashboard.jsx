import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export default function SubAdminDashboard() {
  const { user } = useAuth();

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold text-orange-600">SUB-ADMIN</p>
        <h2 className="text-3xl font-bold text-slate-900">Dashboard</h2>
        <p className="mt-2 text-slate-500">
          Signed in as {user.email}. Manage Vendor/Supervisor accounts, generate stickers,
          and resolve QR/barcode scans.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card
          to="/sub-admin/users"
          title="User Management"
          body="Manage Vendor and Supervisor roles and account status. Admin and Sub-Admin accounts remain protected."
        />
        <Card
          to="/sub-admin/qr-generator"
          title="QR Generator"
          body="Create package-line records and generate downloadable or printable QR/barcode stickers."
        />
        <Card
          to="/sub-admin/scanner"
          title="Scanner"
          body="Resolve QR IDs and barcode IDs across the existing brand collections."
        />
      </div>
    </section>
  );
}

function Card({ to, title, body }) {
  return (
    <Link
      to={to}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <h3 className="font-bold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
      <p className="mt-4 text-sm font-semibold text-orange-600">Open →</p>
    </Link>
  );
}
