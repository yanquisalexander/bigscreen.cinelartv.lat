import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

function findCssFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...findCssFiles(full));
    } else if (extname(full) === '.css') {
      files.push(full);
    }
  }
  return files;
}

const dir = join(fileURLToPath(new URL('..', import.meta.url)), 'dist');
const files = findCssFiles(dir);

for (const file of files) {
  let css = readFileSync(file, 'utf-8');
  const out = [];
  let i = 0;

  while (i < css.length) {
    if (css[i] === '@' && css.slice(i, i + 6) === '@layer') {
      let j = i + 6;

      while (j < css.length && (css[j] === ' ' || css[j] === '\t' || css[j] === '\n' || css[j] === '\r')) j++;

      if (j < css.length && css[j] === '{') {
        // anonymous @layer { ... }
        j++;
        let depth = 1, content = '';
        while (j < css.length && depth > 0) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}') depth--;
          if (depth > 0) content += css[j];
          j++;
        }
        j++;
        out.push(content);
        i = j;
        continue;
      }

      while (j < css.length && css[j] !== '{' && css[j] !== ';') j++;

      if (css[j] === ';') {
        // @layer name; – order declaration, skip entirely
        j++;
        i = j;
        continue;
      }

      if (j < css.length && css[j] === '{') {
        j++;
        let depth = 1, content = '';
        while (j < css.length && depth > 0) {
          if (css[j] === '{') depth++;
          else if (css[j] === '}') depth--;
          if (depth > 0) content += css[j];
          j++;
        }
        j++;
        out.push(content);
        i = j;
        continue;
      }
    }

    out.push(css[i]);
    i++;
  }

  const result = out.join('');
  if (result !== css) {
    writeFileSync(file, result);
    console.log(`  flattened @layer in ${file}`);
  }
}

console.log('Done flattening CSS @layer rules.');
