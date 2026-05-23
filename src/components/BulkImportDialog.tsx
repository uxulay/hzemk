"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import type {
  BulkImportResult,
  BulkImportValidationRow
} from "@/lib/bulk-types";
import {
  downloadCsvTemplate,
  parseCsv,
  type CsvTemplateField
} from "@/lib/utils/csv";

type BulkImportDialogProps<TData> = {
  open: boolean;
  title: string;
  description: string;
  templateFileName: string;
  fields: CsvTemplateField[];
  sampleRows?: Record<string, string>[];
  validateRows: (
    rows: Record<string, string>[]
  ) => Promise<BulkImportValidationRow<TData>[]>;
  onImport: (
    rows: BulkImportValidationRow<TData>[]
  ) => Promise<BulkImportResult>;
  onClose: () => void;
  renderPreviewSummary?: (
    rows: BulkImportValidationRow<TData>[]
  ) => ReactNode;
};

export function BulkImportDialog<TData>({
  open,
  title,
  description,
  templateFileName,
  fields,
  sampleRows,
  validateRows,
  onImport,
  onClose,
  renderPreviewSummary
}: BulkImportDialogProps<TData>) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<
    BulkImportValidationRow<TData>[]
  >([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const fieldLabelByKey = useMemo(
    () =>
      fields.reduce<Record<string, string>>((record, field) => {
        record[field.key] = field.label;
        return record;
      }, {}),
    [fields]
  );
  const errorRowCount = previewRows.filter((row) => row.errors.length > 0).length;
  const validRows = previewRows.filter((row) => row.errors.length === 0);
  const canImport =
    previewRows.length > 0 && errorRowCount === 0 && !parsing && !importing;

  if (!open) {
    return null;
  }

  const resetAndClose = () => {
    setFileName("");
    setPreviewRows([]);
    setErrorMessage("");
    setResult(null);
    onClose();
  };

  const handleFileChange = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      setParsing(true);
      setErrorMessage("");
      setResult(null);
      setFileName(file.name);

      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("当前第一版只支持 CSV 文件，请先另存为 .csv 后再导入。");
      }

      const parsed = parseCsv(await file.text());

      if (parsed.rows.length === 0) {
        throw new Error("CSV 里没有可导入的数据行。");
      }

      const missingHeaders = fields
        .filter((field) => field.required)
        .filter((field) => !parsed.headers.includes(field.key));

      if (missingHeaders.length > 0) {
        throw new Error(
          `CSV 缺少必填表头：${missingHeaders
            .map((field) => field.key)
            .join("、")}`
        );
      }

      setPreviewRows(await validateRows(parsed.rows));
    } catch (error) {
      setPreviewRows([]);
      setErrorMessage(
        error instanceof Error ? error.message : "CSV 解析失败，请检查文件。"
      );
    } finally {
      setParsing(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const submitImport = async () => {
    if (!canImport) {
      return;
    }

    try {
      setImporting(true);
      setErrorMessage("");
      setResult(await onImport(validRows));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "确认导入失败，请稍后重试。"
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="modalBackdrop" role="presentation">
      <div className="modalPanel bulkImportDialog" role="dialog" aria-modal="true">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">批量导入</p>
            <h3>{title}</h3>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() =>
                downloadCsvTemplate(templateFileName, fields, sampleRows)
              }
            >
              下载模板
            </button>
            <button type="button" onClick={resetAndClose} disabled={importing}>
              关闭
            </button>
          </div>
        </div>

        <p className="bulkDialogDescription">{description}</p>

        <div className="bulkUploadBox">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => handleFileChange(event.target.files?.[0])}
            disabled={parsing || importing}
          />
          <span>
            {fileName
              ? `已选择：${fileName}`
              : "请选择 CSV 文件。上传后只预览和校验，不会直接写入数据库。"}
          </span>
        </div>

        {errorMessage ? (
          <div className="debugError">
            <strong>导入失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {parsing ? <div className="debugNotice">正在解析和校验 CSV...</div> : null}

        {previewRows.length > 0 ? (
          <>
            <div className={errorRowCount > 0 ? "warningNotice" : "successNotice"}>
              <strong>预览校验</strong>
              <p>
                共 {previewRows.length} 行，校验通过 {validRows.length} 行，
                有错误 {errorRowCount} 行。
                {errorRowCount > 0
                  ? " 请先修改 CSV 后重新上传，错误行不会被导入。"
                  : " 可以确认导入。"}
              </p>
            </div>

            {renderPreviewSummary ? renderPreviewSummary(previewRows) : null}

            <div className="tableWrap bulkPreviewWrap">
              <table className="dataTable bulkPreviewTable">
                <thead>
                  <tr>
                    <th>行号</th>
                    {fields.map((field) => (
                      <th key={field.key}>
                        {fieldLabelByKey[field.key] ?? field.key}
                      </th>
                    ))}
                    <th>校验结果</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr
                      className={
                        row.errors.length > 0 ? "bulkPreviewErrorRow" : undefined
                      }
                      key={row.rowNumber}
                    >
                      <td>{row.rowNumber}</td>
                      {fields.map((field) => (
                        <td key={field.key}>{row.rawRow[field.key] || "-"}</td>
                      ))}
                      <td>
                        {row.errors.length > 0 ? (
                          <div className="bulkErrorList">
                            {row.errors.map((message) => (
                              <span key={message}>{message}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="tablePill import-status-ok">
                            通过
                          </span>
                        )}
                        {row.notes?.map((note) => (
                          <p className="tableHint" key={note}>
                            {note}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {result ? (
          <div className={result.failedCount > 0 ? "warningNotice" : "successNotice"}>
            <strong>导入完成</strong>
            <p>
              成功 {result.successCount} 条，失败 {result.failedCount} 条。
            </p>
            {result.errors.length > 0 ? (
              <div className="bulkErrorList">
                {result.errors.map((failure) => (
                  <span
                    key={`${failure.rowNumber ?? failure.label}-${failure.message}`}
                  >
                    {failure.rowNumber ? `第 ${failure.rowNumber} 行：` : ""}
                    {failure.label ? `${failure.label}：` : ""}
                    {failure.message}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="modalFooter">
          <span>
            {errorRowCount > 0
              ? "有错误时不能确认导入。"
              : "确认导入后才会写入 Supabase。"}
          </span>
          <div className="rowActions">
            <button type="button" onClick={resetAndClose} disabled={importing}>
              取消
            </button>
            <button
              className="primaryButton"
              type="button"
              onClick={submitImport}
              disabled={!canImport}
            >
              {importing ? "正在导入..." : "确认导入"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
