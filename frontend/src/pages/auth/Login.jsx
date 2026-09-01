// frontend/src/pages/auth/Login.jsx

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import ThemeToggle from '../../components/ThemeToggle';

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'subadmin', label: 'Sub-Admin' },
  { value: 'vendor', label: 'Vendor' },
  { value: 'supervisor', label: 'Supervisor' },
];

const PUBLIC_SIGNUP_ROLES = new Set(['supervisor']);

const GOOGLE_LOGIN_ROLES = new Set([
  'vendor',
  'supervisor',
]);

let googleScriptPromise;

const loadGoogleIdentityScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );

      if (existingScript) {
        existingScript.addEventListener('load', resolve, { once: true });
        existingScript.addEventListener('error', reject, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  return googleScriptPromise;
};

export default function Login() {
  const { user, login, googleLogin } = useAuth();
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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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

  const signupAvailable = PUBLIC_SIGNUP_ROLES.has(selectedRole);
  const googleLoginAvailable = GOOGLE_LOGIN_ROLES.has(selectedRole);

  const handleRoleChange = (event) => {
    const role = event.target.value;

    setSelectedRole(role);
    setForm({ email: '', password: '' });
    setShowPassword(false);
    setRememberMe(false);
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

    const email = form.email.trim().toLowerCase();
    const errors = {};

    if (!selectedRole) {
      errors.role = 'Select a role before logging in';
    }

    if (!EMAIL_RE.test(email)) {
      errors.email = 'Please enter a valid email address.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setError('');
    setFieldErrors({});
    setBusy(true);

    try {
      const loggedIn = await login({
        role: selectedRole,
        email,
        password: form.password,
        rememberMe,
      });

      navigate(roleHome(loggedIn.role), { replace: true });
    } catch (requestError) {
      const nextErrors = {};

      (requestError.fieldErrors || []).forEach((item) => {
        if (item.field) {
          nextErrors[item.field] = item.message;
        }
      });

      setFieldErrors(nextErrors);
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential) => {
      if (!selectedRole || busy) {
        return;
      }

      setError('');
      setFieldErrors({});
      setBusy(true);

      try {
        const loggedIn = await googleLogin({
          role: selectedRole,
          credential,
          rememberMe,
        });

        navigate(roleHome(loggedIn.role), { replace: true });
      } catch (requestError) {
        const nextErrors = {};

        (requestError.fieldErrors || []).forEach((item) => {
          if (item.field) {
            nextErrors[item.field] = item.message;
          }
        });

        setFieldErrors(nextErrors);
        setError(requestError.message);
      } finally {
        setBusy(false);
      }
    },
    [busy, googleLogin, navigate, rememberMe, selectedRole]
  );

  return (
    <AuthShell
      title="Login"
      subtitle="Welcome back! Please login to continue to your account."
    >
      <form
        onSubmit={submit}
        noValidate
        className="space-y-3"
      >
        {error && <Alert>{error}</Alert>}

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

        {googleLoginAvailable && (
          <>
            <GoogleSignInButton
              disabled={busy}
              onCredential={handleGoogleCredential}
            />

            <div className="flex items-center gap-3 py-0.5" aria-hidden="true">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                OR
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

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
              inputMode="email"
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
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              minLength="8"
              value={form.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className={inputClass(fieldErrors.password, false, true)}
            />
            <PasswordVisibilityButton
              visible={showPassword}
              onClick={() => setShowPassword((current) => !current)}
              disabled={!selectedRole}
            />
          </div>
        </AuthField>

        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <label className="flex items-center gap-2 text-slate-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
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
      </form>
    </AuthShell>
  );
}

function GoogleSignInButton({
  disabled,
  onCredential,
}) {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    if (!clientId || disabled) {
      return undefined;
    }

    let cancelled = false;
    const renderButton = () => {
      if (
        cancelled ||
        !containerRef.current ||
        !window.google?.accounts?.id
      ) {
        return;
      }

      const container = containerRef.current;
      const width = Math.max(
        220,
        Math.min(400, Math.floor(container.getBoundingClientRect().width))
      );

      container.innerHTML = '';

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (response?.credential) {
            onCredential(response.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width,
      });
    };

    loadGoogleIdentityScript()
      .then(() => {
        if (cancelled) return;
        renderButton();
      })
      .catch(() => {
        // The normal login form remains available if Google cannot load.
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onCredential]);

  if (!clientId) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[11px] text-slate-500 sm:text-xs">
        Google Sign-In requires VITE_GOOGLE_CLIENT_ID.
      </div>
    );
  }

  if (disabled) {
    return (
      <button
        type="button"
        disabled
        className="relative flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-medium text-slate-400 transition sm:min-h-12 sm:text-sm"
      >
        <span className="text-base font-bold">G</span>
        Select a role to continue with Google
      </button>
    );
  }

  return (
    <div className="flex min-h-11 w-full items-center justify-center overflow-hidden rounded-xl bg-white sm:min-h-12">
      <div
        ref={containerRef}
        className="flex w-full items-center justify-center overflow-hidden rounded-xl"
      />
    </div>
  );
}

export function AuthShell({
  title,
  subtitle,
  children,
  wide = false,
}) {
  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden bg-[#f7f4ef] p-2 sm:p-4 lg:h-[100dvh] lg:overflow-hidden lg:px-7 lg:py-4">
      <div className="absolute right-3 top-3 z-30 sm:right-5 sm:top-5">
        <ThemeToggle compact />
      </div>
      <div className="mx-auto flex min-h-[calc(100dvh-1rem)] w-full max-w-6xl items-center justify-center sm:min-h-[calc(100dvh-2rem)] lg:h-full lg:min-h-0">
        <section className="grid w-full overflow-hidden rounded-2xl border border-white/80 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.16)] lg:h-full lg:max-h-[900px] lg:min-h-0 lg:grid-cols-[1.08fr_0.92fr] lg:rounded-[2rem]">
          <div className="relative z-10 flex min-h-0 min-w-0 flex-col px-4 py-5 sm:px-7 sm:py-6 lg:h-full lg:overflow-y-auto lg:px-[clamp(2rem,3vw,3.5rem)] lg:py-[clamp(0.75rem,1.8vh,1.5rem)]">
            <Link
              to="/"
              className="mb-[clamp(0.45rem,1.5vh,1.1rem)] inline-block w-fit shrink-0"
              aria-label="Back to home"
            >
              <img
                src={logo}
                alt="Fidar Imex Private Limited"
                className="h-auto w-44 max-w-full object-contain sm:w-52 lg:w-[clamp(175px,18vw,250px)]"
              />
            </Link>

            <div className={`w-full shrink-0 ${wide ? 'max-w-2xl' : 'max-w-[400px]'}`}>
              <h1 className="text-3xl font-extrabold leading-none tracking-tight text-slate-900 sm:text-4xl lg:text-[clamp(1.8rem,4.2vh,3rem)]">
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

            <p className="mt-6 shrink-0 border-t border-slate-100 pt-3 text-[10px] leading-4 text-slate-400 sm:text-[11px]">
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

export function inputClass(
  error,
  highlight = false,
  hasTrailingAction = false
) {
  return `w-full appearance-none rounded-xl border bg-white py-[clamp(0.55rem,1.15vh,0.72rem)] pl-10 ${hasTrailingAction ? 'pr-12' : 'pr-3'} text-[clamp(0.78rem,1.45vh,0.9rem)] text-slate-900 outline-none transition placeholder:text-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-100'
      : highlight
        ? 'border-orange-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
        : 'border-slate-300 focus:border-orange-500 focus:ring-4 focus:ring-orange-100'
  }`;
}

export function PasswordVisibilityButton({
  visible,
  onClick,
  disabled = false,
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={visible ? 'Hide password' : 'Show password'}
      aria-pressed={visible}
      className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 transition hover:bg-orange-50 hover:text-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:text-slate-300 sm:right-1.5"
    >
      {visible ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
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

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A10.6 10.6 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-3.1 3.7" />
      <path d="M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a10 10 0 0 0 4.1-.9" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
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
