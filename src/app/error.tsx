"use client";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="errorPage">
      <section className="errorPanel">
        <p className="eyebrow">页面出错</p>
        <h1>这个页面暂时没有正常打开</h1>
        <p>{error.message || "发生了未知错误，请稍后重试。"}</p>
        <button className="primaryButton" type="button" onClick={reset}>
          重新加载
        </button>
      </section>
    </main>
  );
}
