import { useMemo, useState } from 'react';
import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';

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
      title="Sign In / Sign Up"
      subtitle="Select your role to continue to your account."
      icon="👤"
    >
      <div className="space-y-5">
        <AuthField
          label="Role"
          error={fieldErrors.role}
        >
          <select
            value={selectedRole}
            onChange={handleRoleChange}
            className={inputClass(
              fieldErrors.role,
              true
            )}
          >
            <option value="">
              Select Role
            </option>

            {ROLE_OPTIONS.map((role) => (
              <option
                key={role.value}
                value={role.value}
              >
                {role.label}
              </option>
            ))}
          </select>
        </AuthField>

        <div className="border-t border-slate-200 pt-5">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-600">
              {selectedRoleLabel
                ? `${selectedRoleLabel} Sign In`
                : 'Account Sign In'}
            </p>
          </div>

          <form
            onSubmit={submit}
            className="space-y-4"
          >
            {error && (
              <Alert>{error}</Alert>
            )}

            <AuthField
              label="Email Address"
              error={fieldErrors.email}
            >
              <input
                required
                disabled={!selectedRole}
                type="email"
                name="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className={inputClass(
                  fieldErrors.email
                )}
              />
            </AuthField>

            <AuthField
              label="Password"
              error={fieldErrors.password}
            >
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
                className={inputClass(
                  fieldErrors.password
                )}
              />
            </AuthField>

            <button
              type="submit"
              disabled={busy || !selectedRole}
              className="w-full rounded-xl bg-amber-500 px-4 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-amber-200 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
            >
              {busy
                ? 'Signing In...'
                : 'Log In →'}
            </button>
          </form>
        </div>

        {signupAvailable && (
          <div className="border-t border-slate-200 pt-5 text-center">
            <p className="text-sm text-slate-600">
              Don&apos;t have an account?{' '}
              <Link
                to={`/signup?role=${selectedRole}`}
                className="font-bold text-amber-600 hover:text-amber-700"
              >
                Sign Up
              </Link>
            </p>
          </div>
        )}

        {(selectedRole === 'admin' ||
          selectedRole === 'subadmin') && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-slate-700">
            Public signup is not available for{' '}
            <span className="font-semibold">
              {selectedRoleLabel}
            </span>
            . Sign in using credentials created for you by an authorized user.
          </div>
        )}
      </div>
    </AuthShell>
  );
}

export function AuthShell({
  title,
  subtitle,
  icon,
  children,
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-stone-100 via-white to-amber-50 px-5 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-white bg-white/95 p-7 shadow-2xl shadow-slate-300/60 sm:p-9">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-3xl shadow-md">
            {icon || '🔐'}
          </div>

          <h1 className="font-serif text-4xl font-bold tracking-tight text-slate-950">
            {title}
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            {subtitle}
          </p>
        </div>

        {children}
      </div>
    </div>
  );
}

export function AuthField({
  label,
  error,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.2em] text-slate-800">
        {label}
      </span>

      {children}

      {error && (
        <span className="mt-1.5 block text-xs font-semibold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

export function Alert({ children }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      {children}
    </div>
  );
}

function inputClass(error, highlight = false) {
  return `w-full rounded-xl border bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : highlight
        ? 'border-amber-400 ring-1 ring-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
        : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
  }`;
}
