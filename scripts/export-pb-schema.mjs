#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const collectionsPath = path.join(__dirname, '../schema/collections.json');
const seedPath = path.join(__dirname, 'seed_collections.json');

// Baca schema collections.json
const collections = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));

// Export ke format yang bisa di-import ke PocketBase Admin UI
const exportData = {
  collections,
};

fs.writeFileSync(seedPath, JSON.stringify(exportData, null, 2));
console.log(`✅ Collections saved to ${seedPath}`);
console.log('Import ke PocketBase Admin UI via Settings > Backup/Restore > Restore');
