export type CsvDataset = {
  columns: string[];
  rows: Array<Record<string, string | number | boolean | null>>;
};

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[",\n\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

export function ownerDatasetToCsv(dataset: CsvDataset) {
  const lines = [
    dataset.columns.map(csvCell).join(","),
    ...dataset.rows.map((row) => dataset.columns.map((column) => csvCell(row[column])).join(",")),
  ];
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
