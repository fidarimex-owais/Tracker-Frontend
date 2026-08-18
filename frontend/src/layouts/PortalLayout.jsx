import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';

const links = {
  admin: [
    { to: '/admin', label: 'Dashboard', end: true },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/scanner', label: 'Scanner' },
    { to: '/admin/qr-generator', label: 'QR Generator' },
  ],
  vendor: [
    { to: '/vendor', label: 'Dashboard', end: true },
    { to: '/vendor/qr-generator', label: 'QR Generator' },
  ],
  supervisor: [
    { to: '/supervisor', label: 'Dashboard', end: true },
    { to: '/supervisor/scanner', label: 'Scanner' },
  ],
};

export default function PortalLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = async () => { await logout(); navigate('/login', { replace: true }); };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">QR Operations</p>
            <h1 className="text-lg font-bold capitalize text-slate-900">{user.role} Portal</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-medium text-slate-800">{user.email}</p><p className="text-xs capitalize text-slate-500">{user.role}</p></div>
            <button onClick={handleLogout} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Logout</button>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:grid-cols-[210px_1fr]">
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <nav className="flex gap-2 overflow-x-auto md:flex-col">
            {links[user.role].map((link) => (
              <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => `whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-blue-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main><Outlet /></main>
      </div>
    </div>
  );
}
