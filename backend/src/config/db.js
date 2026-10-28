const { Sequelize } = require('sequelize');
require('dotenv').config();

let sequelize;

// If DATABASE_URL is provided (e.g., Neon, Supabase, Render)
if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, {
        dialect: 'postgres',
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false, // Required for cloud providers like Neon
            },
        },
        logging: false,
    });
} else {
    // Local PostgreSQL fallback
    sequelize = new Sequelize(
        process.env.PG_DATABASE,
        process.env.PG_USER,
        process.env.PG_PASSWORD,
        {
            host: process.env.PG_HOST || 'localhost',
            port: process.env.PG_PORT || 5432,
            dialect: 'postgres',
            logging: false,
        }
    );
}

module.exports = sequelize;
