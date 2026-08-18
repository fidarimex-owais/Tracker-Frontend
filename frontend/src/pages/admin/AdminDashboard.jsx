import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';

export default function AdminDashboard() {
  const { user } = useAuth();
  return <section className="space-y-6"><div><p className="text-sm font-semibold text-blue-700">ADMIN</p><h2 className="text-3xl font-bold text-slate-900">Dashboard</h2><p className="mt-2 text-slate-500">Signed in as {user.email}. Manage users, generate stickers, or resolve QR/barcode scans.</p></div><div className="grid gap-4 sm:grid-cols-3"><Card to="/admin/users" title="User Management" body="Assign Admin, Sub-Admin, Vendor, and Supervisor roles. Activate or deactivate accounts."/><Card to="/admin/qr-generator" title="QR Generator" body="Use the same records and sticker-generation workflow available to vendors."/><Card to="/admin/scanner" title="Scanner" body="Resolve QR IDs and barcode IDs across all three brand collections."/></div></section>;
}
function Card({to,title,body}) { return <Link to={to} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{body}</p><p className="mt-4 text-sm font-semibold text-blue-800">Open →</p></Link>; }
