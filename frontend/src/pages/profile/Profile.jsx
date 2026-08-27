// frontend/src/pages/profile/Profile.jsx

import { useEffect, useMemo, useRef, useState } from 'react';

import { useAuth } from '../../auth/useAuth';
import { updateMyProfile } from '../../services/profileService';

const MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_SIZE = 512;

const roleLabel = (role) =>
  role === 'subadmin'
    ? 'Sub-Admin'
    : role.charAt(0).toUpperCase() + role.slice(1);

const initialsFor = (name, email) => {
  const source = String(name || '').trim();

  if (source) {
    const parts = source.split(/\s+/).filter(Boolean);

    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  return String(email || 'U')
    .charAt(0)
    .toUpperCase();
};

const compressProfilePicture = (file) =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Select a valid image file.'));
      return;
    }

    if (file.size > MAX_SOURCE_FILE_BYTES) {
      reject(new Error('Select an image smaller than 8 MB.'));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      try {
        const sourceSize = Math.min(
          image.naturalWidth,
          image.naturalHeight
        );

        const sourceX =
          (image.naturalWidth - sourceSize) / 2;
        const sourceY =
          (image.naturalHeight - sourceSize) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error(
            'Unable to prepare the profile picture.'
          );
        }

        context.drawImage(
          image,
          sourceX,
          sourceY,
          sourceSize,
          sourceSize,
          0,
          0,
          AVATAR_SIZE,
          AVATAR_SIZE
        );

        const dataUrl = canvas.toDataURL(
          'image/webp',
          0.82
        );

        resolve(dataUrl);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Unable to read that image.'));
    };

    image.src = objectUrl;
  });

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const fileInputRef = useRef(null);

  const savedFullName =
    user.fullName || user.userName || '';

  const [fullName, setFullName] = useState(savedFullName);
  const [mobileNumber, setMobileNumber] = useState(
    user.mobileNumber || ''
  );
  const [profilePicture, setProfilePicture] = useState(
    user.profilePicture || ''
  );

  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setFullName(user.fullName || user.userName || '');
    setMobileNumber(user.mobileNumber || '');
    setProfilePicture(user.profilePicture || '');
  }, [user]);

  const displayName =
    savedFullName || `${roleLabel(user.role)} Profile`;

  const initials = useMemo(
    () =>
      initialsFor(
        savedFullName || roleLabel(user.role),
        user.email
      ),
    [savedFullName, user.email, user.role]
  );

  const cancelEditing = () => {
    setFullName(user.fullName || user.userName || '');
    setMobileNumber(user.mobileNumber || '');
    setProfilePicture(user.profilePicture || '');
    setFieldErrors({});
    setError('');
    setSuccess('');
    setEditing(false);
  };

  const handleImageSelection = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    setImageBusy(true);
    setError('');
    setFieldErrors((current) => ({
      ...current,
      profilePicture: '',
    }));

    try {
      const compressed =
        await compressProfilePicture(file);
      setProfilePicture(compressed);
    } catch (imageError) {
      setFieldErrors((current) => ({
        ...current,
        profilePicture: imageError.message,
      }));
    } finally {
      setImageBusy(false);
    }
  };

  const validate = () => {
    const errors = {};
    const normalizedMobile = mobileNumber
      .trim()
      .replace(/[\s-]/g, '');

    if (fullName.trim().length < 2) {
      errors.fullName = 'Enter your full name';
    }

    if (!/^\+?[0-9]{7,15}$/.test(normalizedMobile)) {
      errors.mobileNumber = 'Enter a valid phone number';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setBusy(true);

    try {
      const result = await updateMyProfile({
        fullName: fullName.trim(),
        mobileNumber: mobileNumber
          .trim()
          .replace(/[\s-]/g, ''),
        profilePicture,
      });

      await refreshUser();
      setSuccess(
        result.message || 'Profile updated successfully'
      );
      setEditing(false);
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
          'Unable to update profile'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0 space-y-5">
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}
      >
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600">
            Account
          </p>

          <h2 className="mt-1 text-2xl font-extrabold text-slate-950 sm:text-3xl">
            My Profile
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Your portal identity and contact information.
          </p>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={() => {
              setError('');
              setSuccess('');
              setEditing(true);
            }}
            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-orange-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-orange-600"
          >
            Edit Profile
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form
        onSubmit={saveProfile}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div
          className="border-b border-slate-200 bg-slate-50"
          style={{
            padding: '24px',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '24px',
              width: '100%',
            }}
          >
            <div
              style={{
                flex: '0 0 112px',
                width: '112px',
                height: '112px',
              }}
            >
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt="Profile"
                  style={{
                    display: 'block',
                    width: '112px',
                    height: '112px',
                    minWidth: '112px',
                    minHeight: '112px',
                    maxWidth: '112px',
                    maxHeight: '112px',
                    borderRadius: '9999px',
                    objectFit: 'cover',
                    border: '2px solid rgba(148, 163, 184, 0.35)',
                  }}
                />
              ) : (
                <div
                  className="bg-orange-100 text-orange-700"
                  style={{
                    display: 'flex',
                    width: '112px',
                    height: '112px',
                    minWidth: '112px',
                    minHeight: '112px',
                    maxWidth: '112px',
                    maxHeight: '112px',
                    borderRadius: '9999px',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '30px',
                    fontWeight: 800,
                    border: '2px solid rgba(148, 163, 184, 0.35)',
                  }}
                >
                  {initials}
                </div>
              )}
            </div>

            <div
              style={{
                flex: '1 1 280px',
                minWidth: 0,
              }}
            >
              <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
                {roleLabel(user.role)}
              </p>

              <h3 className="mt-1 break-words text-xl font-extrabold text-slate-950 sm:text-2xl">
                {displayName}
              </h3>

              <p className="mt-1 break-all text-sm text-slate-500">
                {user.email}
              </p>

              {!savedFullName && !editing && (
                <p className="mt-2 text-xs text-slate-400">
                  Add your full name and phone number to complete your profile.
                </p>
              )}

              {editing && (
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    marginTop: '16px',
                  }}
                >
                  <button
                    type="button"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                    disabled={imageBusy}
                    className="inline-flex min-h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                  >
                    {imageBusy
                      ? 'Preparing Image...'
                      : profilePicture
                        ? 'Change Picture'
                        : 'Add Picture'}
                  </button>

                  {profilePicture && (
                    <button
                      type="button"
                      onClick={() =>
                        setProfilePicture('')
                      }
                      disabled={imageBusy}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove Picture
                    </button>
                  )}
                </div>
              )}

              {fieldErrors.profilePicture && (
                <p className="mt-2 text-xs font-semibold text-red-600">
                  {fieldErrors.profilePicture}
                </p>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleImageSelection}
            className="hidden"
          />
        </div>

        <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-2">
          <ProfileField
            label="Full Name"
            error={fieldErrors.fullName}
          >
            {editing ? (
              <input
                type="text"
                value={fullName}
                onChange={(event) => {
                  setFullName(event.target.value);
                  setFieldErrors((current) => ({
                    ...current,
                    fullName: '',
                  }));
                }}
                maxLength={80}
                autoComplete="name"
                className={inputClass(
                  Boolean(fieldErrors.fullName)
                )}
                placeholder="Enter full name"
              />
            ) : (
              <ReadOnlyValue
                value={savedFullName || 'Not provided'}
              />
            )}
          </ProfileField>

          <ProfileField
            label="Phone Number"
            error={fieldErrors.mobileNumber}
          >
            {editing ? (
              <input
                type="tel"
                value={mobileNumber}
                onChange={(event) => {
                  setMobileNumber(event.target.value);
                  setFieldErrors((current) => ({
                    ...current,
                    mobileNumber: '',
                  }));
                }}
                autoComplete="tel"
                className={inputClass(
                  Boolean(fieldErrors.mobileNumber)
                )}
                placeholder="Enter phone number"
              />
            ) : (
              <ReadOnlyValue
                value={user.mobileNumber || 'Not provided'}
              />
            )}
          </ProfileField>

          <ProfileField label="Email ID">
            <ReadOnlyValue value={user.email} />
          </ProfileField>

          <ProfileField label="Profile ID">
            <ReadOnlyValue
              value={user.profileId || '—'}
              mono
            />
          </ProfileField>

          <ProfileField label="Role">
            <ReadOnlyValue
              value={roleLabel(user.role)}
            />
          </ProfileField>

          <ProfileField
            label={
              user.role === 'supervisor'
                ? 'Assigned Vendor'
                : 'Vendor Assignment'
            }
          >
            <ReadOnlyValue
              value={
                user.role === 'supervisor'
                  ? user.vendorName || 'Unassigned'
                  : 'Not applicable'
              }
            />
          </ProfileField>
        </div>

        {editing && (
          <div
            className="border-t border-slate-200 bg-slate-50"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              gap: '8px',
              padding: '16px 24px',
            }}
          >
            <button
              type="button"
              onClick={cancelEditing}
              disabled={busy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy || imageBusy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-orange-500 px-4 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        )}
      </form>
    </section>
  );
}

const inputClass = (hasError) =>
  `min-h-11 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 outline-none transition ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-slate-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
  }`;

function ProfileField({ label, error, children }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {label}
      </span>

      {children}

      {error && (
        <span className="mt-1 block text-xs font-semibold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function ReadOnlyValue({ value, mono = false }) {
  return (
    <div
      className={`min-h-11 break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-800 ${
        mono ? 'font-mono text-xs' : ''
      }`}
    >
      {value}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 5 13 3h-2L9.5 5H6a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-3.5Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
