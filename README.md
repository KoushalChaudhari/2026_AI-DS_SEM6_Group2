# Remuneration Voucher Generator

This project is a full-stack web application designed to generate, preview, and print remuneration vouchers for examiners and moderators at A.C. Patil College of Engineering. It features an interactive UI that allows users to add multiple subjects/papers logic into a single grouped voucher cart, automating calculations for basic remuneration, scaling Travel Allowance (T.A.), and enforcing a minimum ₹100 floor per item.

## Features

- **Cart-Style Multi-Row UI:** Add multiple practical or theory examination rows to a single voucher session.
- **Dynamic Rates Dropdowns:** The "Max Marks" options automatically cascade and filter based on the selected Category, Title, Examiner Type, and Payment Unit.
- **Automated Calculations:** 
    - Remuneration is calculated dynamically from the PostgreSQL database rates corresponding to the exact parameters.
    - A strict **₹100 minimum floor** is applied to the remuneration of every individual item added.
    - **Travel Allowance (T.A.)** is automatically scaled at **₹200 per 30 students or papers** for every row, with manual overriding allowed.
- **Interactive Print Preview:** View a meticulously formatted printable voucher view mirroring the official Excel format. Click any row in the preview to reveal a **calculation breakdown** that transparently demonstrates how the unit rate, multipliers, and minimum floor were applied.
- **Role-Based Admin Controls:** Modify core remuneration rates, titles, categories, examiner types, and theory rates effortlessly through the Admin dashboard.

### Exam Seating Arrangement
- **Visual Room Selector:** An interactive floor-based grid (Ground to 6th floor) allowing teachers to visually select physical rooms for an exam. 
- **Dynamic Physical Capacities:** Admin-configurable bench limits for every distinct room (e.g., Room 101 seats 20, Room 102 seats 30) rather than a global estimate.

#### Division System
- **Optional Year Divisions:** Split academic years (SE, TE, BE) into named divisions (A, B, C, etc.) with granular student counts.
- **Admin Division Management:** Accordion-based UI to configure divisions per branch and year with null-safety validation.
- **Flat Count Fallback:** Branches without divisions use flat year-wise counts (maintains backward compatibility).
- **Division-Aware Allocation:** Allocator respects division boundaries and generates roll numbers per division (e.g., SE-A(1-30), SE-B(31-60)).

#### Pairing Constraints & 3-Pass Algorithm
- **Term Ends:** NO pairing allowed (1 student per bench maximum)
    - 30 benches = 30 students max
    - Single year per room only (SE only, or TE only, or BE only)
    - Strict cross-year constraint violations trigger allocation failure
    
- **Internals:** Cross-year pairing ONLY (different years required)
    - 30 benches = 60 students max (2 per bench)
    - SE must pair with TE/BE, TE with SE/BE (no same-year pairing like SE+SE)
    - Each year auto-limited to 30 per room to reserve space for pairing
    - Strict same-year constraint violations trigger allocation failure

- **3-Pass Home-Floor Priority Allocator:**
    - **Pass 1:** Allocate to assigned floor's default rooms (home-floor priority)
    - **Pass 2:** Cross-floor fallback to default rooms on other floors
    - **Pass 3:** Surplus capacity in non-default rooms
    - Roll numbers generated sequentially per division/year within each room

- **Collision Prevention:** Calculates time slots automatically (+1 hr Internals, +3 hr Term Ends) and actively prevents generating plans that overlap with existing approved schedules for those rooms.

- **Enhanced PDF Export:** 
    - A4-scaled tabular seating plan with official college headers and signature lines
    - Division details shown with line breaks and bold year labels (e.g., **SE**(1-30))
    - Clean formatting: no stats clutter, left-aligned division column, 1.5px table borders
    - Signature section fixed to bottom of last page
    - Print-optimized CSS with proper page breaks and color preservation

## Tech Stack
- **Frontend:** React + Vite, built with modern CSS variables, flexible grids, and minimal dependencies (`react-router-dom`, `react-to-print`, `axios`).
- **Backend:** Node.js + Express.js
- **Database:** PostgreSQL (using the `pg` package)
- **Authentication:** JWT (JSON Web Tokens)

## Dependency Inventory

This section lists all dependencies currently declared in the project manifests.

### Root (Server/Workspace) Runtime Dependencies
- `bcrypt` `^5.1.1`
- `concurrently` `^8.2.2`
- `cors` `^2.8.5`
- `dotenv` `^16.4.5`
- `express` `^4.18.2`
- `express-rate-limit` `^8.3.1`
- `helmet` `^8.1.0`
- `jsonwebtoken` `^9.0.2`
- `pg` `^8.11.3`
- `xss` `^1.0.15`
- `zod` `^4.3.6`

### Client Runtime Dependencies
- `axios` `^1.6.7`
- `framer-motion` `^12.35.2`
- `lucide-react` `^0.577.0`
- `react` `^18.2.0`
- `react-dom` `^18.2.0`
- `react-router-dom` `^6.22.1`
- `react-to-print` `^2.15.1`

### Client Dev/Build Dependencies
- `@types/react` `^18.2.55`
- `@types/react-dom` `^18.2.19`
- `@vitejs/plugin-react` `^4.2.1`
- `vite` `^5.1.3`

## Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- PostgreSQL (v14+ recommended)

### 1. Database Setup
Create a PostgreSQL database (e.g., `renum_db`) and run the migration. The server will automatically create all required tables including the division system tables on first run.

**Tables created automatically:**
- Core tables (branches, rooms, rates, etc.)
- `branch_divisions` table for division configuration (auto-created on server startup)

**Schema migration:**
The division system migration (`CREATE TABLE branch_divisions`) runs automatically when the server initializes (see `/server/index.js` lines 165-180).

### 2. Environment Variables
Create a `.env` file in the root of the project with the following keys:
```env
PORT=5000
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=renum_db
JWT_SECRET=your_super_secret_jwt_key
```

### 3. Installation
The project is organized with the Express server in the root `/server` and the React frontend in `/client`.

**Install Server Dependencies:**
```bash
npm install
```

**Install Client Dependencies:**
```bash
cd client
npm install
```

### 4. Running the Application

**Option A: Concurrent Development Mode (Recommended)**

Run both backend and frontend simultaneously from the root directory:
```bash
npm run dev
```

This uses `concurrently` to start:
- Backend: `node --watch server/index.js` (auto-restarts on file changes)
- Frontend: Vite dev server from `/client` (hot module reloading)

The app will be accessible at `http://localhost:5175`.

**Option B: Manual Start**

**Start the Backend Server (from root directory):**
```bash
npm run dev:server
```
The server will run on `http://localhost:5000` with watch mode enabled.

**Start the Frontend Dev Server (in a separate terminal, from `/client` directory):**
```bash
npm run dev
```
The app will be accessible at `http://localhost:5173` or `http://localhost:5175` (if ports are occupied).

## Architecture Overview

- **`/server/routes/voucher.js`:** Contains the primary calculation engine (`/calculate-batch`). It iterates over user input, queries the database for active rates, floors the raw remuneration to ₹100, and returns a fully calculated array of items.

- **`/server/routes/seating.js`:** Manages the seating plan lifecycle, calculating time slots and explicitly checking collision constraints against PostgreSQL before storing a draft or approved plan. Integrates with the 3-pass allocator service.

- **`/server/routes/branchConfig.js`:** Branch configuration API with division CRUD operations. Supports both flat counts and granular division-based allocation.

- **`/server/services/seatingAllocator.js`:** Core 3-pass allocation engine implementing home-floor priority with strict pairing constraints:
    - Pass 1: Assign to home floor default rooms
    - Pass 2: Cross-floor fallback to default rooms  
    - Pass 3: Surplus capacity in non-default rooms
    - Validates cross-year pairing for Term Ends and prevents same-year pairing for Internals

- **`/client/src/pages/VoucherGenerator.jsx`:** The core interface allowing users to select Month/Year periods, add multiple lines to a cart, query dynamic dropdowns, invoke the batch calculation API, and conditionally display the interactive print preview.

- **`/client/src/pages/SeatingArrangement.jsx`:** Houses the interactive floor grid UI, manual/auto allocation modes, division management, and date/time inputs. Integrates with the backend allocator for automated room assignment.

- **`/client/src/pages/admin/Branches.jsx`:** Admin panel for branch management with accordion-based division configuration UI. Supports adding/removing divisions and toggling between flat and divided modes.

## Recent Enhancements

### Division System (v2.0)
- Comprehensive division framework for optional year segmentation
- Database-backed configuration with null-safety validation
- Roll number generation per division
- Backward compatible with existing flat-count allocations

### Pairing Constraint Enforcement
- **Term Ends:** Strict 1-per-bench, single-year-per-room validation
- **Internals:** Strict cross-year-only pairing with automatic year limiting to 30 per room
- Real-time constraint violation reporting with clear error messages

### PDF Export Improvements
- Cleaned division display (removes "Default" labels)
- Enhanced formatting with line breaks and bold year labels
- Optimized table borders (1.5px) and layout for better readability
- Fixed signature section to page bottom
- Improved print-specific CSS for color preservation across browsers