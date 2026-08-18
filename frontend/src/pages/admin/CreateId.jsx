import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createId,
} from '../../services/adminService';

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

export default function CreateId() {
  const [form, setForm] =
    useState(INITIAL_FORM);

  const [
    fieldErrors,
    setFieldErrors,
  ] = useState({});

  const [error, setError] =
    useState('');

  const [success, setSuccess] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

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

  const validate = () => {
    const errors = {};

    if (
      !COMPANY_OPTIONS.includes(
        form.companyName
      )
    ) {
      errors.companyName =
        'Select a company';
    }

    if (
      form.userName.trim().length < 2
    ) {
      errors.userName =
        'Enter the user name';
    }

    const normalizedMobile =
      form.mobileNumber
        .trim()
        .replace(/[\s-]/g, '');

    if (
      !/^\+?[0-9]{7,15}$/.test(
        normalizedMobile
      )
    ) {
      errors.mobileNumber =
        'Enter a valid mobile number';
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
        form.email.trim()
      )
    ) {
      errors.email =
        'Enter a valid email address';
    }

    if (
      !ROLE_OPTIONS.some(
        (option) =>
          option.value === form.role
      )
    ) {
      errors.role =
        'Select a role';
    }

    if (
      form.password.length < 8
    ) {
      errors.password =
        'Password must be at least 8 characters';
    }

    if (
      form.password !==
      form.confirmPassword
    ) {
      errors.confirmPassword =
        'Passwords do not match';
    }

    setFieldErrors(errors);

    return (
      Object.keys(errors).length === 0
    );
  };

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!validate()) {
      return;
    }

    setBusy(true);

    try {
      const result =
        await createId({
          ...form,
          userName:
            form.userName.trim(),
          mobileNumber:
            form.mobileNumber.trim(),
          email:
            form.email.trim(),
        });

      setSuccess(
        `${
          result.user.userName ||
          'User'
        } ID created successfully.`
      );

      setForm(INITIAL_FORM);
      setFieldErrors({});
    } catch (requestError) {
      const data =
        requestError.response?.data;

      if (
        Array.isArray(data?.errors)
      ) {
        const errors = {};

        data.errors.forEach(
          (item) => {
            if (item.field) {
              errors[item.field] =
                item.message;
            }
          }
        );

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

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
          Admin
        </p>

        <h2 className="text-3xl font-bold text-slate-900">
          Create ID
        </h2>

        <p className="mt-2 text-slate-500">
          Create login credentials for
          a Vendor, Sub-Admin, or
          Supervisor.
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
            <p>
              {success}
            </p>

            <Link
              to="/admin/active-ids"
              className="mt-1 inline-block font-semibold underline"
            >
              View Active IDs
            </Link>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2">
          <Field
            label="Company Name"
            error={
              fieldErrors.companyName
            }
          >
            <select
              name="companyName"
              value={
                form.companyName
              }
              onChange={
                handleChange
              }
              className={inputClass(
                fieldErrors.companyName
              )}
            >
              <option value="">
                Select company
              </option>

              {COMPANY_OPTIONS.map(
                (company) => (
                  <option
                    key={company}
                    value={company}
                  >
                    {company}
                  </option>
                )
              )}
            </select>
          </Field>

          <Field
            label="User Name"
            error={
              fieldErrors.userName
            }
          >
            <input
              type="text"
              name="userName"
              value={form.userName}
              onChange={
                handleChange
              }
              placeholder="Enter user name"
              className={inputClass(
                fieldErrors.userName
              )}
            />
          </Field>

          <Field
            label="Mobile Number"
            error={
              fieldErrors.mobileNumber
            }
          >
            <input
              type="tel"
              name="mobileNumber"
              value={
                form.mobileNumber
              }
              onChange={
                handleChange
              }
              placeholder="Enter mobile number"
              className={inputClass(
                fieldErrors.mobileNumber
              )}
            />
          </Field>

          <Field
            label="Gmail / Email ID"
            error={
              fieldErrors.email
            }
          >
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={
                handleChange
              }
              placeholder="Enter email address"
              className={inputClass(
                fieldErrors.email
              )}
            />
          </Field>

          <Field
            label="Role"
            error={
              fieldErrors.role
            }
          >
            <select
              name="role"
              value={form.role}
              onChange={
                handleChange
              }
              className={inputClass(
                fieldErrors.role
              )}
            >
              <option value="">
                Select role
              </option>

              {ROLE_OPTIONS.map(
                (role) => (
                  <option
                    key={
                      role.value
                    }
                    value={
                      role.value
                    }
                  >
                    {role.label}
                  </option>
                )
              )}
            </select>
          </Field>

          <div />

          <Field
            label="Password"
            error={
              fieldErrors.password
            }
          >
            <input
              type="password"
              name="password"
              value={
                form.password
              }
              onChange={
                handleChange
              }
              placeholder="Create password"
              autoComplete="new-password"
              className={inputClass(
                fieldErrors.password
              )}
            />
          </Field>

          <Field
            label="Confirm Password"
            error={
              fieldErrors.confirmPassword
            }
          >
            <input
              type="password"
              name="confirmPassword"
              value={
                form.confirmPassword
              }
              onChange={
                handleChange
              }
              placeholder="Re-enter password"
              autoComplete="new-password"
              className={inputClass(
                fieldErrors.confirmPassword
              )}
            />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-blue-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? 'Creating ID...'
              : 'Create ID'}
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
      : 'border-slate-300 focus:border-blue-600 focus:ring-blue-100'
  }`;
}