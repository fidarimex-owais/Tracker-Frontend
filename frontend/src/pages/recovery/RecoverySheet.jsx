import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '../../auth/useAuth';

import {
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
  const [options, setOptions] = useState([]);
  const [packagingDate, setPackagingDate] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [lineNumber, setLineNumber] = useState('');
  const [sheet, setSheet] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [error, setError] = useState('');

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
  };

  const handleVendorNameChange = (event) => {
    setVendorName(event.target.value);
    setLineNumber('');
    setSheet(null);
    setError('');
  };

  const handleLineNumberChange = async (event) => {
    const nextLineNumber = event.target.value;

    setLineNumber(nextLineNumber);
    setSheet(null);
    setError('');

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
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-3">
            <Info label="Packaging Date" value={formatDate(sheet.packagingDate)} />
            <Info label="Vendor Name" value={sheet.vendorName} />
            <Info label="Line Number" value={`Line ${sheet.lineNumber}`} />
          </div>

          <div className="responsive-scroll rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-[680px] w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">Row</th>
                  <th className="px-4 py-3 text-center font-semibold">4-Hand</th>
                  <th className="px-4 py-3 text-center font-semibold">5-Hand</th>
                  <th className="px-4 py-3 text-center font-semibold">6-Hand</th>
                  <th className="px-4 py-3 text-center font-semibold">8-Hand</th>
                  <th className="px-4 py-3 text-center font-semibold">Total</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Recovery Percentage
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {[...(sheet.rows || [])]
                  .sort((a, b) => a.rowNumber - b.rowNumber)
                  .map((row) => (
                    <tr key={row.rowNumber}>
                      <td className="px-4 py-3 font-semibold text-slate-800">
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
                      <td className="px-4 py-3 text-center font-semibold text-orange-600">
                        {formatPercentage(row.recoveryPercentage)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
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
