// frontend/src/pages/auth/Signup.jsx

import { useEffect, useState } from 'react';
import {
  Link,
  Navigate,
} from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { roleHome } from '../../auth/roleHome';
import { getVendorOptions } from '../../services/adminService';
import {
  filesToIdentityPayload,
  formatBytes,
  isValidAadhaar,
  isValidPan,
  normalizeAadhaar,
  normalizePan,
  validateIdentityFiles,
} from '../../utils/identityRegistration';
import {
  Alert,
  AuthField,
  AuthShell,
  PasswordVisibilityButton,
  inputClass,
} from './Login';

const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

const PUBLIC_SIGNUP_ROLE = 'supervisor';

const INITIAL_FORM = {
  vendorId: '',
  userName: '',
  mobileNumber: '',
  email: '',
  panNumber: '',
  aadhaarNumber: '',
  password: '',
  confirmPassword: '',
};

const isValidGmail = (email) =>
  EMAIL_RE.test(email) && email.endsWith('@gmail.com');

export default function Signup() {
  const { user, signup } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [documents, setDocuments] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
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
  }, []);

  if (user) {
    return (
      <Navigate
        to={roleHome(user.role)}
        replace
      />
    );
  }

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
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
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
  };

  const submit = async (event) => {
    event.preventDefault();

    const email = form.email.trim().toLowerCase();
    const errors = {};

    if (!form.vendorId) {
      errors.vendorId = 'Select a Vendor';
    }

    if (form.userName.trim().length < 2) {
      errors.userName = 'Enter your full name';
    }

    const normalizedMobile = form.mobileNumber
      .trim()
      .replace(/[\s-]/g, '');

    if (!/^\+?[0-9]{7,15}$/.test(normalizedMobile)) {
      errors.mobileNumber = 'Enter a valid mobile number';
    }

    if (!isValidGmail(email)) {
      errors.email = 'Please enter a valid Gmail address.';
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

    if (!termsAccepted) {
      errors.termsAccepted =
        'You must agree to the Terms & Conditions before registering.';
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
      const documentPayload = await filesToIdentityPayload(documents);
      const result = await signup({
        vendorId: form.vendorId,
        userName: form.userName.trim(),
        mobileNumber: normalizedMobile,
        email,
        panNumber: normalizePan(form.panNumber),
        aadhaarNumber: normalizeAadhaar(form.aadhaarNumber),
        password: form.password,
        confirmPassword: form.confirmPassword,
        documents: documentPayload,
        role: PUBLIC_SIGNUP_ROLE,
        termsAccepted,
      });

      setSuccess(
        result.message ||
          'Registration request submitted. You can login after your request is approved.'
      );

      setForm(INITIAL_FORM);
      setShowPassword(false);
      setShowConfirmPassword(false);
      setTermsAccepted(false);
      setDocuments([]);
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
      title="Supervisor Register"
      subtitle="Create your Supervisor account by filling in the details below."
    >
      <form
        onSubmit={submit}
        noValidate
        className="space-y-3"
      >
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600 sm:text-sm">
          Public registration is available only for Supervisors. Vendor and
          Sub-Admin IDs are created through the authorized portal workflow.
        </div>

        {error && <Alert>{error}</Alert>}

        {success && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs leading-5 text-green-700 sm:text-sm">
            <p className="font-bold">
              Registration request sent successfully.
            </p>
            <p className="mt-1">{success}</p>
            <Link
              to="/login?role=supervisor"
              className="mt-1 inline-block font-bold underline"
            >
              Back to Supervisor Login
            </Link>
          </div>
        )}

        <AuthField label="Role">
          <div className="relative">
            <FieldIcon type="role" />
            <input
              type="text"
              value="Supervisor"
              readOnly
              aria-readonly="true"
              className={`${inputClass(false)} cursor-not-allowed bg-slate-50 font-medium`}
            />
          </div>
        </AuthField>

        <AuthField
          label="Vendor"
          error={fieldErrors.vendorId}
        >
          <div className="relative">
            <FieldIcon type="vendor" />
            <select
              required
              name="vendorId"
              value={form.vendorId}
              onChange={handleChange}
              disabled={vendorsLoading}
              className={inputClass(fieldErrors.vendorId)}
            >
              <option value="">
                {vendorsLoading ? 'Loading Vendors...' : 'Select Vendor'}
              </option>
              {vendors.map((vendor) => (
                <option
                  key={vendor.id}
                  value={vendor.id}
                >
                  {vendor.userName}
                  {vendor.companyName ? ` — ${vendor.companyName}` : ''}
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
            label="PAN Card Number"
            error={fieldErrors.panNumber}
          >
            <input
              required
              type="text"
              name="panNumber"
              maxLength="10"
              autoComplete="off"
              value={form.panNumber}
              onChange={handleChange}
              placeholder="ABCDE1234F"
              className={inputClass(fieldErrors.panNumber, true)}
            />
          </AuthField>

          <AuthField
            label="Aadhaar Card Number"
            error={fieldErrors.aadhaarNumber}
          >
            <input
              required
              type="text"
              inputMode="numeric"
              name="aadhaarNumber"
              maxLength="12"
              autoComplete="off"
              value={form.aadhaarNumber}
              onChange={handleChange}
              placeholder="12-digit Aadhaar number"
              className={inputClass(fieldErrors.aadhaarNumber, true)}
            />
          </AuthField>
        </div>

        <AuthField
          label="Additional Documents (Optional)"
          error={fieldErrors.documents}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            onChange={handleDocumentsChange}
            className="identity-file-input block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 sm:text-sm"
          />
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            Up to 5 PDF/JPG/PNG files. Each file must be 1 KB to 100 KB. PAN,
            Aadhaar, and documents are visible only to Admin users after submission.
          </p>
          {documents.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {documents.map((file) => (
                <span
                  key={`${file.name}-${file.size}`}
                  className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600"
                >
                  {file.name} · {formatBytes(file.size)}
                </span>
              ))}
            </div>
          )}
        </AuthField>

        <div className="mt-1 grid gap-4 sm:grid-cols-2">
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

        <div>
          <label className="flex items-start gap-2 text-xs text-slate-600 sm:text-sm">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => {
                setTermsAccepted(event.target.checked);
                setFieldErrors((current) => ({
                  ...current,
                  termsAccepted: '',
                }));
                setError('');
              }}
              aria-invalid={Boolean(fieldErrors.termsAccepted)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-orange-500"
            />
            <span>
              I agree to the{' '}
              <span className="font-semibold text-orange-600">
                Terms & Conditions
              </span>
            </span>
          </label>

          {fieldErrors.termsAccepted && (
            <p className="mt-1 text-[11px] font-semibold leading-4 text-red-600">
              {fieldErrors.termsAccepted}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={busy || !termsAccepted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
        >
          <RegisterIcon />
          {busy ? 'Sending Request...' : 'Register'}
        </button>

        <p className="text-center text-xs text-slate-600 sm:text-sm">
          Already have an account?{' '}
          <Link
            to="/login?role=supervisor"
            className="font-bold text-orange-600 hover:text-orange-700"
          >
            Login
          </Link>
        </p>
      </form>
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
      {type === 'vendor' && (
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
