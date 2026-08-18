import { useEffect, useState } from 'react';

import {
  SIGNUP_REQUESTS_CHANGED_EVENT,
  approveSignupRequest,
  getSignupRequests,
  rejectSignupRequest,
} from '../../services/adminService';

const ROLE_LABELS = {
  vendor: 'Vendor',
  subadmin: 'Sub-Admin',
  supervisor: 'Supervisor',
};

export default function SignupRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadRequests = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await getSignupRequests();

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

    getSignupRequests()
      .then((result) => {
        if (active) {
          setRequests(result.requests || []);
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
  }, []);

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
      await approveSignupRequest(request.id);

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id
        )
      );

      setSuccess(
        `${request.userName} was approved. The user can now sign in.`
      );

      notifyCountChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to approve signup request'
      );
    } finally {
      setBusyId('');
    }
  };

  const handleReject = async (request) => {
    setBusyId(request.id);
    setError('');
    setSuccess('');

    try {
      await rejectSignupRequest(request.id);

      setRequests((current) =>
        current.filter(
          (item) => item.id !== request.id
        )
      );

      setSuccess(
        `${request.userName}'s signup request was rejected.`
      );

      notifyCountChanged();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'Unable to reject signup request'
      );
    } finally {
      setBusyId('');
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Admin
          </p>

          <h2 className="text-3xl font-bold text-slate-900">
            Signup Requests
          </h2>

          <p className="mt-2 text-slate-500">
            Review users waiting for Admin approval.
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

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">
                Name
              </th>

              <th className="px-4 py-3 font-semibold">
                Company
              </th>

              <th className="px-4 py-3 font-semibold">
                Role
              </th>

              <th className="px-4 py-3 font-semibold">
                Email
              </th>

              <th className="px-4 py-3 font-semibold">
                Action
              </th>
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
                  No pending signup requests.
                </td>
              </tr>
            ) : (
              requests.map((request) => {
                const busy =
                  busyId === request.id;

                return (
                  <tr key={request.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {request.userName}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {request.companyName}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {ROLE_LABELS[request.role] ||
                        request.role}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {request.email}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleApprove(request)
                          }
                          className="rounded-lg bg-green-700 px-3 py-2 text-xs font-semibold text-white hover:bg-green-600 disabled:opacity-50"
                        >
                          {busy
                            ? 'Working...'
                            : 'Approve'}
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            handleReject(request)
                          }
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