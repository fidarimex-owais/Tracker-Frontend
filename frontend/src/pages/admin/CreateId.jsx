// frontend/src/pages/admin/CreateId.jsx

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { createId } from '../../services/adminService';

const BRAND_OPTIONS = [
  'Hi Banana',
  'Banana Man',
  'Joker',
]

const ROLE_OPTIONS = {
  admin: [
    { value: 'vendor', label: 'Vendor' },
    { value: 'subadmin', label: 'Sub-Admin' },
    { value: 'supervisor', label: 'Supervisor' },
  ],
  subadmin: [
    { value: 'vendor', label: 'Vendor' },
    { value: 'supervisor', label: 'Supervisor' },
  ],
  vendor: [
    { value: 'supervisor', label: 'Supervisor' },
  ],
  supervisor: [],
};

const BRAND_REQUIRED_ROLES = new Set([
  'vendor',
  'supervisor',
]);

const INITIAL_FORM = {
  brandName: '',
  userName: '',
  mobileNumber: '',
  email: '',
  role: '',
  password: '',
  confirmPassword: '',
};

const portalLabel = (role) =>
  role === 'subadmin'
    ? 'Sub-Admin'
    : role.charAt(0).toUpperCase() + role.slice(1);

const userPageForRole = (role) => {
  if (role === 'admin') {
    return '/admin/users';
  }

  if (role === 'subadmin') {
    return '/sub-admin/users';
  }

  return '/vendor/users';
};

export default function CreateId() {
  const { user } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const roleOptions = useMemo(
    () => ROLE_OPTIONS[user.role] || [],
    [user.role]
  );

  const requiresBrand = BRAND_REQUIRED_ROLES.has(
    form.role
  );

  const selectedBrand =
    user.role === 'vendor'
      ? user.brandName || ''
      : form.brandName;

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => {
      const next = {
        ...current,
        [name]: value,
      };

      if (
        name === 'role' &&
        !BRAND_REQUIRED_ROLES.has(value)
      ) {
        next.brandName = '';
      }

      return next;
    });

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
      ...(name === 'role'
        ? { brandName: '' }
        : {}),
    }));

    setError('');
    setSuccess('');
  };

  const validate = () => {
    const errors = {};

    if (!roleOptions.some((option) => option.value === form.role)) {
      errors.role = 'Select an authorized role';
    }

    if (
      requiresBrand &&
      !BRAND_OPTIONS.includes(selectedBrand)
    ) {
      errors.brandName =
        user.role === 'vendor'
          ? 'Your Vendor account needs a valid brand assignment'
          : 'Select a brand';
    }

    if (form.userName.trim().length < 2) {
      errors.userName = 'Enter the user name';
    }

    const normalizedMobile = form.mobileNumber
      .trim()
      .replace(/[\s-]/g, '');

    if (!/^\+?[0-9]{7,15}$/.test(normalizedMobile)) {
      errors.mobileNumber = 'Enter a valid mobile number';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      errors.email = 'Enter a valid email address';
    }

    if (form.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    if (form.password !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    setFieldErrors(errors);

    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const result = await createId(
        {
          ...form,
          brandName: requiresBrand
            ? selectedBrand
            : '',
          userName: form.userName.trim(),
          mobileNumber: form.mobileNumber.trim(),
          email: form.email.trim(),
        },
        user.role
      );

      setSuccess(
        `${result.user.userName || 'User'} ID created successfully.`
      );

      setForm(INITIAL_FORM);
      setFieldErrors({});
    } catch (requestError) {
      const data = requestError.response?.data;

      if (Array.isArray(data?.errors)) {
        const errors = {};

        data.errors.forEach((item) => {
          if (item.field) {
            errors[item.field] = item.message;
          }
        });

        setFieldErrors(errors);
      }

      setError(
        data?.message ||
          requestError.message ||
          'Unable to create ID'
      );
    } finally {
      setBusy(false);
    }
  };

  if (roleOptions.length === 0) {
    return (
      <section className="space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            {portalLabel(user.role)}
          </p>
          <h2 className="text-2xl font-bold sm:text-3xl text-slate-900">
            Create ID
          </h2>
        </div>

        <div className="max-w-2xl rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Your role does not have permission to create user IDs.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          {portalLabel(user.role)}
        </p>

        <h2 className="text-2xl font-bold sm:text-3xl text-slate-900">
          Create ID
        </h2>

        <p className="mt-2 text-slate-500">
          Vendor and Supervisor IDs are always assigned to one brand.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            <p>{success}</p>

            <Link
              to={userPageForRole(user.role)}
              className="mt-1 inline-block font-semibold underline"
            >
              View User
            </Link>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Role"
            error={fieldErrors.role}
          >
            <select
              name="role"
              value={form.role}
              onChange={handleChange}
              className={inputClass(fieldErrors.role)}
            >
              <option value="">Select role</option>

              {roleOptions.map((role) => (
                <option
                  key={role.value}
                  value={role.value}
                >
                  {role.label}
                </option>
              ))}
            </select>
          </Field>

          {requiresBrand ? (
            <Field
              label="Brand"
              error={fieldErrors.brandName}
            >
              {user.role === 'vendor' ? (
                <input
                  type="text"
                  readOnly
                  value={selectedBrand || 'No brand assigned'}
                  className={inputClass(fieldErrors.brandName)}
                />
              ) : (
                <select
                  name="brandName"
                  value={form.brandName}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.brandName)}
                >
                  <option value="">Select brand</option>

                  {BRAND_OPTIONS.map((brand) => (
                    <option
                      key={brand}
                      value={brand}
                    >
                      {brand}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <div />
          )}

          <Field
            label="User Name"
            error={fieldErrors.userName}
          >
            <input
              type="text"
              name="userName"
              value={form.userName}
              onChange={handleChange}
              placeholder="Enter user name"
              className={inputClass(fieldErrors.userName)}
            />
          </Field>

          <Field
            label="Mobile Number"
            error={fieldErrors.mobileNumber}
          >
            <input
              type="tel"
              name="mobileNumber"
              value={form.mobileNumber}
              onChange={handleChange}
              placeholder="Enter mobile number"
              className={inputClass(fieldErrors.mobileNumber)}
            />
          </Field>

          <Field
            label="Gmail / Email ID"
            error={fieldErrors.email}
          >
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="Enter email address"
              className={inputClass(fieldErrors.email)}
            />
          </Field>

          <div />

          <Field
            label="Password"
            error={fieldErrors.password}
          >
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Create password"
              autoComplete="new-password"
              className={inputClass(fieldErrors.password)}
            />
          </Field>

          <Field
            label="Confirm Password"
            error={fieldErrors.confirmPassword}
          >
            <input
              type="password"
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              placeholder="Re-enter password"
              autoComplete="new-password"
              className={inputClass(fieldErrors.confirmPassword)}
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Creating ID...' : 'Create ID'}
          </button>
        </div>
      </form>
    </section>
  );
}

function Field({
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
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
  }`;
}
