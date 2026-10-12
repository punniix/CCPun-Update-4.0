import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const baseline = '70c0778c3a2fc3d5674ebf262ac78789fb92a77c';
export const phase2AdminEntries = Object.freeze([
  'features/admin/social/SocialMarketingDashboard.tsx',
  'features/admin/social/SocialPostsWorkspace.tsx',
  'features/admin/social/MarketingDashboardVisuals.tsx',
  'lib/admin/social/marketing-dashboard-model.ts',
]);
const owners = [
  'features/admin/social/MarketingDashboardOverview.tsx',
  'features/admin/social/social-post-workspace-model.ts',
  'lib/admin/social/marketing-dashboard-metrics.ts',
];
const overviewImportContract = [
  {
    "module": "react",
    "typeOnly": false,
    "defaultBinding": null,
    "namespaceBinding": null,
    "namedBindings": [
      {
        "imported": "useMemo",
        "local": "useMemo",
        "typeOnly": false
      }
    ]
  },
  {
    "module": "lucide-react",
    "typeOnly": false,
    "defaultBinding": null,
    "namespaceBinding": null,
    "namedBindings": [
      {
        "imported": "AlertTriangle",
        "local": "AlertTriangle",
        "typeOnly": false
      },
      {
        "imported": "Lightbulb",
        "local": "Lightbulb",
        "typeOnly": false
      },
      {
        "imported": "Sparkles",
        "local": "Sparkles",
        "typeOnly": false
      },
      {
        "imported": "Target",
        "local": "Target",
        "typeOnly": false
      }
    ]
  },
  {
    "module": "@/lib/admin/social/marketing-dashboard-model",
    "typeOnly": false,
    "defaultBinding": null,
    "namespaceBinding": null,
    "namedBindings": [
      {
        "imported": "FORMAT_LABEL",
        "local": "FORMAT_LABEL",
        "typeOnly": false
      },
      {
        "imported": "GOAL_LABEL",
        "local": "GOAL_LABEL",
        "typeOnly": false
      },
      {
        "imported": "PLATFORM_LABEL",
        "local": "PLATFORM_LABEL",
        "typeOnly": false
      },
      {
        "imported": "buildFormatBenchmarks",
        "local": "buildFormatBenchmarks",
        "typeOnly": false
      },
      {
        "imported": "buildInsights",
        "local": "buildInsights",
        "typeOnly": false
      },
      {
        "imported": "buildTimeSlots",
        "local": "buildTimeSlots",
        "typeOnly": false
      },
      {
        "imported": "buildWeeklySeries",
        "local": "buildWeeklySeries",
        "typeOnly": false
      },
      {
        "imported": "buildWinners",
        "local": "buildWinners",
        "typeOnly": false
      },
      {
        "imported": "metricSummary",
        "local": "metricSummary",
        "typeOnly": false
      },
      {
        "imported": "FormatBenchmark",
        "local": "FormatBenchmark",
        "typeOnly": true
      },
      {
        "imported": "MarketingGoal",
        "local": "MarketingGoal",
        "typeOnly": true
      },
      {
        "imported": "MarketingInsight",
        "local": "MarketingInsight",
        "typeOnly": true
      },
      {
        "imported": "MarketingMetricUnit",
        "local": "MarketingMetricUnit",
        "typeOnly": true
      },
      {
        "imported": "MarketingPlatform",
        "local": "MarketingPlatform",
        "typeOnly": true
      },
      {
        "imported": "MarketingPost",
        "local": "MarketingPost",
        "typeOnly": true
      }
    ]
  },
  {
    "module": "./MarketingDashboardVisuals",
    "typeOnly": false,
    "defaultBinding": null,
    "namespaceBinding": null,
    "namedBindings": [
      {
        "imported": "CoverageBadge",
        "local": "CoverageBadge",
        "typeOnly": false
      },
      {
        "imported": "PostIdentity",
        "local": "PostIdentity",
        "typeOnly": false
      },
      {
        "imported": "PostThumbnail",
        "local": "PostThumbnail",
        "typeOnly": false
      },
      {
        "imported": "QualityBadge",
        "local": "QualityBadge",
        "typeOnly": false
      },
      {
        "imported": "WeeklyMedianChart",
        "local": "WeeklyMedianChart",
        "typeOnly": false
      },
      {
        "imported": "formatMarketingValue",
        "local": "formatMarketingValue",
        "typeOnly": false
      }
    ]
  }
];
function importContract(statement) {
  const clause = statement.importClause;
  const bindings = clause?.namedBindings;
  return { module: statement.moduleSpecifier.text, typeOnly: Boolean(clause?.isTypeOnly),
    defaultBinding: clause?.name?.text ?? null,
    namespaceBinding: bindings && ts.isNamespaceImport(bindings) ? bindings.name.text : null,
    namedBindings: bindings && ts.isNamedImports(bindings) ? bindings.elements.map(element => ({
      imported: element.propertyName?.text ?? element.name.text, local: element.name.text, typeOnly: Boolean(element.isTypeOnly),
    })) : [] };
}
const digest = value => createHash('sha256').update(value).digest('hex');
const sameKeys = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());
function tree(file, source) { return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }

// This assertion checks actual current source. It never substitutes a frozen
// source string or old digest for the release being tested.
export function assertPhase2AdminComposition(file, expectedBaselineHash, {
  proof = JSON.parse(readFileSync(new URL('./phase2-admin-modularity.json', import.meta.url), 'utf8')),
  read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8'),
} = {}) {
  assert.ok(phase2AdminEntries.includes(file), 'unreviewed Phase 2 admission');
  assert.equal(proof.baseline, baseline, 'own Production baseline');
  sameKeys(proof.entries, phase2AdminEntries);
  sameKeys(proof.owners, owners);
  sameKeys(Object.keys(proof.baselineSources), phase2AdminEntries);
  sameKeys(Object.keys(proof.baselineHashes), phase2AdminEntries);
  sameKeys(Object.keys(proof.currentHashes), [...phase2AdminEntries, ...owners]);
  for (const entry of phase2AdminEntries) assert.equal(digest(proof.baselineSources[entry]), proof.baselineHashes[entry], entry + ': frozen original');
  assert.equal(proof.baselineHashes[file], expectedBaselineHash, file + ': original protected expectation');
  const current = new Map();
  for (const [entry, hash] of Object.entries(proof.currentHashes)) {
    const source = read(entry);
    assert.equal(digest(source), hash, entry + ': current source');
    current.set(entry, source);
  }
  assert.equal(proof.outputEvidence.file, 'tests/phase2-admin-modularity.test.mjs');
  assert.equal(digest(read(proof.outputEvidence.file)), proof.outputEvidence.sha256, 'registered output assertions');
  const declarations = new Map();
  const graph = new Map();
  for (const [entry, source] of current) {
    const parsed = tree(entry, source);
    const edges = [];
    for (const statement of parsed.statements) {
      if (statement.name && statement.body) {
        const name = statement.name.text;
        const body = statement.getText(parsed).replace(/^export /, '');
        if (declarations.has(name)) assert.equal(declarations.get(name), body, name + ': conflicting duplicate declaration');
        declarations.set(name, body);
      }
      if (!ts.isImportDeclaration(statement) && !ts.isExportDeclaration(statement)) continue;
      if (statement.isTypeOnly || statement.importClause?.isTypeOnly || !statement.moduleSpecifier) continue;
      const bindings = statement.importClause?.namedBindings ?? statement.exportClause;
      if (bindings?.elements?.length && bindings.elements.every(element => element.isTypeOnly)) continue;
      const id = statement.moduleSpecifier.text;
      if (!id.startsWith('.') && !id.startsWith('@/')) continue;
      const stem = path.posix.normalize(id.startsWith('@/') ? id.slice(2) : path.posix.join(path.posix.dirname(entry), id));
      const target = [stem, stem + '.ts', stem + '.tsx'].find(candidate => current.has(candidate));
      if (target) edges.push(target);
    }
    graph.set(entry, edges);
  }
  for (const entry of phase2AdminEntries) {
    const parsed = tree(entry, proof.baselineSources[entry]);
    for (const statement of parsed.statements) if (statement.name && statement.body) {
      assert.equal(declarations.get(statement.name.text), statement.getText(parsed).replace(/^export /, ''), statement.name.text + ': original signature/body');
    }
  }
  for (const owner of owners) {
    const ownerTree = tree(owner, current.get(owner));
    if (owner === owners[0]) assert.deepEqual(ownerTree.statements.filter(ts.isImportDeclaration).map(importContract), overviewImportContract, owner + ": exact reviewed import contract");
    for (const statement of ownerTree.statements) {
      assert.ok(ts.isImportDeclaration(statement) || ts.isFunctionDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement)
        || (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) && statement.expression.text === 'use client'), owner + ': no new module side effects');
      if (ts.isImportDeclaration(statement)) {
        assert.ok(statement.importClause, owner + ": side-effect-only imports denied");
        if (owner !== owners[0]) assert.equal(statement.importClause.isTypeOnly, true, owner + ": types-only boundary");
      }
    }
  }
  const reached = new Set();
  function walk(entry, stack = []) {
    assert.ok(!stack.includes(entry), entry + ': runtime import cycle');
    reached.add(entry);
    for (const next of graph.get(entry) ?? []) walk(next, [...stack, entry]);
  }
  for (const entry of phase2AdminEntries) walk(entry);
  for (const owner of owners) assert.ok(reached.has(owner), owner + ': actual runtime owner reachability');
  return true;
}
