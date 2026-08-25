// frontend/src/pages/admin/QrBrandDetails.jsx

import { useEffect, useMemo, useState } from 'react';
import {
  deleteQrBrandRecord,
  getQrBrandDetailOptions,
  getQrBrandDetails,
} from '../../services/qrBrandDetailsService';

const BRAND_OPTIONS = [
  'Hi Banana',
  'Banana Man',
  'Joker',
];

const makeInitialFilters = (brandName = '') => ({
  packageDate: '',
  brandName,
  supervisor: '',
  lineNumber: '',
  vendorName: '',
  qrCodeId: '',
});

const PAGE_SIZE = 24;

const formatDate = (value) => {
  if (!value) return '—';

  const [year, month, day] = String(value)
    .slice(0, 10)
    .split('-');

  return year && month && day
    ? `${day}-${month}-${year}`
    : value;
};

const formatNumber = (value) =>
  value === null ||
  value === undefined ||
  value === ''
    ? '—'
    : String(value);

const activeFilterCount = (filters, selectedBrand) =>
  Object.entries(filters).filter(([key, value]) => {
    if (!value) return false;
    if (key === 'brandName' && value === selectedBrand) {
      return false;
    }
    return true;
  }).length;

export default function QrBrandDetails() {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  const [filters, setFilters] = useState(
    makeInitialFilters()
  );
  const [appliedFilters, setAppliedFilters] = useState(
    makeInitialFilters()
  );

  const [options, setOptions] = useState({
    vendors: [],
    supervisors: [],
    lineNumbers: [],
  });

  const [rows, setRows] = useState([]);

  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    pages: 1,
    hasPrevious: false,
    hasNext: false,
  });

  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingResults, setLoadingResults] = useState(false);
  const [deletingKey, setDeletingKey] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const appliedCount = useMemo(
    () => activeFilterCount(appliedFilters, selectedBrand),
    [appliedFilters, selectedBrand]
  );

  const loadOptions = async ({
    brandName = selectedBrand,
    packageDate = filters.packageDate,
  } = {}) => {
    if (!brandName) {
      setOptions({
        vendors: [],
        supervisors: [],
        lineNumbers: [],
      });
      return;
    }

    setLoadingOptions(true);

    try {
      const result = await getQrBrandDetailOptions({
        brandName,
        packageDate,
      });

      setOptions({
        vendors: result.data?.vendors || [],
        supervisors: result.data?.supervisors || [],
        lineNumbers: result.data?.lineNumbers || [],
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingOptions(false);
    }
  };

  const loadResults = async ({
    brandName = selectedBrand,
    nextFilters = appliedFilters,
    page = 1,
  } = {}) => {
    if (!brandName) {
      setRows([]);
      return;
    }

    setLoadingResults(true);
    setError('');

    try {
      const result = await getQrBrandDetails({
        ...nextFilters,
        brandName,
        page,
        limit: PAGE_SIZE,
      });

      setRows(result.data?.rows || []);
      setPagination(
        result.data?.pagination || {
          page: 1,
          limit: PAGE_SIZE,
          total: 0,
          pages: 1,
          hasPrevious: false,
          hasNext: false,
        }
      );
    } catch (requestError) {
      setRows([]);
      setError(requestError.message);
    } finally {
      setLoadingResults(false);
    }
  };

  useEffect(() => {
    if (!selectedBrand) return;

    loadOptions({
      brandName: filters.brandName || selectedBrand,
      packageDate: filters.packageDate,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBrand, filters.brandName, filters.packageDate]);

  const selectBrand = (brandName) => {
    const cleanFilters = makeInitialFilters(brandName);

    setSelectedBrand(brandName);
    setFilters(cleanFilters);
    setAppliedFilters(cleanFilters);
    setFilterOpen(false);
    setMessage('');
    setError('');

    loadResults({
      brandName,
      nextFilters: cleanFilters,
      page: 1,
    });

    loadOptions({
      brandName,
      packageDate: '',
    });
  };

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFilters((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const applyFilters = (event) => {
    event.preventDefault();

    const brandName = filters.brandName || selectedBrand;

    if (!brandName) return;

    setSelectedBrand(brandName);
    setAppliedFilters({
      ...filters,
      brandName,
    });
    setFilterOpen(false);
    setMessage('');

    loadResults({
      brandName,
      nextFilters: {
        ...filters,
        brandName,
      },
      page: 1,
    });
  };

  const clearFilters = () => {
    const cleanFilters = makeInitialFilters(selectedBrand);

    setFilters(cleanFilters);
    setAppliedFilters(cleanFilters);
    setMessage('');

    loadResults({
      brandName: selectedBrand,
      nextFilters: cleanFilters,
      page: 1,
    });

    loadOptions({
      brandName: selectedBrand,
      packageDate: '',
    });
  };

  const goToPage = (page) => {
    loadResults({
      brandName: selectedBrand,
      nextFilters: appliedFilters,
      page,
    });
  };

  const deleteRecord = async (row) => {
    const confirmed = window.confirm(
      `Delete this QR record permanently?\n\n` +
        `Brand: ${row.brandName}\n` +
        `Packaging Date: ${formatDate(row.packageDate)}\n` +
        `Vendor: ${row.vendorName || '—'}\n` +
        `Line: ${row.lineNumber}\n\n` +
        'This removes the QR line and its mirrored barcode data.'
    );

    if (!confirmed) return;

    const key = `${row.packageId}-${row.lineId}`;
    setDeletingKey(key);
    setError('');
    setMessage('');

    try {
      await deleteQrBrandRecord({
        brandName: row.brandName,
        packageId: row.packageId,
        lineId: row.lineId,
      });

      setMessage('QR record deleted successfully.');

      await Promise.all([
        loadResults({
          brandName: selectedBrand,
          nextFilters: appliedFilters,
          page: pagination.page,
        }),
        loadOptions({
          brandName: selectedBrand,
          packageDate: filters.packageDate,
        }),
      ]);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingKey('');
    }
  };

  return (
    <div className="min-w-0 space-y-5">
      <section>
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Admin
        </p>

        <h2 className="mt-1 text-2xl font-extrabold text-slate-950 sm:text-3xl">
          QR Brand Details
        </h2>

        <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
          Select a brand to view its QR records, then use Filter
          to narrow the results.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        {BRAND_OPTIONS.map((brandName) => {
          const selected = selectedBrand === brandName;

          return (
            <button
              key={brandName}
              type="button"
              onClick={() => selectBrand(brandName)}
              className={`group min-h-28 rounded-xl border p-4 text-left shadow-sm transition ${
                selected
                  ? 'border-orange-500 bg-orange-50 ring-2 ring-orange-100'
                  : 'border-slate-200 bg-white hover:border-orange-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-600">
                    Brand
                  </p>

                  <h3 className="mt-2 text-lg font-extrabold text-slate-950">
                    {brandName}
                  </h3>
                </div>

                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-black ${
                    selected
                      ? 'border-orange-500 bg-orange-500 text-white'
                      : 'border-slate-200 bg-slate-50 text-slate-500 group-hover:border-orange-300 group-hover:text-orange-600'
                  }`}
                  aria-hidden="true"
                >
                  {selected ? '✓' : '›'}
                </span>
              </div>

              <p className="mt-3 text-xs text-slate-500">
                View {brandName} QR records
              </p>
            </button>
          );
        })}
      </section>

      {message && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!selectedBrand ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
          <p className="text-sm font-bold text-slate-700">
            Select a brand above
          </p>
          <p className="mt-1 text-xs text-slate-500">
            QR Brand Detail cards will appear here.
          </p>
        </section>
      ) : (
        <>
          <section>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-orange-600">
                  Selected Brand
                </p>

                <h3 className="mt-1 text-xl font-extrabold text-slate-950">
                  {selectedBrand}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {pagination.total} matching QR record
                  {pagination.total === 1 ? '' : 's'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setFilterOpen((current) => !current)}
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 text-sm font-bold transition ${
                  filterOpen || appliedCount > 0
                    ? 'border-orange-400 bg-orange-50 text-orange-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-orange-300 hover:text-orange-700'
                }`}
              >
                <FilterIcon />
                Filter
                {appliedCount > 0 && (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-extrabold text-white">
                    {appliedCount}
                  </span>
                )}
              </button>
            </div>

            {filterOpen && (
              <form
                onSubmit={applyFilters}
                className="mt-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-extrabold text-slate-900">
                      Filter QR Brand Details
                    </h4>

                    <p className="mt-1 text-xs text-slate-500">
                      Combine any fields below to narrow the QR cards.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-lg text-slate-500 transition hover:bg-slate-50"
                    aria-label="Close filter panel"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <FilterField label="Packaging Date">
                    <input
                      type="date"
                      name="packageDate"
                      value={filters.packageDate}
                      onChange={handleChange}
                      className={inputClass}
                    />
                  </FilterField>

                  <FilterField label="Brand Name">
                    <select
                      name="brandName"
                      value={filters.brandName}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      {BRAND_OPTIONS.map((brandName) => (
                        <option key={brandName} value={brandName}>
                          {brandName}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Supervisor">
                    <select
                      name="supervisor"
                      value={filters.supervisor}
                      onChange={handleChange}
                      disabled={loadingOptions}
                      className={inputClass}
                    >
                      <option value="">All Supervisors</option>
                      {(options.supervisors || []).map(
                        (supervisor) => (
                          <option
                            key={supervisor}
                            value={supervisor}
                          >
                            {supervisor}
                          </option>
                        )
                      )}
                    </select>
                  </FilterField>

                  <FilterField label="Vendor Name">
                    <select
                      name="vendorName"
                      value={filters.vendorName}
                      onChange={handleChange}
                      disabled={loadingOptions}
                      className={inputClass}
                    >
                      <option value="">All Vendors</option>
                      {(options.vendors || []).map((vendor) => (
                        <option key={vendor} value={vendor}>
                          {vendor}
                        </option>
                      ))}
                    </select>
                  </FilterField>

                  <FilterField label="Line Number">
                    <select
                      name="lineNumber"
                      value={filters.lineNumber}
                      onChange={handleChange}
                      disabled={loadingOptions}
                      className={inputClass}
                    >
                      <option value="">All Lines</option>
                      {(options.lineNumbers || []).map(
                        (lineNumber) => (
                          <option
                            key={lineNumber}
                            value={lineNumber}
                          >
                            Line {lineNumber}
                          </option>
                        )
                      )}
                    </select>
                  </FilterField>

                  <FilterField label="QR Code ID">
                    <input
                      type="text"
                      name="qrCodeId"
                      value={filters.qrCodeId}
                      onChange={handleChange}
                      placeholder="Enter QR Code ID"
                      autoComplete="off"
                      className={inputClass}
                    />
                  </FilterField>
                </div>

                <div className="mt-5 flex flex-col gap-2 min-[390px]:flex-row">
                  <button
                    type="submit"
                    disabled={loadingResults}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg bg-orange-500 px-5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:opacity-50"
                  >
                    {loadingResults
                      ? 'Applying...'
                      : 'Apply Filters'}
                  </button>

                  <button
                    type="button"
                    onClick={clearFilters}
                    disabled={loadingResults}
                    className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear Filters
                  </button>
                </div>
              </form>
            )}
          </section>

          {loadingResults ? (
            <section className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center shadow-sm">
              <p className="text-sm font-semibold text-slate-500">
                Loading {selectedBrand} QR details...
              </p>
            </section>
          ) : rows.length === 0 ? (
            <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
              <p className="text-sm font-bold text-slate-700">
                No QR records found
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try changing or clearing the selected filters.
              </p>
            </section>
          ) : (
            <section className="grid gap-4 xl:grid-cols-2">
              {rows.map((row) => {
                const rowKey = `${row.packageId}-${row.lineId}`;

                return (
                  <QrDetailCard
                    key={rowKey}
                    row={row}
                    deleting={deletingKey === rowKey}
                    onDelete={() => deleteRecord(row)}
                  />
                );
              })}
            </section>
          )}

          {pagination.total > 0 && (
            <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm min-[390px]:flex-row min-[390px]:items-center min-[390px]:justify-between">
              <p className="text-xs text-slate-500">
                Showing{' '}
                {(pagination.page - 1) * pagination.limit + 1}
                {' '}–{' '}
                {Math.min(
                  pagination.page * pagination.limit,
                  pagination.total
                )}
                {' '}of {pagination.total}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    loadingResults ||
                    !pagination.hasPrevious
                  }
                  onClick={() =>
                    goToPage(pagination.page - 1)
                  }
                  className="min-h-10 rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  type="button"
                  disabled={
                    loadingResults ||
                    !pagination.hasNext
                  }
                  onClick={() =>
                    goToPage(pagination.page + 1)
                  }
                  className="min-h-10 rounded-lg border border-slate-300 px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

const inputClass =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:cursor-not-allowed disabled:bg-slate-100';

function QrDetailCard({ row, deleting, onDelete }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50 px-4 py-4 min-[390px]:flex-row min-[390px]:items-start min-[390px]:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-orange-600">
            {row.brandName}
          </p>

          <h4 className="mt-1 text-base font-extrabold text-slate-950">
            {formatDate(row.packageDate)} · Line{' '}
            {formatNumber(row.lineNumber)}
          </h4>

          <p className="mt-1 truncate text-xs text-slate-500">
            {row.vendorName || 'No vendor'}
          </p>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-extrabold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DeleteIcon />
          {deleting ? 'Deleting...' : 'Delete'}
        </button>
      </div>

      <div className="p-4">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
          <Detail label="Packaging Date" value={formatDate(row.packageDate)} />
          <Detail label="Line Number" value={`Line ${formatNumber(row.lineNumber)}`} />
          <Detail label="Vendor" value={row.vendorName} />
          <Detail label="Farmer" value={row.farmerName} />
          <Detail label="Supervisor" value={row.supervisor} />
          <Detail label="Weight" value={formatNumber(row.weight)} />
          <Detail label="Address" value={row.address} />
          <Detail
            label="Geolocation"
            value={
              row.geolocation
                ? `${row.geolocation.latitude}, ${row.geolocation.longitude}`
                : '—'
            }
          />
        </div>

        <div className="mt-5 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
              Hand / Quantity Details
            </p>

            <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-700">
              Total {formatNumber(row.totalQuantity)}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(row.handDetails || []).map((hand) => (
              <div
                key={hand.numberOfHands}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center"
              >
                <p className="text-xs font-extrabold text-slate-900">
                  {hand.numberOfHands}-Hand
                </p>
                <p className="mt-1 text-sm font-black text-orange-600">
                  Qty {hand.quantity}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">
        {value || '—'}
      </p>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function FilterIcon() {
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
      <path d="M4 5h16" />
      <path d="M7 12h10" />
      <path d="M10 19h4" />
    </svg>
  );
}

function DeleteIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="m19 6-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}
