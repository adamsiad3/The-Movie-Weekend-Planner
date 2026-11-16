// Import required modules

const express      = require('express');
const path         = require('path');
const session      = require('express-session');
const MongoStore   = require('connect-mongo');
const { ObjectId } = require('mongodb');
const { connectToDatabase } = require('./mwpDB');


// Create express app

const app = express();

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Middleware for parsing request data

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

// Session setup


app.use(session({
    secret           : 'mwp-secret-2406',
    resave           : false,
    saveUninitialized: false,
    store            : MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/mwp' }),
    cookie           : { maxAge: 1000 * 60 * 60 * 24 }
}));


async function getAllServices() {
    const db = await connectToDatabase();
    return db.collection('services').find().toArray();
}

async function getServiceById(id) {
    const db = await connectToDatabase();
    return db.collection('services').findOne({ id: parseInt(id) });
}

async function updateService(service) {
    const db = await connectToDatabase();
    await db.collection('services').replaceOne({ id: service.id }, service);
}

async function getUserByUsername(username) {
    const db = await connectToDatabase();
    return db.collection('users').findOne({ username });
}

async function getUserById(uID) {
    const db = await connectToDatabase();
    return db.collection('users').findOne({ _id: new ObjectId(uID) });
}

async function getOrdersByUser(uID) {
    const db = await connectToDatabase();
    return db.collection('orders').find({ user: new ObjectId(uID) }).toArray();
}

async function generateMovieId() {
    const services = await getAllServices();
    let maxId = 0;
    for (const svc of services)
        for (const movies of Object.values(svc.genres))
            for (const movie of movies)
                if (movie.id > maxId) maxId = movie.id;
    return maxId + 1;
}


function calcTotalMovies(serviceName, orders) {
    let count = 0;
    for (const o of orders)
        if (o.movies[serviceName]) count += o.movies[serviceName].length;
    return count;
}

function calcTotalSales(serviceName, orders) {
    let total = 0;
    for (const o of orders) {
        if (o.fees[serviceName])   total += o.fees[serviceName];
        if (o.movies[serviceName]) for (const m of o.movies[serviceName]) total += m.price;
    }
    return total;
}

function calcAvgOrder(serviceName, orders) {
    let sum = 0, count = 0;
    for (const o of orders) {
        if (!o.fees[serviceName]) continue;
        let t = o.fees[serviceName];
        if (o.movies[serviceName]) for (const m of o.movies[serviceName]) t += m.price;
        sum += t; count++;
    }
    return count === 0 ? 0 : sum / count;
}

function findMostPopular(serviceName, service, orders) {
    if (!service) return '';
    const counts = {};
    for (const o of orders) {
        if (!o.movies[serviceName]) continue;
        for (const m of o.movies[serviceName])
            counts[m.id] = (counts[m.id] || 0) + 1;
    }
    const allMovies = Object.values(service.genres).flat();
    const sorted    = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    for (const id of sorted) {
        const movie = allMovies.find(m => m.id === parseInt(id));
        if (movie) return movie.title;
    }
    return '';
}


function requireLogin(req, res, next) {
    if (req.session && req.session.user) return next();
    res.redirect('/login');
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.admin) return next();
    res.status(403).send('Access denied: admins only.');
}


app.get('/', (req, res) => {
    res.render('index', { activePage: 'home', user: req.session.user || null });
});

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('login', { activePage: 'login', user: null });
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const dbUser = await getUserByUsername(username);
    if (!dbUser || dbUser.password !== password) {
        return res.render('login', { activePage: 'login', user: null, error: 'Invalid username or password.' });
    }
    req.session.user = {
        _id     : dbUser._id.toString(),
        username: dbUser.username,
        admin   : dbUser.admin,
        privacy : dbUser.privacy
    };
    res.redirect('/');
});

app.get('/logout', requireLogin, (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/');
    res.render('register', { activePage: 'login', user: null });
});

app.post('/register', async (req, res) => {
    const { username, password, privacy } = req.body;
    const db = await connectToDatabase();
    const existing = await getUserByUsername(username);
    if (existing) {
        return res.render('register', { activePage: 'login', user: null, error: 'That username is already taken.' });
    }
    const newUser = { username, password, admin: false, privacy: privacy === 'on' };
    const result  = await db.collection('users').insertOne(newUser);
    req.session.user = {
        _id: result.insertedId.toString(), username, admin: false, privacy: newUser.privacy
    };
    res.redirect('/');
});

app.get('/order', requireLogin, async (req, res) => {
    const services = await getAllServices();
    const summary  = services.map(s => ({ id: s.id, name: s.name, minOrder: s.minOrder, serviceFee: s.serviceFee }));
    res.render('orderForm', { activePage: 'order', services: summary, user: req.session.user });
});

app.get('/stats', requireLogin, async (req, res) => {
    const services = await getAllServices();
    const db       = await connectToDatabase();
    const orders   = await db.collection('orders').find().toArray();
    const statsData = services.map(svc => ({
        name        : svc.name,
        totalOrdered: calcTotalMovies(svc.name, orders),
        totalSales  : calcTotalSales(svc.name, orders),
        avgCost     : calcAvgOrder(svc.name, orders),
        mostPopular : findMostPopular(svc.name, svc, orders)
    }));
    res.render('stats', { activePage: 'stats', statsData, user: req.session.user });
});

app.post('/submit-order', requireLogin, async (req, res) => {
    const db    = await connectToDatabase();
    const order = { ...req.body, user: new ObjectId(req.session.user._id) };
    await db.collection('orders').insertOne(order);
    res.status(200).json({ success: true });
});


app.get('/users', requireLogin, requireAdmin, async (req, res) => {
    const db    = await connectToDatabase();
    const users = await db.collection('users').find().toArray();
    if (req.accepts('json') && !req.accepts('html')) {
        return res.json(users.map(u => ({ id: u._id, username: u.username, privacy: u.privacy })));
    }
    res.render('users', { activePage: 'users', users, user: req.session.user });
});

app.delete('/users/:uID', requireLogin, requireAdmin, async (req, res) => {
    const db     = await connectToDatabase();
    const result = await db.collection('users').deleteOne({ _id: new ObjectId(req.params.uID) });
    if (result.deletedCount === 0) return res.status(404).send('User not found');
    res.json({ success: true });
});

app.get('/users/:uID', requireLogin, async (req, res) => {
    const dbUser = await getUserById(req.params.uID);
    if (!dbUser) return res.status(404).send('User not found');
    const orders = await getOrdersByUser(req.params.uID);
    res.render('userProfile', {
        activePage  : 'profile',
        profileUser : dbUser,
        orders,
        user        : req.session.user,
        isOwnProfile: req.session.user._id === req.params.uID
    });
});

app.put('/users/:uID', requireLogin, async (req, res) => {
    const { username, password, privacy } = req.body;
    const db       = await connectToDatabase();
    const existing = await getUserByUsername(username);
    if (existing && existing._id.toString() !== req.params.uID) {
        return res.status(400).json({ success: false, message: 'Username already taken.' });
    }
    await db.collection('users').updateOne(
        { _id: new ObjectId(req.params.uID) },
        { $set: { username, password, privacy: privacy === true || privacy === 'true' } }
    );
    if (req.session.user._id === req.params.uID) {
        req.session.user.username = username;
        req.session.user.privacy  = privacy === true || privacy === 'true';
    }
    res.json({ success: true });
});


app.get('/services', requireLogin, requireAdmin, async (req, res) => {
    const services = await getAllServices();
    if (req.accepts('json') && !req.accepts('html')) {
        return res.json({ count: services.length, services: services.map(s => ({ id: s.id, name: s.name })) });
    }
    res.render('services', { activePage: 'admin', services, user: req.session.user });
});

app.post('/services', requireLogin, requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).send('Service name must not be blank');
    const services   = await getAllServices();
    const maxId      = services.reduce((max, s) => s.id > max ? s.id : max, 0);
    const newService = { id: maxId + 1, name: name.trim(), minOrder: 0, serviceFee: 0, genres: {} };
    const db         = await connectToDatabase();
    await db.collection('services').insertOne(newService);
    res.status(201).json({ success: true, service: { id: newService.id, name: newService.name } });
});

app.delete('/services/:sID', requireLogin, requireAdmin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    const db = await connectToDatabase();
    await db.collection('services').deleteOne({ id: parseInt(req.params.sID) });
    res.json({ success: true });
});

app.get('/services/:sID', requireLogin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    if (req.accepts('json') && !req.accepts('html')) return res.json(service);
    res.render('serviceInfo', { activePage: 'admin', service, user: req.session.user });
});

app.put('/services/:sID/info', requireLogin, requireAdmin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    const { name, serviceFee, minOrder } = req.body;
    if (name       !== undefined) service.name       = name;
    if (serviceFee !== undefined) service.serviceFee = parseFloat(serviceFee);
    if (minOrder   !== undefined) service.minOrder   = parseFloat(minOrder);
    await updateService(service);
    res.json({ success: true });
});

app.post('/services/:sID/genres', requireLogin, requireAdmin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    const { genre } = req.body;
    if (!genre || !genre.trim())      return res.status(400).send('Genre name must not be blank');
    if (service.genres[genre.trim()]) return res.status(400).send('Genre already exists');
    service.genres[genre.trim()] = [];
    await updateService(service);
    res.json({ success: true });
});

app.post('/services/:sID/movies', requireLogin, requireAdmin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    const { genre, title, description, year, price } = req.body;
    if (!genre || !title || !description || !year || !price)
        return res.status(400).send('Missing required movie fields');
    if (!service.genres[genre]) return res.status(400).send('Genre does not exist in this service');
    const newMovie = {
        id: await generateMovieId(), title: title.trim(),
        description: description.trim(), year: parseInt(year), price: parseFloat(price)
    };
    service.genres[genre].push(newMovie);
    await updateService(service);
    res.status(201).json({ success: true, movie: newMovie });
});

app.delete('/services/:sID/movies/:mID', requireLogin, requireAdmin, async (req, res) => {
    const service = await getServiceById(req.params.sID);
    if (!service) return res.status(404).send('Service not found');
    const mID   = parseInt(req.params.mID);
    let   found = false;
    for (const genre of Object.keys(service.genres)) {
        const idx = service.genres[genre].findIndex(m => m.id === mID);
        if (idx !== -1) { service.genres[genre].splice(idx, 1); found = true; break; }
    }
    if (!found) return res.status(404).send('Movie not found');
    await updateService(service);
    res.json({ success: true });
});


async function startServer() {
    const db = await connectToDatabase();
    let c = await db.collection('services').find();
    console.log('Here are the streaming services in the database:');
    for await (const p of c) console.log(JSON.stringify(p, null, 2));
    c = await db.collection('users').find();
    console.log('Here are the users in the database:');
    for await (const p of c) console.log(JSON.stringify(p, null, 2));
    c = await db.collection('orders').find();
    console.log('Here are the orders in the database:');
    for await (const p of c) console.log(JSON.stringify(p, null, 2));
    app.listen(3000, () => console.log('"Movie Weekend" Planner Server running on http://localhost:3000'));
}
startServer();
