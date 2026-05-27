#!/usr/bin/env node
import { sequelize } from '../models/index.js';

async function dropGoogleIdIndex() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const [indexes] = await sequelize.query("SHOW INDEX FROM `users`");
    if (!indexes || indexes.length === 0) {
      console.log('No indexes found on users table');
      process.exit(0);
    }

    // Find indexes that reference google_id
    const googleIndexes = indexes.filter((idx) => idx.Column_name === 'google_id');
    if (googleIndexes.length === 0) {
      console.log('No indexes found on column google_id');
      process.exit(0);
    }

    // Index names may repeat across rows for composite indexes; collect unique names
    const indexNames = [...new Set(googleIndexes.map((i) => i.Key_name))];

    for (const name of indexNames) {
      if (name === 'PRIMARY') {
        console.warn('Skipping PRIMARY key');
        continue;
      }
      console.log(`Dropping index ${name} on users.google_id`);
      await sequelize.query(`ALTER TABLE \`users\` DROP INDEX \`${name}\``);
      console.log(`Dropped index ${name}`);
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Error while dropping google_id index:', err);
    process.exit(1);
  } finally {
    try { await sequelize.close(); } catch (e) { }
  }
}

dropGoogleIdIndex();
