/**
 * Zero-dependency bundler.
 *
 * Produces dist/index.html: one self-contained file with the markup, styles and
 * all three modules inlined, so it opens straight from a file:// URL with no
 * server, no network and no node_modules. That is the copy you project in a
 * lecture theatre.
 *
 * `npm run build` (Astro) produces the same page through the normal toolchain;
 * this script exists so the page can be rebuilt with nothing but Node.
 *
 * Run:  node tools/bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** Strip local import statements and `export ` keywords so the modules can be
 *  concatenated into a single inline <script type="module">. */
function flatten(source, name) {
  const withoutImports = source.replace(
    /^import\s+[\s\S]*?from\s+'\.\/[^']+';[ \t]*$/gm,
    '',
  );
  if (/^\s*import\s/m.test(withoutImports)) {
    throw new Error(`${name}: an import survived flattening — keep local imports on one line`);
  }
  return `/* ---- ${name} ---- */\n${withoutImports.replace(/^export\s+(?=(const|function|let|class)\s)/gm, '')}`;
}

const modules = ['src/sim.js', 'src/ode.js', 'src/ui.js'] // dependency order
  .map((p) => flatten(read(p), path.basename(p)))
  .join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>The Rabbit &amp; Fox Game — BIMB265125</title>
<meta name="description" content="Interactive companion to the Rabbit &amp; Fox table-top game, Bioengineering Practicum, Universitas Gadjah Mada." />
<style>
${read('src/styles.css')}
</style>
</head>
<body>
${read('src/app.html')}
<script type="module">
${modules}
</script>
</body>
</html>
`;

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
const out = path.join(root, 'dist', 'index.html');
fs.writeFileSync(out, html, 'utf8');
console.log(`wrote ${path.relative(root, out)}  (${(html.length / 1024).toFixed(1)} kB, self-contained)`);
