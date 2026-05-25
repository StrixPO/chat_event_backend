# Quick Setup Guide

## 1. Prerequisites

Make sure you have installed:
- Node.js 18+ (https://nodejs.org)
- PostgreSQL 12+ (https://www.postgresql.org)
- npm (comes with Node.js)

## 2. Install Dependencies

```bash
npm install
```

## 3. Set Up Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and set:
- `DATABASE_URL`: Your PostgreSQL connection string
- `JWT_SECRET`: Generate a random string (min 32 chars)
- `JWT_REFRESH_SECRET`: Generate another random string (min 32 chars)
- `GEMINI_API_KEY`: Your Google Gemini API key
- `FRONTEND_URL`: Your frontend URL (default: http://localhost:3000)

### Generate Secure Secrets

On Linux/Mac:
```bash
openssl rand -hex 32
```

On Windows (PowerShell):
```powershell
[Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Maximum 256}))
```

## 4. Database Setup

### Option A: Local PostgreSQL

Create the database:
```bash
createdb eventdb
```

Run migrations:
```bash
psql -U username -d eventdb -f src/db/migrations/001_init.sql
```

### Option B: Using Docker Compose

```bash
docker-compose up -d
```

This will start PostgreSQL and automatically run migrations.

Update your `.env`:
```env
DATABASE_URL=postgresql://eventuser:eventpassword@localhost:5432/eventdb
```

## 5. Development

Start the development server:
```bash
npm run dev
```

The server will start on http://localhost:4000 (or your configured PORT)

## 6. Test the API

### Health Check
```bash
curl http://localhost:4000/health
```

### Register User
```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

### Login
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "securepassword123"
  }'
```

Copy the `accessToken` from the response.

### Create Chat Session
```bash
curl -X POST http://localhost:4000/api/chat/message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "userMessage": "I want to create a tech conference"
  }'
```

## 7. Troubleshooting

### Database Connection Error
- Verify PostgreSQL is running
- Check DATABASE_URL in `.env`
- Ensure database exists: `createdb eventdb`

### Gemini API Error
- Verify GEMINI_API_KEY is set correctly
- Check that API is enabled in Google Cloud Console

### Port Already in Use
- Change PORT in `.env`
- Or kill process using the port:
  - Linux/Mac: `lsof -i :4000 | kill -9 <PID>`
  - Windows: `netstat -ano | findstr :4000` then `taskkill /PID <PID> /F`

### JWT Errors
- Ensure JWT_SECRET and JWT_REFRESH_SECRET are set
- They should be min 32 characters

## 8. Production Deployment

Build TypeScript:
```bash
npm run build
```

Start production server:
```bash
NODE_ENV=production npm start
```

### Deployment Checklist
- [ ] Update all environment variables for production
- [ ] Use a strong, randomly generated JWT secrets
- [ ] Enable SSL/TLS for PostgreSQL
- [ ] Use a process manager (PM2, systemd, etc.)
- [ ] Set up reverse proxy (nginx) with HTTPS
- [ ] Configure monitoring and logging
- [ ] Set up regular database backups
- [ ] Enable database connection pooling
- [ ] Review security headers (Helmet settings)

## 9. Development Tools

### Format Code
```bash
# If you add prettier/eslint (optional):
npm run format
npm run lint
```

### View TypeScript Compilation
```bash
npm run build
```

### Run Migrations in Dev
```bash
psql -U username -d eventdb -f src/db/migrations/001_init.sql
```

## 10. Documentation

Full API documentation available in [README.md](README.md)

---

**Need help?** Check the README.md for detailed API documentation and examples.
