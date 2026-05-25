"use client";

import { useMemo, useState } from "react";

export type SupplierSearchOption = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  status?: string | null;
};

function getSupplierLabel(supplier: SupplierSearchOption) {
  const statusText = supplier.status === "inactive" ? " / 停用" : "";

  return `${supplier.supplier_code} / ${supplier.name}${statusText}`;
}

type SupplierSearchSelectProps = {
  label: string;
  suppliers: SupplierSearchOption[];
  value: string;
  disabled?: boolean;
  placeholder?: string;
  allowInactiveSelected?: boolean;
  onChange: (supplierId: string) => void;
};

export function SupplierSearchSelect({
  label,
  suppliers,
  value,
  disabled = false,
  placeholder = "搜索供应商编码或名称",
  allowInactiveSelected = true,
  onChange
}: SupplierSearchSelectProps) {
  const [keyword, setKeyword] = useState("");
  const selectedSupplier = suppliers.find((supplier) => supplier.id === value);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const selectableSuppliers = useMemo(() => {
    return suppliers.filter(
      (supplier) =>
        supplier.status === "active" ||
        (allowInactiveSelected && supplier.id === value)
    );
  }, [allowInactiveSelected, suppliers, value]);
  const filteredSuppliers = normalizedKeyword
    ? selectableSuppliers.filter((supplier) =>
        [
          supplier.supplier_code,
          supplier.name,
          supplier.contact_name ?? "",
          supplier.phone ?? ""
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedKeyword)
      )
    : selectableSuppliers.slice(0, 8);

  return (
    <div className="fieldBlock">
      <span>{label}</span>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        disabled={disabled}
        placeholder={
          selectedSupplier ? `当前：${getSupplierLabel(selectedSupplier)}` : placeholder
        }
      />
      {selectedSupplier ? (
        <div className="selectedPickerValue">
          <strong>{getSupplierLabel(selectedSupplier)}</strong>
          <button type="button" onClick={() => onChange("")} disabled={disabled}>
            清除
          </button>
        </div>
      ) : null}
      <div className="searchPickerList">
        {filteredSuppliers.length === 0 ? (
          <p className="tableHint">没有匹配的供应商。</p>
        ) : (
          filteredSuppliers.map((supplier) => (
            <button
              type="button"
              key={supplier.id}
              className={supplier.id === value ? "active" : undefined}
              onClick={() => {
                onChange(supplier.id);
                setKeyword("");
              }}
              disabled={disabled}
            >
              {getSupplierLabel(supplier)}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
