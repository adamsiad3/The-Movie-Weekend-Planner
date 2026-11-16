# Movie Weekend Planner

A full-stack web app for choosing streaming services, placing orders, and viewing order statistics. It uses session-based authentication and role-based access control, with all data stored in MongoDB.

**Stack:** Node.js · Express · MongoDB · Pug · express-session · connect-mongo

## Features

- **Authentication:** register, log in, and log out with session-based auth. Sessions are stored in MongoDB via connect-mongo, so they survive server restarts.
- **Role-based access control:** `requireLogin` and `requireAdmin` middleware protect every route. Authorization is enforced server-side, not just hidden in the UI.
- **Orders:** logged-in users can place orders and view statistics. Each order is tagged with the MongoDB `_id` of the user who placed it.
- **Admin tools:** admins can manage streaming services and view or delete users.
- **Privacy controls:** users can set their profile to private, which hides it from the user directory.
- **Dynamic navigation:** the nav bar changes based on whether the user is logged in and whether they are an admin.
- **Persistent storage:** streaming services, orders, users, and sessions all live in a MongoDB database (`mwp`).

## Getting Started

**Prerequisites:** Node.js and MongoDB installed locally.

1. Start the MongoDB daemon in a separate terminal:
   ```
   mongod --dbpath=C:\data\db
   ```
2. Install dependencies:
   ```
   npm install
   ```
3. Initialize the database (only needed once, or to reset it):
   ```
   node initializeDatabase.js
   ```
4. Start the server:
   ```
   node server.js
   ```
5. Open [http://localhost:3000](http://localhost:3000)

### Demo accounts

| Role  | Username | Password |
|-------|----------|----------|
| Admin | `admin`  | `admin`  |
| User  | `Jen`    | `Jen`    |

## Routes

| Page           | Path             | Access         |
|----------------|------------------|----------------|
| Home           | `/`              | Public         |
| Login          | `/login`         | Public         |
| Register       | `/register`      | Public         |
| Order form     | `/order`         | Login required |
| Statistics     | `/stats`         | Login required |
| Profile        | `/users/:uID`    | Login required |
| User directory | `/users`         | Admin only     |
| Services       | `/services`      | Admin only     |
| Edit service   | `/services/:id`  | Login required |

## Design Notes

- The service update endpoint is `PUT /services/:sID/info`, which avoids a routing conflict with `PUT /users/:uID`.
- Stats helper functions take an orders array fetched from the database instead of reading a global in-memory variable, which keeps them easy to test.
- Private users appear faded and non-clickable in the user directory.
