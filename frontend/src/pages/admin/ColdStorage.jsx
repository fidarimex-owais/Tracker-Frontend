import { useEffect, useMemo, useState } from 'react';
import LocationAutocomplete from '../../components/LocationAutocomplete';
import { getVendorOptions } from '../../services/adminService';
import {
  createColdStorage,
  deleteColdStorage,
  getColdStorages,
  updateColdStorage,
  updateColdStorageStatus,
} from '../../services/coldStorageService';

const INITIAL_FORM = {
  name: '',
  vendorId: '',
  address: '',
  location: null,
};

export default function ColdStorage() {
  const [vendors, setVendors] = useState([]);
  const [coldStorages, setColdStorages] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState('');

  const activeVendors = useMemo(
    () => vendors.filter((vendor) => vendor.id),
    [vendors]
  );

  const loadData = async () => {
    setLoading(true);
    setError('');

    try {
      const [vendorResult, storageResult] = await Promise.all([
        getVendorOptions(),
        getColdStorages({ includeInactive: true }),
      ]);

      setVendors(vendorResult.vendors || []);
      setColdStorages(storageResult.coldStorages || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load Cold Storage data'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setEditingId('');
    setFieldErrors({});
  };

  const validate = () => {
    const errors = {};

    if (form.name.trim().length < 2) {
      errors.name = 'Enter the Cold Storage name';
    }

    if (!form.vendorId) {
      errors.vendorId = 'Select an active Vendor';
    }

    if (!form.address.trim() || !form.location) {
      errors.address =
        'Search and select a Cold Storage address/location from Geoapify';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!validate()) return;

    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        vendorId: form.vendorId,
        address: form.address.trim(),
        location: form.location,
      };

      const result = editingId
        ? await updateColdStorage(editingId, payload)
        : await createColdStorage(payload);

      setSuccess(
        editingId
          ? 'Cold Storage updated successfully.'
          : 'Cold Storage added successfully.'
      );

      resetForm();
      await loadData();

      if (result?.coldStorage) {
        setSuccess(
          editingId
            ? 'Cold Storage updated successfully.'
            : 'Cold Storage added successfully.'
        );
      }
    } catch (requestError) {
      const data = requestError.response?.data;

      if (Array.isArray(data?.errors)) {
        const nextErrors = {};
        data.errors.forEach((item) => {
          if (item.field) nextErrors[item.field] = item.message;
        });
        setFieldErrors(nextErrors);
      }

      setError(
        data?.message ||
          requestError.message ||
          'Unable to save Cold Storage'
      );
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (storage) => {
    setEditingId(storage.id);
    setForm({
      name: storage.name,
      vendorId: storage.vendorId,
      address: storage.address,
      location: storage.location,
    });
    setFieldErrors({});
    setError('');
    setSuccess('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatus = async (storage) => {
    setBusyId(storage.id);
    setError('');
    setSuccess('');

    try {
      await updateColdStorageStatus(storage.id, !storage.isActive);
      setSuccess(
        storage.isActive
          ? 'Cold Storage deactivated.'
          : 'Cold Storage activated.'
      );
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to update Cold Storage status'
      );
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (storage) => {
    const confirmed = window.confirm(
      `Delete Cold Storage "${storage.name}"?\n\nExisting QR records will keep their saved Cold Storage snapshot, but this facility will no longer be selectable.`
    );

    if (!confirmed) return;

    setBusyId(storage.id);
    setError('');
    setSuccess('');

    try {
      await deleteColdStorage(storage.id);
      if (editingId === storage.id) resetForm();
      setSuccess('Cold Storage deleted.');
      await loadData();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to delete Cold Storage'
      );
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-orange-600">
            Admin
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Cold Storage
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            Register Cold Storage facilities, assign them to active Vendors,
            and manage which facilities are available in Generate QR.
          </p>
        </div>

        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          Refresh
        </button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900">
                {editingId ? 'Edit Cold Storage' : 'Add Cold Storage'}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Location coordinates are captured from the selected Geoapify suggestion.
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs font-bold text-slate-500 hover:text-slate-800"
              >
                Cancel edit
              </button>
            )}
          </div>

          <div className="mt-5 space-y-4">
            <Field label="Cold Storage Name" required error={fieldErrors.name}>
              <input
                type="text"
                value={form.name}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }));
                  setFieldErrors((current) => ({ ...current, name: '' }));
                }}
                placeholder="Enter Cold Storage name"
                className={inputClass(fieldErrors.name)}
              />
            </Field>

            <Field label="Active Vendor" required error={fieldErrors.vendorId}>
              <select
                value={form.vendorId}
                onChange={(event) => {
                  setForm((current) => ({
                    ...current,
                    vendorId: event.target.value,
                  }));
                  setFieldErrors((current) => ({ ...current, vendorId: '' }));
                }}
                className={inputClass(fieldErrors.vendorId)}
              >
                <option value="">Select active Vendor</option>
                {activeVendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.userName}
                    {vendor.companyName ? ` — ${vendor.companyName}` : ''}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Cold Storage Address / Location"
              required
              error={fieldErrors.address || fieldErrors.location}
            >
              <LocationAutocomplete
                value={form.address}
                onInputChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    address: value,
                    location: null,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    address: '',
                    location: '',
                  }));
                }}
                onSelect={(suggestion) => {
                  setForm((current) => ({
                    ...current,
                    address: suggestion.formatted,
                    location: {
                      latitude: suggestion.latitude,
                      longitude: suggestion.longitude,
                      placeId: suggestion.placeId,
                    },
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    address: '',
                    location: '',
                  }));
                }}
                placeholder="Search Cold Storage address"
                error={fieldErrors.address || fieldErrors.location}
                hasSelection={Boolean(form.location)}
              />
            </Field>

            {form.location && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Coordinates: {form.location.latitude.toFixed(6)}, {' '}
                {form.location.longitude.toFixed(6)}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="mt-5 w-full rounded-lg bg-orange-500 px-4 py-3 text-sm font-extrabold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving
              ? 'Saving…'
              : editingId
                ? 'Update Cold Storage'
                : 'Add Cold Storage'}
          </button>
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-extrabold text-slate-900">
                  Manage Cold Storage
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Active facilities are selectable during QR generation.
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                {coldStorages.length}
              </span>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Loading Cold Storage facilities…
              </p>
            ) : coldStorages.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No Cold Storage facilities have been added yet.
              </p>
            ) : (
              coldStorages.map((storage) => (
                <article key={storage.id} className="px-4 py-4 sm:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-extrabold text-slate-900">
                          {storage.name}
                        </h4>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                            storage.isActive
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {storage.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {!storage.vendorActive && (
                          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-extrabold uppercase text-red-600">
                            Vendor inactive
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-sm font-semibold text-slate-700">
                        {storage.vendorName}
                        {storage.vendorCompanyName
                          ? ` — ${storage.vendorCompanyName}`
                          : ''}
                      </p>

                      <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                        {storage.address}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(storage)}
                        disabled={busyId === storage.id}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatus(storage)}
                        disabled={busyId === storage.id}
                        className="rounded-lg border border-orange-300 px-3 py-1.5 text-xs font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-50"
                      >
                        {storage.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(storage)}
                        disabled={busyId === storage.id}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({ label, required, error, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-bold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
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

const inputClass = (error) =>
  `w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:ring-2 ${
    error
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
  }`;
