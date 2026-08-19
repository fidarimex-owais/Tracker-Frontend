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
} from './Login';

const BRAND_OPTIONS = [
  'Hi Banana',
  'Rajmata',
  'Banana Man',
];

const SIGNUP_ROLE_LABELS = {
  vendor: 'Vendor',
  supervisor: 'Supervisor',
};

const INITIAL_FORM = {
  brandName: '',
  userName: '',
  mobileNumber: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export default function Signup() {
  const { user, signup } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedRole = searchParams.get('role') || '';
  const roleLabel = SIGNUP_ROLE_LABELS[selectedRole];

  const [form, setForm] = useState(INITIAL_FORM);
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

  if (!roleLabel) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

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

    setError('');
    setSuccess('');
    setFieldErrors({});
    setBusy(true);

    try {
      const result = await signup({
        ...form,
        role: selectedRole,
      });

      setSuccess(
        result.message ||
          'Signup request submitted. You can sign in after your request is approved.'
      );

      setForm(INITIAL_FORM);
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
      title={`${roleLabel} Sign Up`}
      subtitle={`Register as a ${roleLabel}. Select your brand and submit your request for approval.`}
      icon="📝"
    >
      <form
        onSubmit={submit}
        className="space-y-4"
      >
        {error && (
          <Alert>{error}</Alert>
        )}

        {success && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm leading-6 text-green-700">
            <p className="font-bold">
              Signup request sent successfully.
            </p>

            <p className="mt-1">
              {success}
            </p>

            <Link
              to={`/login?role=${selectedRole}`}
              className="mt-2 inline-block font-bold underline"
            >
              Back to {roleLabel} Login
            </Link>
          </div>
        )}

        <AuthField
          label="Brand"
          error={fieldErrors.brandName}
        >
          <select
            required
            name="brandName"
            value={form.brandName}
            onChange={handleChange}
            className={inputClass(
              fieldErrors.brandName,
              true
            )}
          >
            <option value="">
              Select Brand
            </option>

            {BRAND_OPTIONS.map((brand) => (
              <option
                key={brand}
                value={brand}
              >
                {brand}
              </option>
            ))}
          </select>
        </AuthField>

        <AuthField
          label="Full Name"
          error={fieldErrors.userName}
        >
          <input
            required
            type="text"
            name="userName"
            autoComplete="name"
            value={form.userName}
            onChange={handleChange}
            placeholder="Full Name"
            className={inputClass(
              fieldErrors.userName
            )}
          />
        </AuthField>

        <AuthField
          label="Mobile Number"
          error={fieldErrors.mobileNumber}
        >
          <input
            required
            type="tel"
            name="mobileNumber"
            autoComplete="tel"
            value={form.mobileNumber}
            onChange={handleChange}
            placeholder="Mobile Number"
            className={inputClass(
              fieldErrors.mobileNumber
            )}
          />
        </AuthField>

        <AuthField
          label="Email ID"
          error={fieldErrors.email}
        >
          <input
            required
            type="email"
            name="email"
            autoComplete="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email Address"
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
            type="password"
            name="password"
            minLength="8"
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange}
            placeholder="Password"
            className={inputClass(
              fieldErrors.password
            )}
          />
        </AuthField>

        <AuthField
          label="Confirm Password"
          error={fieldErrors.confirmPassword}
        >
          <input
            required
            type="password"
            name="confirmPassword"
            minLength="8"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            placeholder="Confirm Password"
            className={inputClass(
              fieldErrors.confirmPassword
            )}
          />
        </AuthField>

        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-amber-500 px-4 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-amber-200 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy
            ? 'Sending Request...'
            : 'Sign Up →'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            to={`/login?role=${selectedRole}`}
            className="font-bold text-amber-600 hover:text-amber-700"
          >
            Login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function inputClass(error, highlight = false) {
  return `w-full rounded-xl border bg-white px-4 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : highlight
        ? 'border-amber-400 ring-1 ring-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
        : 'border-slate-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
  }`;
}
