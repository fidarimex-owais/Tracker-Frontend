import { useEffect, useMemo, useState } from 'react';
import {
  getIdentityDocumentAccess,
  getIdentityDocuments,
} from '../../services/adminService';

const ROLE_LABELS = {
  subadmin: 'Sub-Admin',
  vendor: 'Vendor',
  supervisor: 'Supervisor',
};

const STATUS_LABELS = {
  active: 'Active user',
  inactive: 'Inactive user',
  pending: 'Pending signup',
  processing: 'Processing signup',
};

const formatAadhaar = (value) =>
  String(value || '').replace(/(\d{4})(?=\d)/g, '$1 ');

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatSize = (bytes) =>
  Number(bytes) >= 1024
    ? `${Math.round(Number(bytes) / 1024)} KB`
    : `${Number(bytes) || 0} B`;

export default function IdentityDocuments() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getIdentityDocuments();
      setRecords(result.records || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load identity records'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredRecords = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return records;

    return records.filter((record) =>
      [
        record.userName,
        record.email,
        ROLE_LABELS[record.role],
        record.panNumber,
        record.aadhaarNumber,
        record.vendorName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(search)
        )
    );
  }, [query, records]);

  const openDocument = async (record, document) => {
    const key = `${record.source}-${record.id}-${document.id}`;
    const popup = window.open('about:blank', '_blank');

    if (popup) {
      popup.opener = null;
      popup.document.title = 'Opening secure document…';
    }

    setOpeningId(key);
    setError('');

    try {
      const result = await getIdentityDocumentAccess(
        record.source,
        record.id,
        document.id
      );

      if (popup) {
        popup.location.replace(result.url);
      } else {
        setError(
          'The browser blocked the document window. Allow pop-ups for this site and try again.'
        );
      }
    } catch (requestError) {
      if (popup) {
        popup.close();
      }
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to open document'
      );
    } finally {
      setOpeningId('');
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-orange-600 sm:text-sm">
            Admin only
          </p>
          <h2 className="mt-1 text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Identity & Documents
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            PAN, Aadhaar, and registration documents are sensitive. This page is available only to authenticated Admin users. Document links are generated only when opened and expire after a short time.
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
            Search identity records
          </span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, role, PAN, Aadhaar, or Vendor"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
          />
        </label>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
          Loading identity records…
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 shadow-sm">
          No identity submissions found.
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredRecords.map((record) => (
            <article
              key={`${record.source}-${record.id}`}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <h3 className="truncate text-base font-extrabold text-slate-900">
                    {record.userName || 'Unnamed user'}
                  </h3>
                  <p className="mt-0.5 truncate text-sm text-slate-500">
                    {record.email}
                  </p>
                </div>

                <div className="flex flex-wrap justify-end gap-1.5 text-[10px] font-extrabold uppercase tracking-wide">
                  <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
                    {ROLE_LABELS[record.role] || record.role}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                    {STATUS_LABELS[record.status] || record.status}
                  </span>
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
                <SensitiveValue
                  label="PAN Card"
                  value={record.panNumber}
                  verification="Format verified"
                />
                <SensitiveValue
                  label="Aadhaar Card"
                  value={formatAadhaar(record.aadhaarNumber)}
                  verification="Checksum verified"
                />

                {record.vendorName && (
                  <InfoValue label="Vendor" value={record.vendorName} />
                )}
                <InfoValue
                  label="Submitted"
                  value={formatDate(record.createdAt)}
                />
              </div>

              <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h4 className="text-sm font-extrabold text-slate-800">
                    Uploaded Documents
                  </h4>
                  <span className="text-xs font-semibold text-slate-500">
                    {record.documents?.length || 0}/5
                  </span>
                </div>

                {record.documents?.length ? (
                  <div className="space-y-2">
                    {record.documents.map((document) => {
                      const key = `${record.source}-${record.id}-${document.id}`;
                      return (
                        <div
                          key={document.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-800">
                              {document.originalName}
                            </p>
                            <p className="mt-0.5 text-[11px] text-slate-500">
                              {formatSize(document.bytes)} · {document.mimeType}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => openDocument(record, document)}
                            disabled={openingId === key}
                            className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-orange-600 disabled:opacity-60"
                          >
                            {openingId === key ? 'Opening…' : 'Open'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-3 text-sm text-slate-500">
                    No additional documents were uploaded.
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function SensitiveValue({ label, value, verification }) {
  return (
    <div className="rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-orange-700">
        {label}
      </p>
      <p className="mt-1 break-all font-mono text-sm font-extrabold tracking-wide text-slate-900">
        {value || '—'}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-emerald-700">
        {verification}
      </p>
    </div>
  );
}

function InfoValue({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-slate-800">
        {value || '—'}
      </p>
    </div>
  );
}
