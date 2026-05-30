import { getSupabaseClient } from "@/lib/supabase/client";

function getTodayString() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("");
}

export async function generateSequentialCode(
  tableName: string,
  columnName: string,
  prefix: string,
  offset = 0
): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(tableName)
    .select(columnName)
    .like(columnName, `${prefix}____`);
    
  if (error) {
    throw new Error(`生成单号失败: ${error.message}`);
  }

  const regex = new RegExp(`^${prefix}(\\d{4})$`);
  const maxNumber = (data || []).reduce((max, row) => {
    const val = (row as any)[columnName] as string;
    const match = val.match(regex);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  const nextNumber = maxNumber + 1 + offset;
  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function generateDailySequenceCode(
  tableName: string,
  columnName: string,
  prefix: string,
  offset = 0
): Promise<string> {
  const supabase = getSupabaseClient();
  const dateStr = getTodayString();
  const fullPrefix = `${prefix}${dateStr}-`;
  
  const { data, error } = await supabase
    .from(tableName)
    .select(columnName)
    .like(columnName, `${fullPrefix}____`);
    
  if (error) {
    throw new Error(`生成单号失败: ${error.message}`);
  }

  const regex = new RegExp(`^${fullPrefix}(\\d{4})$`);
  const maxNumber = (data || []).reduce((max, row) => {
    const val = (row as any)[columnName] as string;
    const match = val.match(regex);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  const nextNumber = maxNumber + 1 + offset;
  return `${fullPrefix}${String(nextNumber).padStart(4, "0")}`;
}

export async function generateChildBatchCode(
  tableName: string,
  columnName: string,
  parentCode: string,
  suffixType: string,
  offset = 0
): Promise<string> {
  const supabase = getSupabaseClient();
  const fullPrefix = `${parentCode}-${suffixType}`;
  
  const { data, error } = await supabase
    .from(tableName)
    .select(columnName)
    .like(columnName, `${fullPrefix}__`);
    
  if (error) {
    throw new Error(`生成单号失败: ${error.message}`);
  }

  const regex = new RegExp(`^${fullPrefix}(\\d{2})$`);
  const maxNumber = (data || []).reduce((max, row) => {
    const val = (row as any)[columnName] as string;
    const match = val.match(regex);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  const nextNumber = maxNumber + 1 + offset;
  return `${fullPrefix}${String(nextNumber).padStart(2, "0")}`;
}
