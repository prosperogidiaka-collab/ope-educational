# OPE EDUCATIONAL

OPE EDUCATIONAL is a multi-role school results management and publishing platform built with Next.js. The current workspace contains a high-fidelity product demo with academic setup controls, review workflow depth, verification flows, coupon security, and printable report cards.

## Included modules

- Overview and operations dashboard
- Academic setup board for session, term, component windows, class offerings, and promotion preview
- Teacher desk with:
  - sticky identity columns
  - blank CSV/Excel template download (registration numbers and names pre-filled)
  - current-sheet CSV and Excel export for guided offline entry
  - bulk CSV and Excel upload of results
  - paste-from-Excel support
  - autosave feedback
  - server-side save of drafts and submissions (resume from any device, visible to the HOD desk)
  - missing-score detection
  - moderated comment templates
- Class Review board (for HOD, principal, and teachers assigned by the principal/HOD) with:
  - a class-summary strip (students, ranked count, class average, pass rate, top of class, items needing attention, published count) plus an overall-grade distribution chart
  - "by subject" view — every student's component scores for one subject, with automatic inconsistency flags (incomplete entries, totals over 100, far-from-class-average outliers, large CA-vs-exam gaps)
  - "by student" view — one student's full subject breakdown, computed totals, position eligibility, and a consolidated list of things to double-check
  - "by template" view — the exact report card the student sees once published (live template + principal edits)
  - per-student **Result preview** (overlay and full-page `/results/[regNumber]?preview=1`) that mirrors the token-protected student view before release
  - a printable **class broadsheet** (`/dashboard/review/broadsheet`) — every student against every subject, with totals, averages, GPA, grade, position, subject averages, and incomplete-entry flags, in an A4-landscape print layout
  - reviewer actions: send a subject sheet back to the teacher, mark a sheet reviewed, request corrections, approve for release, publish & release token — all saved on the server and reflected on the dashboard, audit desk, principal editor, and student portal
- Audit and HOD review board with live teacher submissions, recorded release decisions, anomaly comparisons, and return-to-teacher actions
- Principal control tower with:
  - quick publish center
  - controlled unlock queue
  - alerts feed
  - grade policy panel
  - coupon management
  - a full report-sheet editor where every printed field — including the **per-subject teacher's remark, class highest/lowest, and subject position** — can be adjusted before release, with a live preview
- Template builder board with live preset preview
- Super admin board for multi-school SaaS visibility
- Student portal and result verification page
- Printable / verifiable report card with:
  - compact single-page A4 layout, school logo, motto, address, and exam type
  - student bio (reg number, class, position out of class size, house, sex, date of birth, age, guardian)
  - per-subject CA / exam / total / grade / class average / class highest & lowest / **subject position** / subject teacher's remark (columns are template-configurable)
  - performance summary: total scored vs obtainable, average, weighted average, overall grade, **GPA**, position of class
  - attendance summary with attendance percentage
  - affective and psychomotor domains with a rating key
  - **grading key table** (mark ranges and remarks) driven from the school's grade scale
  - subject teacher, class teacher, and principal remarks
  - fee status, "next term begins" date, verification ID, generated-on timestamp, and an authenticity disclaimer
  - a **dedicated print stylesheet** tuned so the entire card fits one A4 page with no cut and no overflow: the report renders as static server-side HTML in a `#print-area` container, `@media print` hides everything except that container (`.no-print` on toolbars/banners/modals) and tightens every block (fonts, padding, gaps, grids, signatures, verification grid), `print-color-adjust: exact` keeps logos/colours, and the "Print / Save as PDF" button just calls `window.print()` (no JS render-at-print)

## Demo data highlights

The seeded demo in [src/lib/demo-data.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/lib/demo-data.ts) now models:

- class and track subject offerings
- score component freezing
- separate senior and junior grading scales
- elective subject-aware result computation
- HOD, class teacher, bursary, management, and principal workflow stages
- controlled unlock requests after publishing
- version history and audit trail entries
- term-bound coupon records with suspicious-access visibility
- verification IDs and portal access logs

## Core files

- App routes live under [src/app](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/app)
- Demo domain types live in [src/lib/types.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/lib/types.ts)
- Calculation logic lives in [src/lib/calculations.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/lib/calculations.ts)
- PostgreSQL schema lives in [prisma/schema.prisma](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/prisma/schema.prisma)
- Live results merge ([src/lib/live-results.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/lib/live-results.ts)) overlays teacher submissions and reviewer release decisions onto the seeded bundles; the dashboard, audit desk, class-review board, principal editor, and student portal all read it
- The teacher-scores store is seeded from the demo bundles on first run (one sheet per subject), so every subject is immediately reviewable and shows up on the Audit desk without re-keying
- Server-side persistence APIs:
  - `GET/PUT/DELETE /api/teacher-scores/[assignmentId]` for teacher score sheets (drafts and submissions)
  - `GET/PUT/DELETE /api/review-decisions` (`?regNumber=` for DELETE) for class-review release decisions
  - `GET/PUT/DELETE /api/report-sheet/[regNumber]` for principal report-sheet overrides
  - `GET/PUT /api/template-workspace` for the report-card template builder
- Local JSON-backed stores live under [data/](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/data) and are created automatically on first use
- Cloudflare deployments can persist the same store payloads through the `APP_DATA` Workers KV binding, with an in-memory fallback available if the binding has not been connected yet

## Production wiring path

The UI currently runs on seeded demo data, but the Prisma schema already points toward a live production backend with:

- richer user roles including HOD, class teacher, and bursar
- stronger result statuses and approval stages
- verification IDs and locked result sheets
- unlock requests
- coupon access logs
- attendance and report-card metadata

## Local commands

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`
- `npm run deploy`
- `npm run cf-typegen`
- `npm run prisma:format`

## Cloudflare deployment

- Deploy this app to **Cloudflare Workers**, not static Pages, because it uses SSR, route handlers, server actions, cookies, and writable application state.
- Connect a Workers KV namespace to the `APP_DATA` binding for durable production storage of the app's JSON-backed stores.
- If you deploy through Cloudflare's GitHub integration, use:
  - Build command: `npx @opennextjs/cloudflare build`
  - Deploy command: `npx @opennextjs/cloudflare deploy`
- The included [wrangler.jsonc](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/wrangler.jsonc) already targets the OpenNext worker output and enables `nodejs_compat`.
- The included [next.config.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/next.config.ts) initializes the OpenNext Cloudflare dev bridge, and [src/lib/storage-fs.ts](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/lib/storage-fs.ts) switches the app's `data/` storage between local files, Workers KV, and a safe in-memory fallback automatically.

## Local secret storage

Portal passwords, coupon codes, and staff login passwords are kept in local-only files under `data/private/`. Those files are ignored by Git so live credentials are not committed with the project.

## Current environment note

The interface has been reworked into a tighter, flatter design system (refined palette, solid white cards, consistent spacing/typography, compact buttons and status pills, zebra-striped sticky-header tables, a cleaner dark sidebar) — see [src/app/globals.css](/c:/Users/HP/Documents/OPE%20EDU%20RESULTS/src/app/globals.css).

Dependencies are installed and `next build` plus `next lint` pass. The app runs end to end via `npm run build && npm start` (or `npm run dev`); every route returns 200 and the full loop has been exercised — teacher template download → results upload → server-side save → submission visible on the Audit desk and Class Review board → reviewer requests corrections / publishes → student portal + result preview reflect the change → print the report card. Prisma validation still requires a configured `DATABASE_URL`.
