# Wolfie Lists, HW4 (instructor solution)

The HW3 application, now with **user accounts**, in **TypeScript**, on
**PostgreSQL** instead of MongoDB. It is still a React client (Vite, now with
React Router) in front of an Express API.

- Anybody can create an account: an email address, a password, and an avatar
  image that can be uploaded at sign-up or changed later. We manage the
  accounts ourselves; there is no single sign-on.
- Passwords are stored only as **bcrypt** hashes.
- Logging in hands the browser a **JSON Web Token** in an httpOnly cookie, and
  our own Express middleware, `authenticate`, checks it on every request for a
  user's data.
- Every list has an **owner**. A user sees, opens, changes and deletes only
  their own lists. Anybody else's list is a 404, exactly like a list that does
  not exist.
- The data lives in three related tables, `users`, `lists` and `items`, and the
  server talks to them in plain, parameterized SQL through `pg`.

The same application written in idiomatic Next.js (Server Components, Server
Actions, a Data Access Layer, no Express) is the
[HW 4 alternate solution, in NextJS](https://github.com/TheMcKillaGorilla/316-HW4-F26-NextJS-Solution).
For the final project you may use any code from either solution, and build with
either technology.

## Running it

You need Node 20.19 or later and PostgreSQL 16 or later (the EDB installer for
Windows and macOS includes pgAdmin). Create the database once, in pgAdmin or
with `psql -U postgres`:

```sql
CREATE DATABASE wolfie_lists ENCODING 'UTF8';
```

Then:

```
npm install                          # installs shared, server and client (npm workspaces)
copy server\.env.example server\.env # then put your postgres password and a JWT_SECRET in it
npm run seed                         # makes the tables, wipes them, and makes the example accounts
npm run dev                          # Express on 4000 and Vite on 9000, together
```

Open http://localhost:9000 and either create an account or log in as one of
the example accounts in `server/data/starter_accounts.json`:

| Email | Password | Lists |
|---|---|---|
| **joe@shmo.com** | **12345678** | Events to Attend, CSE 316 Homework 1 |
| **jane@doe.com** | **abcdefgh** | Stony Brook University Bucket List |

Log in as one, then the other, and each sees only their own lists. A new
account starts with no lists.

Vite forwards every `/api` request to Express (`client/vite.config.ts`). The
browser only ever talks to port 9000, so the login cookie goes with every
request and the server needs no CORS setup.

The tables are made by **migrations**, numbered SQL files in
`server/migrations/`. The server runs any it has not run yet every time it
starts (`npm run migrate` does it on its own). To change the schema, add the
next numbered file; never edit one that has already run.

`npm run typecheck` checks both packages with `tsc`.

## Testing it

```
npm test            # server suite, then client suite (Vitest)
npm run test:e2e    # the whole stack in Chrome (Playwright)
npm run test:all    # typecheck, both suites, and the end to end tests
```

| Tier | Where | What runs |
|---|---|---|
| server unit | `server/tests/unit` | the rules, the DTOs, bcrypt, tokens and `authenticate`, no database |
| server integration | `server/tests/integration` | real HTTP (supertest agents that keep cookies) against the real app and a real PostgreSQL; also the schema itself |
| client unit | `client/tests/unit` | model, `api.ts`, hooks, small components |
| client integration | `client/tests/integration` | the real `<App />` and its routes in a `MemoryRouter`, against a fake server that stands in for `fetch` |
| end to end | `tests/e2e` | Chrome, Vite, Express and PostgreSQL together |

None of the tests touch your `wolfie_lists` database. The server and e2e tests
start a private PostgreSQL of their own with the `embedded-postgres` package
(real PostgreSQL programs shipped through npm), on ports 54200 and 54100, in a
throwaway folder; each server test file gets a fresh database on it.

The load bearing server file is `server/tests/integration/privacy.test.ts`:
one user can never see, open, change, delete or copy another user's list, and
a visitor without a valid token gets a 401 from every user route.

The server tests set `BCRYPT_ROUNDS=4` (in `server/tests/vitest.config.ts`),
the cheapest bcrypt allows, because they create hundreds of accounts. The real
server uses 10.

The e2e tests run one at a time (`workers: 1`) because they share one
database, which each test resets to the example accounts through a test-only
`POST /test/reset` route. That route exists only in
`server/scripts/e2e-server.ts`, never in the real server.

Current counts: 153 server, 311 client, 151 end to end.

## Layout

```
shared/              the contract: DTO types and the rules both sides share
  src/index.ts         ItemDTO, ListDTO, ListMetadata, UserDTO, limits
server/              the Express API, in TypeScript, run by tsx
  migrations/          001_create_tables.sql: users, lists, items; 002 adds three item columns
  src/db.ts            the connection pool, query() and withTransaction()
  src/migrate.ts       runs the migrations each database has not had yet
  src/rules.ts         what makes a list valid, checked before writing
  src/controllers/     C: auth, user and list controllers, with their SQL
  src/routes/          which URL goes to which controller
  src/dto/             exactly what crosses the network
  src/auth/            bcrypt (passwords.ts) and JWTs (tokens.ts)
  src/middleware/      authenticate, uploadAvatar, request logger, 404, errors
  src/types/           declaration merging: req.userId
  src/app.ts           the middleware chain; server.ts starts it
  scripts/             seed, migrate, the e2e server, the embedded database
client/              the React app (Vite, React Router, Tailwind v4)
  src/App.tsx          every route, and the layouts around them
  src/layouts/         PublicLayout and AppLayout, the two guards
  src/pages/           one thin component per URL
  src/containers/      components that fetch, navigate and decide
  src/components/      presentational components, including the Modal and Form families
  src/context/         ModalContext, SessionContext, CurrentListContext
  src/hooks/           useUndoRedo, useListEditor, useUndoRedoShortcuts
  src/lib/             api.ts (the Facade), DateUtil, IdGenerator
  src/model/           pure functions over plain list and item objects
tests/e2e/           Playwright specs and config
```

## The database

```
users  1 --- * lists  1 --- * items
```

| Table | Columns |
|---|---|
| `users` | `id` uuid, `email` (unique, lower case), `password_hash`, `avatar` bytea, `avatar_type`, `avatar_updated_at`, `created_at` |
| `lists` | `id` uuid, `owner_id` → users (cascade), `name` (1–60 chars), `position`, `created_at`, `updated_at` |
| `items` | `list_id` → lists (cascade), `id` (client-made text), `position`, `description` (1–200 chars), `date_entered` date, `priority` (High, Medium or Low), `target_date` date, `completed`; primary key `(list_id, id)` |

The CHECK constraints repeat the rules in `server/src/rules.ts`. The server
checks first so the user gets a readable message, and the database still says
no if a bug ever lets bad data through.

Worth pointing out in lecture, all in `listController.ts`:
- the home screen is one `LEFT JOIN ... GROUP BY` with `count(...) FILTER (WHERE completed)`;
- saving a list deletes its items and inserts the new ones inside one
  transaction, so a failure (a February 30th, say) leaves the list exactly as
  it was, which `listsApi.test.ts` proves;
- duplicating copies every item with one `INSERT ... SELECT` (the `copyItems` helper);
- deleting a list deletes its items by `ON DELETE CASCADE`, with no code at all.

`pg` hands a `date` column back as a JavaScript `Date` unless told otherwise,
which brings back the time-zone bug HW1's `DateUtil` warned about, so `db.ts`
tells it to keep dates as `YYYY-MM-DD` strings.

## Pages

| URL | Component | Who may see it |
|---|---|---|
| `/` | `pages/SplashPage.tsx` | anybody not logged in: the splash screen, large logo, Create Account and Log In |
| `/register` | `pages/RegisterPage.tsx` | anybody not logged in |
| `/login` | `pages/LoginPage.tsx` | anybody not logged in |
| `/lists` | `pages/ListsPage.tsx` | a logged in user: their lists |
| `/lists/:id` | `pages/ListPage.tsx` | a logged in user: one of their lists (`?new` selects the name) |
| `/account` | `pages/AccountPage.tsx` | a logged in user: change avatar, change password |

`PublicLayout` sends a logged in user on to `/lists`; `AppLayout` sends anybody
else to `/`. Both wait, showing nothing or "Loading…", until the server has
answered `GET /api/users/me`, so nobody sees the wrong page flash past.

## The API

| Method and path | Login? | Does | Answers |
|---|---|---|---|
| `POST /api/auth/register` | no | `{ email, password }`, makes the account and logs in | 201, the user, and the cookie |
| `POST /api/auth/login` | no | `{ email, password }` | 200, the user, and the cookie; 401 `Invalid email or password.` |
| `POST /api/auth/logout` | no | clears the cookie | 204 |
| `GET /api/users/me` | yes | who am I | 200, `{ id, email, avatarUrl }` |
| `PUT /api/users/me/password` | yes | `{ currentPassword, newPassword }` | 204; 400 if the current one is wrong |
| `GET /api/users/me/avatar` | yes | the image itself | 200 with its own content type; 404 if none |
| `PUT /api/users/me/avatar` | yes | multipart, one file named `avatar` | 200, the user with a new `avatarUrl` |
| `GET /api/lists` | yes | home screen | 200, metadata for each of MY lists, in order |
| `GET /api/lists/:id` | yes | open a list | 200, `{ id, name, items }` |
| `POST /api/lists` | yes | new list | 201, its metadata |
| `PUT /api/lists/:id` | yes | save the whole list | 200, its new metadata |
| `POST /api/lists/:id/duplicate` | yes | copy beneath the original | 201, the copy's metadata |
| `DELETE /api/lists/:id` | yes | delete | 204 |

Errors are always `{ error: "message" }`: 400 for invalid data, malformed JSON
or a refused upload, 401 without a valid login, 404 for an unknown list (or
somebody else's) or route, 409 for an email that already has an account, 500
(details logged, not sent) otherwise.

## How accounts work

1. **Register or log in.** The controller hashes the password with bcrypt (or
   compares it with the stored hash), then signs a JWT whose `sub` is the
   user's id, and sets it as a cookie: `httpOnly` (no script can read it, so
   XSS cannot steal it), `SameSite=Lax` (other sites' forms do not carry it),
   `Secure` in production, one day long.
2. **Every later request** carries the cookie by itself. `authenticate`
   verifies the signature and expiry, and either sets `req.userId` and calls
   `next()`, or ends the chain with a 401.
3. **Every list query** has `WHERE owner_id = $1` with `req.userId`. A
   controller never takes a user id from the body or the URL.
4. **The client asks too.** `SessionContext` calls `GET /api/users/me` when the
   app opens; the answer drives the two layout guards. Those guards are for the
   user's convenience only: anyone can change the JavaScript in their own
   browser, so privacy is the server's job, never the client's.
5. **Log out** clears the cookie. The token itself stays valid until it
   expires, since the server keeps no list of tokens; that trade-off, and what
   refresh tokens or a deny list would add, is worth a sentence in lecture.

## Design patterns

New in HW4:

**Component architecture: nested routes and layouts** (`client/src/App.tsx`).
With React Router the routes are components, and their nesting is the page
structure. `PublicLayout` and `AppLayout` are layout routes: they add nothing
to the URL, they wrap every page inside them, and each page appears at their
`<Outlet />`. That is where the two guards and the shared header live.

**Container / Presentational components** (`client/src/containers` and
`client/src/components`). A container owns data and side effects: it calls the
API, navigates, asks for confirmation. A presentational component receives
props and draws them. `ListsContainer` → `ListsView` → `ListCard`, and
`ListEditorContainer` → `ListEditorView` → `ItemCard`.

**Compound Components** (`components/modals/Modal.tsx` and
`components/Form.tsx`). `<Modal>` with `Modal.Header`, `Modal.Message`,
`Modal.Footer` and `Modal.Button`, and `<Form>` with `Form.Field`,
`Form.Error` and `Form.Submit`. The parent shares state with its pieces
through a private context: Modal gives them its id, so `alert-modal-heading`
and `aria-labelledby` can never disagree; Form gives them its pending and
error state, so every form disables its button and reports a thrown error the
same way.

**Chain of Responsibility, extended** (`server/src/app.ts`). `requestLogger →
express.json() → cookieParser() → /api/auth → authenticate → /api/users →
/api/lists → notFound → errorHandler`. Everything after `authenticate` is
protected simply by its position. `uploadAvatar` is a link on one route only.

Carried over from HW3: **Proxy** (Vite's `/api` proxy), **Layered MVC** and
**DTOs** on the server (now typed against `shared/`), **Observer** in Node,
**Facade** (`client/src/lib/api.ts`) and **Memento** (`useUndoRedo`, now a
generic hook). Mongoose's query Builder went with Mongoose.

## TypeScript, where it earns its keep

- **One contract, two compilers.** `shared/src/index.ts` declares every DTO.
  The server's DTO functions are declared to return them and `api.ts` is
  declared to receive them, so changing a field on one side breaks the build
  on the other.
- **Typed query results.** `query<Row>(sql)` says what each row looks like.
  TypeScript cannot read SQL, so this is a promise the programmer makes, and
  the DTO functions are where snake_case rows become the camelCase DTOs.
- **Declaration merging** (`server/src/types/express.d.ts`) adds `userId` to
  Express's own `Request`.
- **A discriminated union** (`ModalContext.tsx`) lets TypeScript know which of
  three shapes an open modal has from its `name` alone.
- **Generics** (`useUndoRedo<T>`) and **`Record<Priority, string>`**
  (`ItemCard.tsx`), which refuses to compile if a priority is ever missing a
  color.

## Decisions made where the specification was silent

- **Plain SQL, no ORM.** Every query is a parameterized string in the
  controllers, so students read real SQL. There is no Repository layer: the
  controllers call `query()` directly, as HW3's called Mongoose directly.
- **UUIDs** for users and lists, so an id says nothing about how many there
  are. Item ids stay client-made strings, as before, unique within a list.
- **Items in their own table** with a `position` column, rather than JSON
  inside a list. Saving still sends the whole list (HW3's design), and the
  server replaces the items inside a transaction.
- **The token lives in an httpOnly cookie**, not local storage, and lasts one
  day. There are no refresh tokens.
- **Avatars live in PostgreSQL**, as a `bytea` column on the user, uploaded
  with multer's memory storage. PNG, JPEG or WebP, under 1 MB, checked in the
  browser first and on the server always. They are served with their own
  content type and `nosniff`. The avatar URL carries `?v=<time of upload>` so a
  changed avatar is never shown stale from cache.
- **No avatar yet** shows the email's first letter in a red circle.
- **Sign-up logs straight in.** If an avatar was chosen it is uploaded right
  after the account is made; if that upload fails the account still stands
  and an alert says so.
- **Passwords** need at least 8 characters and nothing else. Sign-up and
  change-password ask for the new password twice; that check is the client's,
  the length check is both sides'. Changing a password needs the current one,
  and a wrong current password is a 400, not a 401, so it is not mistaken for
  a lost login.
- **Emails** are unique, stored in lower case and trimmed (a CHECK constraint
  insists). Registering an existing email is a 409 that says so; login
  failures never say which part was wrong.
- **New accounts start empty.** `npm run seed` wipes everything and makes
  the two example accounts, each owning its own example lists.
- **Someone else's list** answers 404, with the same body as a missing one.
  Opening one by URL shows "The List Could Not Be Opened" and returns to
  `/lists`.
- **A login that expires mid-session**: any 401 from the API (other than the
  login form's own) forgets the user, and the guard sends them to `/`.
- **The HW3 local storage metadata cache is gone.** It was not per user, and
  the home screen now fetches fresh metadata each time it opens.
- **Encoding.** The database must be UTF-8 so a list can be named in any
  language; on Windows PostgreSQL may otherwise default to WIN1252, which is
  why the `CREATE DATABASE` above says so and the test databases force it.
- **Look.** The red header (logo, title, avatar menu) is in `AppLayout`, so it
  stays put across pages; the list editor's toolbar beneath it is now dark
  grey rather than a second red bar. Everything else matches HW3.
- **Undo history** still lives only as long as a list is open, now meaning as
  long as you stay on its URL.

## The student version (`../cse316-hw4`)

Cut 2026-10-18 from this project by deleting code. Where code that is given
imports something students write, a stub that throws "... has not been written
yet" stands in, so `src/` still compiles; nothing else is scaffolded. The whole
test suite ships as the specification.

**Students write**

| Task | Where | Size |
|---|---|---|
| 1. Migration: `priority`, `target_date`, `completed` with defaults and a CHECK | `server/migrations/002_add_item_details.sql` (deleted) | 1 `ALTER TABLE` |
| 2. bcrypt | `server/src/auth/passwords.ts` (both bodies stubbed) | 2 lines |
| 3. Log in | `login` + its route in `authController.ts`/`authRoutes.ts`; `api.login` (stubbed) | 1 query |
| 4. `authenticate`, and mounting it at `/api` after `/api/auth` | `middleware/authenticate.ts` (only `currentUserId` left), `app.ts` | |
| 5. `AppLayout`'s guard and `SessionContext.logout` (empty body) | client | |
| 6. `getAllMetadata`, `updateList`, `duplicateList` + their 3 routes | `listController.ts`, `listRoutes.ts` | 6 queries: the LEFT JOIN/GROUP BY, UPDATE/DELETE/INSERT in a transaction, shift positions + INSERT the list in a transaction |
| 7. Change password + its route; `api.changePassword` (stubbed) | `userController.ts`, `userRoutes.ts` | 2 queries |
| 8. Tailwind on 13 elements | `AccountContainer.tsx` (9), `AvatarPicker.tsx` (4) | |
| 9. 9 Playwright tests | `tests/e2e/isolation.spec.ts` | |

**Given as worked examples:** `register` and `logout`; `tokens.ts` (sign,
verify, cookie options); the whole avatar path (`AvatarPicker`'s logic,
`avatarFile.ts`, `api.uploadAvatar`, `uploadAvatar.ts`, `getAvatar`/`setAvatar`);
`getList`, `createList`, `deleteList`, `findMyList`, `myListNames`, and
`copyItems`, the one `INSERT ... SELECT` of `duplicateList`, given to keep the
SQL load at six queries; `PublicLayout`'s guard; two isolation tests, one
through the pages and one through the API.

**Kept styled in the Tailwind task:** `sr-only` on the file input (it is about
accessibility, not looks), the avatar's `shadow-card`, and the file error
message. The target screenshots are in `public_html/hw/hw4-images/`
(`account-target.png`, `account-target-password-changed.png`, and the
unstyled `account-starting-point.png`). No test asserts a class or a computed
style, so the styling is graded by eye.

**Grading the Playwright file:** copy a student's `tests/e2e/isolation.spec.ts`
over this project's and run `npm run test:e2e -- isolation`. The names are
identical in both projects, and all 11 must pass against this solution. A test
that cannot fail is not a test: spot check that each would fail against a
server that got its behavior wrong.

**The order matters on a fresh checkout.** Seeding and sign-up stop at
`hashPassword`, the home screen needs `GET /api/lists`, and until `AppLayout`
waits for the session, `useUser` throws behind the login. The handout orders the
tasks so that each brings back more of the application.

**State at the cut.** Starter: server 63 pass / 90 fail of 153 (most fail at
`hashPassword`, since the test helper registers its users); client 177 pass /
134 fail of 311 (mostly the missing guard); e2e 0 pass / 142 fail / 9 skipped (every test resets the database through the seed, which stops at `hashPassword`). `npm run
typecheck` passes for `src/` in both packages; the one error is
`tests/unit/auth.test.ts` importing `authenticate`, which students write.
