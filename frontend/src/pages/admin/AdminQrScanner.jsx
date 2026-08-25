// frontend/src/pages/admin/AdminQrScanner.jsx

import { useEffect, useRef, useState } from 'react';

import { resolveQrScan } from '../../services/scanningService';

const OBJECT_ID_RE = /^[a-fA-F0-9]{24}$/;

export default function AdminQrScanner() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const detectorRef = useRef(null);
  const scanningRef = useRef(false);

  const [manualValue, setManualValue] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cameraMessage, setCameraMessage] = useState('');
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [lastScannedId, setLastScannedId] = useState('');

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    scanningRef.current = false;

    if (frameRef.current) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setCameraActive(false);
  };

  const extractMongoId = (rawValue) => {
    const value = String(rawValue || '').trim();

    if (OBJECT_ID_RE.test(value)) {
      return value;
    }

    try {
      const parsed = JSON.parse(value);
      const parsedId = String(parsed?._id || '').trim();

      return OBJECT_ID_RE.test(parsedId) ? parsedId : '';
    } catch {
      return '';
    }
  };

  const lookupQr = async (rawValue) => {
    const mongoId = extractMongoId(rawValue);

    setError('');
    setData(null);

    if (!mongoId) {
      setError(
        'The scanned QR code does not contain a valid 24-character MongoDB ID.'
      );
      return;
    }

    setBusy(true);

    try {
      const response = await resolveQrScan(mongoId);

      setLastScannedId(mongoId);
      setManualValue(mongoId);
      setData(response.data);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to retrieve QR data'
      );
    } finally {
      setBusy(false);
    }
  };

  const scanFrame = async () => {
    if (
      !scanningRef.current ||
      !videoRef.current ||
      !detectorRef.current
    ) {
      return;
    }

    try {
      if (videoRef.current.readyState >= 2) {
        const codes = await detectorRef.current.detect(videoRef.current);

        if (codes.length > 0) {
          const value = codes[0].rawValue;

          stopCamera();
          await lookupQr(value);
          return;
        }
      }
    } catch {
      // Some browsers can briefly fail while the camera is initializing.
      // Continue scanning the next frame.
    }

    frameRef.current = window.requestAnimationFrame(scanFrame);
  };

  const startCamera = async () => {
    setError('');
    setCameraMessage('');
    setData(null);

    if (!window.isSecureContext) {
      setCameraMessage(
        'Camera scanning requires HTTPS (or localhost). You can still paste or scan the MongoDB ID into the field below.'
      );
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraMessage(
        'Camera access is not available in this browser. Use the manual/scanner input below.'
      );
      return;
    }

    if (!('BarcodeDetector' in window)) {
      setCameraMessage(
        'This browser does not support built-in QR detection. Use Chrome/Edge on a supported device, or use the manual/scanner input below.'
      );
      return;
    }

    try {
      stopCamera();

      const supportedFormats =
        await window.BarcodeDetector.getSupportedFormats?.();

      if (
        Array.isArray(supportedFormats) &&
        !supportedFormats.includes('qr_code')
      ) {
        setCameraMessage(
          'QR detection is not supported by this browser. Use the manual/scanner input below.'
        );
        return;
      }

      detectorRef.current = new window.BarcodeDetector({
        formats: ['qr_code'],
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: 'environment',
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (!videoRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      scanningRef.current = true;
      setCameraActive(true);
      setCameraMessage('Point the camera at the QR code.');

      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (cameraError) {
      stopCamera();

      setCameraMessage(
        cameraError?.name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow camera access or use the manual/scanner input.'
          : 'Unable to start the camera. Use the manual/scanner input below.'
      );
    }
  };

  const submitManual = async (event) => {
    event.preventDefault();
    await lookupQr(manualValue);
  };

  const reset = () => {
    stopCamera();
    setManualValue('');
    setLastScannedId('');
    setData(null);
    setError('');
    setCameraMessage('');
  };

  return (
    <section className="w-full min-w-0 space-y-4 pb-8 sm:space-y-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-600 sm:text-sm">
          QR Scanner
        </p>

        <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Scan & Retrieve QR Data
        </h2>

        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
          Scan a generated QR code. The QR contains the parent MongoDB ID,
          which is used to retrieve and display the complete stored record.
        </p>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-extrabold text-slate-900">
                Camera Scanner
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Use the rear camera when available.
              </p>
            </div>

            <div className="flex gap-2">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={busy}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg bg-orange-500 px-3.5 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:text-sm"
                >
                  Start Camera
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
                >
                  Stop Camera
                </button>
              )}
            </div>
          </div>

          <div className="relative mt-4 aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-full w-full object-cover"
            />

            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center text-white/70">
                <QrFrameIcon />
                <p className="mt-3 text-xs sm:text-sm">
                  Start the camera to scan a QR code.
                </p>
              </div>
            )}

            {cameraActive && (
              <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-orange-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.20)]" />
            )}
          </div>

          {cameraMessage && (
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600">
              {cameraMessage}
            </p>
          )}

          <div className="my-4 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400">
              OR
            </span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={submitManual} className="space-y-3">
            <div>
              <label
                htmlFor="qr-value"
                className="text-xs font-bold text-slate-700 sm:text-sm"
              >
                MongoDB ID / Scanner Input
              </label>

              <input
                id="qr-value"
                autoComplete="off"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Scan or paste 24-character MongoDB ID"
                className="mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="submit"
                disabled={busy || !manualValue.trim()}
                className="min-h-11 rounded-lg bg-orange-500 px-3 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50 sm:text-sm"
              >
                {busy ? 'Retrieving...' : 'Retrieve Data'}
              </button>

              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 sm:text-sm"
              >
                Clear
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 sm:text-sm">
              {error}
            </div>
          )}
        </section>

        <section className="min-w-0">
          {!data ? (
            <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center sm:min-h-full sm:rounded-2xl">
              <div>
                <DatabaseIcon />
                <h3 className="mt-3 font-bold text-slate-800">
                  No QR record loaded
                </h3>
                <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500 sm:text-sm">
                  Scan a QR code or enter its MongoDB ID to retrieve the complete
                  stored document.
                </p>
              </div>
            </div>
          ) : (
            <RecordResult
              result={data}
              scannedId={lastScannedId}
            />
          )}
        </section>
      </div>
    </section>
  );
}

function RecordResult({ result, scannedId }) {
  const record = result.record || {};
  const lines = Array.isArray(record.lines) ? record.lines : [];

  return (
    <div className="min-w-0 space-y-3 sm:space-y-4">
      <section className="rounded-xl border border-emerald-200 bg-white p-3.5 shadow-sm sm:rounded-2xl sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h3 className="font-extrabold text-slate-900">
                QR Record Found
              </h3>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Complete parent MongoDB document
            </p>
          </div>

          <span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-orange-700 sm:text-xs">
            {result.brandName || record.brandName || 'Unknown Brand'}
          </span>
        </div>

        <dl className="mt-4 grid min-w-0 gap-3 min-[390px]:grid-cols-2">
          <Info label="MongoDB ID" value={String(record._id || scannedId || '—')} mono />
          <Info label="Brand" value={record.brandName || result.brandName || '—'} />
          <Info label="Package Date" value={formatDate(record.packageDate)} />
          <Info label="Total Lines" value={lines.length} />
          <Info label="Created" value={formatDateTime(record.createdAt)} />
          <Info label="Updated" value={formatDateTime(record.updatedAt)} />
        </dl>
      </section>

      {lines.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          This record does not contain any line data.
        </section>
      ) : (
        lines.map((line, lineIndex) => (
          <LineCard
            key={line._id || `${line.lineNumber}-${lineIndex}`}
            line={line}
          />
        ))
      )}
    </div>
  );
}

function LineCard({ line }) {
  const qrCodes = Array.isArray(line.qrCodes) ? line.qrCodes : [];

  return (
    <article className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-orange-50/60 px-3.5 py-3 sm:px-5">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
            Line
          </p>
          <h4 className="text-lg font-extrabold text-slate-900">
            Line {line.lineNumber ?? '—'}
          </h4>
        </div>

        <span className="rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
          {line.weight ?? '—'} kg
        </span>
      </div>

      <div className="p-3.5 sm:p-5">
        <dl className="grid min-w-0 gap-3 min-[390px]:grid-cols-2">
          <Info label="Vendor" value={line.vendorName || '—'} />
          <Info label="Farmer" value={line.farmerName || '—'} />
          <Info label="Supervisor" value={line.supervisor || '—'} />
          <Info label="Weight" value={`${line.weight ?? '—'} kg`} />
          <Info
            label="Coordinates"
            value={
              line.geolocation
                ? `${line.geolocation.latitude}, ${line.geolocation.longitude}`
                : '—'
            }
          />
          <Info label="Created" value={formatDateTime(line.createdDate || line.createdAt)} />
          <div className="min-w-0 min-[390px]:col-span-2">
            <Info label="Address" value={line.address || '—'} />
          </div>
        </dl>

        <div className="mt-4">
          <h5 className="text-xs font-extrabold uppercase tracking-[0.08em] text-slate-700">
            QR Categories
          </h5>

          {qrCodes.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              No QR categories stored for this line.
            </p>
          ) : (
            <div className="mt-2 grid min-w-0 gap-2 sm:grid-cols-2">
              {qrCodes.map((qr, index) => (
                <QrCategoryCard
                  key={qr._id || `${qr.numberOfHands}-${index}`}
                  qr={qr}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

function QrCategoryCard({ qr }) {
  const stickers = Array.isArray(qr.stickers) ? qr.stickers : [];
  const quantity = qr.quantity ?? stickers.length;

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-slate-900">
          {qr.numberOfHands ?? '—'}-Hand
        </strong>

        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-[10px] font-extrabold text-orange-700 sm:text-xs">
          Qty {quantity}
        </span>
      </div>
    </div>
  );
}

function Info({ label, value, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </dt>
      <dd
        className={`mt-0.5 break-words text-xs font-semibold text-slate-800 sm:text-sm ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value ?? '—'}
      </dd>
    </div>
  );
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function QrFrameIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-12 w-12 text-white/60"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="mx-auto h-10 w-10 text-orange-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <ellipse cx="12" cy="5" rx="7" ry="3" />
      <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
      <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </svg>
  );
}
