import { ModulePage } from "@/components/pages/module-page";
import { pageCopy } from "@/lib/page-copy";

const metrics = [
  { label: "待接收备货单", value: "8" },
  { label: "待排产任务", value: "5" },
  { label: "缺料预警", value: "3" },
  { label: "待发 FBA", value: "12" }
];

const flow = [
  ["运营", "创建 FBA 备货需求"],
  ["厂长", "接收需求并排产"],
  ["系统", "按 BOM 计算物料需求"],
  ["采购", "补充缺料并到货入库"],
  ["仓库", "生产扣料、成品入库、FBA 出库"]
];

export default function DashboardPage() {
  return (
    <>
      <ModulePage page={pageCopy.dashboard} />
      <section className="pageShell" style={{ paddingTop: 0 }}>
        <div className="metricGrid">
          {metrics.map((metric) => (
            <article className="metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value}</strong>
            </article>
          ))}
        </div>

        <div className="contentGrid">
          <article className="panel">
            <h3>核心流程</h3>
            <ul className="flowList">
              {flow.map(([role, action]) => (
                <li key={action}>
                  {action}
                  <span>{role}</span>
                </li>
              ))}
            </ul>
          </article>
          <article className="panel">
            <h3>第一阶段边界</h3>
            <p>
              现在只完成页面骨架、菜单、角色预留和 mock 数据入口。
              真正的数据库表、审批流、库存扣减和采购生成逻辑，后面分阶段做。
            </p>
          </article>
        </div>
      </section>
    </>
  );
}
