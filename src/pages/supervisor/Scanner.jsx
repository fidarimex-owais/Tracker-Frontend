import { useState } from 'react';
import { resolveScan } from '../../services/scanningService';

export default function Scanner() {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setResult(null);
    setBusy(true);

    try {
      setResult((await resolveScan(code)).data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="min-w-0">
      <div className="mb-5 sm:mb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 sm:text-sm">
          Scanning
        </p>
        <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          Resolve QR / Barcode
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-base">
          Paste the value produced by a scanner. QR values are MongoDB category
          IDs; barcodes use the stored sticker barcode ID.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="flex w-full max-w-2xl flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:p-5"
      >
        <input
          autoFocus
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="Scan or paste code"
          className="min-h-12 min-w-0 flex-1 rounded-lg border border-slate-300 px-3.5 py-3 outline-none focus:ring-2 focus:ring-orange-100"
        />
        <button
          disabled={busy || !code.trim()}
          className="min-h-12 rounded-lg bg-orange-500 px-5 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? 'Checking...' : 'Resolve'}
        </button>
      </form>

      {error && (
        <div className="mt-4 max-w-2xl rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && <ResultCard data={result} />}
    </section>
  );
}

function ResultCard({ data }) {
  const rows = [
    ['Type', data.type?.toUpperCase()],
    ['Brand', data.brandName],
    ['Package Date', new Date(data.packageDate).toLocaleDateString()],
    ['Line Number', data.lineNumber],
    ['Vendor', data.vendorName],
    ['Farmer', data.farmerName],
    ['Supervisor', data.supervisor],
    ['Weight', `${data.weight} kg`],
    ['Hands', data.numberOfHands],
    ['Category Quantity', data.quantity],
    ['QR Unique ID', data.qrUniqueId],
    ['Barcode ID', data.barcodeId || '—'],
    ['Address', data.address],
    ['Coordinates', `${data.geolocation?.latitude}, ${data.geolocation?.longitude}`],
  ];

  return (
    <div className="mt-5 w-full max-w-3xl rounded-xl border border-green-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
        <h3 className="font-bold text-slate-900">Record found</h3>
      </div>

      <dl className="grid min-w-0 gap-x-8 gap-y-3 sm:grid-cols-2">
        {rows.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">
              {key}
            </dt>
            <dd className="mt-0.5 break-words text-sm font-medium text-slate-800">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
