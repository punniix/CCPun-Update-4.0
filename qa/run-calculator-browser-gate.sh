#!/usr/bin/env bash
set -uo pipefail

print_failures() {
  local report_path="$1"
  local label="$2"
  if [ ! -f "$report_path" ]; then
    echo "${label}: report missing: ${report_path}" >&2
    return
  fi
  REPORT_PATH="$report_path" LABEL="$label" node <<'NODE'
const fs = require('node:fs');
const report = JSON.parse(fs.readFileSync(process.env.REPORT_PATH, 'utf8'));
const sections = ['browserAssertions', 'formulaProperties', 'staticChecks', 'checks'];
const failed = sections.flatMap((section) =>
  Array.isArray(report[section])
    ? report[section].filter((item) => !item.pass).map((item) => ({ section, ...item }))
    : []
);
console.error(`${process.env.LABEL}: ${failed.length} failed assertion(s)`);
for (const item of failed) {
  console.error(`- [${item.section}] ${item.name}: ${item.details || '(no details)'}`);
}
NODE
}

FHC_STATUS=0
CLOUD_HTML_PATH=/tmp/fhc-cloud.html \
CLOUD_HEADERS_PATH=/tmp/fhc-cloud.headers \
CLOUD_ROBOTS_PATH=/tmp/fhc-cloud.robots \
UAT_BASE_URL="${UAT_BASE_URL:-http://127.0.0.1:3005}" \
CDP_HTTP="${CDP_HTTP:-http://127.0.0.1:9342}" \
node qa/fhc-exhaustive-uat.mjs || FHC_STATUS=$?
if [ "$FHC_STATUS" -ne 0 ]; then
  print_failures qa/fhc-exhaustive-uat/report.json FHC
fi

CI_STATUS=0
UAT_BASE_URL="${UAT_BASE_URL:-http://127.0.0.1:3005}" \
CDP_HTTP="${CDP_HTTP:-http://127.0.0.1:9342}" \
node qa/ci-recovery-additive-uat.mjs || CI_STATUS=$?
if [ "$CI_STATUS" -ne 0 ]; then
  print_failures qa/ci-recovery-additive-uat/report.json CI
fi

if [ "$FHC_STATUS" -ne 0 ] || [ "$CI_STATUS" -ne 0 ]; then
  echo "Calculator browser QA failed: FHC=${FHC_STATUS}, CI=${CI_STATUS}" >&2
  exit 1
fi

echo "Calculator browser QA passed for FHC and CI"
