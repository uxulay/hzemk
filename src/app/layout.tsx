import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FBA 备货生产管理系统",
  description: "内部使用的跨境电商工贸一体 FBA 备货生产管理系统"
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
