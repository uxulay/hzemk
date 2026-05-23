export type CsvDataRow = Record<string, string>;

export type BulkImportValidationRow<TData = unknown> = {
  rowNumber: number;
  rawRow: CsvDataRow;
  data?: TData;
  errors: string[];
  notes?: string[];
  groupKey?: string;
};

export type BulkImportFailure = {
  rowNumber?: number;
  label?: string;
  message: string;
};

export type BulkImportResult = {
  successCount: number;
  failedCount: number;
  errors: BulkImportFailure[];
};

export type BulkActionResult = {
  id: string;
  label: string;
  success: boolean;
  action: "deleted" | "deactivated" | "blocked";
  message: string;
};
