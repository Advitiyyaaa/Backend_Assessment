const { createClient } = require('redis');
require('dotenv').config();

const RedisClient = createClient({
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    socket: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
        reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
        keepAlive: 5000,
    },
});

// Prevents crashes on connection errors
RedisClient.on('error', (err) => {
    console.error('Redis error:', err.message);
});

RedisClient.on('connect', () => {
    console.log('Redis connected');
});

module.exports = RedisClient;
