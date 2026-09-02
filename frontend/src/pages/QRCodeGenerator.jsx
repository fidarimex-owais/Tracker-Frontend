import { useEffect, useMemo, useState } from 'react';
import {
  buildStickerDownloadUrl,
  buildStickerPrintUrl,
  createRecord,
  resolveConflict,
} from '../services/recordService';
import { getVendorOptions } from '../services/adminService';
import { getColdStorages } from '../services/coldStorageService';
import { calculateDistance } from '../services/geoService';
import LocationAutocomplete from '../components/LocationAutocomplete';
import { useAuth } from '../auth/useAuth';

const BRAND_OPTIONS = ['Hi Banana', 'Joker', 'Banana Man'];
const WEIGHT_OPTIONS = [13.5, 14];
const HAND_CATEGORIES = [4, 5, 6, 8];

const getLocalToday = () => {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60 * 1000
  );

  return localDate.toISOString().slice(0, 10);
};

const initialFormState = {
  brandName: '',
  vendorId: '',
  coldStorageId: '',
  farmerName: '',
  supervisor: '',
  lineNumber: '',
  weight: '',
  farmPlotAddress: '',
  farmPlotLocation: null,
  packageDate: '',
  quantities: { 4: '', 5: '', 6: '', 8: '' },
};

export default function QRCodeGenerator() {
  const { user } = useAuth();
  const isSubAdmin = user?.role === 'subadmin';
  const today = getLocalToday();

  const [form, setForm] = useState(initialFormState);
  const [vendors, setVendors] = useState([]);
  const [vendorsLoading, setVendorsLoading] = useState(true);
  const [coldStorages, setColdStorages] = useState([]);
  const [coldStoragesLoading, setColdStoragesLoading] = useState(false);
  const [distanceData, setDistanceData] = useState(null);
  const [distanceLoading, setDistanceLoading] = useState(false);
  const [distanceError, setDistanceError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [zips, setZips] = useState([]);
  const [lineInfo, setLineInfo] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [resolving, setResolving] = useState(false);

  const selectedVendor = useMemo(
    () => vendors.find((vendor) => vendor.id === form.vendorId) || null,
    [vendors, form.vendorId]
  );

  const selectedColdStorage = useMemo(
    () =>
      coldStorages.find(
        (storage) => storage.id === form.coldStorageId
      ) || null,
    [coldStorages, form.coldStorageId]
  );

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
          setSubmitError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load active Vendors'
          );
        }
      })
      .finally(() => {
        if (active) setVendorsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!form.vendorId) {
      setColdStorages([]);
      setColdStoragesLoading(false);
      return undefined;
    }

    let active = true;
    setColdStoragesLoading(true);

    getColdStorages({ vendorId: form.vendorId })
      .then((result) => {
        if (active) {
          setColdStorages(result.coldStorages || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setColdStorages([]);
          setSubmitError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load Cold Storage facilities'
          );
        }
      })
      .finally(() => {
        if (active) setColdStoragesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [form.vendorId]);

  useEffect(() => {
    const farmPlot = form.farmPlotLocation;

    if (!selectedColdStorage || !farmPlot) {
      setDistanceData(null);
      setDistanceError('');
      setDistanceLoading(false);
      return undefined;
    }

    let active = true;
    setDistanceLoading(true);
    setDistanceData(null);
    setDistanceError('');

    calculateDistance({
      from: selectedColdStorage.location,
      to: farmPlot,
    })
      .then((result) => {
        if (active) {
          setDistanceData(result.route || null);
        }
      })
      .catch((requestError) => {
        if (active) {
          setDistanceError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to calculate distance'
          );
        }
      })
      .finally(() => {
        if (active) setDistanceLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    selectedColdStorage,
    form.farmPlotLocation,
  ]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
      ...(name === 'vendorId'
        ? {
            coldStorageId: '',
            farmPlotAddress: '',
            farmPlotLocation: null,
          }
        : {}),
      ...(name === 'coldStorageId'
        ? {
            farmPlotAddress: '',
            farmPlotLocation: null,
          }
        : {}),
    }));

    setFieldErrors((current) => ({
      ...current,
      [name]: '',
      ...(name === 'vendorId'
        ? {
            coldStorageId: '',
            farmPlotAddress: '',
            distance: '',
          }
        : {}),
      ...(name === 'coldStorageId'
        ? {
            farmPlotAddress: '',
            distance: '',
          }
        : {}),
    }));

    setSubmitError(null);
  };

  const handleQuantityChange = (hand, value) => {
    setForm((current) => ({
      ...current,
      quantities: {
        ...current.quantities,
        [hand]: value,
      },
    }));
  };

  const validateClientSide = () => {
    const errors = {};

    if (!form.brandName) {
      errors.brandName = 'Brand name is required';
    }

    if (!selectedVendor) {
      errors.vendorId = 'Select an active Vendor';
    }

    if (!selectedColdStorage) {
      errors.coldStorageId = 'Select an active Cold Storage';
    }

    if (!form.farmerName.trim()) {
      errors.farmerName = 'Farmer name is required';
    }

    if (!form.supervisor.trim()) {
      errors.supervisor = 'Supervisor is required';
    }

    if (form.lineNumber === '' || Number(form.lineNumber) <= 0) {
      errors.lineNumber = 'Line number must be a positive number';
    }

    if (form.weight === '' || Number(form.weight) <= 0) {
      errors.weight = 'Weight must be a positive number';
    }

    if (!form.farmPlotAddress.trim() || !form.farmPlotLocation) {
      errors.farmPlotAddress =
        'Search and select the Farm Plot address/location';
    }

    if (selectedColdStorage && form.farmPlotLocation && !distanceData) {
      errors.distance = distanceError || 'Wait for distance calculation to finish';
    }

    if (!form.packageDate) {
      errors.packageDate = 'Package date is required';
    } else if (isSubAdmin && form.packageDate < today) {
      errors.packageDate =
        'Sub-admin can generate QR codes only for today or future dates';
    }

    let anyPositive = false;

    for (const hand of HAND_CATEGORIES) {
      const raw = form.quantities[hand];
      if (raw === '') continue;

      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0) {
        errors[`quantity${hand}`] = 'Must be a non-negative whole number';
        continue;
      }

      if (num > 0) anyPositive = true;
    }

    if (!anyPositive) {
      errors.quantities =
        'Enter a quantity greater than 0 for at least one hand category';
    }

    return errors;
  };

  const buildPayload = () => {
    const quantities = {};

    for (const hand of HAND_CATEGORIES) {
      const raw = form.quantities[hand];
      quantities[hand] = raw === '' ? 0 : Number(raw);
    }

    return {
      brandName: form.brandName,
      vendorId: form.vendorId,
      coldStorageId: form.coldStorageId,
      farmerName: form.farmerName.trim(),
      supervisor: form.supervisor.trim(),
      lineNumber: Number(form.lineNumber),
      weight: Number(form.weight),
      farmPlotAddress: form.farmPlotAddress.trim(),
      farmPlotLocation: {
        latitude: form.farmPlotLocation.latitude,
        longitude: form.farmPlotLocation.longitude,
        placeId: form.farmPlotLocation.placeId || '',
      },
      packageDate: form.packageDate,
      quantities,
    };
  };

  const mapFieldErrors = (errors) => {
    const mapped = {};

    errors.forEach((fieldError) => {
      let key = fieldError.field;

      if (key.startsWith('quantities.')) {
        key = `quantity${key.replace('quantities.', '')}`;
      }

      if (key.startsWith('farmPlotLocation.')) {
        key = 'farmPlotAddress';
      }

      mapped[key] = fieldError.message;
    });

    return mapped;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitError(null);
    setZips([]);
    setConflict(null);

    const clientErrors = validateClientSide();

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    setFieldErrors({});
    setSubmitting(true);

    try {
      const result = await createRecord(buildPayload());

      setZips(result.data.categories || []);
      setLineInfo({
        brandName: result.data.brandName,
        packageDate: result.data.packageDate,
        lineNumber: result.data.lineNumber,
      });
      setForm(initialFormState);
      setColdStorages([]);
      setDistanceData(null);
      setDistanceError('');
    } catch (error) {
      if (error.isConflict) {
        setConflict(error.conflictData);
      } else {
        if (error.fieldErrors) {
          setFieldErrors(mapFieldErrors(error.fieldErrors));
        }
        setSubmitError(error.message);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = (numberOfHands) => {
    if (!lineInfo) return;
    const printUrl = buildStickerPrintUrl(lineInfo, numberOfHands);
    window.open(printUrl, '_blank', 'noopener,noreferrer');
  };

  const buildDownloadUrl = (numberOfHands) =>
    buildStickerDownloadUrl(lineInfo, numberOfHands);

  const handleResolve = async (action) => {
    if (!conflict) return;

    setResolving(true);
    setSubmitError(null);

    try {
      const result = await resolveConflict({
        brandName: conflict.brandName,
        packageDate: conflict.packageDate,
        lineNumber: conflict.lineNumber,
        action,
        payload:
          action === 'update'
            ? conflict.submittedPayload
            : undefined,
      });

      setZips(result.data.categories || []);
      setLineInfo({
        brandName: result.data.brandName,
        packageDate: result.data.packageDate,
        lineNumber: result.data.lineNumber,
      });
      setConflict(null);
    } catch (error) {
      setSubmitError(error.message);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-0 py-2 sm:px-2 sm:py-6 lg:px-4 lg:py-8">
      <div className="mb-8 text-center">
        <p className="mb-2 text-sm font-semibold tracking-wide text-green-600">
          GENERATE QR CODE
        </p>
        <h1 className="mb-3 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl">
          QR Code Generator
        </h1>
        <p className="mx-auto max-w-2xl text-slate-500">
          Select the Vendor and Cold Storage, choose the Farm Plot location,
          and the driving distance will be calculated automatically before QR generation.
        </p>
      </div>

      {submitError && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      {conflict && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-800">
          <p className="mb-1 font-semibold">This data already exists.</p>
          <p className="mb-3">
            Brand <strong>{conflict.brandName}</strong>, Line{' '}
            <strong>{conflict.lineNumber}</strong> for package date{' '}
            <strong>
              {new Date(conflict.packageDate).toLocaleDateString()}
            </strong>{' '}
            was already submitted. Choose what to do:
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolve('reuse')}
              className="flex-1 rounded-md border border-amber-400 bg-white px-4 py-2 font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
            >
              Use Existing Stickers
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolve('update')}
              className="flex-1 rounded-md bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
            >
              Update &amp; Regenerate Stickers
            </button>
          </div>
          {resolving && (
            <p className="mt-2 text-xs">
              Working — this can take a moment for large quantities…
            </p>
          )}
        </div>
      )}

      {zips.length > 0 && (
        <div className="mb-6 rounded-md border border-green-300 bg-green-50 px-4 py-4 text-sm text-green-700">
          <p className="mb-3 font-semibold">
            Stickers generated. Download or print by category:
          </p>
          <div className="flex flex-col gap-2">
            {zips.map((category) => (
              <div
                key={category.numberOfHands}
                className="flex items-center justify-between gap-3 rounded-md border border-green-300 bg-white px-4 py-2"
              >
                <div>
                  <span className="font-medium text-slate-800">
                    {category.numberOfHands} Hand
                  </span>
                  <span className="ml-2 text-xs text-slate-500">
                    {category.quantity} unique stickers / {category.quantity * 2} physical copies
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePrint(category.numberOfHands)}
                    className="rounded-md border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50"
                  >
                    Print
                  </button>
                  <a
                    href={buildDownloadUrl(category.numberOfHands)}
                    className="rounded-md bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="grid grid-cols-1 gap-y-4 md:grid-cols-2 md:gap-x-8 md:gap-y-5">
          <Field label="Brand Name" required error={fieldErrors.brandName}>
            <select
              name="brandName"
              value={form.brandName}
              onChange={handleChange}
              className={selectClass(fieldErrors.brandName)}
            >
              <option value="">Select brand name</option>
              {BRAND_OPTIONS.map((brand) => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vendor Name" required error={fieldErrors.vendorId}>
            <select
              name="vendorId"
              value={form.vendorId}
              onChange={handleChange}
              disabled={vendorsLoading}
              className={selectClass(fieldErrors.vendorId)}
            >
              <option value="">
                {vendorsLoading ? 'Loading Vendors…' : 'Select active Vendor'}
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.userName}
                  {vendor.companyName ? ` — ${vendor.companyName}` : ''}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Cold Storage" required error={fieldErrors.coldStorageId}>
            <select
              name="coldStorageId"
              value={form.coldStorageId}
              onChange={handleChange}
              disabled={!form.vendorId || coldStoragesLoading}
              className={selectClass(fieldErrors.coldStorageId)}
            >
              <option value="">
                {!form.vendorId
                  ? 'Select Vendor first'
                  : coldStoragesLoading
                    ? 'Loading Cold Storage…'
                    : 'Select Cold Storage'}
              </option>
              {coldStorages.map((storage) => (
                <option key={storage.id} value={storage.id}>
                  {storage.name}
                </option>
              ))}
            </select>
            {form.vendorId && !coldStoragesLoading && coldStorages.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                No active Cold Storage is registered for this Vendor.
              </p>
            )}
          </Field>

          <Field label="Farmer Name" required error={fieldErrors.farmerName}>
            <input
              type="text"
              name="farmerName"
              value={form.farmerName}
              onChange={handleChange}
              placeholder="Enter farmer name"
              className={inputClass(fieldErrors.farmerName)}
            />
          </Field>

          <Field label="Supervisor" required error={fieldErrors.supervisor}>
            <input
              type="text"
              name="supervisor"
              value={form.supervisor}
              onChange={handleChange}
              placeholder="Enter supervisor name"
              className={inputClass(fieldErrors.supervisor)}
            />
          </Field>

          <Field label="Line Number" required error={fieldErrors.lineNumber}>
            <input
              type="number"
              name="lineNumber"
              value={form.lineNumber}
              onChange={handleChange}
              placeholder="Enter line number"
              className={inputClass(fieldErrors.lineNumber)}
            />
          </Field>

          <Field label="Weight (kg)" required error={fieldErrors.weight}>
            <select
              name="weight"
              value={form.weight}
              onChange={handleChange}
              className={selectClass(fieldErrors.weight)}
            >
              <option value="">Select weight</option>
              {WEIGHT_OPTIONS.map((weight) => (
                <option key={weight} value={weight}>
                  {weight} kg
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field
              label="Farm Plot Address / Location"
              required
              error={fieldErrors.farmPlotAddress}
            >
              <LocationAutocomplete
                value={form.farmPlotAddress}
                disabled={!selectedColdStorage}
                onInputChange={(value) => {
                  setForm((current) => ({
                    ...current,
                    farmPlotAddress: value,
                    farmPlotLocation: null,
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    farmPlotAddress: '',
                    distance: '',
                  }));
                  setDistanceData(null);
                  setDistanceError('');
                }}
                onSelect={(suggestion) => {
                  setForm((current) => ({
                    ...current,
                    farmPlotAddress: suggestion.formatted,
                    farmPlotLocation: {
                      latitude: suggestion.latitude,
                      longitude: suggestion.longitude,
                      placeId: suggestion.placeId,
                    },
                  }));
                  setFieldErrors((current) => ({
                    ...current,
                    farmPlotAddress: '',
                    distance: '',
                  }));
                }}
                placeholder={
                  selectedColdStorage
                    ? 'Search Farm Plot address/location'
                    : 'Select Cold Storage first'
                }
                error={fieldErrors.farmPlotAddress}
                hasSelection={Boolean(form.farmPlotLocation)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <DistanceCard
              coldStorage={selectedColdStorage}
              farmPlotAddress={form.farmPlotAddress}
              loading={distanceLoading}
              route={distanceData}
              error={fieldErrors.distance || distanceError}
            />
          </div>

          <div className="md:col-span-2">
            <Field label="Package Date" required error={fieldErrors.packageDate}>
              <input
                type="date"
                name="packageDate"
                value={form.packageDate}
                min={isSubAdmin ? today : undefined}
                onChange={handleChange}
                className={inputClass(fieldErrors.packageDate)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-800">
              Sticker Quantity per Hand Category{' '}
              <span className="text-red-500">*</span>
            </p>
            {fieldErrors.quantities && (
              <p className="mb-2 text-xs text-red-600">
                {fieldErrors.quantities}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {HAND_CATEGORIES.map((hand) => (
                <div key={hand}>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">
                    {hand} Hand
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantities[hand]}
                    onChange={(event) =>
                      handleQuantityChange(hand, event.target.value)
                    }
                    placeholder="0"
                    className={inputClass(fieldErrors[`quantity${hand}`])}
                  />
                  {fieldErrors[`quantity${hand}`] && (
                    <p className="mt-1 text-xs text-red-600">
                      {fieldErrors[`quantity${hand}`]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || distanceLoading}
          className="mt-8 w-full rounded-md bg-orange-500 py-4 font-semibold text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Generating…' : 'Generate Stickers'}
        </button>
      </form>
    </div>
  );
}

function DistanceCard({
  coldStorage,
  farmPlotAddress,
  loading,
  route,
  error,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-slate-500">
            Cold Storage → Farm Plot
          </p>
          <h3 className="mt-1 text-base font-extrabold text-slate-900">
            Distance
          </h3>
        </div>

        {route && (
          <div className="text-right">
            <p className="text-2xl font-extrabold text-orange-600">
              {route.distanceKm.toFixed(2)} km
            </p>
            {route.durationMinutes && (
              <p className="text-xs font-semibold text-slate-500">
                Approx. {route.durationMinutes} min by road
              </p>
            )}
          </div>
        )}
      </div>

      {!coldStorage ? (
        <p className="mt-3 text-sm text-slate-500">
          Select a Cold Storage to begin.
        </p>
      ) : !farmPlotAddress ? (
        <p className="mt-3 text-sm text-slate-500">
          Cold Storage: <strong>{coldStorage.name}</strong>. Select the Farm Plot location to calculate distance.
        </p>
      ) : loading ? (
        <p className="mt-3 text-sm font-semibold text-slate-600">
          Calculating driving distance with Geoapify…
        </p>
      ) : error ? (
        <p className="mt-3 text-sm font-semibold text-red-600">
          {error}
        </p>
      ) : route ? (
        <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
          <p>
            <strong className="text-slate-800">From:</strong>{' '}
            {coldStorage.name}
          </p>
          <p>
            <strong className="text-slate-800">To:</strong>{' '}
            {farmPlotAddress}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-800">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

const baseFieldClass =
  'w-full rounded-md border bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

const inputClass = (hasError) =>
  `${baseFieldClass} ${
    hasError ? 'border-red-400' : 'border-slate-300'
  }`;

const selectClass = (hasError) =>
  `${baseFieldClass} ${
    hasError ? 'border-red-400' : 'border-slate-300'
  }`;
