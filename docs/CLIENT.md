# Client Documentation — Emotract Frontends

Emotract ships two independent React single-page applications:

| App        | Path                                       | Port  | Stack                                  | Audience              |
|------------|--------------------------------------------|-------|----------------------------------------|-----------------------|
| User app   | [user/](../user/)                          | 5173  | React 19 + Vite + Styled-Components    | End users (chat)      |
| Admin app  | [admin/](../admin/)                        | 5174  | React 18 + Vite + TypeScript + ShadCN  | Administrators        |

Both authenticate through Auth0 Universal Login, talk to the same Express backend on port `5001`, and connect to its Socket.io server with the Auth0 access token. They differ in framework conventions, state management, and feature surface — covered separately below.

---

## Table of Contents

### Part A — User App
1. [User App Overview](#1-user-app-overview)
2. [Directory Layout (User)](#2-directory-layout-user)
3. [Provider Stack & Routing (User)](#3-provider-stack--routing-user)
4. [Auth0 Integration (User)](#4-auth0-integration-user)
5. [Pages (User)](#5-pages-user)
6. [Components (User)](#6-components-user)
7. [Socket Context](#7-socket-context)
8. [HTTP Layer (User)](#8-http-layer-user)
9. [Environment Variables (User)](#9-environment-variables-user)

### Part B — Admin App
10. [Admin App Overview](#10-admin-app-overview)
11. [Directory Layout (Admin)](#11-directory-layout-admin)
12. [Provider Stack & Routing (Admin)](#12-provider-stack--routing-admin)
13. [Auth0 Integration (Admin)](#13-auth0-integration-admin)
14. [Pages (Admin)](#14-pages-admin)
15. [Components (Admin)](#15-components-admin)
16. [HTTP Layer & Server State (Admin)](#16-http-layer--server-state-admin)
17. [Theming & Layout (Admin)](#17-theming--layout-admin)
18. [Environment Variables (Admin)](#18-environment-variables-admin)

### Cross-cutting
19. [Auth0 Application Setup (Both Apps)](#19-auth0-application-setup-both-apps)
20. [Running the Frontends](#20-running-the-frontends)

---

# Part A — User App

## 1. User App Overview

The user app is the chat surface end users land on. It's intentionally lean: one chat page, one profile-completion page, one avatar-picker page, and a login page that hands off to Auth0.

Key responsibilities:
- Auth0 Universal Login (redirect flow)
- Profile completion gate
- Avatar selection
- Real-time messaging via Socket.io
- Online presence indicators
- Suspended/flagged user blocking UI

State stays simple: component-local `useState`, the Auth0 React context for auth, a custom `SocketProvider` for the socket connection, and `sessionStorage` for the currently selected chat (survives refresh).

---

## 2. Directory Layout (User)

```
user/
├── public/
├── src/
│   ├── assets/
│   │   └── avatars/                 # Bundled avatar images
│   ├── components/
│   │   ├── ChatContainer.jsx        # Message display + input integration
│   │   ├── ChatInput.jsx            # Message composer (emoji picker, send)
│   │   ├── Contacts.jsx             # Sidebar of contacts / chats
│   │   ├── Logout.jsx               # Logout button → Auth0 logout
│   │   ├── SetAvatar.jsx            # Avatar picker
│   │   ├── SuspendedUserPopup.jsx   # Modal shown for flagged users
│   │   ├── Welcome.jsx              # Empty-state placeholder
│   │   └── ui/
│   │       └── Settings.jsx
│   ├── context/
│   │   ├── Auth0ProviderWithNavigate.jsx
│   │   └── SocketProvider.jsx
│   ├── pages/
│   │   ├── Chat.jsx                 # Main chat page
│   │   ├── CompleteProfile.jsx      # Profile completion form
│   │   └── Login.jsx                # Auth0 login redirect entry
│   ├── utils/
│   │   ├── APIRoutes.js             # Endpoint path constants
│   │   ├── PrivateRoute.jsx         # Route guard
│   │   └── axiosInstance.js         # Axios with Auth0 token injection
│   ├── App.jsx                      # Router definition
│   ├── main.jsx                     # ReactDOM entry + providers
│   └── index.css                    # Global styles
├── vite.config.js
└── package.json
```

---

## 3. Provider Stack & Routing (User)

### 3.1 `main.jsx`
Wraps `<App />` in this order (outer → inner):

```
BrowserRouter
  └── Auth0ProviderWithNavigate
        └── SocketProvider
              └── App
```

`BrowserRouter` lives outside `Auth0ProviderWithNavigate` because the provider uses `useNavigate` to handle the Auth0 redirect callback.

### 3.2 `App.jsx` routes

| Path                | Element                                | Protection                                    |
|---------------------|----------------------------------------|-----------------------------------------------|
| `/login`            | `<Login />`                            | public                                        |
| `/complete-profile` | `<CompleteProfile />`                  | `<PrivateRoute>` (auth only, profile pending) |
| `/setAvatar`        | `<SetAvatar />`                        | `<PrivateRoute>` (auth + profile complete)    |
| `/`                 | `<Chat />`                             | `<PrivateRoute>` (full access)                |

### 3.3 `PrivateRoute` flow

In [user/src/utils/PrivateRoute.jsx](../user/src/utils/PrivateRoute.jsx):

1. If `!isAuthenticated` → redirect to `/login`.
2. If `!user.is_profile_complete` → redirect to `/complete-profile`.
3. If `!user.isAvatarImageSet` → redirect to `/setAvatar`.
4. Otherwise → render the route.

This is the single funnel that keeps half-onboarded users from reaching the chat surface.

---

## 4. Auth0 Integration (User)

### 4.1 `Auth0ProviderWithNavigate`
Located at [user/src/context/Auth0ProviderWithNavigate.jsx](../user/src/context/Auth0ProviderWithNavigate.jsx). Wraps `@auth0/auth0-react`'s `Auth0Provider` with:

- `domain` ← `VITE_AUTH0_DOMAIN`
- `clientId` ← `VITE_AUTH0_CLIENT_ID`
- `audience` ← `VITE_AUTH0_AUDIENCE`
- `redirectUri` ← `window.location.origin`
- `cacheLocation: "localstorage"` — so sessions survive a hard refresh
- `onRedirectCallback` — uses `useNavigate` to return the user to the page they came from

### 4.2 Tokens
The SDK manages tokens internally. The app never reads/writes tokens to localStorage directly. To call the API, it uses `getAccessTokenSilently()` from `useAuth0()` and feeds the result into `axiosInstance` via `setTokenGetter` (see [§8](#8-http-layer-user)).

### 4.3 Login & logout
- `Login.jsx` calls `loginWithRedirect()` and immediately redirects to Auth0's hosted page.
- `Logout.jsx` calls `logout({ returnTo: window.location.origin })`, then also pings `POST /api/v1/auth/logout` so the server can mark the user offline.

---

## 5. Pages (User)

### 5.1 `Login.jsx`
Sole responsibility: trigger `loginWithRedirect()`. No local form — credentials live with Auth0.

### 5.2 `CompleteProfile.jsx`
Form rendered after first Auth0 signup. Collects:
- `firstname`, `lastname`
- `phone`
- `aadhaar_number`
- `parent_email`
- `age`
- `gender`

Submits to `PATCH /api/v1/auth/complete-profile`, which sets `is_profile_complete: true`. On success, navigates to `/setAvatar`.

### 5.3 `Chat.jsx`
Main chat workspace. On mount:
1. Fetches the contact list (`GET /auth/all-users/:id`).
2. Subscribes to socket events (`msg-recieve`, `user-status-change`, `online-users`) via `SocketProvider`.
3. Persists the active chat to `sessionStorage` so a refresh restores it.
4. Renders `<Contacts />` + `<ChatContainer />` or `<Welcome />` based on selection.

If `getUserBlockStatus` reports the current user as flagged, `<SuspendedUserPopup />` is rendered and inputs are disabled.

---

## 6. Components (User)

| Component                          | Responsibility                                                                 |
|------------------------------------|--------------------------------------------------------------------------------|
| `Contacts.jsx`                     | Sidebar list of users with online dot, last-active timestamps, selection state |
| `ChatContainer.jsx`                | Renders message bubbles, owns the message-list scroll behavior                 |
| `ChatInput.jsx`                    | Textarea + emoji picker (via `emoji-picker-react`) + send button               |
| `Welcome.jsx`                      | Placeholder rendered when no contact is selected                               |
| `Logout.jsx`                       | Auth0 logout + server-side logout fan-out                                      |
| `SetAvatar.jsx`                    | Avatar picker, persists via `POST /auth/setavatar/:id`                         |
| `SuspendedUserPopup.jsx`           | Modal shown to users with `is_flagged: true`                                   |
| `ui/Settings.jsx`                  | Slide-out settings panel                                                       |

Styling is done with `styled-components` (per-component) plus Tailwind v4 for utility classes.

---

## 7. Socket Context

[user/src/context/SocketProvider.jsx](../user/src/context/SocketProvider.jsx) is the single client-side owner of the Socket.io connection.

### 7.1 Connection lifecycle
- Connects **only after** Auth0 reports `isAuthenticated`.
- Passes the Auth0 access token via `socket.handshake.auth.token`.
- Disconnects on logout and on unmount.

### 7.2 What it exposes
The provider value typically includes:
- `socket` — the live socket instance
- `onlineUsers` — current set of online user IDs (kept in sync with `online-users` and `user-status-change` events)
- helpers to emit `send-msg`

Consumers use `useContext(SocketContext)` to read these. Server-side event names are described in [SERVER.md §9](SERVER.md#9-real-time-layer-socketio).

---

## 8. HTTP Layer (User)

### 8.1 `axiosInstance.js`
[user/src/utils/axiosInstance.js](../user/src/utils/axiosInstance.js) exports a configured Axios client.

- `baseURL` ← `VITE_BACKEND_URL` (default `http://localhost:5001/api/v1`)
- Request interceptor calls a registered "token getter" function and attaches `Authorization: Bearer <token>` to every request.
- `setTokenGetter(fn)` — registers `getAccessTokenSilently` from Auth0 once after login.

### 8.2 `APIRoutes.js`
[user/src/utils/APIRoutes.js](../user/src/utils/APIRoutes.js) — string constants for every endpoint the user app touches:

| Constant                          | Path                            |
|-----------------------------------|---------------------------------|
| `completeProfileRoute`            | `/auth/complete-profile`        |
| `logoutRoute`                     | `/auth/logout`                  |
| `allUsersRoute`                   | `/auth/all-users`               |
| `allContactUsersRoute`            | `/auth/all-contact-users`       |
| `userBlockRoute`                  | `/auth/block-status`            |
| `sendMessageRoute`                | `/messages/addmsg`              |
| `recieveMessageRoute`             | `/messages/getmsg`              |
| `fetchCurrentOnlineStatusRoute`   | `/auth/online-status`           |
| `setAvatarRoute`                  | `/auth/setavatar`               |

### 8.3 Request → response pattern
1. Component calls `axiosInstance.post(sendMessageRoute, { from, to, message })`.
2. Interceptor injects bearer token.
3. Server validates JWT, runs the controller, returns JSON.
4. Component updates local state.

For real-time delivery (vs persistence), the same flow runs in parallel with `socket.emit("send-msg", { to, msg })`.

---

## 9. Environment Variables (User)

`user/.env`:

| Variable               | Purpose                                                |
|------------------------|--------------------------------------------------------|
| `VITE_BACKEND_URL`     | Base URL for axios (e.g. `http://localhost:5001/api/v1`) |
| `VITE_AUTH0_DOMAIN`    | Auth0 tenant domain                                    |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA application client ID                        |
| `VITE_AUTH0_AUDIENCE`  | Auth0 API identifier — must match server's `AUTH0_AUDIENCE` |

Vite only exposes variables prefixed with `VITE_` to client code.

---

# Part B — Admin App

## 10. Admin App Overview

The admin app is a TypeScript dashboard built on ShadCN UI (Radix primitives + Tailwind) with TanStack Query for server state. It's intentionally heavier than the user app — analytics, tables, charts, drill-downs.

Key responsibilities:
- Auth0 Universal Login (same flow as user app, different SPA client config if separated, or same client with role-gated access)
- Aggregate dashboard (totals, trends, charts)
- User table with block / unblock / delete / restrict actions
- Per-user analytics drill-down
- Dark / light theming

---

## 11. Directory Layout (Admin)

```
admin/
├── src/
│   ├── assets/
│   ├── components/
│   │   ├── charts/                    # Recharts wrappers
│   │   ├── layout/
│   │   │   └── dashboard-layout.tsx   # Auth-gated app shell
│   │   ├── shared/                    # Reusable dashboard chrome
│   │   │   ├── data-table.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   ├── theme-toggle.tsx
│   │   │   ├── user-nav.tsx
│   │   │   └── ... (alert-modal, breadcrumbs, pagination, etc.)
│   │   └── ui/                        # ShadCN primitives (button, card, dialog, …)
│   ├── constants/
│   │   ├── api.ts                     # Endpoint path constants
│   │   └── data.ts                    # Static lookups
│   ├── hooks/
│   │   └── use-sidebar.ts
│   ├── lib/
│   │   ├── api.ts                     # Typed API functions
│   │   └── utils.ts                   # cn() + misc helpers
│   ├── pages/
│   │   ├── auth/
│   │   │   ├── PrivateRoute.tsx
│   │   │   ├── signin/index.tsx
│   │   │   └── logout/index.tsx
│   │   ├── dashboard/
│   │   │   ├── components/
│   │   │   │   ├── overview.tsx
│   │   │   │   └── recent-sales.tsx
│   │   │   └── index.tsx
│   │   ├── form/index.tsx
│   │   ├── not-found/index.tsx
│   │   └── students/
│   │       ├── index.tsx              # Users list
│   │       ├── StudentDetailPage.tsx  # User drill-down
│   │       ├── queries/               # Query hooks
│   │       └── components/
│   │           ├── students-table/
│   │           ├── student-feed-table/
│   │           ├── student-forms/
│   │           ├── bio.tsx
│   │           ├── count-card.tsx
│   │           ├── feed.tsx
│   │           ├── interest-channel.tsx
│   │           ├── parent-detail-card.tsx
│   │           └── time-spent-card.tsx
│   ├── providers/
│   │   ├── Auth0ProviderWithNavigate.tsx
│   │   ├── theme-provider.tsx
│   │   └── index.tsx                  # Composes all providers
│   ├── routes/
│   │   ├── index.tsx
│   │   └── hooks/                     # use-router, use-pathname
│   ├── types/
│   ├── utils/
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## 12. Provider Stack & Routing (Admin)

### 12.1 `main.tsx` → `App.tsx` → `AppProvider`
`AppProvider` in [admin/src/providers/index.tsx](../admin/src/providers/index.tsx) composes everything in this order:

```
HelmetProvider                ← <title> / <meta> management
  └── BrowserRouter
        └── Auth0ProviderWithNavigate
              └── ErrorBoundary
                    └── QueryClientProvider   ← TanStack Query
                          ├── ReactQueryDevtools
                          └── ThemeProvider
                                └── SidebarProvider
                                      └── <AppRouter />
```

### 12.2 `routes/index.tsx`

**Public routes**
| Path       | Element        |
|------------|----------------|
| `/login`   | `<SignInPage>` |
| `/logout`  | `<Logout>`     |
| `/404`     | `<NotFound>`   |
| `*`        | redirect → `/404` |

**Protected routes (wrapped by `<PrivateRoute>` + `<DashboardLayout>`)**
| Path                   | Element                |
|------------------------|------------------------|
| `/` (index)            | `<DashboardPage>`      |
| `/users`               | `<StudentPage>`        |
| `/user/details/:id`    | `<StudentDetailPage>`  |
| `/form`                | `<FormPage>`           |

All page components are lazy-loaded with `React.lazy` + `<Suspense>`.

### 12.3 `<PrivateRoute>`
[admin/src/pages/auth/PrivateRoute.tsx](../admin/src/pages/auth/PrivateRoute.tsx):
1. While Auth0 is `isLoading`, render a loader.
2. If `!isAuthenticated`, redirect to `/login`.
3. Otherwise, allow the layout + nested route to render.

Server-side `isAdmin` middleware enforces the **real** authorization — the frontend guard is UX only.

---

## 13. Auth0 Integration (Admin)

[admin/src/providers/Auth0ProviderWithNavigate.tsx](../admin/src/providers/Auth0ProviderWithNavigate.tsx) mirrors the user app's pattern, but in TypeScript:

- `cacheLocation: "localstorage"` for cross-refresh persistence
- `redirectUri = window.location.origin`
- `onRedirectCallback` uses `useNavigate` to return to the originating route
- Tokens injected into axios via the same "token getter" pattern as the user app

Because both apps register the same `AUTH0_AUDIENCE`, the server treats their JWTs identically — what makes one "admin" is the resolved user's `role` in MongoDB, not the SPA they logged in from.

---

## 14. Pages (Admin)

### 14.1 `pages/dashboard/index.tsx`
Top-level dashboard. Pulls from `getDashboardStats()` and renders:
- KPI cards (total users, online, flagged, messages, chats)
- 30-day trend chart (`components/overview.tsx`)
- Recent activity feed (`components/recent-sales.tsx`)

### 14.2 `pages/students/index.tsx`
User management table. Features:
- TanStack Table for sorting / filtering / pagination
- Row actions (block / unblock / delete / restrict) via `components/students-table/cell-action.tsx`
- Search input + column filters via `student-table-action.tsx`

### 14.3 `pages/students/StudentDetailPage.tsx`
Drill-down for a single user. Composed from:
- `bio.tsx` — name, email, age, gender
- `parent-detail-card.tsx` — guardian email / phone
- `count-card.tsx` — message / chat counts
- `time-spent-card.tsx` — activity duration
- `interest-channel.tsx` — topic / channel breakdown
- `feed.tsx` + `student-feed-table/` — message feed with admin actions

### 14.4 `pages/form/index.tsx`
Generic form scaffold (react-hook-form + zod schema). Used for ad-hoc admin inputs.

### 14.5 `pages/auth/signin/index.tsx`
Calls `loginWithRedirect()` — same pattern as the user app.

### 14.6 `pages/auth/logout/index.tsx`
Performs Auth0 logout, then `POST /auth/logout` to the server.

### 14.7 `pages/not-found/index.tsx`
404 page; receives any unmatched route.

---

## 15. Components (Admin)

### 15.1 `components/ui/` — ShadCN primitives
Wrappers over Radix UI: `button`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `select`, `tabs`, `toast`, `tooltip`, `chart`, etc. Style via Tailwind classes + `cn()` from `lib/utils.ts`.

### 15.2 `components/shared/` — dashboard chrome
| Component                  | Purpose                                                |
|----------------------------|--------------------------------------------------------|
| `sidebar.tsx` / `mobile-sidebar.tsx` | Nav rail + mobile drawer variant            |
| `dashboard-nav.tsx`        | Nav item list driven by `constants/data.ts`            |
| `header.tsx`               | Top bar — breadcrumbs, theme toggle, user menu         |
| `user-nav.tsx`             | Avatar dropdown with profile / logout                  |
| `data-table.tsx` + `data-table-skeleton.tsx` | Generic TanStack Table wrapper       |
| `pagination-section.tsx`   | Paged result controls                                  |
| `table-search-input.tsx`   | Debounced search input bound to table state            |
| `alert-modal.tsx` / `popup-modal.tsx` | Confirm + generic modals                    |
| `breadcrumbs.tsx`          | Route-driven breadcrumb trail                          |
| `theme-toggle.tsx`         | Dark / light switch                                    |
| `fileupload.tsx`           | Drag-drop upload control                               |

### 15.3 `components/charts/`
Recharts-based chart components used by the dashboard and student detail pages.

### 15.4 `components/layout/dashboard-layout.tsx`
The protected shell: sidebar + header + `<Outlet />`. Wraps every authenticated route.

---

## 16. HTTP Layer & Server State (Admin)

### 16.1 `lib/api.ts`
Typed wrapper functions over axios. Each function corresponds to one server endpoint:

| Function                          | Server endpoint                     |
|-----------------------------------|-------------------------------------|
| `getDashboardStats()`             | `GET /auth/dashboard-stats`         |
| `getUsers(limit?)`                | `GET /auth/complete-users?limit=`   |
| `getSingleUser(id)`               | `GET /auth/get-user-details/:id`    |
| `getUserAnalytics(id)`            | `GET /auth/get-user-analytics/:id`  |
| `getGenderDetails()`              | `GET /auth/user-gender-details`     |
| `handleBlockUser(id)`             | `PATCH /auth/block-user/:id`        |
| `handleUnBlockUser(id)`           | `PATCH /auth/unblock-user/:id`      |
| `handleDeleteUser(id)`            | `DELETE /auth/delete-user/:id`      |
| `restrictUser(args)`              | `POST /auth/restrict-user`          |

`restrictUser` takes a `RestrictUserProps` object with a `type` discriminator that maps to the server's `INFORM_PARENT_AND_BLOCK` / `WARN_CHILD` branch (see [SERVER.md §8.3](SERVER.md#83-admincontrollerjs--controllersv1admincontrollerjs)).

### 16.2 `constants/api.ts`
String constants for endpoint paths — keeps the magic strings out of `lib/api.ts`.

### 16.3 TanStack Query usage
Every server call is wrapped in `useQuery` or `useMutation`. Conventions:
- **Query keys** are arrays starting with the resource: `["users"]`, `["user", id]`, `["dashboard-stats"]`.
- **Mutations** invalidate the relevant query keys on success (`queryClient.invalidateQueries`).
- `staleTime` / `refetchOnWindowFocus` are tuned per query in the hook definitions under `pages/students/queries/`.

This gives the admin app cache + revalidation behavior for free; components don't manage loading state by hand.

---

## 17. Theming & Layout (Admin)

### 17.1 Theme
`providers/theme-provider.tsx` wraps `next-themes` and persists the selection to `localStorage`. `theme-toggle.tsx` flips between `light` / `dark` / `system`. Tailwind's `class` strategy is used (`dark:` prefix variants).

### 17.2 Sidebar state
`use-sidebar.ts` + `SidebarProvider` keep the collapsed/expanded state of the nav rail. Mobile breakpoints render `<MobileSidebar />` instead.

### 17.3 Layout composition
`dashboard-layout.tsx` is the only layout: sidebar (collapsible), header (sticky), content area (`<Outlet />`).

---

## 18. Environment Variables (Admin)

`admin/.env`:

| Variable               | Purpose                                                |
|------------------------|--------------------------------------------------------|
| `VITE_BACKEND_URL`     | Base URL for axios (e.g. `http://localhost:5001/api/v1`) |
| `VITE_AUTH0_DOMAIN`    | Auth0 tenant domain                                    |
| `VITE_AUTH0_CLIENT_ID` | Auth0 SPA application client ID                        |
| `VITE_AUTH0_AUDIENCE`  | Auth0 API identifier — must match server's `AUTH0_AUDIENCE` |

---

# Cross-cutting

## 19. Auth0 Application Setup (Both Apps)

The frontends rely on these Auth0 dashboard settings:

1. **Application type**: Single Page Application.
2. **Allowed Callback URLs**: `http://localhost:5173, http://localhost:5174` (and prod equivalents).
3. **Allowed Logout URLs**: same as callbacks.
4. **Allowed Web Origins**: same.
5. **Token signing algorithm**: RS256 (matches what `express-oauth2-jwt-bearer` expects).
6. **API**: register an API with identifier = `AUTH0_AUDIENCE`. Both SPAs request this audience so tokens validate server-side.
7. **M2M application**: separate app authorized for the Auth0 Management API (Read/Update Users at minimum). Drives `AUTH0_M2M_CLIENT_ID` / `_SECRET` on the server.

> Role assignment between user and admin happens on the **server** during auto-provisioning, driven by the `Origin` header. See [SERVER.md §6.2](SERVER.md#62-resolveuser).

---

## 20. Running the Frontends

### Docker (recommended)
```bash
docker-compose up --build
```
Both apps and the backend come up together.

### Manual
```bash
# Terminal 1 — user app
cd user && npm install && npm run dev      # http://localhost:5173

# Terminal 2 — admin app
cd admin && npm install && npm run dev     # http://localhost:5174
```

### Build for production
```bash
cd user  && npm run build && npm run preview
cd admin && npm run build && npm run preview
```

The admin app's build runs `tsc` first to catch type errors before Vite emits the bundle.

### Health checks
- User app: visit `http://localhost:5173/login`. The page should immediately redirect to Auth0 Universal Login. After login, you should land on `/complete-profile` (first time) or `/` (chat).
- Admin app: visit `http://localhost:5174/login`. After Auth0 login, you should land on the dashboard. If the server returns 403, the resolved user is missing `role: "ADMIN"` — promote them via the database or seed admin step.
