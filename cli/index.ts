#!/usr/bin/env node
/**
 * Runnable entry for the project generator. Run with Node's native TypeScript
 * support (Node 22.6+): `node cli/index.ts ...`, or via `yarn generate ...`.
 */
import { run } from './generate.ts';

process.exit(await run(process.argv.slice(2)));
