type CsvValue = string | number | boolean | null | undefined | Date;

function escapeCsv(value: CsvValue) {
  if (value === null || value === undefined) {
    return "";
  }
  const raw = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(raw)) {
    return `"${raw.replace(/"/g, '""')}"`;
  }
  return raw;
}

export function toCsv(headers: string[], rows: CsvValue[][]) {
  return [
    headers.map(escapeCsv).join(","),
    ...rows.map((row) => row.map(escapeCsv).join(","))
  ].join("\n");
}
