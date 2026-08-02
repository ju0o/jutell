#!/usr/bin/env node

import { run } from './cli.js';
import { createIo } from './output/format.js';

const code = await run(
  process.argv.slice(2),
  createIo(),
  true,
);

process.exitCode = code;
