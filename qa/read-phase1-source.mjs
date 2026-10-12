import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const proof = JSON.parse(readFileSync(new URL('./phase1-source-ownership.json', import.meta.url), 'utf8'));
const defaultOwners = new Set([...Object.keys(proof.owners), ...Object.keys(proof.compositions)]);

// Supplementary source guards inspect current implementations actually imported by
// the entry. No baseline snapshots, external dependencies or unimported owner bag.
export function readPhase1Source(file, { owners = defaultOwners, read = p => readFileSync(p, 'utf8') } = {}) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  if (file instanceof URL) file = path.relative(root, fileURLToPath(file));
  else if (path.isAbsolute(file)) file = path.relative(root, file);
  const visited = new Set();
  function collect(p) {
    p = path.posix.normalize(p);
    if (path.posix.isAbsolute(p) || p === '..' || p.startsWith('../') || p.split('/').some(part => part.startsWith('.env') || part === 'node_modules' || part === '.ccpun-private')) throw new Error('outside reviewed source');
    if (visited.has(p)) return '';
    visited.add(p);
    const source = read(p);
    const tree = ts.createSourceFile(p, source, ts.ScriptTarget.Latest, true, p.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    let result = source;
    for (const statement of tree.statements) {
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly || !statement.moduleSpecifier) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (bindings?.elements?.length && bindings.elements.every(element => element.isTypeOnly)) continue;
      const id = statement.moduleSpecifier.text;
      if (!id.startsWith('@/') && !id.startsWith('.')) continue;
      const stem = path.posix.normalize(id.startsWith('@/') ? id.slice(2) : path.posix.join(path.posix.dirname(p), id));
      const owner = [stem, stem + '.ts', stem + '.tsx', stem + '.mjs', stem + '/index.ts'].find(candidate => owners.has(candidate));
      if (owner) result += '\n/* current imported owner: ' + owner + ' */\n' + collect(owner);
    }
    return result;
  }
  return collect(file);
}
