"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { defaultMockUser } from "@/lib/mock-user";
import { roleLabels, type MockUser, type UserRole } from "@/types/roles";

type MockRoleContextValue = {
  user: MockUser;
  setRole: (role: UserRole) => void;
};

const MockRoleContext = createContext<MockRoleContextValue | null>(null);

const roleOptions = Object.keys(roleLabels) as UserRole[];

export function MockRoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(defaultMockUser.role);

  useEffect(() => {
    const savedRole = window.localStorage.getItem("mock-role") as UserRole | null;
    if (savedRole && roleOptions.includes(savedRole)) {
      setRoleState(savedRole);
    }
  }, []);

  const setRole = (nextRole: UserRole) => {
    setRoleState(nextRole);
    window.localStorage.setItem("mock-role", nextRole);
  };

  const value = useMemo(
    () => ({
      user: { ...defaultMockUser, role },
      setRole
    }),
    [role]
  );

  return (
    <MockRoleContext.Provider value={value}>{children}</MockRoleContext.Provider>
  );
}

export function useMockRole() {
  const context = useContext(MockRoleContext);

  if (!context) {
    throw new Error("useMockRole must be used inside MockRoleProvider");
  }

  return context;
}
