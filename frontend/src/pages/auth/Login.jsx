import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={roleHome(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault(); setError(''); setBusy(true);
    try { const loggedIn = await login(form); navigate(roleHome(loggedIn.role), { replace: true }); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <AuthShell title="Welcome back" subtitle="Sign in with your email and password.">
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <AuthInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <AuthInput label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button disabled={busy} className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? 'Signing in...' : 'Login'}</button>
      <p className="text-center text-sm text-slate-500">No account? <Link to="/signup" className="font-semibold text-blue-800">Sign up</Link></p>
    </form>
  </AuthShell>;
}

export function AuthShell({ title, subtitle, children }) { return <div className="min-h-screen bg-slate-950 px-5 py-12 grid place-items-center"><div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl"><div className="mb-6"><p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-blue-700">QR Operations</p><h1 className="text-3xl font-bold text-slate-900">{title}</h1><p className="mt-2 text-sm text-slate-500">{subtitle}</p></div>{children}</div></div>; }
export function AuthInput({ label, ...props }) { return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span><input required {...props} className="w-full rounded-lg border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></label>; }
export function Alert({ children }) { return <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{children}</div>; }
