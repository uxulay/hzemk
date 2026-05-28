import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EMK 管理系统",
  description: "内部生产与库存管理后台"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
