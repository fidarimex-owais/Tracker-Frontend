import { useState } from 'react';
import {
  buildStickerDownloadUrl,
  buildStickerPrintUrl,
  createRecord,
  resolveConflict,
} from '../services/recordService';

const BRAND_OPTIONS = ['Hi Banana', 'Joker', 'Banana Man'];
const VENDOR_OPTIONS = ['Yogesh Korhale', 'Sachin Markad', 'Tannaji Kashid'];
const WEIGHT_OPTIONS = [13.5, 14];
const HAND_CATEGORIES = [4, 5, 6, 8];

const initialFormState = {
  brandName: '',
  vendorName: '',
  farmerName: '',
  supervisor: '',
  lineNumber: '',
  weight: '',
  address: '',
  packageDate: '',
  latitude: '',
  longitude: '',
  quantities: { 4: '', 5: '', 6: '', 8: '' },
};

export default function QRCodeGenerator() {
  const [form, setForm] = useState(initialFormState);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [zips, setZips] = useState([]); // [{ numberOfHands, quantity }] — categories available, not stored files
  const [lineInfo, setLineInfo] = useState(null); // { brandName, packageDate, lineNumber } — needed to build Print URLs

  const [conflict, setConflict] = useState(null);
  const [resolving, setResolving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuantityChange = (hand, value) => {
    setForm((prev) => ({
      ...prev,
      quantities: { ...prev.quantities, [hand]: value },
    }));
  };

  const validateClientSide = () => {
    const errors = {};
    if (!form.brandName) errors.brandName = 'Brand name is required';
    if (!VENDOR_OPTIONS.includes(form.vendorName)) {
      errors.vendorName = 'Select a valid vendor name';
    }
    if (!form.farmerName.trim()) errors.farmerName = 'Farmer name is required';
    if (!form.supervisor.trim()) errors.supervisor = 'Supervisor is required';
    if (form.lineNumber === '' || Number(form.lineNumber) <= 0) {
      errors.lineNumber = 'Line number must be a positive number';
    }
    if (form.weight === '' || Number(form.weight) <= 0) {
      errors.weight = 'Weight must be a positive number';
    }
    if (!form.address.trim()) errors.address = 'Address is required';
    if (!form.packageDate) errors.packageDate = 'Package date is required';
    if (form.latitude === '' || Number(form.latitude) < -90 || Number(form.latitude) > 90) {
      errors.latitude = 'Latitude must be between -90 and 90';
    }
    if (form.longitude === '' || Number(form.longitude) < -180 || Number(form.longitude) > 180) {
      errors.longitude = 'Longitude must be between -180 and 180';
    }

    // At least one hand category must have a positive integer quantity.
    let anyPositive = false;
    for (const hand of HAND_CATEGORIES) {
      const raw = form.quantities[hand];
      if (raw === '') continue; // empty = 0, allowed, just skipped
      const num = Number(raw);
      if (!Number.isInteger(num) || num < 0) {
        errors[`quantity${hand}`] = `Must be a non-negative whole number`;
        continue;
      }
      if (num > 0) anyPositive = true;
    }
    if (!anyPositive) {
      errors.quantities = 'Enter a quantity greater than 0 for at least one hand category';
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
      vendorName: form.vendorName,
      farmerName: form.farmerName.trim(),
      supervisor: form.supervisor.trim(),
      lineNumber: Number(form.lineNumber),
      weight: Number(form.weight),
      address: form.address.trim(),
      packageDate: form.packageDate,
      geolocation: {
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
      },
      quantities,
    };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
      const payload = buildPayload();
      const result = await createRecord(payload);
      // Backend now returns `categories` (numberOfHands + quantity), not
      // zip filenames — nothing is stored on disk, so there's no file to
      // name. Download/print URLs are built client-side from lineInfo.
      setZips(result.data.categories || []);
      setLineInfo({
        brandName: result.data.brandName,
        packageDate: result.data.packageDate,
        lineNumber: result.data.lineNumber,
      });
      setForm(initialFormState);
    } catch (error) {
      if (error.isConflict) {
        setConflict(error.conflictData);
      } else {
        if (error.fieldErrors) {
          const mapped = {};
          error.fieldErrors.forEach((fe) => {
            let key = fe.field;
            if (key.startsWith('geolocation.')) key = key.replace('geolocation.', '');
            if (key.startsWith('quantities.')) key = 'quantity' + key.replace('quantities.', '');
            mapped[key] = fe.message;
          });
          setFieldErrors(mapped);
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
        payload: action === 'update' ? conflict.submittedPayload : undefined,
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
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-center mb-8">
        <p className="text-green-600 font-semibold text-sm tracking-wide mb-2">
          GENERATE QR CODE
        </p>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">QR Code Generator</h1>
        <p className="text-slate-500 max-w-xl mx-auto">
          Enter the details below and how many stickers you need per hand category. Each
          category gets its own downloadable ZIP.
        </p>
      </div>

      {submitError && (
        <div className="mb-6 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-red-700 text-sm">
          {submitError}
        </div>
      )}

      {conflict && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-4 text-amber-800 text-sm">
          <p className="font-semibold mb-1">This data already exists.</p>
          <p className="mb-3">
            Brand <strong>{conflict.brandName}</strong>, Line{' '}
            <strong>{conflict.lineNumber}</strong> for package date{' '}
            <strong>{new Date(conflict.packageDate).toLocaleDateString()}</strong> was already
            submitted. Choose what to do:
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
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
          {resolving && <p className="mt-2 text-xs">Working — this can take a moment for large quantities...</p>}
        </div>
      )}

      {/* Download AND print, per category. */}
      {zips.length > 0 && (
        <div className="mb-6 rounded-md border border-green-300 bg-green-50 px-4 py-4 text-green-700 text-sm">
          <p className="font-semibold mb-3">Stickers generated. Download or print by category:</p>
          <div className="flex flex-col gap-2">
            {zips.map((z) => (
              <div
                key={z.numberOfHands}
                className="flex items-center justify-between gap-3 rounded-md border border-green-300 bg-white px-4 py-2"
              >
                <div>
                  <span className="font-medium text-slate-800">{z.numberOfHands} Hand</span>
                  <span className="ml-2 text-xs text-slate-500">{z.quantity} stickers</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePrint(z.numberOfHands)}
                    className="rounded-md border border-orange-300 px-3 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50"
                  >
                    Print
                  </button>
                  <a
                    href={buildDownloadUrl(z.numberOfHands)}
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
          <Field label="Brand Name" required error={fieldErrors.brandName}>
            <select
              name="brandName"
              value={form.brandName}
              onChange={handleChange}
              className={selectClass(fieldErrors.brandName)}
            >
              <option value="">Select brand name</option>
              {BRAND_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Vendor Name" required error={fieldErrors.vendorName}>
            <select
              name="vendorName"
              value={form.vendorName}
              onChange={handleChange}
              className={selectClass(fieldErrors.vendorName)}
            >
              <option value="">Select vendor name</option>
              {VENDOR_OPTIONS.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
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
              {WEIGHT_OPTIONS.map((w) => (
                <option key={w} value={w}>
                  {w} kg
                </option>
              ))}
            </select>
          </Field>

          <div className="md:col-span-2">
            <Field label="Address" required error={fieldErrors.address}>
              <input
                type="text"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="Enter full address"
                className={inputClass(fieldErrors.address)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <Field label="Package Date" required error={fieldErrors.packageDate}>
              <input
                type="date"
                name="packageDate"
                value={form.packageDate}
                onChange={handleChange}
                className={inputClass(fieldErrors.packageDate)}
              />
            </Field>
          </div>

          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Geolocation <span className="text-red-500">*</span>
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
              <Field label="Latitude" error={fieldErrors.latitude}>
                <input
                  type="number"
                  name="latitude"
                  value={form.latitude}
                  onChange={handleChange}
                  placeholder="Enter latitude"
                  step="any"
                  className={inputClass(fieldErrors.latitude)}
                />
              </Field>
              <Field label="Longitude" error={fieldErrors.longitude}>
                <input
                  type="number"
                  name="longitude"
                  value={form.longitude}
                  onChange={handleChange}
                  placeholder="Enter longitude"
                  step="any"
                  className={inputClass(fieldErrors.longitude)}
                />
              </Field>
            </div>
          </div>

          {/* Quantities — one input per hand category */}
          <div className="md:col-span-2">
            <p className="text-sm font-semibold text-slate-800 mb-2">
              Sticker Quantity per Hand Category <span className="text-red-500">*</span>
            </p>
            {fieldErrors.quantities && (
              <p className="mb-2 text-xs text-red-600">{fieldErrors.quantities}</p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {HAND_CATEGORIES.map((hand) => (
                <div key={hand}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {hand} Hand
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.quantities[hand]}
                    onChange={(e) => handleQuantityChange(hand, e.target.value)}
                    placeholder="0"
                    className={inputClass(fieldErrors[`quantity${hand}`])}
                  />
                  {fieldErrors[`quantity${hand}`] && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors[`quantity${hand}`]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-md transition-colors"
        >
          {submitting ? 'Generating...' : 'Generate Stickers'}
        </button>
      </form>
    </div>
  );
}

function Field({ label, required, error, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-800 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const baseFieldClass =
  'w-full rounded-md border px-3.5 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500';

const inputClass = (hasError) =>
  `${baseFieldClass} ${hasError ? 'border-red-400' : 'border-slate-300'}`;

const selectClass = (hasError) =>
  `${baseFieldClass} bg-white ${hasError ? 'border-red-400' : 'border-slate-300'}`;