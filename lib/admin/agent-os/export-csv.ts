export type CsvDataset = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
  lineage?: {
    generatedAt: string;
    cutoff: string;
    sourceDataAvailableThrough: string | null;
    dataQualityStatus: string;
    sourceManifestHash: string;
    modelSchemaVersion: string;
    analysisVersion: string | null;
    aiAnalysisId?: string | null;
    aiAnalysisIds?: string[];
    pipelineCorrelationId: string | null;
    metricSemantics: string[];
    limitations: string[];
  };
};

function csvCell(value: unknown) {
  const raw = value == null ? "" : String(value);
  const text = typeof value === "string" && /^[\s\uFEFF]*[=+\-@]/.test(raw) ? "'" + raw : raw;
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function csvRows(dataset: CsvDataset) {
  if (!dataset.lineage) return { columns: dataset.columns, rows: dataset.rows };
  const lineage = dataset.lineage;
  const provenance: Record<string, string | number | boolean | null> = {
    "__generated_at": lineage.generatedAt,
    "__cutoff": lineage.cutoff,
    "__source_available_through": lineage.sourceDataAvailableThrough,
    "__data_quality_status": lineage.dataQualityStatus,
    "__source_manifest_sha256": lineage.sourceManifestHash,
    "__schema_version": lineage.modelSchemaVersion,
    "__analysis_version": lineage.analysisVersion,
    "__ai_analysis_id": lineage.aiAnalysisId ?? lineage.aiAnalysisIds?.join("|") ?? null,
    "__pipeline_correlation_id": lineage.pipelineCorrelationId,
    "__metric_semantics": lineage.metricSemantics.join("|"),
    "__limitations": lineage.limitations.join(" | "),
  };
  const provenanceColumns = Object.keys(provenance);
  return {
    columns: [...dataset.columns, ...provenanceColumns],
    rows: dataset.rows.length ? dataset.rows.map(row => ({ ...row, ...provenance })) : [{ ...provenance }],
  };
}

export function ownerDatasetToCsv(dataset: CsvDataset) {
  const normalized = csvRows(dataset);
  const lines = [
    normalized.columns.map(csvCell).join(","),
    ...normalized.rows.map((row) => normalized.columns.map((column) => csvCell(row[column])).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
