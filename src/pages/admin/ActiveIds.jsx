import {
  useEffect,
  useState,
} from 'react';

import {
  getActiveIds,
} from '../../services/adminService';

const ROLE_LABELS = {
  vendor: 'Vendor',
  subadmin: 'Sub-Admin',
  supervisor: 'Supervisor',
};

export default function ActiveIds() {
  const [users, setUsers] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');

    try {
      const result =
        await getActiveIds();

      setUsers(
        result.users || []
      );
    } catch (requestError) {
      setError(
        requestError.response
          ?.data?.message ||
          requestError.message ||
          'Unable to load active IDs'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    getActiveIds()
      .then((result) => {
        if (active) {
          setUsers(
            result.users || []
          );
        }
      })
      .catch(
        (requestError) => {
          if (active) {
            setError(
              requestError
                .response?.data
                ?.message ||
                requestError.message ||
                'Unable to load active IDs'
            );
          }
        }
      )
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-orange-600">
            Admin
          </p>

          <h2 className="text-3xl font-bold text-slate-900">
            Active IDs
          </h2>

          <p className="mt-2 text-slate-500">
            Active IDs created through
            the Admin Portal.
          </p>
        </div>

        <button
          type="button"
          onClick={loadUsers}
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
                Status
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
                  Loading active IDs...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td
                  colSpan="5"
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No active IDs have
                  been created yet.
                </td>
              </tr>
            ) : (
              users.map(
                (user) => (
                  <tr
                    key={
                      user.id
                    }
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {user.userName ||
                        '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {user.companyName ||
                        '—'}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {ROLE_LABELS[
                        user.role
                      ] ||
                        user.role}
                    </td>

                    <td className="px-4 py-3 text-slate-600">
                      {user.email}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    </td>
                  </tr>
                )
              )
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}