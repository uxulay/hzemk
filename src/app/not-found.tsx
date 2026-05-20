import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="errorPage">
      <section className="errorPanel">
        <p className="eyebrow">404</p>
        <h1>页面不存在</h1>
        <p>你访问的页面没有找到，可能是地址写错了。</p>
        <Link className="primaryButton" href="/dashboard">
          返回后台首页
        </Link>
      </section>
    </main>
  );
}
