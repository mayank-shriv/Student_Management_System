import { Sequelize } from 'sequelize';
import logger from './logger.js';

let sequelize;

// Common options shared by both connection modes.
const commonOptions = {
  dialect: 'mysql',
  logging: (msg) => logger.debug(msg),
  pool: {
    // Increase from 5 to 10 for better concurrency with a remote DB.
    max: 10,
    min: 2,
    acquire: 30000,
    idle: 10000,
  },
  // Retry transient connection errors automatically.
  retry: {
    max: 3,
  },
  // Keep connections alive over long idle periods (important for remote DBs
  // behind proxies that may drop idle TCP connections).
  dialectOptions: {
    connectTimeout: 10000,
  },
};

if (process.env.DATABASE_URL) {
  sequelize = new Sequelize(process.env.DATABASE_URL, commonOptions);
} else {
  sequelize = new Sequelize(
    process.env.DB_NAME || 'railway',
    process.env.DB_USER || 'root',
    process.env.DB_PASS || '',
    {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      ...commonOptions,
    }
  );
}

export default sequelize;
