import { useEffect, useState } from 'react';
import { getUsers, updateUserRole, updateUserStatus } from '../../services/adminService';
import { useAuth } from '../../auth/useAuth';

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const isSubAdmin = currentUser.role === 'subadmin';

  useEffect(() => {
    let active = true;
    getUsers(currentUser.role)
      .then((result) => { if (active) setUsers(result.users); })
      .catch((e) => { if (active) setError(e.response?.data?.message || e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [currentUser.role]);

  const changeRole = async (id, role) => {
    setBusyId(id);
    setError('');
    try {
      const result = await updateUserRole(id, role, currentUser.role);
      setUsers((prev) => prev.map((u) => (u.id === id ? result.user : u)));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleStatus = async (target) => {
    setBusyId(target.id);
    setError('');
    try {
      const result = await updateUserStatus(target.id, !target.isActive, currentUser.role);
      setUsers((prev) => prev.map((u) => (u.id === target.id ? result.user : u)));
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section>
      <div className="mb-6">
        <p className="text-sm font-semibold text-blue-700">{isSubAdmin ? 'SUB-ADMIN' : 'ADMIN'}</p>
        <h2 className="text-3xl font-bold text-slate-900">User Management</h2>
        <p className="mt-2 text-slate-500">
          {isSubAdmin
            ? 'Manage Vendor and Supervisor accounts. Admin and Sub-Admin accounts can only be managed by an Admin.'
            : 'New public sign-ups start as Vendor. Assign Vendor, Supervisor, Sub-Admin, or Admin access here.'}
        </p>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <p className="text-slate-500">Loading users...</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.email}
                    {u.id === currentUser.id && <span className="ml-2 text-xs text-blue-700">You</span>}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      disabled={busyId === u.id}
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1.5"
                    >
                      <option value="vendor">Vendor</option>
                      <option value="supervisor">Supervisor</option>
                      {!isSubAdmin && <option value="subadmin">Sub-Admin</option>}
                      {!isSubAdmin && <option value="admin">Admin</option>}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}>
                      {u.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button
                      disabled={busyId === u.id}
                      onClick={() => toggleStatus(u)}
                      className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {u.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
