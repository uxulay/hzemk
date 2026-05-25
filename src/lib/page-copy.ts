export type PageCopy = {
  title: string;
  description: string;
  owner: string;
  nextSteps: string[];
};

export const pageCopy: Record<string, PageCopy> = {
  dashboard: {
    title: "后台首页",
    description: "汇总备货、生产、采购和库存的关键状态。",
    owner: "所有角色",
    nextSteps: ["接入真实登录", "展示待处理备货单", "展示缺料和排产提醒"]
  },
  replenishment: {
    title: "备货需求",
    description: "运营发起和查看内部备货需求，这里不叫销售订单。",
    owner: "运营 / 厂长",
    nextSteps: ["增加筛选", "增加状态流转", "关联 SKU 和目标 FBA 仓"]
  },
  replenishmentNew: {
    title: "创建备货需求",
    description: "运营填写 SKU、数量、目标仓库和期望发货时间。",
    owner: "运营",
    nextSteps: ["设计表单字段", "校验备货数量", "保存到 Supabase"]
  },
  productionPlanning: {
    title: "厂长排产",
    description: "厂长接收备货需求，安排生产日期、产线和负责人。",
    owner: "厂长",
    nextSteps: ["生成生产任务", "检查产能", "查看缺料风险"]
  },
  productionOrders: {
    title: "生产任务",
    description: "跟踪生产任务状态，从待生产到完成入库。",
    owner: "厂长 / 仓库",
    nextSteps: ["生产领料", "记录完工数量", "成品入库"]
  },
  bom: {
    title: "BOM 管理",
    description: "维护每个成品 SKU 对应需要用到的原材料和用量。",
    owner: "管理员 / 厂长",
    nextSteps: ["维护 BOM 版本", "支持半成品", "计算物料需求"]
  },
  materialRequirements: {
    title: "物料需求",
    description: "根据备货数量和 BOM 计算需要多少原材料，并对比库存。",
    owner: "厂长 / 采购 / 仓库",
    nextSteps: ["自动计算缺料", "生成采购建议", "锁定生产用料"]
  },
  purchaseOrders: {
    title: "采购单",
    description: "采购根据缺料需求创建采购单，到货后交给仓库入库。",
    owner: "采购",
    nextSteps: ["供应商资料", "采购状态", "到货入库"]
  },
  inventoryMaterials: {
    title: "原材料库存",
    description: "管理原材料库存、库位、可用数量和安全库存。",
    owner: "仓库",
    nextSteps: ["入库", "出库", "库存预警"]
  },
  inventoryProducts: {
    title: "成品库存",
    description: "管理生产完成后的成品库存，以及准备发往 FBA 的数量。",
    owner: "仓库 / 运营",
    nextSteps: ["成品入库", "FBA 发货出库", "库存占用"]
  },
  inventoryTransactions: {
    title: "出入库记录",
    description: "记录原材料、半成品、成品的每一次库存变化。",
    owner: "仓库",
    nextSteps: ["按 SKU 查询", "按时间导出", "追踪操作人"]
  },
  adminUsers: {
    title: "用户管理",
    description: "管理员维护系统用户和角色权限。",
    owner: "管理员",
    nextSteps: ["接入 Supabase Auth", "角色分配", "账号启停"]
  },
  adminProducts: {
    title: "产品管理",
    description: "维护产品基础资料，给 SKU、BOM 和库存做统一入口。",
    owner: "管理员",
    nextSteps: ["产品分类", "图片资料", "生命周期状态"]
  },
  adminSkus: {
    title: "SKU 管理",
    description: "维护亚马逊 SKU、MSKU、FNSKU 和内部成品编码。",
    owner: "管理员",
    nextSteps: ["关联产品", "关联 FBA 仓", "关联 BOM"]
  }
};
