import type { ReactNode } from "react";
import { MockRoleProvider } from "@/components/auth/mock-role-provider";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <MockRoleProvider>
      <div className="appFrame">
        <Sidebar />
        <div className="mainArea">
          <Header />
          {children}
        </div>
      </div>
    </MockRoleProvider>
  );
}
