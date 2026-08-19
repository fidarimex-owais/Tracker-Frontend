import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getUsers,
  updateUserBrand,
  updateUserRole,
  updateUserStatus,
} from '../../services/adminService';

import { useAuth } from '../../auth/useAuth';

const BRAND_OPTIONS = [
  'Hi Banana',
  'Rajmata',
  'Banana Man',
];

const ROLE_LABELS = {
  admin: 'Admin',
  subadmin: 'Sub-Admin',
  vendor: 'Vendor',
  supervisor: 'Supervisor',
};

const FILTERS_BY_ACTOR = {
  admin: [
    'all',
    'admin',
    'subadmin',
    'vendor',
    'supervisor',
  ],
  subadmin: [
    'all',
    'vendor',
    'supervisor',
  ],
  vendor: [
    'all',
    'supervisor',
  ],
};

const MANAGEABLE_ROLE_OPTIONS = {
  admin: [
    'admin',
    'subadmin',
    'vendor',
    'supervisor',
  ],
  subadmin: [
    'vendor',
    'supervisor',
  ],
  vendor: [
    'supervisor',
  ],
};

const portalLabel = (role) =>
  role === 'subadmin'
    ? 'SUB-ADMIN'
    : role.toUpperCase();

const descriptionForRole = (user) => {
  if (user.role === 'admin') {
    return 'View users and manage brand assignments across the system.';
  }

  if (user.role === 'subadmin') {
    return 'View and manage Vendor and Supervisor accounts across all brands.';
  }

  if (user.role === 'vendor') {
    return `View and manage Supervisor accounts assigned to ${user.brandName || 'your brand'}.`;
  }

  return 'View users.';
};

export default function UserManagement() {
  const {
    user: currentUser,
  } = useAuth();

  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const filters =
    FILTERS_BY_ACTOR[currentUser.role] || ['all'];

  const roleOptions =
    MANAGEABLE_ROLE_OPTIONS[currentUser.role] || [];

  const canChangeRoles = currentUser.role !== 'vendor';
  const canChangeBrands = ['admin', 'subadmin'].includes(
    currentUser.role
  );

  useEffect(() => {
    let active = true;

    getUsers(currentUser.role)
      .then((result) => {
        if (active) {
          setUsers(result.users || []);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e.response?.data?.message ||
              e.message
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
  }, [currentUser.role]);

  const counts = useMemo(() => {
    const next = {
      all: users.length,
      admin: 0,
      subadmin: 0,
      vendor: 0,
      supervisor: 0,
    };

    for (const user of users) {
      if (next[user.role] !== undefined) {
        next[user.role] += 1;
      }
    }

    return next;
  }, [users]);

  const visibleUsers = useMemo(
    () =>
      roleFilter === 'all'
        ? users
        : users.filter(
            (user) => user.role === roleFilter
          ),
    [roleFilter, users]
  );

  const changeRole = async (id, role) => {
    setBusyId(id);
    setError('');

    try {
      const result = await updateUserRole(
        id,
        role,
        currentUser.role
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === id
            ? result.user
            : user
        )
      );
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message
      );
    } finally {
      setBusyId(null);
    }
  };

  const changeBrand = async (id, brandName) => {
    setBusyId(id);
    setError('');

    try {
      const result = await updateUserBrand(
        id,
        brandName,
        currentUser.role
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === id
            ? result.user
            : user
        )
      );
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message
      );
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (target) => {
    setBusyId(target.id);
    setError('');

    try {
      const result = await updateUserStatus(
        target.id,
        !target.isActive,
        currentUser.role
      );

      setUsers((previous) =>
        previous.map((user) =>
          user.id === target.id
            ? result.user
            : user
        )
      );
    } catch (e) {
      setError(
        e.response?.data?.message ||
          e.message
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold text-blue-700">
          {portalLabel(currentUser.role)}
        </p>

        <h2 className="text-3xl font-bold text-slate-900">
          User
        </h2>

        <p className="mt-2 max-w-3xl text-slate-500">
          {descriptionForRole(currentUser)}
        </p>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {filters.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setRoleFilter(role)}
            className={`rounded-xl border px-4 py-3 text-left shadow-sm transition ${
              roleFilter === role
                ? 'border-blue-800 bg-blue-900 text-white'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <p className="text-xs font-semibold uppercase tracking-wide opacity-70">
              {role === 'all'
                ? 'All Users'
                : ROLE_LABELS[role]}
            </p>

            <p className="mt-1 text-2xl font-bold">
              {counts[role] || 0}
            </p>
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-slate-500">
          Loading users...
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Brand</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {visibleUsers.map((user) => {
                const isBrandUser = [
                  'vendor',
                  'supervisor',
                ].includes(user.role);

                return (
                  <tr key={user.id}>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {user.userName || '—'}
                    </td>

                    <td className="px-4 py-3">
                      {isBrandUser && canChangeBrands ? (
                        <select
                          disabled={busyId === user.id}
                          value={user.brandName || ''}
                          onChange={(event) =>
                            changeBrand(
                              user.id,
                              event.target.value
                            )
                          }
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
                        >
                          <option value="" disabled>
                            Select brand
                          </option>

                          {BRAND_OPTIONS.map((brand) => (
                            <option
                              key={brand}
                              value={brand}
                            >
                              {brand}
                            </option>
                          ))}
                        </select>
                      ) : isBrandUser ? (
                        <span className="font-medium text-slate-700">
                          {user.brandName || 'Not assigned'}
                        </span>
                      ) : (
                        <span className="text-slate-400">
                          All brands
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-800">
                      {user.email}

                      {user.id === currentUser.id && (
                        <span className="ml-2 text-xs text-blue-700">
                          You
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {canChangeRoles ? (
                        <select
                          disabled={busyId === user.id}
                          value={user.role}
                          onChange={(event) =>
                            changeRole(
                              user.id,
                              event.target.value
                            )
                          }
                          className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
                        >
                          {roleOptions.map((role) => (
                            <option
                              key={role}
                              value={role}
                            >
                              {ROLE_LABELS[role]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-medium text-slate-700">
                          {ROLE_LABELS[user.role] || user.role}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          user.isActive
                            ? 'bg-green-100 text-green-700'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {user.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : '—'}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        disabled={busyId === user.id}
                        onClick={() => toggleStatus(user)}
                        className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {user.isActive
                          ? 'Deactivate'
                          : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {visibleUsers.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-4 py-10 text-center text-slate-400"
                  >
                    No users found for this role and brand access.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
