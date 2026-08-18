import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { Alert, AuthInput, AuthShell } from './Login';
import { roleHome } from '../../auth/roleHome';

export default function Signup() {
  const { user, signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={roleHome(user.role)} replace />;
  const submit = async (e) => { e.preventDefault(); setError(''); setBusy(true); try { const created = await signup(form); navigate(roleHome(created.role), { replace: true }); } catch (err) { setError(err.message); } finally { setBusy(false); } };
  return <AuthShell title="Create account" subtitle="Public sign-up creates a Vendor account. Admin can later assign Supervisor, Sub-Admin, or Admin access.">
    <form onSubmit={submit} className="space-y-4">
      {error && <Alert>{error}</Alert>}
      <AuthInput label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <AuthInput label="Password" type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <button disabled={busy} className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60">{busy ? 'Creating...' : 'Sign up'}</button>
      <p className="text-center text-sm text-slate-500">Already registered? <Link to="/login" className="font-semibold text-blue-800">Login</Link></p>
    </form>
  </AuthShell>;
}
