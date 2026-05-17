# 📚 Student Management System

A **production-grade, full-stack Node.js web application** for managing students, subjects, attendance, and marks. Built with **Express.js**, **Sequelize ORM**, and **MySQL**, following the **MVC architecture** with role-based access control (Faculty & Student).

**Author:** Mayank Shrivastava

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js ≥ 18 (ES Modules) |
| Framework | Express.js 4 |
| ORM | Sequelize 6 |
| Database | MySQL |
| Auth | JWT (Dual-token) + bcryptjs |
| Caching | Redis (ioredis) |
| Email | Nodemailer (SMTP) |
| Security | Helmet, CORS, express-rate-limit |
| Logging | Winston + Morgan |
| Validation | express-validator |
| Frontend | Vanilla HTML / CSS / JS |

---

## Architecture

```
                         ┌─────────────────────────────┐
                         │      Client (Browser)       │
                         │  HTML · CSS · Vanilla JS    │
                         └─────────────┬───────────────┘
                                       │
                                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        Express Server                                │
│                                                                      │
│  ┌────────────────── Middleware Pipeline ──────────────────────────┐  │
│  │ Helmet → CORS → BodyParser → CookieParser → Morgan → Static   │  │
│  └────────────────────────────┬────────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌─────────────────────── Routes ─────────────────────────────────┐  │
│  │  authRoutes.js    facultyRoutes.js    studentRoutes.js         │  │
│  └──────┬──────────────────┬────────────────────┬─────────────────┘  │
│         │                  │                    │                     │
│         ▼                  ▼                    ▼                     │
│  ┌──── Auth MW ───┐ ┌── Role MW ──┐  ┌── Validate MW ──┐           │
│  │  JWT Verify    │ │  RBAC Check │  │  Input Sanitize  │           │
│  └────────────────┘ └─────────────┘  └──────────────────┘           │
│         │                  │                    │                     │
│         ▼                  ▼                    ▼                     │
│  ┌─────────────────── Controllers ────────────────────────────────┐  │
│  │  authController  │  studentController  │  subjectController   │  │
│  │  marksController │  attendanceController                      │  │
│  └────────────────────────────┬───────────────────────────────────┘  │
│                               │                                      │
│                     ┌─────────┼─────────┐                            │
│                     ▼         ▼         ▼                            │
│               ┌─────────┐ ┌───────┐ ┌────────┐                      │
│               │ Sequelize│ │ Redis │ │ Email  │                      │
│               │   ORM   │ │ Cache │ │ (SMTP) │                      │
│               └────┬────┘ └───────┘ └────────┘                      │
│                    │                                                  │
│  ┌──── Error Handler (centralized) ──────────────────────────────┐  │
│  │  Operational vs Programming errors · Dev/Prod responses       │  │
│  └───────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                              ┌─────────────────┐
                              │   MySQL (Cloud)  │
                              └─────────────────┘
```

---

## Project Structure

```
studentManagementSystem/
├── server.js                  ← Entry point
├── package.json               ← Dependencies & scripts
├── .env                       ← Environment variables (not in repo)
│
├── config/
│   ├── database.js            ← Sequelize DB connection & pooling
│   ├── logger.js              ← Winston logger configuration
│   └── redis.js               ← Redis client with graceful fallback
│
├── models/
│   ├── index.js               ← Associations hub (all relationships)
│   ├── User.js                ← User model (bcrypt hooks, JWT fields)
│   ├── Student.js             ← Student profile (enrollment, dept)
│   ├── Subject.js             ← Subject model (faculty-owned)
│   ├── Attendance.js          ← Attendance (composite unique key)
│   └── Mark.js                ← Marks (composite unique key)
│
├── controllers/
│   ├── authController.js      ← Register, Login, Refresh, Reset
│   ├── studentController.js   ← Student dashboard & data
│   ├── subjectController.js   ← CRUD for subjects
│   ├── attendanceController.js← Batch mark & view attendance
│   └── marksController.js     ← Batch add, update & view marks
│
├── middleware/
│   ├── auth.js                ← JWT verification (cookie-based)
│   ├── role.js                ← Role-based access control
│   ├── validate.js            ← express-validator result handler
│   └── errorHandler.js        ← Centralized error formatting
│
├── routes/
│   ├── authRoutes.js          ← Auth endpoints + rate limiting
│   ├── facultyRoutes.js       ← Faculty-only endpoints
│   └── studentRoutes.js       ← Student-only endpoints
│
├── utils/
│   ├── AppError.js            ← Custom operational error class
│   ├── email.js               ← Nodemailer transport & reset email
│   └── paginate.js            ← Reusable pagination helper
│
└── public/                    ← Frontend (served as static files)
    ├── index.html             ← Login page
    ├── register.html          ← Registration page
    ├── faculty.html           ← Faculty dashboard
    ├── student.html           ← Student dashboard
    ├── forgot-password.html   ← Forgot password page
    ├── reset-password.html    ← Reset password page
    ├── css/style.css          ← Global stylesheet
    └── js/
        ├── common.js          ← API helper, token refresh, toasts
        ├── auth.js            ← Login/Register form logic
        ├── faculty.js         ← Faculty dashboard logic
        ├── student.js         ← Student dashboard logic
        ├── forgot-password.js ← Forgot password form
        └── reset-password.js  ← Reset password form
```

---

## Database Schema

```
┌──────────────┐        ┌──────────────┐
│    users     │        │   students   │
├──────────────┤        ├──────────────┤
│ id (PK)      │──1:1──▶│ id (PK)      │
│ name         │        │ user_id (FK) │
│ email (UQ)   │        │ enrollment_no│
│ password     │        │ department   │
│ role (ENUM)  │        └──────┬───────┘
│ refresh_token│               │
│ reset_token  │               │ 1:M
│ reset_expires│               ▼
└──────┬───────┘        ┌──────────────┐
       │                │  attendance  │
       │ 1:M            ├──────────────┤
       ▼                │ id (PK)      │
┌──────────────┐        │ student_id   │
│   subjects   │        │ subject_id   │
├──────────────┤        │ date         │
│ id (PK)      │──1:M──▶│ status(ENUM) │
│ name         │        └──────────────┘
│ code (UQ)    │
│ faculty_id   │        ┌──────────────┐
└──────────────┘──1:M──▶│    marks     │
                        ├──────────────┤
                        │ id (PK)      │
                        │ student_id   │
                        │ subject_id   │
                        │ marks (0-100)│
                        └──────────────┘
```

**Constraints:**
- `attendance` → composite unique on `(student_id, subject_id, date)`
- `marks` → composite unique on `(student_id, subject_id)`
- Cascade deletes from `Student` / `Subject` → `Attendance` / `Marks`

---

## API Endpoints

### Auth (`/api/auth`)

| Method | Endpoint | Rate Limited | Description |
|--------|----------|:---:|-------------|
| POST | `/register` | — | Register faculty (invite code) or student |
| POST | `/login` | 5/15min | Login → JWT cookies |
| POST | `/refresh` | — | Rotate access token |
| POST | `/logout` | — | Clear tokens |
| GET | `/me` | — | Current user profile |
| POST | `/forgot-password` | 3/15min | Send reset email |
| POST | `/reset-password` | — | Reset with token |

### Faculty (`/api/faculty`) — `auth + role('faculty')`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/students` | List all students (paginated) |
| POST | `/subjects` | Create subject |
| GET | `/subjects` | List faculty's subjects |
| DELETE | `/subjects/:id` | Delete subject |
| POST | `/attendance` | Batch mark attendance |
| GET | `/attendance/:subjectId` | View attendance by subject |
| POST | `/marks` | Batch add marks |
| PUT | `/marks/:id` | Update a mark |
| GET | `/marks/:subjectId` | View marks by subject |

### Student (`/api/student`) — `auth + role('student')`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Aggregated overview |
| GET | `/attendance` | Personal attendance |
| GET | `/marks` | Personal marks |
| GET | `/subjects` | Enrolled subjects |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check (DB + memory) |

---

## Security

| Feature | Implementation |
|---------|---------------|
| Password hashing | bcrypt (12 salt rounds, Sequelize hooks) |
| JWT dual-token | Access (15m) + Refresh (7d) with rotation |
| HttpOnly cookies | Tokens stored in cookies, immune to XSS |
| Refresh token hashing | SHA-256 hashed in DB, never stored raw |
| Rate limiting | Login & forgot-password endpoints |
| Helmet | CSP, HSTS, X-Frame-Options |
| RBAC | Factory middleware: `role('faculty')` |
| Input validation | express-validator on all mutating endpoints |
| Error sanitization | Stack traces hidden in production |
| Email enumeration prevention | Same response regardless of user existence |

---

## Setup

```bash
# Install dependencies
npm install

# Configure environment
# Create .env with: DATABASE_URL, JWT_SECRET, ACCESS_TOKEN_SECRET,
# REFRESH_TOKEN_SECRET, SMTP_* (see .env.example)

# Development
npm run dev

# Production
npm start
```

**Requires:** Node.js ≥ 18, MySQL, Redis (optional)
