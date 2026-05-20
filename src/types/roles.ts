export type UserRole =
  | "operations"
  | "plant_manager"
  | "procurement"
  | "warehouse"
  | "admin";

export type MockUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export const roleLabels: Record<UserRole, string> = {
  operations: "运营",
  plant_manager: "厂长",
  procurement: "采购",
  warehouse: "仓库",
  admin: "管理员"
};
