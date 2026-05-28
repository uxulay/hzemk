import { PageHeader } from "@/components/ui/PageHeader";

export default function DataDashboardPage() {
  return (
    <main className="modernPageShell">
      <PageHeader title="数据驾驶舱" />
      <section className="modernCard">
        <div className="emptyState">驾驶舱指标将在下一阶段逐步接入。</div>
      </section>
    </main>
  );
}
