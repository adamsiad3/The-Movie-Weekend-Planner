
COMP2406 Assignment 4 - Movie Weekend Planner
 
Name: Adam Siad
 
Student Number: 101340476
 
Description:
This assignment extends Assignment 3 by migrating all data from in-memory
storage to a MongoDB database, adding user authentication with sessions,
and implementing authorization so only the right users can access each route.
 
How It Works:
- The server connects to a MongoDB database called "mwp" on startup.
- All streaming services and orders are stored in and retrieved from MongoDB.
- Users can register, log in, and log out using session-based authentication.
- Sessions are stored in MongoDB via connect-mongo so they survive restarts.
- The navigation bar changes dynamically based on whether a user is logged in
  and whether they have admin privileges.
- Logged-in users can place orders, view statistics, and edit their profile.
- Admin users can manage streaming services and view/delete all users.
- Each order is tagged with the MongoDB _id of the user who placed it.
- User profiles can be set to private, hiding them from the user directory.
- Authorization middleware (requireLogin, requireAdmin) protects all routes.
 
How to Run:
1. Start the MongoDB daemon in a separate terminal:
   mongod --dbpath=C:\data\db
 
2. In the project folder, initialize the database (only needed once, or to reset):
   node initializeDatabase.js
 
3. Install dependencies (first time only):
   npm install
 
4. Start the server:
   node server.js
 
5. Open browser and go to: http://localhost:3000
 
Test Accounts:
- Admin user:   username=admin,    password=admin
- Regular user: username=Jen,      password=Jen
 
Pages:
- Home:          http://localhost:3000/
- Login:         http://localhost:3000/login
- Register:      http://localhost:3000/register
- Order Form:    http://localhost:3000/order         (login required)
- Statistics:    http://localhost:3000/stats         (login required)
- Profile:       http://localhost:3000/users/:uID    (login required)
- User Directory:http://localhost:3000/users         (admin only)
- Services:      http://localhost:3000/services      (admin only)
- Edit Service:  http://localhost:3000/services/:id  (login required)
 
Design Decisions:
- The A3 route PUT /services/:sID was renamed to PUT /services/:sID/info
  to avoid a routing conflict with the new PUT /users/:uID route.
- Stats helper functions now accept an orders array fetched from the DB
  rather than reading a global in-memory variable.
- Private users appear faded and non-clickable in the user directory.
- All authorization is enforced server-side, not just hidden in the UI.
 
Notes:
- Uses Express for routing and middleware.
- Uses PUG as the template engine.
- Uses MongoDB for all persistent data storage.
- Uses express-session and connect-mongo for session management.
- Static files are served from the public/ folder.