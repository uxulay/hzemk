"use client";

import { useState, type ReactNode } from "react";
import { MockRoleProvider } from "@/components/auth/mock-role-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <MockRoleProvider>
      <div className={sidebarCollapsed ? "appFrame appFrameCollapsed" : "appFrame"}>
        <Sidebar collapsed={sidebarCollapsed} />
        <div className="mainArea">
          <Header
            sidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
          />
          {children}
        </div>
      </div>
    </MockRoleProvider>
  );
}
