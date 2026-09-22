import { readFile } from 'node:fs/promises';
import { validateCatalogue } from '../src/catalogue.mjs';

const root = new URL('../', import.meta.url);
const data = JSON.parse(await readFile(new URL('research/catalogue.json', root), 'utf8'));
const audit = JSON.parse(await readFile(new URL('research/legacy-audit.json', root), 'utf8'));
const { errors, warnings } = validateCatalogue(data, audit);
warnings.forEach((message) => console.warn(`REVIEW: ${message}`));
errors.forEach((message) => console.error(`ERROR: ${message}`));
if (errors.length) process.exitCode = 1;
else
  console.log(
    `Traceability valid: ${data.features.length} capabilities, ${data.sources.length} sources, ${audit.entries.length} legacy review groups. This is not automated proof of source truth.`,
  );
