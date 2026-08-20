import { useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';
import logo from '../../assets/fidar-imex-logo.png';
import fruitHero from '../../assets/fidar-fruit-hero.jpg';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Sub-Admin' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'supervisor', label: 'Supervisor' },
];

const SIGNUP_ROLES = new Set([
  'vendor',
  'supervisor',
]);

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialRole = useMemo(() => {
    const role = searchParams.get('role') || '';

    return ROLE_OPTIONS.some(
      (option) => option.value === role
    )
      ? role
      : '';
  }, [searchParams]);

  const [selectedRole, setSelectedRole] = useState(initialRole);
  const [form, setForm] = useState({
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
      />
    );
  }

  const selectedRoleLabel =
    ROLE_OPTIONS.find(
      (option) => option.value === selectedRole
    )?.label || '';

  const signupAvailable = SIGNUP_ROLES.has(selectedRole);

  const handleRoleChange = (event) => {
    const role = event.target.value;

    setSelectedRole(role);
    setForm({ email: '', password: '' });
    setFieldErrors({});
    setError('');

    if (role) {
      setSearchParams({ role }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
    }));

    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();

    if (!selectedRole) {
      setFieldErrors({
        role: 'Select a role before logging in',
      });
      return;
    }

    setError('');
    setFieldErrors({});
    setBusy(true);

    try {
      const loggedIn = await login({
        role: selectedRole,
        email: form.email,
        password: form.password,
      });

      navigate(
        roleHome(loggedIn.role),
        { replace: true }
      );
    } catch (requestError) {
      const errors = {};

      (requestError.fieldErrors || []).forEach((item) => {
        if (item.field) {
          errors[item.field] = item.message;
        }
      });

      setFieldErrors(errors);
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      title="Login"
      subtitle="Welcome back! Please login to continue to your account."
    >
      <form
        onSubmit={submit}
        className="space-y-3"
      >
        {error && (
          <Alert>{error}</Alert>
        )}

        <AuthField
          label="Role"
          error={fieldErrors.role}
        >
          <div className="relative">
            <RoleIcon />
            <select
              value={selectedRole}
              onChange={handleRoleChange}
              className={inputClass(fieldErrors.role, true)}
            >
              <option value="">Select Role</option>
              {ROLE_OPTIONS.map((role) => (
                <option
                  key={role.value}
                  value={role.value}
                >
                  {role.label}
                </option>
              ))}
            </select>
          </div>
        </AuthField>

        <AuthField
          label="Email ID"
          error={fieldErrors.email}
        >
          <div className="relative">
            <MailIcon />
            <input
              required
              disabled={!selectedRole}
              type="email"
              name="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter your email"
              className={inputClass(fieldErrors.email)}
            />
          </div>
        </AuthField>

        <AuthField
          label="Password"
          error={fieldErrors.password}
        >
          <div className="relative">
            <LockIcon />
            <input
              required
              disabled={!selectedRole}
              type="password"
              name="password"
              autoComplete="current-password"
              minLength="8"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={inputClass(fieldErrors.password)}
            />
          </div>
        </AuthField>

        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 accent-orange-500"
            />
            Remember me
          </label>

          <span className="font-semibold text-orange-600">
            Secure Login
          </span>
        </div>

        <button
          type="submit"
          disabled={busy || !selectedRole}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none sm:text-base"
        >
          <LoginIcon />
          {busy ? 'Logging In...' : 'Login'}
        </button>

        {signupAvailable && (
          <div className="text-center text-xs text-slate-600 sm:text-sm">
            Don&apos;t have an account?{' '}
            <Link
              to={`/signup?role=${selectedRole}`}
              className="font-bold text-orange-600 hover:text-orange-700"
            >
              Register
            </Link>
          </div>
        )}

        {(selectedRole === 'admin' || selectedRole === 'subadmin') && (
          <div className="rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs leading-5 text-slate-700 sm:text-sm">
            Public registration is not available for{' '}
            <span className="font-semibold">
              {selectedRoleLabel}
            </span>
            . Login using credentials created for you by an authorized user.
          </div>
        )}
      </form>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}) {
  return (
    <main className="h-[100dvh] w-full overflow-hidden bg-[#f7f4ef] p-[clamp(0.5rem,1.4vh,1rem)] sm:px-5 lg:px-7">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
        <section className="grid h-full max-h-[900px] w-full min-h-0 overflow-hidden rounded-[clamp(1rem,2vw,2rem)] border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10 flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-[clamp(1.1rem,3vw,3.5rem)] py-[clamp(0.75rem,1.8vh,1.5rem)]">
            <Link
              to="/"
              className="mb-[clamp(0.45rem,1.5vh,1.1rem)] inline-block w-fit shrink-0"
              aria-label="Back to home"
            >
              <img
                src={logo}
                alt="Fidar Imex Private Limited"
                className="h-auto w-[clamp(175px,18vw,250px)] max-w-full object-contain"
              />
            </Link>

            <div className={`w-full min-h-0 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
              <h1 className="text-[clamp(1.8rem,4.2vh,3rem)] font-extrabold leading-none tracking-tight text-slate-900">
                {title}
              </h1>

              <p className="mt-[clamp(0.35rem,0.8vh,0.65rem)] max-w-xl text-[clamp(0.78rem,1.55vh,0.95rem)] leading-[1.45] text-slate-500">
                {subtitle}
              </p>

              <div className="mt-[clamp(0.55rem,1.2vh,0.9rem)] h-1 w-12 rounded-full bg-orange-500" />

              <div className="mt-[clamp(0.7rem,1.5vh,1.15rem)]">
                {children}
              </div>
            </div>

            <p className="mt-auto shrink-0 pt-2 text-[10px] leading-4 text-slate-400 sm:text-[11px]">
              © 2026 FIDAR IMEX PRIVATE LIMITED. All rights reserved.
            </p>
          </div>

          <div className="relative hidden h-full min-h-0 overflow-hidden lg:block">
            <img
              src={fruitHero}
              alt="Fresh fruits"
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/20 to-transparent" />
          </div>
        </section>
      </div>
    </main>
  );
}

export function AuthField({
  label,
  error,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-slate-800 sm:text-sm">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] font-semibold leading-4 text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Alert({ children }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 sm:text-sm">
      {children}
    </div>
  );
}

export function inputClass(error, highlight = false) {
  return `w-full appearance-none rounded-xl border bg-white py-[clamp(0.55rem,1.15vh,0.72rem)] pl-10 pr-3 text-[clamp(0.78rem,1.45vh,0.9rem)] text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
      : highlight
        ? 'border-orange-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
        : 'border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
  }`;
}

function IconBase({ children }) {
  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
      {children}
    </span>
  );
}

function RoleIcon() {
  return (
    <IconBase>
      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </svg>
    </IconBase>
  );
}

function MailIcon() {
  return (
    <IconBase>
      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </svg>
    </IconBase>
  );
}

function LockIcon() {
  return (
    <IconBase>
      <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </IconBase>
  );
}

function LoginIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 17l5-5-5-5" />
      <path d="M15 12H3" />
      <path d="M14 3h4a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-4" />
    </svg>
  );
}
