"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <main className="errorPage">
          <section className="errorPanel">
            <p className="eyebrow">系统出错</p>
            <h1>页面加载失败</h1>
            <p>{error.message || "发生了未知错误，请稍后重试。"}</p>
            <button className="primaryButton" type="button" onClick={reset}>
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
