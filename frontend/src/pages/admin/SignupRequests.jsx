// frontend/src/pages/admin/SignupRequests.jsx

import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth';

import {
  SIGNUP_REQUESTS_CHANGED_EVENT,
  approveSignupRequest,
  getSignupRequests,
  getVendorOptions,
  rejectSignupRequest,
} from '../../services/adminService';

const ROLE_LABELS = {
  subadmin: 'Sub-Admin',
  vendor: 'Vendor',
  supervisor: 'Supervisor',
};

const portalLabel = (role) =>
  role === 'subadmin'
    ? 'Sub-Admin'
    : role.charAt(0).toUpperCase() + role.slice(1);

const descriptionForUser = (user) => {
  if (user.role === 'vendor') {
    return 'Only Supervisor requests assigned to your Vendor account are shown here.';
  }

  if (user.role === 'admin') {
    return 'Sub-Admin, Vendor, and Supervisor signup requests are shown here. Supervisor requests include their selected Vendor.';
  }

  return 'Vendor and Supervisor signup requests are shown here. Supervisor requests include their selected Vendor.';
};

export default function SignupRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [vendorSelections, setVendorSelections] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getSignupRequests(user.role);
      setRequests(result.requests || []);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to load signup requests'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    const requestsPromise = getSignupRequests(user.role);
    const vendorsPromise = ['admin', 'subadmin'].includes(user.role)
      ? getVendorOptions()
      : Promise.resolve({ vendors: [] });

    Promise.all([requestsPromise, vendorsPromise])
      .then(([requestResult, vendorResult]) => {
        if (active) {
          const nextRequests = requestResult.requests || [];
          setRequests(nextRequests);
          setVendors(vendorResult.vendors || []);
          setVendorSelections(
            Object.fromEntries(
              nextRequests
                .filter((request) => request.role === 'supervisor')
                .map((request) => [request.id, request.vendorId || ''])
            )
          );
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              requestError.message ||
              'Unable to load signup requests'
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [user.role]);

  const notifyCountChanged = () => {
    window.dispatchEvent(
      new Event(SIGNUP_REQUESTS_CHANGED_EVENT)
    );
  };

  const handleApprove = async (request) => {
    setBusyId(request.id);
    setError('');
    setSuccess('');

    try {
      const vendorId =
        request.role === 'supervisor'
          ? user.role === 'vendor'
            ? user.id
            : vendorSelections[request.id] || request.vendorId || ''
          : '';

      if (request.role === 'supervisor' && !vendorId) {
        setError('Select a Vendor before approving this Supervisor request.');
        setBusyId('');
        return;
      }

      const result = await approveSignupRequest(
        request.id,
        user.role,
        vendorId
      );

      setRequests((current) =>
        current.filter((item) => item.id !== request.id)
      );

      setSuccess(
        `${request.userName} was approved as ${ROLE_LABELS[request.role]}${request.role === 'supervisor' ? ` for ${result.user?.vendorName || request.vendorName || 'the selected Vendor'}` : ''}.`
      );

      notifyCountChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to approve signup request'
      );

      await loadRequests();
      notifyCountChanged();
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (request) => {
    setBusyId(request.id);
    setError('');
    setSuccess('');

    try {
      await rejectSignupRequest(
        request.id,
        user.role
      );

      setRequests((current) =>
        current.filter((item) => item.id !== request.id)
      );

      setSuccess(
        `${request.userName}'s ${ROLE_LABELS[request.role]} signup request was rejected.`
      );

      notifyCountChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to reject signup request'
      );

      await loadRequests();
      notifyCountChanged();
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            {portalLabel(user.role)}
          </p>

          <h2 className="text-2xl font-bold sm:text-3xl text-slate-900">
            Signup Requests
          </h2>

          <p className="mt-2 text-slate-500">
            {descriptionForUser(user)}
          </p>
        </div>

        <button
          type="button"
          onClick={loadRequests}
          disabled={loading}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
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

      <div className="responsive-scroll rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-[680px] w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Vendor</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading signup requests...
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No pending signup requests for your role and Vendor access.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const busy = busyId === request.id;

                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {request.userName}
                    </td>

                    <td className="px-4 py-3 font-semibold text-slate-700">
                      {request.role === 'supervisor' && ['admin', 'subadmin'].includes(user.role) ? (
                        <select
                          value={vendorSelections[request.id] || ''}
                          onChange={(event) =>
                            setVendorSelections((current) => ({
                              ...current,
                              [request.id]: event.target.value,
                            }))
                          }
                          disabled={busy}
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                        >
                          <option value="">Select Vendor</option>
                          {vendors.map((vendor) => (
                            <option key={vendor.id} value={vendor.id}>
                              {vendor.userName}
                            </option>
                          ))}
                        </select>
                      ) : request.role === 'supervisor' ? (
                        request.vendorName || 'Assigned to you'
                      ) : (
                        'Not applicable'
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {ROLE_LABELS[request.role] || request.role}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {request.email}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleApprove(request)}
                          className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                        >
                          {busy ? 'Working...' : 'Approve'}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => handleReject(request)}
                          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
