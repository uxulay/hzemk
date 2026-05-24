import type { CsvDataRow } from "@/lib/bulk-types";

export type CsvTemplateField = {
  key: string;
  label: string;
  required?: boolean;
  example?: string;
  aliases?: string[];
};

export type ParsedCsv = {
  headers: string[];
  rows: CsvDataRow[];
};

export function normalizeCsvValue(value: string | null | undefined) {
  return (value ?? "").replace(/^\uFEFF/, "").trim();
}

function parseCsvCells(content: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === "\"") {
      if (inQuotes && nextChar === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  return rows.filter((row) =>
    row.some((cell) => normalizeCsvValue(cell).length > 0)
  );
}

export function parseCsv(content: string): ParsedCsv {
  const rows = parseCsvCells(content);

  if (rows.length === 0) {
    return {
      headers: [],
      rows: []
    };
  }

  const headers = rows[0].map((header) => normalizeCsvValue(header));
  const duplicateHeader = headers.find(
    (header, index) => headers.indexOf(header) !== index
  );

  if (duplicateHeader) {
    throw new Error(`CSV 表头重复：${duplicateHeader}`);
  }

  if (headers.some((header) => !header)) {
    throw new Error("CSV 表头不能为空，请检查第一行。");
  }

  const dataRows = rows.slice(1).map((row) => {
    return headers.reduce<CsvDataRow>((record, header, index) => {
      record[header] = normalizeCsvValue(row[index]);
      return record;
    }, {});
  });

  return {
    headers,
    rows: dataRows
  };
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export function generateCsvTemplate(
  fields: CsvTemplateField[],
  sampleRows: CsvDataRow[] = []
) {
  const headerLine = fields.map((field) => escapeCsvCell(field.key)).join(",");
  const rowsToWrite =
    sampleRows.length > 0
      ? sampleRows
      : [
          fields.reduce<CsvDataRow>((record, field) => {
            record[field.key] = field.example ?? "";
            return record;
          }, {})
        ];

  const sampleLines = rowsToWrite.map((row) =>
    fields.map((field) => escapeCsvCell(row[field.key])).join(",")
  );

  return [headerLine, ...sampleLines].join("\n");
}

export function getCsvRowValue(
  row: CsvDataRow,
  field: Pick<CsvTemplateField, "key" | "aliases">
) {
  const keys = [field.key, ...(field.aliases ?? [])];

  for (const key of keys) {
    const value = normalizeCsvValue(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

export function downloadCsvTemplate(
  fileName: string,
  fields: CsvTemplateField[],
  sampleRows?: CsvDataRow[]
) {
  const csv = generateCsvTemplate(fields, sampleRows);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
