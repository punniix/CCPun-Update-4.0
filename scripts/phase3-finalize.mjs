import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const FINALIZER_BEGIN = '# BEGIN PHASE3 FINALIZER';
const FINALIZER_END = '# END PHASE3 FINALIZER';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content.endsWith('\n') ? content : `${content}\n`);
}

function replaceOnce(source, from, to, label) {
  const index = source.indexOf(from);
  if (index < 0) throw new Error(`Phase 3 finalizer could not find ${label}`);
  if (source.indexOf(from, index + from.length) >= 0) throw new Error(`Phase 3 finalizer found duplicate ${label}`);
  return `${source.slice(0, index)}${to}${source.slice(index + from.length)}`;
}

function removeExactFile(path) {
  if (!existsSync(path)) throw new Error(`Expected cleanup file is missing: ${path}`);
  rmSync(path);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findMatchingBrace(source, openIndex) {
  let depth = 1;
  let quote = null;
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      if (char === '\\') { index += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      if (end < 0) throw new Error('Unterminated CSS comment');
      index = end + 1;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error('Unbalanced CSS braces');
}

function splitSelectors(selectorText) {
  const result = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
  let quote = null;
  for (let index = 0; index < selectorText.length; index += 1) {
    const char = selectorText[index];
    if (quote) {
      if (char === '\\') { index += 1; continue; }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') parenDepth += 1;
    else if (char === ')') parenDepth = Math.max(0, parenDepth - 1);
    else if (char === '[') bracketDepth += 1;
    else if (char === ']') bracketDepth = Math.max(0, bracketDepth - 1);
    else if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
      result.push(selectorText.slice(start, index).trim());
      start = index + 1;
    }
  }
  result.push(selectorText.slice(start).trim());
  return result.filter(Boolean);
}

function splitLeadingTrivia(prelude) {
  let index = 0;
  while (index < prelude.length) {
    const whitespace = prelude.slice(index).match(/^\s+/)?.[0];
    if (whitespace) { index += whitespace.length; continue; }
    if (prelude.startsWith('/*', index)) {
      const end = prelude.indexOf('*/', index + 2);
      if (end < 0) break;
      index = end + 2;
      continue;
    }
    break;
  }
  return [prelude.slice(0, index), prelude.slice(index).trim()];
}

function pruneCssBlock(source, zeroClasses) {
  let cursor = 0;
  let output = '';
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) { output += source.slice(cursor); break; }
    const close = findMatchingBrace(source, open);
    const prelude = source.slice(cursor, open);
    const inner = source.slice(open + 1, close);
    const [leading, token] = splitLeadingTrivia(prelude);
    if (!token) {
      output += `${prelude}{${inner}}`;
      cursor = close + 1;
      continue;
    }
    if (token.startsWith('@')) {
      output += `${leading}${token} {${pruneCssBlock(inner, zeroClasses)}}`;
      cursor = close + 1;
      continue;
    }
    const selectors = splitSelectors(token);
    const kept = selectors.filter((selector) => !zeroClasses.some((className) => new RegExp(`\\.${escapeRegExp(className)}(?![A-Za-z0-9_-])`).test(selector)));
    if (kept.length > 0) output += `${leading}${kept.join(', ')} {${inner}}`;
    else output += leading;
    cursor = close + 1;
  }
  return output;
}

function splitWebsite43Article() {
  const path = 'features/blog/website-43/Website43Article.tsx';
  let source = read(path);
  const start = source.indexOf('function richContent(');
  const end = source.indexOf('\n\nexport default function Website43Article');
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not isolate Website43 article body renderer');
  let body = source.slice(start, end);
  body = replaceOnce(body, 'function renderBody(', 'export function renderWebsite43ArticleBody(', 'Website43 renderBody export');
  const bodyModule = `import Image from 'next/image';\nimport type { ReactNode } from 'react';\nimport type { ArticleBlock, ArticleRichText } from '@/lib/content/types';\nimport styles from '@/components/layout/website-43/Website43.module.css';\n\n${body}\n`;
  write('features/blog/website-43/Website43ArticleBody.tsx', bodyModule);
  source = `${source.slice(0, start)}${source.slice(end + 2)}`;
  source = source.replace("import type { ReactNode } from 'react';\n", '');
  source = source.replace("import type { Article, ArticleBlock, ArticleRichText } from '@/lib/content/types';", "import type { Article } from '@/lib/content/types';");
  source = source.replace("import Website43ArticleToc from './Website43ArticleToc';", "import Website43ArticleToc from './Website43ArticleToc';\nimport { renderWebsite43ArticleBody } from './Website43ArticleBody';");
  source = source.replace('renderBody(article.body, headingIds)', 'renderWebsite43ArticleBody(article.body, headingIds)');
  if (source.includes('renderBody(')) throw new Error('Website43Article still contains legacy renderBody owner');
  write(path, source);
}

function splitLifeCoverageWizard() {
  const path = 'features/financial-health-check/components/LifeCoverageWizard.tsx';
  let source = read(path);
  const start = source.indexOf('type Values = {');
  const moneyEndToken = "const money = (value: number) => new Intl.NumberFormat('th-TH').format(value);";
  const moneyEnd = source.indexOf(moneyEndToken, start);
  if (start < 0 || moneyEnd < 0) throw new Error('Could not isolate LifeCoverage model');
  let modelBlock = source.slice(start, moneyEnd + moneyEndToken.length);
  modelBlock = modelBlock
    .replace('type Values = {', 'export type LifeCoverageValues = {')
    .replace('const initialValues: Values = {', 'export const LIFE_COVERAGE_INITIAL_VALUES: LifeCoverageValues = {')
    .replace('const money = (value: number) =>', 'export const formatLifeCoverageMoney = (value: number) =>');
  const model = `${modelBlock}\n\nexport function calculateLifeCoverage(values: LifeCoverageValues) {\n  const familySupport = values.householdMonthly * 12 * values.supportYears;\n  const need = familySupport + values.debt + values.education;\n  const resources = values.existingLifeCoverage + values.liquidAssets;\n  return { familySupport, need, resources, gap: Math.max(need - resources, 0) };\n}\n`;
  write('features/financial-health-check/components/lifeCoverageModel.ts', model);
  source = `${source.slice(0, start)}${source.slice(moneyEnd + moneyEndToken.length + 1)}`;
  source = source.replace("import { getConsentData } from '@/lib/cookie-consent';", "import { getConsentData } from '@/lib/cookie-consent';\nimport { calculateLifeCoverage, formatLifeCoverageMoney, LIFE_COVERAGE_INITIAL_VALUES, type LifeCoverageValues } from './lifeCoverageModel';");
  source = source.replace(/\bValues\b/g, 'LifeCoverageValues');
  source = source.replace(/\binitialValues\b/g, 'LIFE_COVERAGE_INITIAL_VALUES');
  source = source.replace(/\bmoney\(/g, 'formatLifeCoverageMoney(');
  const resultPattern = /  const result = useMemo\(\(\) => \{[\s\S]*?\n  \}, \[values\]\);/;
  if (!resultPattern.test(source)) throw new Error('Could not isolate LifeCoverage calculation useMemo');
  source = source.replace(resultPattern, '  const result = useMemo(() => calculateLifeCoverage(values), [values]);');
  write(path, source);
}

function splitCookieConsent() {
  const path = 'features/analytics/components/CookieConsent.tsx';
  let source = read(path);
  const start = source.indexOf('// ─── Toggle Switch');
  const end = source.indexOf('// ─── Main Component');
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not isolate CookieConsent preference UI');
  let preferences = source.slice(start, end).trim();
  preferences = replaceOnce(preferences, 'function CategoryRow({', 'export function CategoryRow({', 'CookieConsent CategoryRow export');
  write('features/analytics/components/CookieConsentPreferences.tsx', `'use client';\n\nimport { useState } from 'react';\n\n${preferences}\n`);
  source = `${source.slice(0, start)}import { CategoryRow } from './CookieConsentPreferences';\n\n${source.slice(end)}`;
  write(path, source);
}

function splitSanitySchemas() {
  const path = 'lib/content/sanity.ts';
  let source = read(path);
  const start = source.indexOf('const spanSchema =');
  const end = source.indexOf('\n\nexport function portableTextToArticleBlocks');
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not isolate Sanity schema ownership block');
  let schemas = source.slice(start, end);
  schemas = schemas.replace(/^const /gm, 'export const ');
  schemas = schemas.replace(/^type /gm, 'export type ');
  schemas = schemas.replace(/^function parseRenderable/gm, 'export function parseRenderable');
  write('lib/content/sanity-schema.ts', `import { z } from 'zod';\n\n${schemas}\n`);
  source = `${source.slice(0, start)}${source.slice(end + 2)}`;
  source = source.replace('import { z } from "zod";\n', '');
  const imports = "import { baseArticleSchema, bodyItemSchema, faqItemSchema, parseRenderableBodyItems, parseRenderableFaqItems, rawArticleSchema, type PortableBodyItem, type RawArticle, type RawArticleSummary } from './sanity-schema';\n";
  source = source.replace('import type { Article, ArticleBlock, ContentProvider } from "./types";\n', `import type { Article, ArticleBlock, ContentProvider } from "./types";\n${imports}`);
  write(path, source);
}

function splitStepExpenses() {
  const path = 'features/ci-planning/components/steps/StepExpenses.tsx';
  let source = read(path);
  const typesStart = source.indexOf('type ExpenseField =');
  const fieldErrorStart = source.indexOf('function FieldError', typesStart);
  const previewStart = source.indexOf('function previewInstallments', fieldErrorStart);
  const recoveryLinkStart = source.indexOf('function RecoverySourceLink', previewStart);
  const safeStart = source.indexOf('function safeRecoveryPreview', recoveryLinkStart);
  const componentStart = source.indexOf('export default function StepExpenses', safeStart);
  if ([typesStart, fieldErrorStart, previewStart, recoveryLinkStart, safeStart, componentStart].some((value) => value < 0)) throw new Error('Could not isolate StepExpenses model blocks');
  const typesAndFormatting = source.slice(typesStart, fieldErrorStart);
  const previews = source.slice(previewStart, recoveryLinkStart);
  const safeModels = source.slice(safeStart, componentStart);
  let model = `${typesAndFormatting}${previews}${safeModels}`;
  model = model.replace(/^type /gm, 'export type ').replace(/^function /gm, 'export function ');
  write('features/ci-planning/components/steps/StepExpenses.model.ts', `import { calcDebtNeed, calcHouseholdNeed, calcIncomeBasedNeed, calcOtherDebtNeed, calcRecoveryReserveNeed } from '@/features/ci-planning/calculator/calculator';\nimport type { CIEducationPlan, CIFormData, CIRecoveryCosts } from '@/features/ci-planning/calculator/types';\n\n${model.trim()}\n`);

  source = `${source.slice(0, typesStart)}${source.slice(fieldErrorStart, previewStart)}${source.slice(recoveryLinkStart, safeStart)}${source.slice(componentStart)}`;

  const obligationsStart = source.indexOf('    <details open={hasAdvancedData}');
  const recoveryStart = source.indexOf('    <details open={hasRecoveryData}', obligationsStart);
  const summaryStart = source.indexOf('    {planPreview ?', recoveryStart);
  if ([obligationsStart, recoveryStart, summaryStart].some((value) => value < 0)) throw new Error('Could not isolate StepExpenses section boundaries');
  const obligationsBlock = source.slice(obligationsStart, recoveryStart).trim();
  const recoveryBlock = source.slice(recoveryStart, summaryStart).trim();

  const obligationsModule = `'use client';\n\nimport { Plus, Trash2 } from 'lucide-react';\nimport type { ChangeEvent } from 'react';\nimport CurrencyInput from '@/components/ui/CurrencyInput';\nimport type { CIEducationPlan, CIFormData } from '@/features/ci-planning/calculator/types';\nimport { baht, describedBy, previewBaht, previewEducationSubtotal, safePlanPreview, type ExpenseField } from './StepExpenses.model';\n\nfunction FieldError({ id, message }: { id: string; message?: string }) {\n  if (!message) return null;\n  return <p id={id} role=\"alert\" tabIndex={-1} className=\"text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring\">{message}</p>;\n}\n\ntype Props = {\n  open: boolean;\n  educationPlans: CIEducationPlan[];\n  expenses: CIFormData['expenses'];\n  errors: Record<string, string>;\n  planPreview: ReturnType<typeof safePlanPreview>;\n  handleAddEducationPlan: () => void;\n  handleEducationPlan: (index: number, field: keyof CIEducationPlan, value: number) => void;\n  handleEducationYears: (index: number, event: ChangeEvent<HTMLInputElement>) => void;\n  handleRemoveEducationPlan: (index: number) => void;\n  handleExpense: (field: ExpenseField, value: number) => void;\n  handleInstallments: (field: 'mortgageInstallmentsRemaining' | 'carInstallmentsRemaining', event: ChangeEvent<HTMLInputElement>) => void;\n};\n\nexport default function ExpenseObligationsSection({ open: hasAdvancedData, educationPlans, expenses, errors, planPreview, handleAddEducationPlan, handleEducationPlan, handleEducationYears, handleRemoveEducationPlan, handleExpense, handleInstallments }: Props) {\n  return (\n${obligationsBlock}\n  );\n}\n`;
  write('features/ci-planning/components/steps/ExpenseObligationsSection.tsx', obligationsModule);

  const recoveryModule = `'use client';\n\nimport { ExternalLink } from 'lucide-react';\nimport type { ChangeEvent } from 'react';\nimport CurrencyInput from '@/components/ui/CurrencyInput';\nimport type { CIRecoveryCosts } from '@/features/ci-planning/calculator/types';\nimport { CI_RECOVERY_REFERENCE, CI_RECOVERY_SOURCES } from '@/features/ci-planning/recovery-evidence';\nimport { baht, safeRecoveryPreview, type RecoveryAmountField, type RecoveryCountField } from './StepExpenses.model';\n\nfunction FieldError({ id, message }: { id: string; message?: string }) {\n  if (!message) return null;\n  return <p id={id} role=\"alert\" tabIndex={-1} className=\"text-sm text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring\">{message}</p>;\n}\n\nfunction RecoverySourceLink({ id, children }: { id: string; children: React.ReactNode }) {\n  const source = CI_RECOVERY_SOURCES.find((item) => item.id === id);\n  if (!source) return <>{children}</>;\n  return <a href={source.url} target=\"_blank\" rel=\"noopener noreferrer\" className=\"inline-flex items-center gap-1 text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary\">{children}<ExternalLink className=\"h-3 w-3\" aria-hidden=\"true\" /></a>;\n}\n\ntype Props = {\n  open: boolean;\n  recovery: CIRecoveryCosts;\n  errors: Record<string, string>;\n  recoveryPreview: ReturnType<typeof safeRecoveryPreview>;\n  handleRecoveryCount: (field: RecoveryCountField, event: ChangeEvent<HTMLInputElement>) => void;\n  handleRecoveryAmount: (field: RecoveryAmountField, value: number) => void;\n};\n\nexport default function RecoveryReserveSection({ open: hasRecoveryData, recovery, errors, recoveryPreview, handleRecoveryCount, handleRecoveryAmount }: Props) {\n  return (\n${recoveryBlock}\n  );\n}\n`;
  write('features/ci-planning/components/steps/RecoveryReserveSection.tsx', recoveryModule);

  source = `${source.slice(0, obligationsStart)}    <ExpenseObligationsSection\n      open={hasAdvancedData}\n      educationPlans={educationPlans}\n      expenses={expenses}\n      errors={errors}\n      planPreview={planPreview}\n      handleAddEducationPlan={handleAddEducationPlan}\n      handleEducationPlan={handleEducationPlan}\n      handleEducationYears={handleEducationYears}\n      handleRemoveEducationPlan={handleRemoveEducationPlan}\n      handleExpense={handleExpense}\n      handleInstallments={handleInstallments}\n    />\n\n    <RecoveryReserveSection\n      open={hasRecoveryData}\n      recovery={recovery}\n      errors={errors}\n      recoveryPreview={recoveryPreview}\n      handleRecoveryCount={handleRecoveryCount}\n      handleRecoveryAmount={handleRecoveryAmount}\n    />\n\n${source.slice(summaryStart)}`;
  source = source.replace("import { ExternalLink, Plus, Trash2 } from 'lucide-react';\n", '');
  source = source.replace("import { calcDebtNeed, calcHouseholdNeed, calcIncomeBasedNeed, calcOtherDebtNeed, calcRecoveryReserveNeed } from '@/features/ci-planning/calculator/calculator';\n", '');
  source = source.replace("import { CI_RECOVERY_REFERENCE, CI_RECOVERY_SOURCES } from '@/features/ci-planning/recovery-evidence';\n", '');
  const oldTypeImport = "import type { CIEducationPlan, CIFormData, CIRecoveryCosts } from '@/features/ci-planning/calculator/types';";
  const newImports = `${oldTypeImport}\nimport ExpenseObligationsSection from './ExpenseObligationsSection';\nimport RecoveryReserveSection from './RecoveryReserveSection';\nimport { baht, describedBy, safePlanPreview, safeRecoveryPreview, type ExpenseField, type RecoveryAmountField, type RecoveryCountField } from './StepExpenses.model';`;
  source = source.replace(oldTypeImport, newImports);
  const recoveryLinkFunction = /function RecoverySourceLink\([\s\S]*?\n}\n\n/;
  if (!recoveryLinkFunction.test(source)) throw new Error('Could not remove StepExpenses RecoverySourceLink owner');
  source = source.replace(recoveryLinkFunction, '');
  write(path, source);
}

function migrateSourceBoundRegressions() {
  const vercelPath = 'tests/vercel-native-regression.mjs';
  let vercel = read(vercelPath);
  vercel = vercel.replace("const sanityProvider = read('lib/content/sanity.ts');", "const sanityProvider = [read('lib/content/sanity-schema.ts'), read('lib/content/sanity.ts')].join('\\n');");
  vercel = vercel.replace("const consentUi = read('features/analytics/components/CookieConsent.tsx');", "const consentUi = [read('features/analytics/components/CookieConsent.tsx'), read('features/analytics/components/CookieConsentPreferences.tsx')].join('\\n');");
  vercel = vercel.replace("const navbar = read('components/layout/Navbar.tsx');", "const navbar = read('components/layout/website-43/Website43Navbar.tsx');");
  vercel = vercel.replace('assert.match(navbar, /href=\"\\/blog\\/\"/);', 'assert.match(navbar, /\\$\\{BASE\\}\\/blog/);');
  vercel = vercel.replaceAll("read('components/layout/Navbar.tsx')", "read('components/layout/website-43/Website43Navbar.tsx')");
  vercel = vercel.replace("const blogArchive = read('features/blog/components/BlogArchive.tsx');", "const blogArchivePage = read('features/blog/pages/BlogArchivePage.tsx');\nconst blogPresentation = read('features/blog/website-43/Website43Blog.tsx');\nconst blogData = read('features/blog/website-43/blogData.ts');");
  vercel = vercel.replace('assert.match(blogArchive, /LEGACY_CATEGORY_TOPICS/);\nassert.match(blogArchive, /deriveCategories\\(articles/);', "assert.match(blogArchivePage, /listCategoryRegistry/);\nassert.match(blogArchivePage, /listCategoryMenuEntries/);\nassert.match(blogPresentation, /Website43BlogInteractive/);\nassert.match(blogData, /getArticlePath/);\nassert.match(blogData, /getArticleSemanticTopic/);");
  vercel = vercel.replace("const articleBodyRenderer = read('features/blog/components/ArticleBody.tsx');", "const articleBodyRenderer = read('features/blog/website-43/Website43ArticleBody.tsx');\nconst articleTocRenderer = read('features/blog/website-43/Website43ArticleToc.tsx');");
  vercel = vercel.replace('assert.match(articleBodyRenderer, /ArticleTableOfContents/);', "assert.match(articleTocRenderer, /groups/);\nassert.match(articlePresentation, /renderWebsite43ArticleBody\\(article\\.body, headingIds\\)/);");
  vercel = vercel.replace('assert.match(articleBodyRenderer, /id=\\\\{headingId\\\\(index\\\\)\\\\}/);', 'assert.match(articleBodyRenderer, /id=\\{id\\}/);');
  vercel = vercel.replaceAll('block\\\\.type === ', 'item\\\\.type === ');
  vercel = vercel.replace("const articleFaq = read('features/blog/components/ArticleFaq.tsx');\nassert.match(articleFaq, /คำถามที่พบบ่อย/);", "assert.match(articlePresentation, /คำถามที่พบบ่อย/);");
  for (const retiredPath of [
    'features/blog/components/ArticleBody.tsx',
    'features/blog/components/ArticleCard.tsx',
    'features/blog/components/ArticleFaq.tsx',
    'features/blog/components/BlogArchive.tsx',
    'components/layout/Navbar.tsx',
  ]) {
    if (vercel.includes(retiredPath)) throw new Error(`vercel-native regression still references retired path: ${retiredPath}`);
  }
  write(vercelPath, vercel);

  const resultPath = 'tests/result-actions-regression.ts';
  let result = read(resultPath);
  const walkthroughDeclaration = "const ciWalkthroughSource = readFileSync(\n  new URL('../features/ci-planning/components/CIPreToolWalkthrough.tsx', import.meta.url),\n  'utf8',\n);\n";
  result = replaceOnce(result, walkthroughDeclaration, '', 'CI walkthrough regression declaration');
  const oldExpensesDeclaration = "const ciExpensesSource = readFileSync(\n  new URL('../features/ci-planning/components/steps/StepExpenses.tsx', import.meta.url),\n  'utf8',\n);";
  const newExpensesDeclaration = "const ciExpensesSurfaceSource = [\n  readFileSync(new URL('../features/ci-planning/components/steps/StepExpenses.tsx', import.meta.url), 'utf8'),\n  readFileSync(new URL('../features/ci-planning/components/steps/ExpenseObligationsSection.tsx', import.meta.url), 'utf8'),\n  readFileSync(new URL('../features/ci-planning/components/steps/RecoveryReserveSection.tsx', import.meta.url), 'utf8'),\n].join('\\n');";
  result = replaceOnce(result, oldExpensesDeclaration, newExpensesDeclaration, 'CI expense surface regression declaration');
  result = result.replaceAll('ciExpensesSource', 'ciExpensesSurfaceSource');
  result = result.replaceAll('ciWalkthroughSource', 'ciPageSource');
  result = result.replace('(ciPageSource.match(/href=\"#ci-calculator\"/g) ?? []).length', '(ciPageSource.match(/ctaHref=\"#ci-calculator\"/g) ?? []).length');
  result = result.replace("(ciPageSource.match(/gold-button/g) ?? []).length", "(ciPageSource.match(/ctaLabel=\"เริ่มประเมิน\"/g) ?? []).length");
  result = result.replace("'lean CI landing must have exactly one pre-calculator gold CTA'", "'CI tool hero must have exactly one primary pre-calculator CTA label'");
  if (result.includes('CIPreToolWalkthrough')) throw new Error('result-actions regression still references retired CI walkthrough');
  write(resultPath, result);
}

function pruneWebsite43Css() {
  const path = 'components/layout/website-43/Website43.module.css';
  const zeroClasses = [
    'articleFaq', 'chip', 'chips', 'cookieButton', 'cookieCard', 'cookieCategories', 'finalActions', 'form-glass',
    'learnCard', 'learnCardAlt', 'legalBack', 'legalContent', 'legalIndex', 'legalIntro', 'legalTitle', 'legalUpdated',
    'lineCta', 'narrow', 'planCard', 'planCategoriesSection', 'planLink', 'reassurance', 'storyIntro', 'storyVisual',
    'takeaway', 'toolCtas', 'toolCtasActions',
  ];
  const pruned = pruneCssBlock(read(path), zeroClasses);
  for (const className of zeroClasses) {
    if (new RegExp(`\\.${escapeRegExp(className)}(?![A-Za-z0-9_-])`).test(pruned)) throw new Error(`CSS selector cleanup missed .${className}`);
  }
  write(path, pruned);

  const auditPath = 'scripts/audit-public-css-usage.mjs';
  let audit = read(auditPath);
  const anchor = "if (dynamicModuleAccess.length > 0) {\n  throw new Error('Website43.module.css uses dynamic property access; static ownership auditing is no longer safe.');\n}\n";
  const withGate = `${anchor}if (moduleUnused.length > 0) {\n  throw new Error(\`Website43.module.css has ${'${moduleUnused.length}'} class selector(s) with no reachable runtime reference: ${'${moduleUnused.join(\', \')}'}\`);\n}\n`;
  audit = replaceOnce(audit, anchor, withGate, 'Website43 zero-reference blocking gate');
  write(auditPath, audit);
}

function cleanDependencies() {
  const path = 'package.json';
  const pkg = JSON.parse(read(path));
  const removed = ['@radix-ui/react-slot', '@radix-ui/react-toast', 'class-variance-authority', 'framer-motion', 'tailwindcss-animate'];
  for (const dependency of removed) {
    if (!(dependency in pkg.dependencies)) throw new Error(`Expected zero-consumer dependency is missing before cleanup: ${dependency}`);
    delete pkg.dependencies[dependency];
  }
  write(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

function cleanLegacySourcesAndAudit() {
  for (const path of [
    'features/blog/components/ArticleBody.tsx',
    'features/blog/components/ArticleCard.tsx',
    'features/blog/components/ArticleFaq.tsx',
    'features/blog/components/BlogArchive.tsx',
    'features/ci-planning/components/CIPreToolWalkthrough.tsx',
    'components/layout/Navbar.tsx',
  ]) removeExactFile(path);

  const auditPath = 'scripts/audit-public-architecture.mjs';
  let audit = read(auditPath);
  audit = audit.replace("  if (file.startsWith('features/blog/components/')) return 'test-bound pre-Website43 Blog renderer';\n", '');
  audit = audit.replace("  if (file === 'features/ci-planning/components/CIPreToolWalkthrough.tsx') return 'regression fixture for retired walkthrough behavior';\n", '');
  audit = audit.replace("  if (file === 'components/layout/Navbar.tsx') return 'test-bound pre-Website43 navbar contract';\n", '');
  audit = audit.replace("  const basename = file.split('/').at(-1);\n  return testSources\n    .filter(([, source]) => source.includes(file) || (basename && source.includes(basename)))\n    .map(([testFile]) => testFile);", "  const basename = file.split('/').at(-1);\n  return testSources\n    .filter(([, source]) => source.includes(file) || (basename && (source.includes(\`'${'${basename}'}'\`) || source.includes(\`\"${'${basename}'}\"\`))))\n    .map(([testFile]) => testFile);");
  write(auditPath, audit);
}

function updateOwnershipDocs() {
  const path = 'docs/architecture/public-runtime-ownership.md';
  let docs = read(path);
  docs = docs.replace(
    /## Blog legacy status[\s\S]*?## Calculator parity status/,
    `## Blog legacy status\n\nThe pre-Website43 Blog renderer was fully retired after its block, FAQ, category and SEO regression assertions were moved to the current \`pages/\` and \`website-43/\` owners. Do not recreate \`features/blog/components/\` as a parallel renderer. Blog/CMS media still has a separate content lifecycle and is not deleted by source reachability audits.\n\n## Calculator parity status`,
  );
  docs = docs.replace(
    '| Article | `features/blog/pages/ArticlePage.tsx` → `features/blog/website-43/Website43Article.tsx` | Body blocks, FAQ, sources, author card and visible semantic breadcrumbs render here. TOC interaction is isolated in `Website43ArticleToc.tsx`. |',
    '| Article | `features/blog/pages/ArticlePage.tsx` → `features/blog/website-43/Website43Article.tsx` | Body block rendering is owned by `Website43ArticleBody.tsx`; TOC interaction is isolated in `Website43ArticleToc.tsx`. |',
  );
  docs = docs.replace(
    '| CI Planning | `features/ci-planning/page.tsx` + current `components/` + `calculator/` | `features/ci-planning/legacy/calculator.ts` is parity evidence only and must not be imported into new UI. |',
    '| CI Planning | `features/ci-planning/page.tsx` + current `components/` + `calculator/` | Step 1 model logic, debt/education UI and Recovery Reserve UI have separate owners. `legacy/calculator.ts` is parity evidence only. |',
  );
  docs = docs.replace(
    '| Financial Health Check | `features/financial-health-check/page.tsx` → `components/ClientFHC.tsx` → `components/LifeCoverageWizard.tsx` | The older multi-step FHC UI was retired in Phase 3. `calculator/` is retained only as a frozen regression reference until its parity contract is deliberately retired. |',
    '| Financial Health Check | `features/financial-health-check/page.tsx` → `components/ClientFHC.tsx` → `components/LifeCoverageWizard.tsx` | Pure calculation/model helpers live in `lifeCoverageModel.ts`; the older `calculator/` directory remains only as a frozen regression reference. |',
  );
  write(path, docs);
}

function removeFinalizerScaffolding() {
  const workflowPath = '.github/workflows/seo-topic-hubs-ci.yml';
  let workflow = read(workflowPath);
  const start = workflow.indexOf(FINALIZER_BEGIN);
  const end = workflow.indexOf(FINALIZER_END);
  if (start < 0 || end < 0 || end <= start) throw new Error('Phase 3 finalizer workflow markers are missing');
  workflow = `${workflow.slice(0, start)}${workflow.slice(end + FINALIZER_END.length)}`.replace(/\n{3,}$/g, '\n');
  write(workflowPath, workflow);
  rmSync('scripts/phase3-finalize.mjs');
}

splitWebsite43Article();
splitLifeCoverageWizard();
splitCookieConsent();
splitSanitySchemas();
splitStepExpenses();
migrateSourceBoundRegressions();
pruneWebsite43Css();
cleanDependencies();
cleanLegacySourcesAndAudit();
updateOwnershipDocs();
removeFinalizerScaffolding();

console.log('Phase 3 one-shot finalizer completed.');
