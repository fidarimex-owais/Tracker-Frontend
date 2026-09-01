import { useEffect, useMemo, useState } from 'react';
import {
  deleteIdentityDocumentFile,
  deleteIdentityDocumentRecord,
  getIdentityDocumentAccess,
  getIdentityDocuments,
  updateIdentityDocumentRecord,
} from '../../services/adminService';
import {
  filesToIdentityPayload,
  formatBytes,
  isValidAadhaar,
  isValidPan,
  normalizeAadhaar,
  normalizePan,
  validateIdentityFiles,
} from '../../utils/identityRegistration';

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

const MAX_DOCUMENTS = 5;

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

const recordKey = (record) => `${record.source}-${record.id}`;

export default function IdentityDocuments() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openingId, setOpeningId] = useState('');
  const [deletingId, setDeletingId] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editingRecord, setEditingRecord] = useState(null);
  const [editForm, setEditForm] = useState({
    companyName: '',
    panNumber: '',
    aadhaarNumber: '',
  });
  const [editDocuments, setEditDocuments] = useState([]);
  const [editErrors, setEditErrors] = useState({});
  const [saving, setSaving] = useState(false);

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
        record.companyName,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLowerCase().includes(search)
        )
    );
  }, [query, records]);

  const replaceRecord = (nextRecord) => {
    setRecords((current) =>
      current.map((record) =>
        record.source === nextRecord.source &&
        record.id === nextRecord.id
          ? nextRecord
          : record
      )
    );
  };

  const openDocument = async (record, document) => {
    const key = `${recordKey(record)}-${document.id}`;
    const popup = window.open('about:blank', '_blank');

    if (popup) {
      popup.opener = null;
      popup.document.title = 'Opening secure document…';
    }

    setOpeningId(key);
    setError('');
    setSuccess('');

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
      if (popup) popup.close();
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to open document'
      );
    } finally {
      setOpeningId('');
    }
  };

  const startEdit = (record) => {
    setEditingRecord(record);
    setEditForm({
      companyName: record.companyName || '',
      panNumber: record.panNumber || '',
      aadhaarNumber: record.aadhaarNumber || '',
    });
    setEditDocuments([]);
    setEditErrors({});
    setError('');
    setSuccess('');
  };

  const cancelEdit = () => {
    setEditingRecord(null);
    setEditDocuments([]);
    setEditErrors({});
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    const nextValue =
      name === 'panNumber'
        ? normalizePan(value)
        : name === 'aadhaarNumber'
          ? normalizeAadhaar(value)
          : value;

    setEditForm((current) => ({
      ...current,
      [name]: nextValue,
    }));
    setEditErrors((current) => ({
      ...current,
      [name]: '',
    }));
  };

  const handleEditDocuments = (event) => {
    const files = Array.from(event.target.files || []);
    const baseError = validateIdentityFiles(files);
    const total =
      (editingRecord?.documents?.length || 0) + files.length;

    const documentError =
      baseError ||
      (total > MAX_DOCUMENTS
        ? `Only ${MAX_DOCUMENTS} documents can be stored. Delete an existing document before adding more.`
        : '');

    if (documentError) {
      setEditDocuments([]);
      setEditErrors((current) => ({
        ...current,
        documents: documentError,
      }));
      event.target.value = '';
      return;
    }

    setEditDocuments(files);
    setEditErrors((current) => ({
      ...current,
      documents: '',
    }));
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editingRecord) return;

    const errors = {};

    if (!isValidPan(editForm.panNumber)) {
      errors.panNumber =
        'Enter a valid PAN number (for example ABCDE1234F)';
    }

    if (!isValidAadhaar(editForm.aadhaarNumber)) {
      errors.aadhaarNumber = 'Enter a valid 12-digit Aadhaar number';
    }

    if (
      editingRecord.role === 'vendor' &&
      (editForm.companyName.trim().length < 2 ||
        editForm.companyName.trim().length > 120)
    ) {
      errors.companyName =
        'Enter the Vendor company name (2 to 120 characters)';
    }

    const fileError = validateIdentityFiles(editDocuments);
    if (fileError) errors.documents = fileError;

    if (
      (editingRecord.documents?.length || 0) +
        editDocuments.length >
      MAX_DOCUMENTS
    ) {
      errors.documents = `Only ${MAX_DOCUMENTS} documents can be stored.`;
    }

    if (Object.keys(errors).length > 0) {
      setEditErrors(errors);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const documents = await filesToIdentityPayload(editDocuments);
      const result = await updateIdentityDocumentRecord(
        editingRecord.source,
        editingRecord.id,
        {
          companyName:
            editingRecord.role === 'vendor'
              ? editForm.companyName.trim().replace(/\s+/g, ' ')
              : '',
          panNumber: normalizePan(editForm.panNumber),
          aadhaarNumber: normalizeAadhaar(editForm.aadhaarNumber),
          documents,
        }
      );

      replaceRecord(result.record);
      setEditingRecord(null);
      setEditDocuments([]);
      setEditErrors({});
      setSuccess(`${editingRecord.userName}'s identity information was updated.`);
    } catch (requestError) {
      const data = requestError.response?.data;
      const nextErrors = {};

      (data?.errors || []).forEach((item) => {
        if (item.field) nextErrors[item.field] = item.message;
      });

      setEditErrors(nextErrors);
      setError(
        data?.message ||
          requestError.message ||
          'Unable to update identity information'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteDocument = async (record, document) => {
    const confirmed = window.confirm(
      `Delete "${document.originalName}" permanently? This also removes the file from Cloudinary.`
    );
    if (!confirmed) return;

    const key = `${recordKey(record)}-${document.id}`;
    setDeletingId(key);
    setError('');
    setSuccess('');

    try {
      const result = await deleteIdentityDocumentFile(
        record.source,
        record.id,
        document.id
      );
      replaceRecord(result.record);
      setSuccess(`Document "${document.originalName}" was deleted.`);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to delete document'
      );
    } finally {
      setDeletingId('');
    }
  };

  const deleteIdentity = async (record) => {
    const confirmed = window.confirm(
      record.source === 'signup-request'
        ? `Delete ${record.userName}'s pending signup request, PAN, Aadhaar, and all uploaded documents?\n\nThis action cannot be undone.`
        : `Delete PAN, Aadhaar, and all uploaded identity documents for ${record.userName}?\n\nThis does NOT delete the user's login account. This action cannot be undone.`
    );
    if (!confirmed) return;

    const key = recordKey(record);
    setDeletingId(key);
    setError('');
    setSuccess('');

    try {
      await deleteIdentityDocumentRecord(record.source, record.id);
      setRecords((current) =>
        current.filter(
          (item) =>
            !(
              item.source === record.source &&
              item.id === record.id
            )
        )
      );

      if (
        editingRecord?.source === record.source &&
        editingRecord?.id === record.id
      ) {
        cancelEdit();
      }

      setSuccess(
        record.source === 'signup-request'
          ? `${record.userName}'s pending signup request and identity documents were deleted.`
          : `${record.userName}'s identity information and uploaded documents were deleted. The login account was kept.`
      );
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to delete identity information'
      );
    } finally {
      setDeletingId('');
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
            Admins can securely view and edit PAN/Aadhaar information, add or delete documents, and remove identity submissions. For active users, deleting identity data keeps the login account. For pending signups, Delete removes the pending request too.
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

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">
          {success}
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
            placeholder="Search name, company, email, role, PAN, Aadhaar, or Vendor"
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
          {filteredRecords.map((record) => {
            const key = recordKey(record);
            const editing =
              editingRecord?.source === record.source &&
              editingRecord?.id === record.id;

            return (
              <article
                key={key}
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

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex flex-wrap justify-end gap-1.5 text-[10px] font-extrabold uppercase tracking-wide">
                      <span className="rounded-full bg-orange-50 px-2.5 py-1 text-orange-700">
                        {ROLE_LABELS[record.role] || record.role}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                        {STATUS_LABELS[record.status] || record.status}
                      </span>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          editing ? cancelEdit() : startEdit(record)
                        }
                        disabled={deletingId === key || record.status === 'processing'}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-extrabold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        {editing ? 'Cancel Edit' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteIdentity(record)}
                        disabled={deletingId === key || record.status === 'processing'}
                        className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingId === key ? 'Deleting…' : 'Delete Identity'}
                      </button>
                    </div>
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

                  {record.role === 'vendor' && (
                    <InfoValue
                      label="Company Name"
                      value={record.companyName || 'Not provided'}
                    />
                  )}
                  {record.vendorName && (
                    <InfoValue label="Vendor" value={record.vendorName} />
                  )}
                  <InfoValue
                    label="Submitted"
                    value={formatDate(record.createdAt)}
                  />
                </div>

                {editing && (
                  <form
                    onSubmit={saveEdit}
                    className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5"
                  >
                    <div className="mb-3">
                      <h4 className="text-sm font-extrabold text-slate-900">
                        Edit Identity Information
                      </h4>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        PAN and Aadhaar are encrypted again when saved. New documents are added to the existing list.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {record.role === 'vendor' && (
                        <EditField
                          label="Company Name"
                          error={editErrors.companyName}
                          className="sm:col-span-2"
                        >
                          <input
                            type="text"
                            name="companyName"
                            maxLength="120"
                            value={editForm.companyName}
                            onChange={handleEditChange}
                            placeholder="Enter company name"
                            className={editInputClass(editErrors.companyName)}
                          />
                        </EditField>
                      )}

                      <EditField
                        label="PAN Card Number"
                        error={editErrors.panNumber}
                      >
                        <input
                          type="text"
                          name="panNumber"
                          maxLength="10"
                          value={editForm.panNumber}
                          onChange={handleEditChange}
                          className={editInputClass(editErrors.panNumber)}
                        />
                      </EditField>

                      <EditField
                        label="Aadhaar Card Number"
                        error={editErrors.aadhaarNumber}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          name="aadhaarNumber"
                          maxLength="12"
                          value={editForm.aadhaarNumber}
                          onChange={handleEditChange}
                          className={editInputClass(editErrors.aadhaarNumber)}
                        />
                      </EditField>

                      <EditField
                        label={`Add Documents (${record.documents?.length || 0}/${MAX_DOCUMENTS} stored)`}
                        error={editErrors.documents}
                        className="sm:col-span-2"
                      >
                        <input
                          type="file"
                          multiple
                          accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                          onChange={handleEditDocuments}
                          className="identity-file-input block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-600"
                        />
                        {editDocuments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {editDocuments.map((file) => (
                              <span
                                key={`${file.name}-${file.size}`}
                                className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600"
                              >
                                {file.name} · {formatBytes(file.size)}
                              </span>
                            ))}
                          </div>
                        )}
                      </EditField>
                    </div>

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-lg bg-orange-500 px-4 py-2 text-xs font-extrabold text-white hover:bg-orange-600 disabled:opacity-50"
                      >
                        {saving ? 'Saving…' : 'Save Changes'}
                      </button>
                    </div>
                  </form>
                )}

                <div className="border-t border-slate-100 px-4 py-4 sm:px-5">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-extrabold text-slate-800">
                      Uploaded Documents
                    </h4>
                    <span className="text-xs font-semibold text-slate-500">
                      {record.documents?.length || 0}/{MAX_DOCUMENTS}
                    </span>
                  </div>

                  {record.documents?.length ? (
                    <div className="space-y-2">
                      {record.documents.map((document) => {
                        const documentKey = `${key}-${document.id}`;
                        return (
                          <div
                            key={document.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-slate-800">
                                {document.originalName}
                              </p>
                              <p className="mt-0.5 text-[11px] text-slate-500">
                                {formatSize(document.bytes)} · {document.mimeType}
                              </p>
                            </div>

                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openDocument(record, document)}
                                disabled={openingId === documentKey}
                                className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-orange-600 disabled:opacity-60"
                              >
                                {openingId === documentKey ? 'Opening…' : 'Open'}
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteDocument(record, document)}
                                disabled={deletingId === documentKey || record.status === 'processing'}
                                className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                {deletingId === documentKey ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
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
            );
          })}
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
      <p className="mt-1 break-all text-sm font-extrabold text-slate-900">
        {value || '—'}
      </p>
      <p className="mt-1 text-[10px] font-semibold text-green-700">
        {verification}
      </p>
    </div>
  );
}

function InfoValue({ label, value }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-slate-800">
        {value || '—'}
      </p>
    </div>
  );
}

function EditField({ label, error, className = '', children }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-extrabold text-slate-700">
        {label}
      </span>
      {children}
      {error && (
        <span className="mt-1 block text-[11px] font-semibold text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

function editInputClass(error) {
  return `w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:ring-2 ${
    error
      ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-orange-500 focus:ring-orange-100'
  }`;
}
