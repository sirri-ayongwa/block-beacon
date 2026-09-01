# BlockBeacon

BlockBeacon is a mobile-first civic reporting app for everyday neighborhood issues: potholes, broken streetlights, litter, unsafe crossings, damaged sidewalks, graffiti, dumped items, and water leaks.

The goal is simple: a resident should be able to snap a photo, pin the location, publish a report, and let neighbors add weight to it without feeling like the report disappeared into a black box.

## Why It Exists

Many local issues are not ignored because residents do not care. They are ignored because the reporting process is unclear, fragmented, city-specific, or invisible after submission.

BlockBeacon makes the process public and community-driven:

- reports are visible on a shared neighborhood map
- neighbors can upvote issues that matter
- status changes are public and timestamped
- verified moderators can update reports and hand them off
- AI helps reduce form friction and supports moderator verification

## What It Does

### Report Issues From The Map

Residents can open the map, choose a location, upload or take photos, and submit a report with:

- title
- category
- optional description
- precise latitude and longitude
- anonymous posting option
- up to 3 photos

Reports appear as category-aware pins on a Leaflet/OpenStreetMap map.

### AI Photo Autofill

When a user uploads a report photo, Gemini analyzes the image and suggests:

- a short title
- the best matching issue category
- a concise description

For example, a road hazard photo can become:

> Large pothole blocking right lane

The current AI provider is Gemini, using `gemini-3.6-flash` from server-side API routes.

### Duplicate Report Detection

Before submission, BlockBeacon checks nearby open reports and warns the user when the new report may describe the same physical issue.

The app combines:

- distance-based nearby issue checks
- category matching
- AI-assisted comparison against nearby reports

When a likely duplicate is found, the user sees a warning and can choose to upvote the existing report or confirm that their report is different.

### Voting And Community Priority

Neighbors can upvote reports to show which problems affect more people. Voting is account-based so each person gets one vote per issue.

Issue lists and moderator views can use upvote counts to surface higher-priority problems.

### Visible Status Lifecycle

Reports move through a clear public lifecycle:

- `Needs attention`
- `City is looking`
- `Fixed`

Status changes are visible to neighbors, and users who care about a report can be notified when it changes.

### Verified Moderators

Moderators apply through a dedicated onboarding flow. They provide:

- organization or department
- community served
- verified account email
- proof document or badge image

Gemini reviews the submitted text plus uploaded proof files, including images, PDFs, and DOCX files, and returns an approval recommendation with a reason and confidence score.

Verified moderators can:

- review community reports
- update issue statuses
- hand off reports to departments
- appear with a verified city-hall badge

### City-Hall Handoff

For issues that need escalation, moderators can generate handoff material including:

- a referral email body
- a browser-generated PDF summary
- issue title, category, status, upvotes, location, and description

When an issue is handed off, BlockBeacon records the handoff state so neighbors can see that it has moved beyond discussion.

### Issue Detail Pages

Each report has a detail page with:

- report metadata
- signed photo previews
- status history
- votes
- comments
- issue-scoped chat access

### Neighbor Conversation

BlockBeacon supports discussion around reports through:

- issue comments
- moderator-marked comments
- issue-specific chat rooms
- expiring chat rooms for temporary coordination

### Offline Capture

If a user loses connection, report data and photos can be queued locally and submitted later when the browser comes back online.

This matters for civic reporting because the problem may be on a street corner, park, or rural road with weak mobile signal.

### Notifications

The app includes notification support for issue updates, including visual notifications and a small chime when an issue a user cares about changes status.

### Settings And Localization

Users can configure:

- country and home map area
- default anonymous posting
- notification preferences
- digest preferences

The UI includes a language dropdown and localized text support, with English as the complete base language.

## Tech Stack

- React 19
- TanStack Start
- TanStack Router
- TanStack Query
- Vite
- TypeScript
- Tailwind CSS
- Leaflet and React Leaflet
- OpenStreetMap tiles
- Firebase
- Gemini
- jsPDF
- UploadThing
- Resend and Mailchimp-related email utilities

## Current Architecture

BlockBeacon is a TanStack Start application with file-based routes in `src/routes`.

Important areas:

- `src/routes/_authenticated/map.tsx` - main authenticated map experience
- `src/components/ReportSheet.tsx` - report creation popup, photo upload, AI autofill, duplicate warning
- `src/routes/_authenticated/issue.$id.tsx` - issue detail page
- `src/routes/_authenticated/moderator.tsx` - moderator dashboard
- `src/routes/_authenticated/moderator_.apply.tsx` - moderator application and document verification
- `src/routes/api/public/analyze-report-photo.ts` - Gemini photo analysis route
- `src/routes/api/public/verify-moderator.ts` - Gemini moderator verification route
- `src/lib/gemini.server.ts` - shared server-side Gemini JSON helper
- `src/integrations/firebase/client.ts` - Firebase setup

The codebase currently uses Firebase services while preserving a Supabase-like client interface in parts of the app. That compatibility layer keeps the app moving without requiring every existing call site to be rewritten at once.

## AI Features

### Report Photo Analysis

The report photo analysis route accepts base64 image data and sends it to Gemini as inline image data. Gemini returns JSON shaped like:

```json
{
  "title": "Large pothole blocking right lane",
  "description": "A deep pothole is visible in the roadway and may affect traffic.",
  "category": "pothole",
  "duplicate": {
    "isDuplicate": false,
    "issueId": null,
    "reason": "",
    "confidenceScore": 0
  }
}
```

Allowed report categories:

- `broken_streetlight`
- `litter`
- `pothole`
- `unsafe_intersection`
- `graffiti`
- `damaged_sidewalk`
- `abandoned_item`
- `water_leak`
- `other`

### Moderator Verification

Moderator verification sends application text and the uploaded proof file to Gemini. The route supports images, PDFs, and DOCX uploads when the browser provides the file data and MIME type.

Gemini returns:

```json
{
  "isApproved": true,
  "flaggedCategory": null,
  "reason": "The document appears to support the applicant's city role.",
  "confidenceScore": 0.82
}
```

The app stores the AI review result on the moderator profile for later use.

## Environment Variables

Create `.env.local` for local development. Do not commit real secrets.

```env
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_STORAGE_BUCKET=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_MEASUREMENT_ID=""

GEMINI_API_KEY=""

MAILCHIMP_API_KEY=""
MAILCHIMP_SENDER_EMAIL=""
ADMIN_EMAIL=""
UPLOADTHING_TOKEN=""
```

Notes:

- `VITE_*` values are browser-exposed by design.
- `GEMINI_API_KEY`, email provider keys, and upload tokens must stay server-side.
- Restart the dev server after changing `.env.local`.

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview a production build:

```bash
npm run preview
```

Lint:

```bash
npm run lint
```

## Data Model Overview

Core app collections/tables used through the compatibility client include:

- `issues`
- `issue_photos`
- `issue_votes`
- `issue_status_events`
- `issue_comments`
- `chat_rooms`
- `chat_messages`
- `profiles`
- `moderator_profiles`
- `notifications`
- `reporter_leaderboard`

The issue record stores the public report details, location, category, status, photo reference, reporter, anonymity flag, and upvote count.

## Privacy And Safety

BlockBeacon is designed around public civic reporting, so the app should avoid collecting unnecessary private information.

Key principles:

- public reports should describe visible civic issues
- anonymous reports hide the resident's name from neighbors
- account identity is still used for voting integrity and moderation
- moderator proof files are used for verification and should not be published
- server-side API keys must never be exposed through `VITE_` variables

## Project Status

The app currently includes the core resident reporting flow, map, photo upload, AI autofill, duplicate warnings, issue details, comments, chat, moderator onboarding, Gemini verification, handoff tooling, settings, localization support, and notification utilities.

Some infrastructure details depend on the deployment environment, especially Firebase configuration, API keys, storage permissions, and email provider setup.

## Roadmap

Planned or natural next steps:
- ward or district boundaries for moderator assignment
- stronger background push notification support
- open data exports for researchers and journalists
- richer duplicate clustering for repeated issue reports
- moderator-only geographic scopes
- improved accessibility and low-bandwidth mode

## Impact

BlockBeacon turns scattered individual complaints into visible community demand. A resident can document a hazard in under a minute, neighbors can validate it with a tap, and verified officials can update or escalate the issue with a clear public trail.

That public trail matters. It shows which problems get fixed, which blocks wait, and where civic attention is uneven.
