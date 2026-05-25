# Event Backend - AI-First Event Creation System

Production-ready Node.js + Express backend with PostgreSQL for an AI-powered event creation system using Gemini 2.5 Flash.

## Features

- 🔐 **JWT Authentication** with refresh tokens
- 🤖 **Gemini AI Integration** for conversational event creation
- 📊 **PostgreSQL** with parameterized queries for security
- 🛡️ **Security First** - Helmet, CORS, rate limiting, input validation with Zod
- 📋 **GDPR Compliant** - Data export and deletion endpoints
- 🔍 **Audit Logging** - Complete action tracking
- ⚡ **Production Ready** - TypeScript, error handling, proper middleware

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 12+
- Gemini API key

## Installation

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env`:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/eventdb
JWT_SECRET=your-secret-here-min-32-chars-recommended
JWT_REFRESH_SECRET=your-refresh-secret-here-min-32-chars
GEMINI_API_KEY=your-gemini-key-here
FRONTEND_URL=http://localhost:3000
PORT=4000
NODE_ENV=development
```

4. Create database and run migrations:
```bash
# Create the database
createdb eventdb

# Run migrations
psql -U user -h localhost -d eventdb -f src/db/migrations/001_init.sql
```

## Development

Start the development server with hot reload:
```bash
npm run dev
```

Build TypeScript:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Project Structure

```
src/
├── routes/
│   ├── auth.ts       # Authentication (register, login, logout, refresh)
│   ├── events.ts     # Event CRUD operations
│   ├── chat.ts       # Gemini chat interface for event creation
│   └── gdpr.ts       # GDPR compliance (data export, account deletion)
├── middleware/
│   ├── auth.ts       # JWT verification middleware
│   ├── validate.ts   # Zod validation middleware
│   └── rateLimiter.ts # Express rate limiting
├── db/
│   ├── client.ts     # PostgreSQL connection pool
│   └── migrations/
│       └── 001_init.sql
├── lib/
│   ├── gemini.ts     # Gemini API wrapper
│   └── audit.ts      # Audit logging helpers
├── types/
│   └── index.ts      # TypeScript interfaces
└── index.ts          # Express app entry point
```

## API Endpoints

### Authentication Routes (`/api/auth`)

#### POST /register
Register a new user.
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com"
  },
  "accessToken": "jwt_token"
}
```

#### POST /login
Login user and receive tokens.
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

#### POST /refresh
Issue new access token using refresh token from cookie.

Response:
```json
{
  "accessToken": "new_jwt_token"
}
```

#### POST /logout
Logout user and clear refresh token cookie. Requires JWT.

---

### Events Routes (`/api/events`) - Protected by JWT

#### GET /
List all user's events.

Response:
```json
[
  {
    "id": "uuid",
    "event_name": "Tech Conference 2024",
    "description": "Annual tech conference...",
    "timezone": "America/New_York",
    "status": "PUBLISHED",
    "start_date": "2024-06-15T09:00:00Z",
    "end_date": "2024-06-17T18:00:00Z",
    "roles": ["speaker", "volunteer", "attendee"]
  }
]
```

#### GET /:id
Get single event by ID.

#### POST /
Create event manually.
```json
{
  "event_name": "Tech Conference 2024",
  "subheading": "The future of AI",
  "description": "Join us for a comprehensive...",
  "banner_image_url": "https://example.com/banner.jpg",
  "timezone": "UTC",
  "status": "DRAFT",
  "start_date": "2024-06-15T09:00:00Z",
  "end_date": "2024-06-17T18:00:00Z",
  "vanish_date": "2024-07-01T00:00:00Z",
  "roles": ["speaker", "attendee"]
}
```

#### PUT /:id
Update event.

#### DELETE /:id
Soft delete event (sets deleted_at).

---

### Chat Routes (`/api/chat`) - Protected by JWT

#### POST /message
Send message to Gemini event creation assistant.
```json
{
  "sessionId": "uuid (optional - omit to create new session)",
  "userMessage": "I want to create a tech conference"
}
```

Response:
```json
{
  "sessionId": "uuid",
  "reply": "Great! Let's create a tech conference...",
  "suggestions": ["Tell me more about topics", "What's the date?"],
  "eventCreated": false,
  "eventId": null
}
```

When all event fields are collected:
```json
{
  "sessionId": "uuid",
  "reply": "Perfect! I've created your event.",
  "suggestions": [],
  "eventCreated": true,
  "eventId": "uuid"
}
```

#### GET /sessions
List all chat sessions.

#### GET /sessions/:sessionId
Get single chat session with full message history.

---

### GDPR Routes (`/api/gdpr`) - Protected by JWT

#### GET /export
Export all user data (user info, events, chat sessions) as JSON.

Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "created_at": "2024-01-15T10:00:00Z"
  },
  "events": [...],
  "chat_sessions": [...],
  "exported_at": "2024-01-20T14:30:00Z"
}
```

#### DELETE /me
Delete user account and all associated data (soft delete).

Response:
```json
{
  "message": "Account deleted successfully"
}
```

---

## Security Features

### Input Validation
- Zod schema validation for all inputs
- `validator.escape()` to prevent XSS
- Email format validation
- Password minimum 8 characters

### Authentication
- JWT with 15-minute expiration
- Refresh tokens with 7-day expiration
- HttpOnly cookies for refresh tokens
- Token verification on protected routes

### Database Security
- Parameterized queries (no SQL injection)
- UUID primary keys
- Soft deletes (deleted_at timestamp)
- Connection pooling with pg

### Rate Limiting
- Global: 100 req/15min per IP
- Auth routes: 10 req/15min per IP
- Chat routes: 20 req/min per user

### HTTP Security
- Helmet.js for security headers
- CORS restricted to frontend URL only
- Content-Type validation
- Request size limits (1MB JSON)

### Audit Logging
All sensitive actions logged with:
- User ID
- Action type
- Entity information
- IP address
- Timestamp
- Metadata

---

## Database Schema

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### events
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_name TEXT NOT NULL,
  subheading TEXT,
  description TEXT,
  banner_image_url TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  status TEXT CHECK (status IN ('DRAFT','PUBLISHED','CANCELLED')) DEFAULT 'DRAFT',
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  vanish_date TIMESTAMPTZ,
  roles JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);
```

### chat_sessions
```sql
CREATE TABLE chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  event_id UUID REFERENCES events(id),
  messages JSONB DEFAULT '[]',
  state JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/eventdb` |
| `JWT_SECRET` | Secret for signing access tokens | Min 32 chars recommended |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens | Min 32 chars recommended |
| `GEMINI_API_KEY` | Google Gemini API key | Your API key |
| `FRONTEND_URL` | CORS origin for frontend | `http://localhost:3000` |
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment | `development` or `production` |

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `204` - No Content (delete success)
- `400` - Bad Request (validation error)
- `401` - Unauthorized (auth failure)
- `404` - Not Found
- `409` - Conflict (email already exists)
- `429` - Too Many Requests (rate limited)
- `500` - Internal Server Error

---

## Audit Logging Actions

- `USER_REGISTERED` - User account created
- `USER_LOGIN` - Successful login
- `USER_LOGIN_FAILED` - Failed login attempt
- `USER_LOGOUT` - User logged out
- `EVENT_CREATED` - Event created
- `EVENT_UPDATED` - Event updated
- `EVENT_DELETED` - Event deleted
- `DATA_EXPORTED` - User data exported
- `ACCOUNT_DELETED` - User account deleted

---

## Performance Considerations

1. **Database Indexing** - All foreign keys and frequently-queried columns indexed
2. **Connection Pooling** - pg Pool with configurable min/max connections
3. **Rate Limiting** - Protects against abuse
4. **JSON Size Limits** - 1MB max request body
5. **Soft Deletes** - No actual data removal for audit trail

---

## Deployment

### Production Checklist

1. ✅ Set `NODE_ENV=production`
2. ✅ Generate strong JWT secrets (min 32 characters)
3. ✅ Use PostgreSQL with SSL
4. ✅ Set `FRONTEND_URL` to actual frontend domain
5. ✅ Configure environment variables securely
6. ✅ Run `npm run build` before deployment
7. ✅ Use process manager (PM2, systemd, etc.)
8. ✅ Set up reverse proxy (nginx) with HTTPS
9. ✅ Monitor logs and audit trails
10. ✅ Regular database backups

---

## License

ISC
