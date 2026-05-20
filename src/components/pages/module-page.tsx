import type { PageCopy } from "@/lib/page-copy";

type ModulePageProps = {
  page: PageCopy;
};

export function ModulePage({ page }: ModulePageProps) {
  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">负责人：{page.owner}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>
        <span className="statusPill">预留页面</span>
      </section>

      <section className="contentGrid">
        <article className="panel">
          <h3>这个页面第一阶段做什么</h3>
          <p>
            现在先把入口、名称和职责放准，方便后面一页一页补业务功能。
            这里会先使用 mock 数据，不会直接写复杂后端逻辑。
          </p>
        </article>

        <article className="panel">
          <h3>后续开发顺序</h3>
          <ul className="checkList">
            {page.nextSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
