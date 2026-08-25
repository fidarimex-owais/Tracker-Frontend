// frontend/src/pages/recovery/RecoverySheet.jsx

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../auth/useAuth';

import {
  deleteRecoverySheet,
  findRecoverySheet,
  getRecoverySheetOptions,
} from '../../services/recoveryService';

const formatDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) {
    return value || '';
  }

  const [year, month, day] = value.split('-');
  return `${day}-${month}-${year}`;
};

const formatPercentage = (value) => {
  const number = Number(value || 0);

  return `${Number.isInteger(number) ? number : number.toFixed(2)}%`;
};

export default function RecoverySheet() {
  const { user } = useAuth();
  const vendorTodayOnly = user.role === 'vendor';
  const canDownload = ['admin', 'subadmin'].includes(user.role);
  const canDelete = user.role === 'admin';
  const [options, setOptions] = useState([]);
  const [packagingDate, setPackagingDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [sheet, setSheet] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [deletingSheet, setDeletingSheet] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    getRecoverySheetOptions()
      .then((result) => {
        if (active) {
          setOptions(result.data || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load Recovery Sheet options'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoadingOptions(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const packagingDates = useMemo(
    () =>
      [...new Set(options.map((item) => item.packagingDate))].sort(
        (a, b) => b.localeCompare(a)
      ),
    [options]
  );

  const vendors = useMemo(
    () =>
      [
        ...new Set(
          options
            .filter((item) => item.packagingDate === packagingDate)
            .map((item) => item.vendorName)
        ),
      ].sort((a, b) => a.localeCompare(b)),
    [options, packagingDate]
  );

  const lineNumbers = useMemo(
    () =>
      [
        ...new Set(
          options
            .filter(
              (item) =>
                item.packagingDate === packagingDate &&
                item.vendorName === vendorName
            )
            .map((item) => item.lineNumber)
        ),
      ].sort((a, b) => a - b),
    [options, packagingDate, vendorName]
  );

  const handlePackagingDateChange = (event) => {
    setPackagingDate(event.target.value);
    setVendorName('');
    setLineNumber('');
    setSheet(null);
    setError('');
    setMessage('');
  };

  const handleVendorNameChange = (event) => {
    setVendorName(event.target.value);
    setLineNumber('');
    setSheet(null);
    setError('');
    setMessage('');
  };

  const handleLineNumberChange = async (event) => {
    const nextLineNumber = event.target.value;

    setLineNumber(nextLineNumber);
    setSheet(null);
    setError('');
    setMessage('');

    if (!packagingDate || !vendorName || !nextLineNumber) {
      return;
    }

    setLoadingSheet(true);

    try {
      const result = await findRecoverySheet({
        packagingDate,
        vendorName,
        lineNumber: Number(nextLineNumber),
      });

      setSheet(result.data || null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load Recovery Sheet'
      );
    } finally {
      setLoadingSheet(false);
    }
  };

  const handleDeleteRecoverySheet = async () => {
    if (!sheet || !canDelete || deletingSheet) {
      return;
    }

    const confirmed = window.confirm(
      `Delete the Recovery Sheet for ${formatDate(sheet.packagingDate)} / ${sheet.vendorName} / Line ${sheet.lineNumber}?\n\nThis permanently deletes the generated Recovery Sheet. The Raw Recovery Sheet is not deleted.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingSheet(true);
    setError('');
    setMessage('');

    try {
      await deleteRecoverySheet(sheet._id);

      setOptions((current) =>
        current.filter((item) => item.id !== String(sheet._id))
      );
      setSheet(null);
      setLineNumber('');
      setMessage('Recovery Sheet deleted successfully.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to delete Recovery Sheet'
      );
    } finally {
      setDeletingSheet(false);
    }
  };

  const downloadRecoverySheet = () => {
    if (!sheet || !canDownload) {
      return;
    }

    const rows = [...(sheet.rows || [])].sort(
      (a, b) => a.rowNumber - b.rowNumber
    );

    const csvRows = [
      ['Recovery Sheet'],
      ['Packaging Date', formatDate(sheet.packagingDate)],
      ['Vendor Name', sheet.vendorName || ''],
      ['Line Number', `Line ${sheet.lineNumber}`],
      [],
      [
        'Row',
        '4-Hand',
        '5-Hand',
        '6-Hand',
        '8-Hand',
        'Total',
        'Recovery Percentage',
      ],
      ...rows.map((row) => [
        `Row ${row.rowNumber}`,
        row.fourHand ?? 0,
        row.fiveHand ?? 0,
        row.sixHand ?? 0,
        row.eightHand ?? 0,
        row.total ?? 0,
        formatPercentage(row.recoveryPercentage),
      ]),
    ];

    const escapeCsvValue = (value) => {
      const stringValue = String(value ?? '');

      if (
        stringValue.includes(',') ||
        stringValue.includes('"') ||
        stringValue.includes('\n')
      ) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    };

    const csv = csvRows
      .map((row) => row.map(escapeCsvValue).join(','))
      .join('\r\n');

    const blob = new Blob(['\uFEFF', csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeVendor = String(sheet.vendorName || 'vendor')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '-');

    anchor.href = url;
    anchor.download = `recovery-sheet-${sheet.packagingDate}-${safeVendor}-line-${sheet.lineNumber}.csv`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
          Recovery
        </p>

        <h2 className="text-2xl font-bold sm:text-3xl text-slate-900">
          Recovery Sheet
        </h2>

        <p className="mt-2 text-slate-500">
          {vendorTodayOnly
            ? "Vendor access is limited to today's generated Recovery Sheets. Select Vendor Name and Line Number for today's Packaging Date."
            : 'Select Packaging Date, Vendor Name, and Line Number to view a generated Recovery Sheet.'}
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Packaging Date
            </span>

            <select
              value={packagingDate}
              disabled={loadingOptions}
              onChange={handlePackagingDateChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
            >
              <option value="">
                {loadingOptions ? 'Loading...' : 'Select Packaging Date'}
              </option>

              {packagingDates.map((date) => (
                <option key={date} value={date}>
                  {formatDate(date)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Vendor Name
            </span>

            <select
              value={vendorName}
              disabled={!packagingDate}
              onChange={handleVendorNameChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
            >
              <option value="">Select Vendor Name</option>

              {vendors.map((vendor) => (
                <option key={vendor} value={vendor}>
                  {vendor}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-slate-700">
              Line Number
            </span>

            <select
              value={lineNumber}
              disabled={!vendorName}
              onChange={handleLineNumberChange}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100"
            >
              <option value="">Select Line Number</option>

              {lineNumbers.map((line) => (
                <option key={line} value={line}>
                  Line {line}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

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

      {loadingSheet && (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-8 text-center text-slate-500 shadow-sm">
          Loading Recovery Sheet...
        </div>
      )}

      {!loadingSheet && !sheet && !error && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center text-sm text-slate-500">
          Select all three fields to display a Recovery Sheet.
        </div>
      )}

      {!loadingSheet && sheet && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-3">
                <Info
                  label="Packaging Date"
                  value={formatDate(sheet.packagingDate)}
                />
                <Info label="Vendor Name" value={sheet.vendorName} />
                <Info label="Line Number" value={`Line ${sheet.lineNumber}`} />
              </div>

              {(canDownload || canDelete) && (
                <div className="flex w-full shrink-0 flex-col gap-2 min-[390px]:flex-row sm:w-auto">
                  {canDownload && (
                    <button
                      type="button"
                      onClick={downloadRecoverySheet}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-xs font-bold text-white transition hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-orange-200 sm:text-sm"
                    >
                      <DownloadIcon />
                      Download CSV
                    </button>
                  )}

                  {canDelete && (
                    <button
                      type="button"
                      onClick={handleDeleteRecoverySheet}
                      disabled={deletingSheet}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-xs font-bold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
                    >
                      <DeleteIcon />
                      {deletingSheet ? 'Deleting...' : 'Delete'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium text-slate-400 sm:hidden">
              Swipe left/right to view all Recovery Sheet columns.
            </p>

            <div
              className="w-full overflow-x-scroll rounded-xl border border-slate-200 bg-white shadow-sm"
              style={{
                WebkitOverflowScrolling: 'touch',
                scrollbarGutter: 'stable',
              }}
            >
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="whitespace-nowrap px-4 py-3 font-semibold">
                      Row
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      4-Hand
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      5-Hand
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      6-Hand
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      8-Hand
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      Total
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-center font-semibold">
                      Recovery Percentage
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {[...(sheet.rows || [])]
                    .sort((a, b) => a.rowNumber - b.rowNumber)
                    .map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-800">
                          Row {row.rowNumber}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {row.fourHand}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {row.fiveHand}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {row.sixHand}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">
                          {row.eightHand}
                        </td>
                        <td className="px-4 py-3 text-center font-semibold text-slate-900">
                          {row.total}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-center font-semibold text-orange-600">
                          {formatPercentage(row.recoveryPercentage)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
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

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-1 font-semibold text-slate-800">{value}</p>
    </div>
  );
}
