# 📚 Student Management System — Complete Revision Guide

> **Purpose of this file:** This is your interview-prep revision document. It explains every file, every design decision, and the full architecture so you can confidently walk an interviewer through the project.

---

## 🏗️ Project Overview (Your Elevator Pitch)

> "I built a full-stack Student Management System using **Node.js, Express, Sequelize ORM, and MySQL**. It has **role-based access control** (Faculty & Student), **JWT authentication with access/refresh token rotation**, and features like **attendance tracking, marks management, and password reset via email**. The frontend is vanilla HTML/CSS/JS served statically by Express."

### Tech Stack at a Glance

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js ≥18 | Modern JS with ES Modules support |
| Framework | Express.js 4 | Industry-standard, middleware-based HTTP framework |
| ORM | Sequelize 6 | Declarative model definitions, migrations, associations |
| Database | MySQL (Railway cloud) | Relational DB — perfect for structured student/marks/attendance data |
| Auth | JWT (jsonwebtoken) | Stateless authentication via httpOnly cookies |
| Password Hashing | bcryptjs | Secure one-way hashing with salt rounds |
| Email | Nodemailer | SMTP-based password reset emails |
| Security | Helmet, CORS, express-rate-limit | HTTP header hardening, rate limiting |
| Logging | Winston + Morgan | Structured JSON logs + HTTP access logs |
| Validation | express-validator | Request body validation middleware |
| Frontend | Vanilla HTML/CSS/JS | No framework — served as static files |

---

## 📁 Project Structure & File-by-File Breakdown

```
studentManagementSystem/
├── server.js                  ← Entry point (starts everything)
├── package.json               ← Dependencies & scripts
├── .env                       ← Environment variables (secrets)
├── config/
│   ├── database.js            ← Sequelize DB connection
│   └── logger.js              ← Winston logger setup
├── models/
│   ├── index.js               ← Associations hub (relationships)
│   ├── User.js                ← User model (auth + roles)
│   ├── Student.js             ← Student profile model
│   ├── Subject.js             ← Subject model
│   ├── Mark.js                ← Marks model
│   └── Attendance.js          ← Attendance model
├── middleware/
│   ├── auth.js                ← JWT verification middleware
│   ├── role.js                ← Role-based access control
│   ├── validate.js            ← Request validation runner
│   └── errorHandler.js        ← Centralized error handler
├── controllers/
│   ├── authController.js      ← Login/Register/Refresh/Reset
│   ├── studentController.js   ← Student dashboard & data
│   ├── subjectController.js   ← CRUD for subjects
│   ├── attendanceController.js← Mark & view attendance
│   └── marksController.js     ← Add/update/view marks
├── routes/
│   ├── authRoutes.js          ← Auth endpoints + validation
│   ├── facultyRoutes.js       ← Faculty-only endpoints
│   └── studentRoutes.js       ← Student-only endpoints
├── utils/
│   ├── AppError.js            ← Custom error class
│   └── email.js               ← Nodemailer email sender
└── public/                    ← Frontend (static files)
    ├── index.html             ← Login page
    ├── register.html          ← Registration page
    ├── faculty.html           ← Faculty dashboard
    ├── student.html           ← Student dashboard
    ├── forgot-password.html   ← Forgot password page
    ├── reset-password.html    ← Reset password page
    ├── css/style.css          ← All styles
    └── js/
        ├── common.js          ← Shared utilities (API helper, toasts)
        ├── auth.js            ← Login/Register form logic
        ├── faculty.js         ← Faculty dashboard logic
        ├── student.js         ← Student dashboard logic
        ├── forgot-password.js ← Forgot password form
        └── reset-password.js  ← Reset password form
```

---

## 🔵 LAYER 1: Entry Point & Configuration

### 📄 `server.js` — The Application Entry Point

**What it does:** Bootstraps the entire application. Sets up middleware, routes, and starts listening.

**Key concepts to explain in interview:**

1. **ES Modules:** Uses `import/export` (not `require`). Enabled by `"type": "module"` in package.json. Requires `fileURLToPath` trick for `__dirname`.

2. **Middleware pipeline (ORDER MATTERS!):**
   ```
   Helmet (security headers) → CORS → Body parsers → Cookie parser
   → Morgan (logging) → Static files → Routes → 404 handler → Error handler
   ```

3. **Helmet with CSP:** Content Security Policy restricts which domains can load scripts/styles/fonts. Prevents XSS attacks.

4. **Database-first startup:** The `startServer()` async function calls `sequelize.authenticate()` then `sequelize.sync()` BEFORE `app.listen()`. Server won't start if DB is unreachable.

5. **Dev vs Prod sync:** `sequelize.sync({ alter: true })` in dev auto-updates table schemas. In production, it syncs without altering to avoid risky migrations.

**🎤 Interview answer:** *"The server follows a strict initialization order — it first verifies the database connection, syncs models, and only then starts accepting HTTP requests. This prevents the app from serving requests when the database is down."*

---

### 📄 `config/database.js` — Database Connection

**What it does:** Creates and exports a Sequelize instance connected to MySQL.

**Key design decision:** Supports TWO connection modes:
- **`DATABASE_URL` (connection string)** — Used for cloud databases (Railway). Single URL contains host, port, user, password, and database name.
- **Individual env vars (`DB_HOST`, `DB_USER`, etc.)** — Fallback for local development.

**Connection pooling:** `pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }` means:
- Max 5 simultaneous connections
- Connections released after 10s idle
- Timeout after 30s if pool is full

**🎤 Interview answer:** *"I implemented dual connection strategies — a connection string for cloud deployment and individual parameters for local dev. The connection pool prevents overwhelming the database with too many connections."*

---

### 📄 `config/logger.js` — Winston Logger

**What it does:** Creates a structured logger with console output (always) and file output (production only).

**Key points:**
- **Console transport:** Colorized, human-readable format for development
- **File transports (production only):** `error.log` (errors only) + `combined.log` (everything)
- **Log rotation:** `maxsize: 5MB`, keeps last 5 files — prevents disk from filling up
- **`defaultMeta: { service: 'student-mgmt' }`** — Tags every log entry for filtering in log aggregation tools
- **Creates `logs/` directory** automatically if it doesn't exist

**🎤 Interview answer:** *"I use Winston for structured JSON logging. In development it outputs colorized logs to console. In production it also writes to rotating log files — error.log captures only errors for quick debugging, combined.log has everything for detailed analysis."*

---

## 🟢 LAYER 2: Data Models (Sequelize ORM)

### 📄 `models/User.js` — The Core User Model

**Fields:** `id`, `name`, `email`, `password`, `role` (ENUM: faculty/student), `refresh_token`, `reset_token`, `reset_token_expires`

**Key concepts:**

1. **Sequelize Hooks (lifecycle events):**
   - `beforeCreate` → Hashes password with bcrypt (12 salt rounds) before INSERT
   - `beforeUpdate` → Only re-hashes if `user.changed('password')` is true (avoids double-hashing)

2. **Instance methods:**
   - `comparePassword(candidate)` → Uses `bcrypt.compare()` to verify login passwords
   - `toSafeObject()` → Returns user data WITHOUT password/tokens (for API responses)

3. **Validation:** Built into model — email format, name length (2-100), password length (6+)

4. **Indexes:** Unique index on `email` for fast lookups and enforced uniqueness

**🎤 Interview answer:** *"The User model uses Sequelize hooks to automatically hash passwords before saving. The `beforeUpdate` hook checks `user.changed('password')` to avoid re-hashing an already-hashed password. I also added a `toSafeObject()` method that strips sensitive fields before sending data to the client."*

---

### 📄 `models/Student.js` — Student Profile (extends User)

**Fields:** `id`, `user_id` (FK → users), `enrollment_no`, `department`

**Why a separate table?** Not all users are students. Faculty users don't need enrollment numbers. This is a **one-to-one** relationship — one User has one Student profile.

---

### 📄 `models/Subject.js` — Subjects

**Fields:** `id`, `name`, `code` (unique, uppercase), `faculty_id` (FK → users)

**Design:** Each subject belongs to one faculty member. Faculty can only manage their own subjects (ownership check in controllers).

---

### 📄 `models/Attendance.js` — Attendance Records

**Fields:** `id`, `student_id` (FK), `subject_id` (FK), `date` (DATEONLY), `status` (ENUM: present/absent)

**Composite unique constraint:** `[student_id, subject_id, date]` — A student can only have ONE attendance record per subject per day. This prevents duplicates and enables upsert logic.

---

### 📄 `models/Mark.js` — Marks/Grades

**Fields:** `id`, `student_id` (FK), `subject_id` (FK), `marks` (0-100)

**Composite unique constraint:** `[student_id, subject_id]` — One mark entry per student per subject. Enforced at DB level.

---

### 📄 `models/index.js` — The Associations Hub ⭐

**This is the MOST important file for understanding relationships.**

```
User ──(1:1)──→ Student       (hasOne / belongsTo)
User ──(1:M)──→ Subject       (hasMany / belongsTo)  — faculty creates subjects
Student ──(1:M)──→ Attendance  (hasMany / belongsTo)
Subject ──(1:M)──→ Attendance  (hasMany / belongsTo)
Student ──(1:M)──→ Mark        (hasMany / belongsTo)
Subject ──(1:M)──→ Mark        (hasMany / belongsTo)
```

**`onDelete: 'CASCADE'`** — Deleting a Student auto-deletes their Attendance and Marks. Deleting a Subject auto-deletes its Attendance and Marks.

**Why define associations here?** Centralizing avoids circular imports. All models are imported once, associations are set up, then everything is re-exported.

**🎤 Interview answer:** *"I centralized all Sequelize associations in models/index.js to avoid circular dependency issues. The relationships use CASCADE deletes so removing a student automatically cleans up their attendance and marks records. Attendance has a three-column composite unique key to prevent duplicate entries per student per subject per day."*

---

## 🟡 LAYER 3: Middleware

### 📄 `middleware/auth.js` — JWT Authentication

**Flow:**
1. Extract `access_token` from cookies (not headers — more secure)
2. Verify with `jwt.verify()` using ACCESS_TOKEN_SECRET
3. Find user in DB by decoded `id`
4. Attach `req.user` for downstream handlers
5. Handle `JsonWebTokenError` (tampered) and `TokenExpiredError` separately

**🎤 Why cookies instead of localStorage?** *"httpOnly cookies can't be accessed by JavaScript, which prevents XSS attacks from stealing tokens. The `sameSite: 'strict'` flag prevents CSRF attacks."*

---

### 📄 `middleware/role.js` — Role-Based Access Control (RBAC)

**Pattern:** Higher-order function (closure). `role('faculty')` returns a middleware that checks `req.user.role`.

```js
// Usage in routes:
router.use(auth);              // Step 1: Must be logged in
router.use(role('faculty'));    // Step 2: Must be faculty
```

**🎤 Interview answer:** *"The role middleware is a factory function — you call it with allowed roles, and it returns a middleware function. This pattern makes it reusable: `role('faculty')` or `role('student')` or even `role('faculty', 'admin')` for multiple roles."*

---

### 📄 `middleware/validate.js` — Validation Runner

**What it does:** Runs after `express-validator` checks. If validation errors exist, returns 422 with structured error messages. Otherwise calls `next()`.

**Pattern:** Validation rules are defined in route files, this middleware collects and formats the results.

---

### 📄 `middleware/errorHandler.js` — Centralized Error Handler ⭐

**Why centralized?** Instead of try/catch in every controller sending different error formats, ALL errors flow here via `next(error)`.

**Handles 3 Sequelize-specific errors:**
| Error Type | Status Code | Example |
|-----------|-------------|---------|
| `SequelizeValidationError` | 400 | Name too short |
| `SequelizeUniqueConstraintError` | 409 | Duplicate email |
| `SequelizeForeignKeyConstraintError` | 400 | Invalid student_id |

**Dev vs Prod responses:**
- **Dev:** Returns full error object + stack trace (for debugging)
- **Prod:** Only returns message for `isOperational` errors. Unknown errors get generic "Something went wrong" (prevents leaking internal details)

**🎤 Interview answer:** *"I use a centralized error handler so every error in the app gets consistent formatting. It distinguishes between operational errors (like 'user not found') and programming errors (like null reference). In production, only operational error messages are sent to clients — programming errors get a generic message to avoid leaking internal details."*

---

## 🔴 LAYER 4: Controllers (Business Logic)

### 📄 `controllers/authController.js` — Authentication ⭐⭐ (Most Complex File)

**This file handles 7 operations:** register, login, refresh, logout, getMe, forgotPassword, resetPassword

#### Token System (Dual-Token Architecture):

```
┌─────────────┐     ┌──────────────┐
│ Access Token │     │ Refresh Token│
├─────────────┤     ├──────────────┤
│ Expires: 15m│     │ Expires: 7d  │
│ Used for:   │     │ Used for:    │
│ API requests│     │ Getting new  │
│             │     │ access tokens│
└─────────────┘     └──────────────┘
```

**Key security features:**

1. **Refresh token rotation:** Every time you refresh, BOTH tokens are re-issued and the old refresh token is invalidated (stored as SHA-256 hash in DB).

2. **Hash comparison for refresh tokens:** The raw refresh token is never stored. Only its SHA-256 hash is in the DB. On refresh, the incoming token is hashed and compared.

3. **Cookie security flags:** `httpOnly` (no JS access), `secure` (HTTPS only in prod), `sameSite: strict` (no CSRF).

4. **`durationToMs()` helper:** Converts strings like `"15m"` or `"7d"` to milliseconds for cookie `maxAge`.

#### Registration Flow:
```
1. Check if email already exists → 409 if yes
2. Create User record (password auto-hashed by hook)
3. If role is 'student' → also create Student record with enrollment_no
4. If Student creation fails → rollback by destroying the User
5. Issue tokens and set cookies
```

#### Forgot Password Flow:
```
1. Find user by email
2. Generate random 32-byte token → hash with SHA-256 → save hash to DB
3. Set expiry to 1 hour from now
4. If SMTP configured → send email with reset link
5. If dev mode and no email → return token in response (for testing)
6. ALWAYS return success (even if email not found) → prevents email enumeration
```

#### Reset Password Flow:
```
1. Hash the incoming token → find user with matching reset_token
2. Check if token has expired
3. Update password (hook auto-hashes it)
4. Clear reset_token, reset_token_expires, AND refresh_token
5. User must login again with new password
```

**🎤 Interview answer:** *"I implemented a dual-token JWT system. The short-lived access token (15 min) is used for API requests. When it expires, the client automatically calls the refresh endpoint with the long-lived refresh token (7 days) to get a new pair. Refresh tokens are stored as SHA-256 hashes in the database, and on every refresh, the old token is invalidated — this is called token rotation and prevents replay attacks."*

---

### 📄 `controllers/studentController.js` — Student Dashboard

**4 endpoints:** getDashboard, getMyAttendance, getMyMarks, getMySubjects

**`getDashboard` aggregation logic (the most complex):**
1. Finds student profile by `req.user.id`
2. Fetches ALL attendance records with subject info
3. Fetches ALL marks records with subject info
4. Groups attendance by subject → calculates per-subject percentage
5. Calculates overall attendance percentage and average marks
6. Returns everything in one response

**`getMySubjects` — clever approach:** Finds subjects by looking at which subjects appear in the student's attendance AND marks records (using a `Set` to deduplicate).

---

### 📄 `controllers/attendanceController.js` — Attendance Management

**`markAttendance` — Batch operation with upsert:**
- Receives an array of `records` (multiple students at once)
- Uses `findOrCreate` for each record — creates if new, updates if exists
- Returns per-student results (created/updated/error)
- **Ownership check:** Faculty can only mark attendance for THEIR subjects

---

### 📄 `controllers/marksController.js` — Marks Management

**`addMarks`:** Batch creation. Unlike attendance, does NOT update existing — returns error message telling user to use PUT instead.

**`updateMarks`:** Updates a single mark by ID. Verifies the mark's subject belongs to the requesting faculty.

**`getMarksBySubject`:** Uses nested eager loading: `Mark → Student → User` to get student names.

---

### 📄 `controllers/subjectController.js` — Subject CRUD

Simple CRUD with ownership enforcement. `code` is uppercased on creation. Delete checks that the subject belongs to the requesting faculty.

---

## 🟣 LAYER 5: Routes (API Endpoints)

### 📄 `routes/authRoutes.js`

| Method | Endpoint | Middleware | Controller |
|--------|----------|-----------|------------|
| POST | `/api/auth/register` | validation chain | register |
| POST | `/api/auth/login` | **loginLimiter (5 req/15min)** + validation | login |
| POST | `/api/auth/forgot-password` | **forgotPasswordLimiter (3 req/15min)** + validation | forgotPassword |
| POST | `/api/auth/reset-password` | validation | resetPassword |
| POST | `/api/auth/refresh` | — | refresh |
| POST | `/api/auth/logout` | — | logout |
| GET | `/api/auth/me` | **auth** | getMe |

**Rate limiting:** Login limited to 5 attempts per 15 minutes. Forgot-password limited to 3 per 15 minutes. Prevents brute-force and email spam.

**Conditional validation:** `enrollment_no` is only required `if(body('role').equals('student'))`.

---

### 📄 `routes/facultyRoutes.js`

**All routes protected by:** `auth` + `role('faculty')` (applied via `router.use()` at top)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/faculty/students` | List all students (inline handler) |
| POST | `/api/faculty/subjects` | Create subject |
| GET | `/api/faculty/subjects` | List all subjects |
| DELETE | `/api/faculty/subjects/:id` | Delete subject |
| POST | `/api/faculty/attendance` | Mark attendance (batch) |
| GET | `/api/faculty/attendance/:subjectId` | View attendance by subject |
| POST | `/api/faculty/marks` | Add marks (batch) |
| PUT | `/api/faculty/marks/:id` | Update single mark |
| GET | `/api/faculty/marks/:subjectId` | View marks by subject |

---

### 📄 `routes/studentRoutes.js`

**All routes protected by:** `auth` + `role('student')`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/student/dashboard` | Full dashboard data |
| GET | `/api/student/attendance` | My attendance records |
| GET | `/api/student/marks` | My marks |
| GET | `/api/student/subjects` | My subjects |

---

## 🟠 LAYER 6: Utilities

### 📄 `utils/AppError.js` — Custom Error Class

Extends native `Error`. Adds `statusCode`, `status` (fail for 4xx, error for 5xx), and `isOperational` flag.

**`isOperational = true`** means this is a known/expected error (like "user not found"). The error handler treats these differently from unexpected programming bugs.

**`Error.captureStackTrace(this, this.constructor)`** — Ensures the stack trace starts from where `new AppError()` was called, not from inside the AppError constructor.

---

### 📄 `utils/email.js` — Email Service

Creates a Nodemailer transporter from SMTP env vars. Two exported functions:
- `sendEmail({ to, subject, text, html })` — Generic email sender
- `sendPasswordResetEmail(email, resetToken)` — Builds a styled HTML email with a reset button/link

---

## 🔵 LAYER 7: Frontend

### 📄 `public/js/common.js` — Shared Frontend Utilities

**Most important function — `apiRequest()`:**
```
1. Makes fetch() with credentials:'include' (sends cookies)
2. If response is 401 AND retry is true → calls tryRefreshSession()
3. If refresh succeeds → retries the original request (retry=false to prevent infinite loop)
4. If refresh fails → throws error (user redirected to login)
```

**This is the automatic token refresh mechanism.** The user never sees expired tokens — the frontend silently refreshes behind the scenes.

---

### 📄 `public/js/auth.js` — Login/Register Logic

- `checkAuth()` — On page load, calls `/api/auth/me`. If logged in, redirects to faculty/student dashboard. Skips redirect on password-reset pages.
- Login form → POST `/api/auth/login` → redirect by role
- Register form → Shows enrollment fields only when role is "student"

---

### 📄 `public/js/faculty.js` — Faculty Dashboard (442 lines)

Manages tabs: Students, Subjects, Attendance (mark + view), Marks (add + view). Handles modals for adding subjects and editing marks. All data fetched via `apiRequest()`.

### 📄 `public/js/student.js` — Student Dashboard (218 lines)

Loads dashboard overview, attendance details, marks with grades, and enrolled subjects. Has helper functions for grade calculation (`getGrade`) and attendance status coloring.

---

## 🧠 Key Architecture Patterns (Interview Gold)

### 1. MVC Pattern
```
Model (Sequelize models) → Controller (business logic) → View (HTML pages)
Routes connect URLs to controllers. Middleware sits between routes and controllers.
```

### 2. Middleware Chain Pattern
```
Request → Helmet → CORS → BodyParser → CookieParser → Morgan → Static
        → Route Match → [auth] → [role] → [validation] → Controller
        → Response OR → ErrorHandler
```

### 3. Centralized Error Handling
All controllers use `try/catch` with `next(error)` — errors flow to one place.

### 4. Token Rotation Security
```
Login → Issue Access + Refresh tokens
API Call → Use Access token (from cookie)
401 → Frontend auto-refreshes → New token pair → Retry request
Logout → Clear cookies + nullify refresh token in DB
```

### 5. Ownership-Based Authorization
Faculty can only manage THEIR OWN subjects/attendance/marks. Checked in every controller: `if (subject.faculty_id !== req.user.id)`.

---

## 🎯 Common Interview Questions & Answers

**Q: Why JWT instead of sessions?**
> JWTs are stateless — the server doesn't need to store session data. This makes horizontal scaling easier (any server can verify the token). The refresh token in the DB is only checked during refresh, not on every request.

**Q: Why httpOnly cookies instead of localStorage?**
> localStorage is accessible via JavaScript, making it vulnerable to XSS. httpOnly cookies are invisible to client-side JS. Combined with sameSite:'strict', this also prevents CSRF.

**Q: Why Sequelize instead of raw SQL?**
> Sequelize provides model validation, hooks (auto-hashing), associations (eager loading), and protection against SQL injection through parameterized queries. It also makes schema changes easier with sync/migrations.

**Q: How do you handle concurrent attendance marking?**
> The composite unique constraint `[student_id, subject_id, date]` prevents duplicate records at the database level. The `findOrCreate` method handles the race condition — it atomically checks and creates.

**Q: What happens if the database goes down?**
> The server won't start (authenticate() fails in startServer). If it goes down during runtime, Sequelize queries will throw errors caught by the centralized error handler, returning 500 to clients. The connection pool will retry when the DB comes back.

---

## 🚀 How to Run

```bash
# Install dependencies
npm install

# Set up .env (copy from .env.example or configure your own)

# Development (with auto-restart)
npm run dev

# Production
npm start
```

**Required env vars:** `DATABASE_URL` or `DB_HOST/DB_USER/DB_PASS/DB_NAME`, `JWT_SECRET`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`

---

## 📊 Database Schema (ER Diagram)

```
┌──────────────┐     ┌──────────────┐
│    users     │     │   students   │
├──────────────┤     ├──────────────┤
│ id (PK)      │──1:1──│ id (PK)      │
│ name         │     │ user_id (FK) │
│ email (UQ)   │     │ enrollment_no│
│ password     │     │ department   │
│ role (ENUM)  │     └──────┬───────┘
│ refresh_token│            │
│ reset_token  │            │ 1:M
│ reset_expires│            ▼
└──────┬───────┘     ┌──────────────┐
       │             │  attendance  │
       │ 1:M         ├──────────────┤
       ▼             │ id (PK)      │
┌──────────────┐     │ student_id   │
│   subjects   │     │ subject_id   │
├──────────────┤     │ date         │
│ id (PK)      │──1:M──│ status(ENUM) │
│ name         │     └──────────────┘
│ code (UQ)    │
│ faculty_id   │     ┌──────────────┐
└──────────────┘──1:M──│    marks     │
                     ├──────────────┤
                     │ id (PK)      │
                     │ student_id   │
                     │ subject_id   │
                     │ marks (0-100)│
                     └──────────────┘
```
