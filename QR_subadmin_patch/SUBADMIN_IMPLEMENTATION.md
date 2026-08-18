# Sub-Admin Portal Implementation

## Role hierarchy

The application now supports four roles:

- `admin` — full control
- `subadmin` — limited administrative control
- `vendor` — QR/barcode/sticker generation
- `supervisor` — scanning/lookup

Public sign-up still creates a `vendor` account. Only an Admin can assign the `subadmin` or `admin` role.

## Sub-Admin permissions

A Sub-Admin can:

- open `/sub-admin`
- view and manage Vendor and Supervisor users
- change a Vendor to Supervisor and a Supervisor to Vendor
- activate/deactivate Vendor and Supervisor accounts
- use the QR Generator
- use the QR/barcode Scanner

A Sub-Admin cannot:

- promote anyone to Admin
- promote anyone to Sub-Admin
- change an Admin account
- change another Sub-Admin account
- deactivate an Admin or Sub-Admin

These restrictions are enforced by the backend, not only by the frontend UI.

## Backend changes

### Updated files

- `backend/src/modules/auth/auth.model.js`
  - adds `subadmin` to the User role enum
- `backend/src/modules/admin/admin.service.js`
  - adds role-aware user-management permission checks
- `backend/src/modules/admin/admin.controller.js`
  - passes the authenticated actor into the service permission checks
- `backend/src/modules/records/records.routes.js`
  - permits `subadmin` to use records/sticker generation
- `backend/src/modules/scanning/scanning.routes.js`
  - permits `subadmin` to scan/resolve codes
- `backend/src/api/index.js`
  - mounts the new `/api/sub-admin` module

### New module

`backend/src/modules/subadmin/`

- `subadmin.routes.js`
- `subadmin.controller.js`
- `subadmin.service.js`
- `subadmin.model.js`
- `subadmin.validation.js`

Current endpoints:

- `GET /api/sub-admin/dashboard`
- `GET /api/sub-admin/users`
- `PATCH /api/sub-admin/users/:id/role`
- `PATCH /api/sub-admin/users/:id/status`

## Frontend changes

### New files

- `frontend/src/pages/subadmin/SubAdminDashboard.jsx`
- `frontend/src/auth/roleHome.js`

### Updated files

- `frontend/src/App.jsx`
- `frontend/src/layouts/PortalLayout.jsx`
- `frontend/src/components/PortalHomeRedirect.jsx`
- `frontend/src/auth/ProtectedRoute.jsx`
- `frontend/src/pages/auth/Login.jsx`
- `frontend/src/pages/auth/Signup.jsx`
- `frontend/src/pages/admin/UserManagement.jsx`
- `frontend/src/pages/admin/AdminDashboard.jsx`
- `frontend/src/services/adminService.js`

New frontend routes:

- `/sub-admin`
- `/sub-admin/users`
- `/sub-admin/scanner`
- `/sub-admin/qr-generator`

## Installation

If replacing the complete project, install dependencies in both folders:

```powershell
cd backend
npm install
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

No new npm packages were introduced specifically for the Sub-Admin portal, so an existing installation normally only needs a server restart after replacing the source files.

## Creating a Sub-Admin

1. Start backend and frontend.
2. Sign in using an Admin account.
3. Open **Admin Portal -> Users**.
4. Find the target account.
5. Change its role to **Sub-Admin**.
6. Have that user log out and log back in if necessary.
7. The user is routed to `/sub-admin`.

Do not allow public signup to submit a role field. Signup intentionally remains Vendor-only.

## Existing MongoDB data

No migration is needed for existing users. Existing `admin`, `vendor`, and `supervisor` documents remain valid. New Sub-Admin accounts simply store:

```json
{
  "role": "subadmin"
}
```

## Quick verification

### Admin

- Login as Admin.
- Admin -> Users should show four role options: Vendor, Supervisor, Sub-Admin, Admin.
- Promote a Vendor to Sub-Admin.

### Sub-Admin

- Login with that promoted account.
- It should open `/sub-admin`.
- Users page should show Vendor/Supervisor accounts only.
- Role selector should offer only Vendor and Supervisor.
- QR Generator should work.
- Scanner should work.

### Backend security test

A Sub-Admin request to `/api/admin/users` should return `403`.
A Sub-Admin can use `/api/sub-admin/users`.
A Sub-Admin cannot use its API to assign `admin` or `subadmin`; the backend returns `403`.
