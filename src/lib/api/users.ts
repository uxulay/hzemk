import { getSupabaseClient } from "@/lib/supabase/client";

export type UserStatus = "active" | "disabled";

export type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProfileRow = {
  id: string;
  role_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type UserListRow = UserProfileRow & {
  role: RoleRow | null;
};

export type UserStats = {
  totalUsers: number;
  adminUsers: number;
  operatorUsers: number;
  factoryManagerUsers: number;
  purchaserUsers: number;
  warehouseUsers: number;
};

export type UserPageFilters = {
  roleId?: string;
  status?: string;
};

export type UserPageResult = {
  rows: UserListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateUserProfileInput = {
  authUserId: string;
  fullName: string;
  email: string;
  roleId: string;
  phone?: string;
  status: UserStatus;
};

export type UpdateUserProfileInput = {
  profileId: string;
  fullName: string;
  email: string;
  roleId: string;
  phone?: string;
  status: UserStatus;
};

type MaybeRelation<T> = T | T[] | null;

type RawUserListRow = Omit<UserListRow, "role"> & {
  role: MaybeRelation<RoleRow>;
};

const roleCodeGroups = {
  admin: ["admin"],
  operator: ["operator", "operations"],
  factoryManager: ["factory_manager", "plant_manager"],
  purchaser: ["purchaser", "procurement"],
  warehouse: ["warehouse"]
};

function formatSupabaseError(action: string, error: { message: string }) {
  if (error.message.includes("profiles_id_fkey")) {
    return new Error(
      `${action}失败：这个用户 ID 在 Supabase Auth 里不存在。当前页面不创建登录账号，请先使用已存在的 Auth 用户 ID。`
    );
  }

  return new Error(`${action}失败：${error.message}`);
}

async function withTimeout<T>(promise: PromiseLike<T>, action: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`${action}超时：请检查 Supabase 地址、anon key、网络和 RLS 策略。`)
      );
    }, 10000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function singleRelation<T>(value: MaybeRelation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function assertUserStatus(status: string): asserts status is UserStatus {
  if (!["active", "disabled"].includes(status)) {
    throw new Error("用户状态只能是 active 或 disabled。");
  }
}

function assertUuid(value: string, label: string) {
  const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidPattern.test(value)) {
    throw new Error(`${label}必须是标准 UUID。`);
  }
}

function assertEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("请填写正确的邮箱格式。");
  }
}

function normalizeUserListRow(row: RawUserListRow): UserListRow {
  return {
    ...row,
    role: singleRelation(row.role)
  };
}

function countByRoleCode(users: UserListRow[], roleCodes: string[]) {
  return users.filter((user) =>
    user.role?.code ? roleCodes.includes(user.role.code) : false
  ).length;
}

async function ensureRoleExists(roleId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("roles").select("id").eq("id", roleId).maybeSingle(),
    "检查角色是否存在"
  );

  if (error) {
    throw formatSupabaseError("检查角色是否存在", error);
  }

  if (!data) {
    throw new Error("请选择有效角色。");
  }
}

async function ensureProfileIdIsUnique(profileId: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("profiles").select("id").eq("id", profileId).maybeSingle(),
    "检查用户资料是否已存在"
  );

  if (error) {
    throw formatSupabaseError("检查用户资料是否已存在", error);
  }

  if (data) {
    throw new Error("这个用户 ID 已经有用户资料，请改为编辑。");
  }
}

async function ensureEmailIsUnique(email: string, excludeProfileId?: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("profiles").select("id").eq("email", email).maybeSingle(),
    "检查邮箱是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查邮箱是否重复", error);
  }

  if (data && data.id !== excludeProfileId) {
    throw new Error("邮箱已经存在，请换一个邮箱。");
  }
}

export async function getRoles(): Promise<RoleRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("roles").select("*").order("code", { ascending: true }),
    "读取角色列表"
  );

  if (error) {
    throw formatSupabaseError("读取角色列表", error);
  }

  return (data ?? []) as RoleRow[];
}

export async function getUsers(): Promise<UserListRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .select(
        `
          id,
          role_id,
          full_name,
          email,
          phone,
          status,
          created_at,
          updated_at,
          role:roles!profiles_role_id_fkey (
            id,
            code,
            name,
            description,
            created_at,
            updated_at
          )
        `
      )
      .order("created_at", { ascending: false }),
    "读取用户列表"
  );

  if (error) {
    throw formatSupabaseError("读取用户列表", error);
  }

  return ((data ?? []) as unknown as RawUserListRow[]).map(normalizeUserListRow);
}

export async function getUsersPage(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  filters?: UserPageFilters;
} = {}): Promise<UserPageResult> {
  const supabase = getSupabaseClient();
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const keyword = params.keyword?.trim() ?? "";
  const roleId = params.filters?.roleId;
  const status = params.filters?.status;
  let query = supabase
    .from("profiles")
    .select(
      `
        id,
        role_id,
        full_name,
        email,
        phone,
        status,
        created_at,
        updated_at,
        role:roles!profiles_role_id_fkey (
          id,
          code,
          name,
          description,
          created_at,
          updated_at
        )
      `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  if (keyword) {
    const escapedKeyword = keyword.replace(/[%_,]/g, " ").trim();
    query = query.or(
      `full_name.ilike.%${escapedKeyword}%,email.ilike.%${escapedKeyword}%`
    );
  }

  if (roleId && roleId !== "all") {
    query = query.eq("role_id", roleId);
  }

  if (status && status !== "all") {
    query =
      status === "disabled"
        ? query.in("status", ["disabled", "inactive"])
        : query.eq("status", status);
  }

  const { data, error, count } = await withTimeout(query, "分页读取用户列表");

  if (error) {
    throw formatSupabaseError("分页读取用户列表", error);
  }

  const total = count ?? 0;

  return {
    rows: ((data ?? []) as unknown as RawUserListRow[]).map(normalizeUserListRow),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function getUserStats(): Promise<UserStats> {
  const supabase = getSupabaseClient();
  const [roles, profilesResult] = await Promise.all([
    getRoles(),
    withTimeout(
      supabase.from("profiles").select("id, role_id, status"),
      "统计用户数量"
    )
  ]);

  if (profilesResult.error) {
    throw formatSupabaseError("统计用户数量", profilesResult.error);
  }

  const roleById = new Map(roles.map((role) => [role.id, role]));
  const users = ((profilesResult.data ?? []) as Array<{
    id: string;
    role_id: string | null;
    status: string;
  }>).map((profile) => ({
    ...profile,
    role: profile.role_id ? roleById.get(profile.role_id) ?? null : null
  })) as UserListRow[];

  return {
    totalUsers: users.length,
    adminUsers: countByRoleCode(users, roleCodeGroups.admin),
    operatorUsers: countByRoleCode(users, roleCodeGroups.operator),
    factoryManagerUsers: countByRoleCode(users, roleCodeGroups.factoryManager),
    purchaserUsers: countByRoleCode(users, roleCodeGroups.purchaser),
    warehouseUsers: countByRoleCode(users, roleCodeGroups.warehouse)
  };
}

export async function createUserProfile(
  input: CreateUserProfileInput
): Promise<UserProfileRow> {
  const authUserId = input.authUserId.trim();
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  const roleId = input.roleId.trim();

  if (!authUserId) {
    throw new Error("请填写 Supabase Auth 用户 ID。");
  }

  assertUuid(authUserId, "Supabase Auth 用户 ID");

  if (!fullName) {
    throw new Error("请填写用户名称。");
  }

  if (!email) {
    throw new Error("请填写邮箱。");
  }

  assertEmail(email);

  if (!roleId) {
    throw new Error("请选择角色。");
  }

  assertUuid(roleId, "角色 ID");
  assertUserStatus(input.status);
  await Promise.all([
    ensureRoleExists(roleId),
    ensureProfileIdIsUnique(authUserId),
    ensureEmailIsUnique(email)
  ]);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .insert({
        id: authUserId,
        role_id: roleId,
        full_name: fullName,
        email,
        phone: normalizeOptionalText(input.phone),
        status: input.status
      })
      .select("*")
      .single(),
    "新增用户资料"
  );

  if (error) {
    throw formatSupabaseError("新增用户资料", error);
  }

  return data as UserProfileRow;
}

export async function updateUserProfile(
  input: UpdateUserProfileInput
): Promise<void> {
  const profileId = input.profileId.trim();
  const fullName = input.fullName.trim();
  const email = normalizeEmail(input.email);
  const roleId = input.roleId.trim();

  if (!profileId) {
    throw new Error("缺少用户 ID。");
  }

  assertUuid(profileId, "用户 ID");

  if (!fullName) {
    throw new Error("请填写用户名称。");
  }

  if (!email) {
    throw new Error("请填写邮箱。");
  }

  assertEmail(email);

  if (!roleId) {
    throw new Error("请选择角色。");
  }

  assertUuid(roleId, "角色 ID");
  assertUserStatus(input.status);
  await Promise.all([
    ensureRoleExists(roleId),
    ensureEmailIsUnique(email, profileId)
  ]);

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("profiles")
      .update({
        role_id: roleId,
        full_name: fullName,
        email,
        phone: normalizeOptionalText(input.phone),
        status: input.status
      })
      .eq("id", profileId),
    "编辑用户资料"
  );

  if (error) {
    throw formatSupabaseError("编辑用户资料", error);
  }
}

export async function toggleUserStatus(
  profileId: string,
  currentStatus: string
): Promise<UserStatus> {
  if (!profileId) {
    throw new Error("缺少用户 ID。");
  }

  assertUuid(profileId, "用户 ID");

  const nextStatus: UserStatus =
    currentStatus === "active" ? "disabled" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("profiles").update({ status: nextStatus }).eq("id", profileId),
    "启用或停用用户"
  );

  if (error) {
    throw formatSupabaseError("启用或停用用户", error);
  }

  return nextStatus;
}
