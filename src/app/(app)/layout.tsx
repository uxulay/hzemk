"use client";

import { useState, type ReactNode, Suspense } from "react";
import { MockRoleProvider } from "@/components/auth/mock-role-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <MockRoleProvider>
      <div className={sidebarCollapsed ? "appFrame appFrameCollapsed" : "appFrame"}>
        <div className="desktopSidebar">
          <Suspense fallback={null}>
            <Sidebar collapsed={sidebarCollapsed} />
          </Suspense>
        </div>
        <div className="mainArea">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onOpenMobileSidebar={() => setMobileSidebarOpen(true)}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
          {children}
        </div>
      </div>
      <div
        className="mobileSidebarLayer"
        data-open={mobileSidebarOpen ? "true" : "false"}
        aria-hidden={!mobileSidebarOpen}
      >
        <button
          className="mobileSidebarBackdrop"
          type="button"
          aria-label="关闭菜单"
          onClick={() => setMobileSidebarOpen(false)}
        />
        <div className="mobileSidebarPanel">
          <Suspense fallback={null}>
            <Sidebar onNavigate={() => setMobileSidebarOpen(false)} />
          </Suspense>
        </div>
      </div>
    </MockRoleProvider>
  );
}
