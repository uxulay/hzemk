import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";

const logoUrl =
  "https://wrxqiaphfxihjclqnged.supabase.co/storage/v1/object/public/public-assets/emk_logo.png";

const settingGroups = [
  {
    title: "基础设置",
    items: ["系统名称：FBA 备货生产管理系统", "默认语言：中文", "默认时区：Asia/Shanghai"]
  },
  {
    title: "单据编号规则",
    items: ["采购单：PUR-YYYYMMDD-####", "生产任务：PO-YYYYMMDD-随机码", "库存流水：系统自动生成"]
  },
  {
    title: "库存预警规则",
    items: ["可用库存 = 当前库存 - 占用库存", "低库存按安全库存判断", "缺少库存记录时按 0 库存显示"]
  },
  {
    title: "导入导出设置",
    items: ["CSV 上传先预览", "错误行会阻止写入", "导入模板保留中文字段"]
  }
];

export default function AdminSettingsPage() {
  return (
    <main className="pageShell modernPageShell">
      <PageHeader eyebrow="系统管理" title="系统设置" />

      <div className="warningNotice">
        <strong>当前设置页只做展示占位。</strong>
        <p>本阶段不写数据库，也不会假装保存成功。等后续有真实设置表或接口后再接保存逻辑。</p>
      </div>

      <section className="modernCard">
        <div className="modernCardHeader">
          <div>
            <p className="eyebrow">Logo / 品牌设置</p>
            <h3>当前品牌</h3>
          </div>
          <StatusBadge status="active" label="展示中" />
        </div>
        <div className="settingsBrandPreview">
          <img src={logoUrl} alt="EMK Logo" />
          <div>
            <strong>EMK</strong>
            <span>Logo 继续使用当前 Supabase Storage 图片地址。</span>
          </div>
        </div>
      </section>

      <section className="settingsGrid">
        {settingGroups.map((group) => (
          <div className="modernCard settingsCard" key={group.title}>
            <div className="modernCardHeader">
              <div>
                <p className="eyebrow">系统设置</p>
                <h3>{group.title}</h3>
              </div>
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="modalFooter settingsFooter">
              <button className="secondaryButton" type="button" disabled>
                暂不支持保存
              </button>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
