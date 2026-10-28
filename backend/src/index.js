const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const sequelize = require('./config/db');
const RedisClient = require('./config/redis');
require('./models/index'); // Loads all models and their associations
const authRouter = require('./routes/authRoute');
const patientRouter = require('./routes/patientRoute');
const doctorRouter = require('./routes/doctorRoute');
const mappingRouter = require('./routes/mappingRoute');
require('dotenv').config();

const app = express();

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    })
);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/patients', patientRouter);
app.use('/api/doctors', doctorRouter);
app.use('/api/mappings', mappingRouter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.status(200).json({ status: 'Healthcare Backend is running 🚀' });
});

// ─── 404 catch-all ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
    res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('Unhandled server error:', err.stack || err.message);
    const status = err.status || 500;
    const message =
        process.env.NODE_ENV === 'production' && status === 500
            ? 'Internal server error'
            : err.message || 'Something went wrong';
    res.status(status).json({ error: message });
});

// ─── Start server ─────────────────────────────────────────────────────────────
const startServer = async () => {
    try {
        await sequelize.authenticate();
        console.log('Connected to PostgreSQL successfully');

        await sequelize.sync({ alter: false });
        console.log('Database models synchronized');

        await RedisClient.connect();
        console.log('Connected to Redis');

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Server startup failed:', err.message);
        process.exit(1);
    }
};

startServer();
