# FBR Digital Invoice Backend

Multi-customer FBR e-Invoice management backend built with Node.js + Express + MongoDB.

---

## Folder Structure

```
fbr-backend/
├── server.js              ← Main entry point
├── package.json           ← Dependencies
├── .env.example           ← Copy to .env and fill in your values
│
├── middleware/
│   └── auth.js            ← JWT token verification
│
├── models/
│   ├── Customer.js        ← Client business schema
│   └── Invoice.js         ← Invoice schema
│
├── routes/
│   ├── auth.js            ← POST /api/auth/login
│   ├── customers.js       ← CRUD for your customers
│   ├── invoices.js        ← Excel upload + invoice management
│   └── fbr.js             ← FBR portal sync
│
└── services/
    ├── excelParser.js     ← Reads FBR Excel format
    └── fbrApi.js          ← Communicates with FBR API
```

---

## Setup (Step by Step)

### 1. Install Node.js
Download from https://nodejs.org — install the LTS version.

### 2. Install dependencies
Open a terminal in this folder and run:
```bash
npm install
```

### 3. Set up MongoDB
- Go to https://mongodb.com/atlas and create a FREE cluster
- Create a database user with a password
- Get your connection string (looks like: mongodb+srv://user:pass@cluster.mongodb.net/fbr)

### 4. Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in:
- Your MongoDB connection string
- Your admin email and password
- Your FBR API credentials (from https://e.fbr.gov.pk)

### 5. Start the server
```bash
# Development (auto-restarts on file changes)
npm run dev

# Production
npm start
```

Server runs on: http://localhost:5000

---

## API Endpoints

### Auth
| Method | URL | Body | Description |
|--------|-----|------|-------------|
| POST | /api/auth/login | `{ email, password }` | Get login token |
| GET | /api/auth/verify | — | Check if token is valid |

### Customers
| Method | URL | Description |
|--------|-----|-------------|
| GET | /api/customers | List all customers |
| POST | /api/customers | Add new customer |
| PUT | /api/customers/:id | Update customer |
| DELETE | /api/customers/:id | Remove customer |

### Invoices
| Method | URL | Description |
|--------|-----|-------------|
| GET | /api/invoices?customerId=xxx | List invoices (with filters) |
| POST | /api/invoices/upload | Upload FBR Excel file |
| DELETE | /api/invoices/:id | Delete pending invoice |

### FBR Sync
| Method | URL | Description |
|--------|-----|-------------|
| POST | /api/fbr/sync/:customerId | Sync all pending invoices to FBR |
| POST | /api/fbr/submit/:invoiceId | Submit single invoice to FBR |
| GET | /api/fbr/status/:invoiceId | Check invoice status on FBR |

---

## Testing the API (without a frontend)

Use a free tool called **Postman** (https://postman.com) or **Thunder Client** (VS Code extension).

Example: Login
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{ "email": "admin@yourdomain.com", "password": "YourPassword" }
```

Copy the `token` from the response, then use it in all other requests:
```
Authorization: Bearer <your_token_here>
```

---

## Deploying Online (Free)

1. Push your code to GitHub
2. Go to https://railway.app and sign in with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Add your environment variables in Railway's dashboard
5. Your backend will be live at a URL like: https://fbr-backend.railway.app

---

## FBR API Notes

- Register at: https://e.fbr.gov.pk (PRAL portal)
- Test using the sandbox environment first — ask FBR support for sandbox credentials
- FBR API returns an **IRN** (Invoice Registration Number) on success — store this
- Rejected invoices show a reason in `rejectionNote` — common reasons:
  - Invalid NTN
  - Duplicate invoice number
  - Invalid STRN
  - Missing buyer details
