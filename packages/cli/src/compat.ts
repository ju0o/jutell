#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { createIo } from './output/format.js';
import { run } from './index.js';

const entry = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === entry) {
  const code = await run(process.argv.slice(2), createIo(), true);
  process.exitCode = code;
}
