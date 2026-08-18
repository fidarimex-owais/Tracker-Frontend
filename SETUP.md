# QR Project — Auth + Role Portals

## 1. Backend environment
Copy `backend/.env.example` to `backend/.env` and set your real MongoDB URI and secrets.

Required auth values:
- `JWT_SECRET`: use a long random secret.
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: creates the first admin account at backend startup if it does not already exist.
- `FRONTEND_ORIGIN`: normally `http://localhost:5173` during development.

Public sign-up only creates **Vendor** users. An Admin changes a user's role to **Supervisor** or **Admin** from Admin → Users.

## 2. Install and run backend
```powershell
cd backend
npm install
npm run dev
```

## 3. Install and run frontend
Open a second terminal:
```powershell
cd frontend
npm install
npm run dev
```

Frontend defaults to `http://localhost:5173` and backend to `http://localhost:5000`.

## Portal permissions
- Admin: user management, QR/sticker generation, QR/barcode scanner.
- Vendor: QR/sticker generation.
- Supervisor: QR/barcode scanner.

## Authentication
Email/password authentication uses bcryptjs password hashes and a JWT stored in an HTTP-only cookie. Do not store plaintext passwords.
