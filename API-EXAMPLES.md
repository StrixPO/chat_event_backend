# API Testing Examples

## Setup

Before testing, start the server:
```bash
npm run dev
```

Server runs on: `http://localhost:4000`

## Base URL
```
http://localhost:4000
```

## 1. Authentication Routes

### 1.1 Register User

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "MySecurePassword123"
  }'
```

**Expected Response (201):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "testuser@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

Save the `accessToken` for other requests.

---

### 1.2 Login User

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@example.com",
    "password": "MySecurePassword123"
  }'
```

**Expected Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "testuser@example.com"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 1.3 Refresh Token

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/refresh \
  -H "Content-Type: application/json"
```

**Expected Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

### 1.4 Logout

**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/logout \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## 2. Events Routes

**All event routes require JWT token. Use the `accessToken` from login:**
```
Authorization: Bearer YOUR_ACCESS_TOKEN
```

### 2.1 List All Events

**Request:**
```bash
curl http://localhost:4000/api/events \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_name": "Tech Conference 2024",
    "subheading": "The future of AI",
    "description": "Join us for a comprehensive exploration of AI advancements...",
    "banner_image_url": "https://example.com/banner.jpg",
    "timezone": "America/New_York",
    "status": "PUBLISHED",
    "start_date": "2024-06-15T09:00:00.000Z",
    "end_date": "2024-06-17T18:00:00.000Z",
    "vanish_date": "2024-07-01T00:00:00.000Z",
    "roles": ["speaker", "volunteer", "attendee"],
    "created_at": "2024-01-20T10:00:00.000Z",
    "updated_at": "2024-01-20T10:00:00.000Z",
    "deleted_at": null
  }
]
```

---

### 2.2 Get Single Event

**Request:**
```bash
curl http://localhost:4000/api/events/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):** Same as 2.1 single object

---

### 2.3 Create Event

**Request:**
```bash
curl -X POST http://localhost:4000/api/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "event_name": "Tech Conference 2024",
    "subheading": "The future of AI",
    "description": "Join us for a comprehensive exploration of AI advancements in the modern world. This is definitely at least 20 characters.",
    "banner_image_url": "https://example.com/banner.jpg",
    "timezone": "America/New_York",
    "status": "DRAFT",
    "start_date": "2024-06-15T09:00:00Z",
    "end_date": "2024-06-17T18:00:00Z",
    "vanish_date": "2024-07-01T00:00:00Z",
    "roles": ["speaker", "volunteer", "attendee"]
  }'
```

**Expected Response (201):** Created event object

---

### 2.4 Update Event

**Request:**
```bash
curl -X PUT http://localhost:4000/api/events/660e8400-e29b-41d4-a716-446655440001 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "event_name": "Tech Conference 2024 - Updated",
    "subheading": "The future of AI",
    "description": "Updated description with more than 20 characters for this conference.",
    "banner_image_url": "https://example.com/banner-new.jpg",
    "timezone": "UTC",
    "status": "PUBLISHED",
    "start_date": "2024-06-15T09:00:00Z",
    "end_date": "2024-06-17T18:00:00Z",
    "vanish_date": "2024-07-01T00:00:00Z",
    "roles": ["speaker", "attendee"]
  }'
```

**Expected Response (200):** Updated event object

---

### 2.5 Delete Event

**Request:**
```bash
curl -X DELETE http://localhost:4000/api/events/660e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (204):** No content

---

## 3. Chat Routes

**All chat routes require JWT token and are rate-limited to 20 req/min per user:**

### 3.1 Send Chat Message (Create Session)

**Request:**
```bash
curl -X POST http://localhost:4000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userMessage": "I want to create a tech conference for software developers"
  }'
```

**Expected Response (200):**
```json
{
  "sessionId": "770e8400-e29b-41d4-a716-446655440002",
  "reply": "That sounds great! A tech conference for developers would be amazing. Let me help you create it step by step. First, what would you like to name this conference?",
  "suggestions": [
    "TechConf 2024",
    "Developer Summit",
    "Code & Coffee Conference"
  ],
  "eventCreated": false
}
```

---

### 3.2 Continue Conversation

**Request:**
```bash
curl -X POST http://localhost:4000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "sessionId": "770e8400-e29b-41d4-a716-446655440002",
    "userMessage": "TechConf 2024"
  }'
```

**Expected Response (200):**
```json
{
  "sessionId": "770e8400-e29b-41d4-a716-446655440002",
  "reply": "Perfect! TechConf 2024 is a great name. Now, would you like to add a catchy tagline or subheading? For example, 'The Future of Software Development'. You can skip this if you prefer.",
  "suggestions": [
    "Skip the subheading",
    "Add a tagline",
    "Keep it simple"
  ],
  "eventCreated": false
}
```

---

### 3.3 List Chat Sessions

**Request:**
```bash
curl http://localhost:4000/api/chat/sessions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):**
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "event_id": null,
    "messages": [
      {
        "role": "user",
        "content": "I want to create a tech conference",
        "timestamp": "2024-01-20T10:15:00.000Z"
      },
      {
        "role": "assistant",
        "content": "That sounds great!...",
        "timestamp": "2024-01-20T10:15:01.000Z"
      }
    ],
    "state": {
      "event_name": "TechConf 2024"
    },
    "created_at": "2024-01-20T10:15:00.000Z",
    "updated_at": "2024-01-20T10:15:05.000Z"
  }
]
```

---

### 3.4 Get Single Chat Session

**Request:**
```bash
curl http://localhost:4000/api/chat/sessions/770e8400-e29b-41d4-a716-446655440002 \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):** Same as 3.3 single session object

---

## 4. GDPR Routes

**All GDPR routes require JWT token:**

### 4.1 Export User Data

**Request:**
```bash
curl http://localhost:4000/api/gdpr/export \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "testuser@example.com",
    "consent_given_at": "2024-01-20T10:00:00.000Z",
    "created_at": "2024-01-20T10:00:00.000Z",
    "deleted_at": null
  },
  "events": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "event_name": "Tech Conference 2024",
      "description": "Join us for a comprehensive exploration...",
      "status": "PUBLISHED",
      "created_at": "2024-01-20T10:00:00.000Z",
      "updated_at": "2024-01-20T10:00:00.000Z",
      "deleted_at": null
    }
  ],
  "chat_sessions": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "messages": [...],
      "state": {...},
      "created_at": "2024-01-20T10:15:00.000Z",
      "updated_at": "2024-01-20T10:15:05.000Z"
    }
  ],
  "exported_at": "2024-01-20T11:00:00.000Z"
}
```

The response will download as a JSON file: `user-data-{user-id}.json`

---

### 4.2 Delete Account (GDPR Right to Be Forgotten)

**Request:**
```bash
curl -X DELETE http://localhost:4000/api/gdpr/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response (200):**
```json
{
  "message": "Account deleted successfully"
}
```

**Note:** This soft-deletes the user and all their events. The refresh token cookie will be cleared.

---

## 5. Health Check

### 5.1 Server Health

**Request:**
```bash
curl http://localhost:4000/health
```

**Expected Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2024-01-20T11:00:00.000Z"
}
```

---

## Error Examples

### Invalid Email
**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "not-an-email",
    "password": "password123"
  }'
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": "Invalid email format"
}
```

---

### Password Too Short
**Request:**
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "short"
  }'
```

**Response (400):**
```json
{
  "error": "Validation failed",
  "details": "Password must be at least 8 characters"
}
```

---

### Missing Authorization Token
**Request:**
```bash
curl http://localhost:4000/api/events
```

**Response (401):**
```json
{
  "error": "Missing or invalid authorization header"
}
```

---

### Event Not Found
**Request:**
```bash
curl http://localhost:4000/api/events/invalid-uuid \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Response (404):**
```json
{
  "error": "Event not found"
}
```

---

### Rate Limited
After exceeding rate limit (10 auth requests per 15 minutes):

**Response (429):**
```
Too many requests from this IP, please try again later.
```

---

## Testing Workflow

1. **Register**: Create a new user account
2. **Login**: Get access token
3. **Create Event**: Via POST /api/events or via chat
4. **Chat**: Use POST /api/chat/message to create events conversationally
5. **List Events**: Verify created events
6. **Update Event**: Modify event details
7. **Export Data**: GDPR data export
8. **Delete**: Soft delete events or account

---

## Tips

- Use `YOUR_ACCESS_TOKEN` placeholder in examples - replace with actual token
- Keep tokens secure - don't share them
- Access tokens expire in 15 minutes - use refresh token to get a new one
- All timestamps are in ISO 8601 format (UTC)
- Description must be at least 20 characters
- Timezone should be IANA format (e.g., "America/New_York", "UTC")
