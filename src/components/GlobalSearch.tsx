"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchGlobal, type GlobalSearchResult } from "@/lib/api/global-search";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { SearchIcon } from "@/components/ui/icons";

const resultTypes: Array<GlobalSearchResult["type"]> = [
  "功能",
  "单据",
  "产品/SKU",
  "辅料"
];

export function GlobalSearch() {
  const { user } = useMockRole();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const groupedResults = useMemo(
    () =>
      resultTypes
        .map((type) => ({
          type,
          items: results.filter((item) => item.type === type)
        }))
        .filter((group) => group.items.length > 0),
    [results]
  );

  useEffect(() => {
    const normalizedKeyword = keyword.trim();

    if (!normalizedKeyword) {
      setResults([]);
      setLoading(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setResults(await searchGlobal(normalizedKeyword, user.role));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [keyword, user.role]);

  useEffect(() => {
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <div className="globalSearchWrapper" ref={wrapperRef}>
      <label className="globalSearch">
        <SearchIcon size={18} />
        <input
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="⌘K 搜索单据 / 产品 / SKU / 物料"
        />
      </label>

      {open && keyword.trim() ? (
        <div className="globalSearchPanel">
          {loading ? <div className="globalSearchState">正在搜索...</div> : null}

          {!loading && groupedResults.length === 0 ? (
            <div className="globalSearchState">暂无匹配结果</div>
          ) : null}

          {!loading
            ? groupedResults.map((group) => (
                <section className="globalSearchGroup" key={group.type}>
                  <h4>{group.type}</h4>
                  {group.items.map((item) => (
                    <Link
                      className="globalSearchItem"
                      href={item.href}
                      key={item.id}
                      onClick={() => setOpen(false)}
                    >
                      <strong>{item.title}</strong>
                      <span>{item.description}</span>
                    </Link>
                  ))}
                </section>
              ))
            : null}
        </div>
      ) : null}
    </div>
  );
}
