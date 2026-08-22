import { useState } from 'react';
import {
  Link,
  Navigate,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';
import {
  Alert,
  AuthField,
  AuthShell,
  PasswordVisibilityButton,
  inputClass,
} from './Login';

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const BRAND_OPTIONS = [
  'Hi Banana',
  'Rajmata',
  'Banana Man',
];

const SIGNUP_ROLE_OPTIONS = [
  { value: 'vendor', label: 'Vendor' },
  { value: 'supervisor', label: 'Supervisor' },
];

const INITIAL_FORM = {
  brandName: '',
  userName: '',
  mobileNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
};

const isValidGmail = (email) =>
  EMAIL_RE.test(email) && email.endsWith('@gmail.com');

export default function Signup() {
  const { user, signup } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const roleFromUrl = searchParams.get('role') || '';
  const validInitialRole = SIGNUP_ROLE_OPTIONS.some(
    (option) => option.value === roleFromUrl
  )
    ? roleFromUrl
    : '';

  const [selectedRole, setSelectedRole] = useState(validInitialRole);
  const [form, setForm] = useState(INITIAL_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
      />
    );
  }

  const roleLabel = SIGNUP_ROLE_OPTIONS.find(
    (option) => option.value === selectedRole
  )?.label;

  const handleRoleChange = (event) => {
    const role = event.target.value;

    setSelectedRole(role);
    setForm(INITIAL_FORM);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setFieldErrors({});
    setError('');
    setSuccess('');

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
    setSuccess('');
  };

  const submit = async (event) => {
    event.preventDefault();

    const email = form.email.trim().toLowerCase();
    const errors = {};

    if (!selectedRole) {
      errors.role = 'Select Vendor or Supervisor before registering';
    }

    if (!isValidGmail(email)) {
      errors.email = 'Please enter a valid Gmail address.';
    }

    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setError('');
    setSuccess('');
    setFieldErrors({});
    setBusy(true);

    try {
      const result = await signup({
        ...form,
        email,
        role: selectedRole,
      });

      setSuccess(
        result.message ||
          'Registration request submitted. You can login after your request is approved.'
      );

      setForm(INITIAL_FORM);
      setShowPassword(false);
      setShowConfirmPassword(false);
    } catch (requestError) {
      const nextErrors = {};

      (requestError.fieldErrors || []).forEach((item) => {
        if (item.field) {
          nextErrors[item.field] = item.message;
        }
      });

      if (
        requestError.statusCode === 409 &&
        requestError.message === 'This email address is already registered.'
      ) {
        nextErrors.email = requestError.message;
      }

      setFieldErrors(nextErrors);
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell
      wide
      title={roleLabel ? `${roleLabel} Register` : 'Register'}
      subtitle={
        roleLabel
          ? `Create your ${roleLabel} account by filling in the details below.`
          : 'Select a role to begin your registration.'
      }
    >
      <div className="space-y-3">
        <AuthField
          label="Role"
          error={fieldErrors.role}
        >
          <div className="relative">
            <FieldIcon type="role" />
            <select
              required
              name="role"
              value={selectedRole}
              onChange={handleRoleChange}
              className={inputClass(fieldErrors.role, true)}
            >
              <option value="">Select Role</option>
              {SIGNUP_ROLE_OPTIONS.map((role) => (
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

        {roleLabel && (
          <form
            onSubmit={submit}
            noValidate
            className="space-y-3"
          >
            {error && <Alert>{error}</Alert>}

            {success && (
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 sm:text-sm">
                <p className="font-bold">
                  Registration request sent successfully.
                </p>
                <p className="mt-1">{success}</p>
                <Link
                  to={`/login?role=${selectedRole}`}
                  className="mt-1 inline-block font-bold underline"
                >
                  Back to {roleLabel} Login
                </Link>
              </div>
            )}

            <AuthField
              label="Brand"
              error={fieldErrors.brandName}
            >
              <div className="relative">
                <FieldIcon type="brand" />
                <select
                  required
                  name="brandName"
                  value={form.brandName}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.brandName)}
                >
                  <option value="">Select Brand</option>
                  {BRAND_OPTIONS.map((brand) => (
                    <option
                      key={brand}
                      value={brand}
                    >
                      {brand}
                    </option>
                  ))}
                </select>
              </div>
            </AuthField>

            <div className="grid gap-3 sm:grid-cols-2">
              <AuthField
                label="Full Name"
                error={fieldErrors.userName}
              >
                <div className="relative">
                  <FieldIcon type="person" />
                  <input
                    required
                    type="text"
                    name="userName"
                    autoComplete="name"
                    value={form.userName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    className={inputClass(fieldErrors.userName)}
                  />
                </div>
              </AuthField>

              <AuthField
                label="Mobile Number"
                error={fieldErrors.mobileNumber}
              >
                <div className="relative">
                  <FieldIcon type="phone" />
                  <input
                    required
                    type="tel"
                    name="mobileNumber"
                    autoComplete="tel"
                    value={form.mobileNumber}
                    onChange={handleChange}
                    placeholder="Enter mobile number"
                    className={inputClass(fieldErrors.mobileNumber)}
                  />
                </div>
              </AuthField>
            </div>

            <AuthField
              label="Gmail Address"
              error={fieldErrors.email}
            >
              <div className="relative">
                <FieldIcon type="email" />
                <input
                  required
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@gmail.com"
                  className={inputClass(fieldErrors.email)}
                />
              </div>
            </AuthField>

            <div className="grid gap-3 sm:grid-cols-2">
              <AuthField
                label="Password"
                error={fieldErrors.password}
              >
                <div className="relative">
                  <FieldIcon type="lock" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    minLength="8"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Enter password"
                    className={inputClass(fieldErrors.password, false, true)}
                  />
                  <PasswordVisibilityButton
                    visible={showPassword}
                    onClick={() => setShowPassword((current) => !current)}
                  />
                </div>
              </AuthField>

              <AuthField
                label="Confirm Password"
                error={fieldErrors.confirmPassword}
              >
                <div className="relative">
                  <FieldIcon type="lock" />
                  <input
                    required
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    minLength="8"
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm password"
                    className={inputClass(fieldErrors.confirmPassword, false, true)}
                  />
                  <PasswordVisibilityButton
                    visible={showConfirmPassword}
                    onClick={() =>
                      setShowConfirmPassword((current) => !current)
                    }
                  />
                </div>
              </AuthField>
            </div>

            <label className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
              <input
                required
                type="checkbox"
                className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-orange-500"
              />
              <span>
                I agree to the{' '}
                <span className="font-semibold text-orange-600">
                  Terms & Conditions
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
            >
              <RegisterIcon />
              {busy ? 'Sending Request...' : 'Register'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-600 sm:text-sm">
          Already have an account?{' '}
          <Link
            to={selectedRole ? `/login?role=${selectedRole}` : '/login'}
            className="font-bold text-orange-600 hover:text-orange-700"
          >
            Login
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}

function FieldIcon({ type }) {
  const common = 'h-4 w-4 sm:h-5 sm:w-5';

  return (
    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
      {type === 'role' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      )}
      {type === 'brand' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 21V5l8-3 8 3v16" />
          <path d="M8 8h2M8 12h2M14 8h2M14 12h2M10 21v-5h4v5" />
        </svg>
      )}
      {type === 'person' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      )}
      {type === 'phone' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M7 3h3l2 5-2 2a16 16 0 0 0 4 4l2-2 5 2v3c0 2-1 4-4 4C9 21 3 15 3 7c0-3 2-4 4-4Z" />
        </svg>
      )}
      {type === 'email' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m4 7 8 6 8-6" />
        </svg>
      )}
      {type === 'lock' && (
        <svg viewBox="0 0 24 24" className={common} fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
        </svg>
      )}
    </span>
  );
}

function RegisterIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="4" />
      <path d="M3 21a6 6 0 0 1 12 0M19 8v6M22 11h-6" />
    </svg>
  );
}
