# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Favea (ファベア) is a Japanese "oshikatsu" (推し活 - fan activity) ticket and deadline management system. It helps fans track concert/event tickets, lottery deadlines, and payment deadlines for idol/entertainment events.

**Tech Stack:** Next.js 14 (App Router) + TypeScript + Supabase + shadcn/ui + Tailwind CSS

## Commands

```bash
# Development
npm run dev          # Start dev server at localhost:3000

# Build & Production
npm run build        # Production build
npm start            # Start production server

# Linting
npm run lint         # ESLint with next/core-web-vitals
```

**Note:** No test framework is currently configured.

## Architecture

### Route Structure (Next.js App Router)
- `src/app/(auth)/` - Auth route group (login, signup pages)
- `src/app/(dashboard)/` - Protected dashboard routes
- `src/app/api/ai-draft/` - AI event collection API endpoint
- `src/middleware.ts` - Auth routing protection

### Key Components
- `src/components/event-card.tsx` - Event display with deadline countdown
- `src/components/event-dialog.tsx` - Event create/edit modal
- `src/components/ai-collect-dialog.tsx` - AI collection interface
- `src/components/calendar-view.tsx` - Calendar event view
- `src/components/ui/` - shadcn/ui components

### Supabase Integration
- `src/lib/supabase/client.ts` - Browser client
- `src/lib/supabase/server.ts` - Server-side client
- `src/lib/supabase/middleware.ts` - Session management
- `supabase/functions/ai-collect/` - Edge Function for AI collection

### Type Definitions
- `src/lib/types.ts` - Database table types and ticket status enums

## Ticket Status Flow

```
not_applied → applied → pending → won/lost → paid → confirmed
```

Display statuses: waiting (抽選開始待ち), lottery (抽選中), payment (入金待ち), confirmed (確定)

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=<project-url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

## CI/CD

GitHub Actions workflow (`.github/workflows/deploy.yml`) handles:
- Supabase migrations
- Edge Function deployment

Requires secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_ID`

## Current State

- Frontend UI complete with mock data
- Database schema defined in TypeScript types (migrations not yet applied)
- AI collection UI ready, backend logic stubbed
- Authentication fully integrated with Supabase Auth
