# ASCORA + EduVerse AI

Adaptive AI teaching platform for the ASCORA hardware prototype.

## Core loop

Student assessment → learning profile → mastery/misconception analysis → adaptive teaching strategy → ASCORA → new interaction → updated profile.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

In a second terminal:

```bash
npm run server
```

The frontend runs on http://localhost:5173 and the API on http://localhost:3001.

## Supabase

1. Create a Supabase project.
2. Put the project URL and anon key in `.env`.
3. Run `supabase/schema.sql` in the SQL editor.
4. Add the service-role key only to the backend environment.

The prototype includes a local fallback mode when Supabase is not configured, so the UI can still be explored.

## Important

The AI provider adapter is intentionally provider-agnostic. Add your chosen provider inside `server/services/aiProvider.js`; never expose its secret in frontend code.

The Ascora simulator uses the same API contracts intended for the physical robot. Replace the simulator transport with the device controller/WebSocket client when hardware is ready.