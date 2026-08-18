import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';
import { AuthShell } from './Login';

const COMPANY_OPTIONS = [
  'Rajmata',
  'Korhale',
  'Jaywant',
];

const ROLE_OPTIONS = [
  {
    value: 'vendor',
    label: 'Vendor',
  },
  {
    value: 'subadmin',
    label: 'Sub-Admin',
  },
  {
    value: 'supervisor',
    label: 'Supervisor',
  },
];

const INITIAL_FORM = {
  companyName: '',
  userName: '',
  mobileNumber: '',
  email: '',
  role: '',
  password: '',
  confirmPassword: '',
};

export default function Signup() {
  const { user, signup } = useAuth();

  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) {
    return <Navigate to={roleHome(user.role)} replace />;
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
      const result = await signup(form);

      setSuccess(
        result.message ||
          'Signup request submitted. You can sign in after Admin approval.'
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
      title="Request an account"
      subtitle="Submit your details for Admin approval. You can sign in after the request is approved."
    >
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700">
            <p className="font-semibold">
              Request sent successfully.
            </p>

            <p className="mt-1">
              {success}
            </p>
          </div>
        )}

        <SignupField
          label="Company Name"
          error={fieldErrors.companyName}
        >
          <select
            required
            name="companyName"
            value={form.companyName}
            onChange={handleChange}
            className={inputClass(fieldErrors.companyName)}
          >
            <option value="">
              Select company
            </option>

            {COMPANY_OPTIONS.map((company) => (
              <option
                key={company}
                value={company}
              >
                {company}
              </option>
            ))}
          </select>
        </SignupField>

        <SignupField
          label="User Name"
          error={fieldErrors.userName}
        >
          <input
            required
            type="text"
            name="userName"
            value={form.userName}
            onChange={handleChange}
            placeholder="Enter your name"
            className={inputClass(fieldErrors.userName)}
          />
        </SignupField>

        <SignupField
          label="Mobile Number"
          error={fieldErrors.mobileNumber}
        >
          <input
            required
            type="tel"
            name="mobileNumber"
            value={form.mobileNumber}
            onChange={handleChange}
            placeholder="Enter mobile number"
            className={inputClass(fieldErrors.mobileNumber)}
          />
        </SignupField>

        <SignupField
          label="Gmail / Email ID"
          error={fieldErrors.email}
        >
          <input
            required
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Enter email address"
            className={inputClass(fieldErrors.email)}
          />
        </SignupField>

        <SignupField
          label="Role"
          error={fieldErrors.role}
        >
          <select
            required
            name="role"
            value={form.role}
            onChange={handleChange}
            className={inputClass(fieldErrors.role)}
          >
            <option value="">
              Select role
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
        </SignupField>

        <SignupField
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
            placeholder="Create password"
            className={inputClass(fieldErrors.password)}
          />
        </SignupField>

        <SignupField
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
            placeholder="Re-enter password"
            className={inputClass(fieldErrors.confirmPassword)}
          />
        </SignupField>

        <button
          disabled={busy}
          className="w-full rounded-lg bg-blue-900 px-4 py-3 font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
        >
          {busy
            ? 'Sending request...'
            : 'Submit Signup Request'}
        </button>

        <p className="text-center text-sm text-slate-500">
          Already approved?{' '}

          <Link
            to="/login"
            className="font-semibold text-blue-800"
          >
            Login
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function SignupField({
  label,
  error,
  children,
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>

      {children}

      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function inputClass(error) {
  return `w-full rounded-lg border px-3.5 py-3 text-sm outline-none focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-600 focus:ring-red-100'
      : 'border-slate-300 focus:border-blue-700 focus:ring-blue-100'
  }`;
}