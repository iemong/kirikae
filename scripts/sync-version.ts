#!/usr/bin/env bun
/**
 * Sync version from package.json to jsr.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rootDir = join(import.meta.dir, '..');
const packageJsonPath = join(rootDir, 'package.json');
const jsrJsonPath = join(rootDir, 'jsr.json');

// Read package.json
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version;

if (!version) {
  console.error('Error: version not found in package.json');
  process.exit(1);
}

// Read jsr.json
const jsrJson = JSON.parse(readFileSync(jsrJsonPath, 'utf-8'));

// Update version
jsrJson.version = version;

// Write jsr.json
writeFileSync(jsrJsonPath, JSON.stringify(jsrJson, null, 2) + '\n');

console.log(`✓ Synced version ${version} to jsr.json`);
