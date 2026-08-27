// frontend/src/pages/admin/CreateId.jsx

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import {
  createId,
  getVendorOptions,
} from '../../services/adminService';
import {
  filesToIdentityPayload,
  formatBytes,
  isValidAadhaar,
  isValidPan,
  normalizeAadhaar,
  normalizePan,
  validateIdentityFiles,
} from '../../utils/identityRegistration';

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

const INITIAL_FORM = {
  vendorId: '',
  userName: '',
  mobileNumber: '',
  email: '',
  panNumber: '',
  aadhaarNumber: '',
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
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const roleOptions = useMemo(
    () => ROLE_OPTIONS[user.role] || [],
    [user.role]
  );

  const isSupervisor = form.role === 'supervisor';
  const needsVendorDropdown =
    isSupervisor && user.role !== 'vendor';

  useEffect(() => {
    if (!needsVendorDropdown) {
      return;
    }

    let active = true;
    setVendorsLoading(true);

    getVendorOptions()
      .then((result) => {
        if (active) {
          setVendors(result.vendors || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load Vendors'
          );
        }
      })
      .finally(() => {
        if (active) {
          setVendorsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [needsVendorDropdown]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'panNumber'
        ? normalizePan(value)
        : name === 'aadhaarNumber'
          ? normalizeAadhaar(value)
          : value;

    setForm((current) => ({
      ...current,
      [name]: nextValue,
      ...(name === 'role' && value !== 'supervisor'
        ? { vendorId: '' }
        : {}),
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
      ...(name === 'role' ? { vendorId: '' } : {}),
    }));

    setError('');
    setSuccess('');
  };

  const handleDocumentsChange = (event) => {
    const nextDocuments = Array.from(event.target.files || []);
    const documentError = validateIdentityFiles(nextDocuments);

    if (documentError) {
      setDocuments([]);
      setFieldErrors((current) => ({
        ...current,
        documents: documentError,
      }));
      event.target.value = '';
      return;
    }

    setDocuments(nextDocuments);
    setFieldErrors((current) => ({
      ...current,
      documents: '',
    }));
    setError('');
    setSuccess('');
  };

  const validate = () => {
    const errors = {};

    if (!roleOptions.some((option) => option.value === form.role)) {
      errors.role = 'Select an authorized role';
    }

    if (needsVendorDropdown && !form.vendorId) {
      errors.vendorId = 'Select a Vendor';
    }

    if (form.userName.trim().length < 2) {
      errors.userName = 'Enter the full name';
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

    if (!isValidPan(form.panNumber)) {
      errors.panNumber = 'Enter a valid PAN number (for example ABCDE1234F)';
    }

    if (!isValidAadhaar(form.aadhaarNumber)) {
      errors.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number';
    }

    const documentError = validateIdentityFiles(documents);
    if (documentError) {
      errors.documents = documentError;
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
      const documentPayload = await filesToIdentityPayload(documents);
      const result = await createId(
        {
          vendorId:
            isSupervisor && user.role !== 'vendor'
              ? form.vendorId
              : '',
          userName: form.userName.trim(),
          mobileNumber: form.mobileNumber.trim(),
          email: form.email.trim(),
          panNumber: normalizePan(form.panNumber),
          aadhaarNumber: normalizeAadhaar(form.aadhaarNumber),
          documents: documentPayload,
          role: form.role,
          password: form.password,
          confirmPassword: form.confirmPassword,
        },
        user.role
      );

      setSuccess(
        `${result.user.userName || 'User'} ID created successfully.`
      );

      setForm(INITIAL_FORM);
      setDocuments([]);
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
          Vendor IDs are brand-independent. Supervisor IDs are assigned directly to a Vendor.
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

          {isSupervisor ? (
            <Field
              label="Vendor"
              error={fieldErrors.vendorId}
            >
              {user.role === 'vendor' ? (
                <input
                  type="text"
                  readOnly
                  value={user.userName || 'Current Vendor'}
                  className={inputClass(fieldErrors.vendorId)}
                />
              ) : (
                <select
                  name="vendorId"
                  value={form.vendorId}
                  onChange={handleChange}
                  disabled={vendorsLoading}
                  className={inputClass(fieldErrors.vendorId)}
                >
                  <option value="">
                    {vendorsLoading
                      ? 'Loading Vendors...'
                      : 'Select Vendor'}
                  </option>

                  {vendors.map((vendor) => (
                    <option
                      key={vendor.id}
                      value={vendor.id}
                    >
                      {vendor.userName}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            <div />
          )}

          <Field
            label="Full Name"
            error={fieldErrors.userName}
          >
            <input
              type="text"
              name="userName"
              value={form.userName}
              onChange={handleChange}
              placeholder="Enter full name"
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

          <Field
            label="PAN Card Number"
            error={fieldErrors.panNumber}
          >
            <input
              type="text"
              name="panNumber"
              maxLength="10"
              autoComplete="off"
              value={form.panNumber}
              onChange={handleChange}
              placeholder="ABCDE1234F"
              className={inputClass(fieldErrors.panNumber)}
            />
          </Field>

          <Field
            label="Aadhaar Card Number"
            error={fieldErrors.aadhaarNumber}
          >
            <input
              type="text"
              inputMode="numeric"
              name="aadhaarNumber"
              maxLength="12"
              autoComplete="off"
              value={form.aadhaarNumber}
              onChange={handleChange}
              placeholder="12-digit Aadhaar number"
              className={inputClass(fieldErrors.aadhaarNumber)}
            />
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Additional Documents (Optional)"
              error={fieldErrors.documents}
            >
              <input
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                onChange={handleDocumentsChange}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:font-semibold file:text-orange-700"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Up to 5 PDF/JPG/PNG files, 1 KB to 100 KB each. Identity data and documents are available only to Admin users after creation.
              </span>
              {documents.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {documents.map((file) => (
                    <span
                      key={`${file.name}-${file.size}`}
                      className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600"
                    >
                      {file.name} · {formatBytes(file.size)}
                    </span>
                  ))}
                </div>
              )}
            </Field>
          </div>

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
            disabled={busy || vendorsLoading}
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
