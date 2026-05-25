"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type {
  BulkImportResult,
  BulkImportValidationRow
} from "@/lib/bulk-types";
import {
  bulkImportFbaReplenishmentRequests,
  validateFbaReplenishmentImportRows,
  type FbaReplenishmentImportInput
} from "@/lib/api/replenishment";
import {
  downloadCsvTemplate,
  parseCsv,
  type CsvTemplateField
} from "@/lib/utils/csv";

const fbaImportFields: CsvTemplateField[] = [
  {
    key: "sku_code",
    label: "SKU 编码",
    required: true,
    example: "STORAGE-BOX-BLACK"
  },
  {
    key: "target_warehouse_code",
    label: "目标仓库编码",
    example: "WH-FBA-STAGING"
  },
  {
    key: "fba_warehouse_code",
    label: "FBA 仓库代码",
    example: "ONT8"
  },
  {
    key: "requested_quantity",
    label: "备货数量",
    required: true,
    example: "120"
  },
  {
    key: "expected_date",
    label: "期望完成日期",
    example: "2026-06-10"
  },
  {
    key: "priority",
    label: "优先级",
    example: "normal"
  },
  {
    key: "remark",
    label: "备注",
    example: "按 30 天销量补货"
  },
  {
    key: "amazon_site",
    label: "亚马逊站点",
    example: "US"
  }
];

const sampleRows = [
  {
    sku_code: "STORAGE-BOX-BLACK",
    target_warehouse_code: "WH-FBA-STAGING",
    fba_warehouse_code: "ONT8",
    requested_quantity: "120",
    expected_date: "2026-06-10",
    priority: "normal",
    remark: "按 30 天销量补货",
    amazon_site: "US"
  }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "导入失败，请稍后重试。";
}

function getFieldValue(
  row: BulkImportValidationRow<FbaReplenishmentImportInput>,
  field: CsvTemplateField
) {
  return row.rawRow[field.key] || "-";
}

export function FbaReplenishmentBulkImportPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [previewRows, setPreviewRows] = useState<
    BulkImportValidationRow<FbaReplenishmentImportInput>[]
  >([]);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const fieldLabelByKey = useMemo(
    () =>
      fbaImportFields.reduce<Record<string, string>>((record, field) => {
        record[field.key] = field.label;
        return record;
      }, {}),
    []
  );
  const errorRowCount = previewRows.filter((row) => row.errors.length > 0).length;
  const validRows = previewRows.filter((row) => row.errors.length === 0);
  const canImport =
    previewRows.length > 0 &&
    errorRowCount === 0 &&
    !parsing &&
    !importing &&
    !result;

  const resetImport = () => {
    setFileName("");
    setPreviewRows([]);
    setErrorMessage("");
    setResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
        throw new Error("当前只支持 CSV 文件，请先另存为 .csv 后再导入。");
      }

      const parsed = parseCsv(await file.text());

      if (parsed.rows.length === 0) {
        throw new Error("CSV 里没有可导入的数据行。");
      }

      const missingHeaders = fbaImportFields
        .filter((field) => field.required)
        .filter((field) => !parsed.headers.includes(field.key));

      if (missingHeaders.length > 0) {
        throw new Error(
          `CSV 缺少必填表头：${missingHeaders
            .map((field) => field.key)
            .join("、")}`
        );
      }

      setPreviewRows(await validateFbaReplenishmentImportRows(parsed.rows));
    } catch (error) {
      setPreviewRows([]);
      setErrorMessage(getErrorMessage(error));
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

      const importRows = validRows
        .map((row) => row.data)
        .filter(
          (row): row is FbaReplenishmentImportInput => Boolean(row)
        );

      setResult(await bulkImportFbaReplenishmentRequests(importRows));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="bulkInlineArea">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">批量导入</p>
          <h3>CSV 创建备货需求</h3>
        </div>
        <div className="rowActions">
          <button
            type="button"
            onClick={() =>
              downloadCsvTemplate(
                "fba-replenishment-import-template.csv",
                fbaImportFields,
                sampleRows
              )
            }
          >
            下载模板
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={parsing || importing}
          >
            上传文件
          </button>
        </div>
      </div>

      <p className="bulkDialogDescription">
        支持字段：sku_code、target_warehouse_code、fba_warehouse_code、
        requested_quantity、expected_date、priority、remark、amazon_site。
      </p>

      <div className="bulkUploadBox">
        <input
          ref={fileInputRef}
          className="hiddenFileInput"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => handleFileChange(event.target.files?.[0])}
          disabled={parsing || importing}
        />
        <span>
          {fileName
            ? `已选择：${fileName}`
            : "上传后先预览和校验，确认导入后才写入 Supabase。"}
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
                ? " 请先修改 CSV 后重新上传。"
                : " 可以确认导入。"}
            </p>
          </div>

          <div className="tableWrap bulkPreviewWrap">
            <table className="dataTable bulkPreviewTable">
              <thead>
                <tr>
                  <th>行号</th>
                  {fbaImportFields.map((field) => (
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
                    {fbaImportFields.map((field) => (
                      <td key={field.key}>{getFieldValue(row, field)}</td>
                    ))}
                    <td>
                      {row.errors.length > 0 ? (
                        <div className="bulkErrorList">
                          {row.errors.map((message, index) => (
                            <span key={`${row.rowNumber}-${message}-${index}`}>
                              {message}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="tablePill import-status-ok">通过</span>
                      )}
                      {row.notes?.map((note) => (
                        <p className="tableHint" key={`${row.rowNumber}-${note}`}>
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

      <div className="modalFooter bulkInlineFooter">
        <span>
          {errorRowCount > 0
            ? "有错误时不能确认导入。"
            : "确认导入后才会创建备货需求。"}
        </span>
        <div className="rowActions">
          <button type="button" onClick={resetImport} disabled={importing}>
            重新选择
          </button>
          {result ? (
            <Link className="primaryButton successButton" href="/replenishment">
              去列表页
            </Link>
          ) : (
            <button
              className="primaryButton successButton"
              type="button"
              onClick={submitImport}
              disabled={!canImport}
            >
              {importing ? "正在导入..." : "确认导入"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
