import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="loginPage">
      <section className="loginCard">
        <p className="eyebrow">内部系统登录</p>
        <h1>EMK 管理系统</h1>
        <p>
          第一阶段先放登录页面样子。后续接入 Supabase Auth 后，这里会变成真实账号登录。
        </p>

        <form className="formStack">
          <label>
            邮箱
            <input placeholder="demo@company.local" type="email" />
          </label>
          <label>
            密码
            <input placeholder="请输入密码" type="password" />
          </label>
          <Link className="primaryButton" href="/dashboard">
            进入后台
          </Link>
        </form>
      </section>
    </main>
  );
}
