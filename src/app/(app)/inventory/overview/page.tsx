"use client";

import { useState } from "react";
import { CurrentInventoryPage } from "../_components/current-inventory-page";

type InventoryOverviewTab = "all" | "materials" | "products";

const tabs: Array<{
  value: InventoryOverviewTab;
  label: string;
}> = [
  { value: "all", label: "全部" },
  { value: "materials", label: "原材料" },
  { value: "products", label: "成品" }
];

export default function InventoryOverviewPage() {
  const [activeTab, setActiveTab] = useState<InventoryOverviewTab>("all");

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">仓库管理</p>
          <h2>库存总览</h2>
          <p>从一个入口查看原材料和成品当前库存，并快速进入流水、调整、其他入库和其他出库。</p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="listPanel">
        <div className="tabBar" role="tablist" aria-label="库存总览类型">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab.value ? "tabButton active" : "tabButton"}
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "all" || activeTab === "materials" ? (
        <CurrentInventoryPage embedded mode="materials" />
      ) : null}

      {activeTab === "all" || activeTab === "products" ? (
        <CurrentInventoryPage embedded mode="products" />
      ) : null}
    </main>
  );
}
