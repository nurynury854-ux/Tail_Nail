export interface BranchLineConfig {
  channelSecret: string
  channelAccessToken: string
  notifyTo?: string
  oaId?: string
}

const BRANCH_LINE_CONFIGS: Record<string, BranchLineConfig> = {
  '1': {
    channelSecret: process.env.LINE_BRANCH_1_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_BRANCH_1_CHANNEL_ACCESS_TOKEN ?? '',
    notifyTo: process.env.LINE_BRANCH_1_NOTIFY_TO,
    oaId: process.env.LINE_BRANCH_1_OA_ID,
  },
  '2': {
    channelSecret: process.env.LINE_BRANCH_2_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_BRANCH_2_CHANNEL_ACCESS_TOKEN ?? '',
    notifyTo: process.env.LINE_BRANCH_2_NOTIFY_TO,
    oaId: process.env.LINE_BRANCH_2_OA_ID,
  },
  '3': {
    channelSecret: process.env.LINE_BRANCH_3_CHANNEL_SECRET ?? '',
    channelAccessToken: process.env.LINE_BRANCH_3_CHANNEL_ACCESS_TOKEN ?? '',
    notifyTo: process.env.LINE_BRANCH_3_NOTIFY_TO,
    oaId: process.env.LINE_BRANCH_3_OA_ID,
  },
}

export function getBranchLineConfig(branchId: string): BranchLineConfig | null {
  const config = BRANCH_LINE_CONFIGS[branchId]
  if (!config || !config.channelAccessToken) return null
  return config
}

// Used by the webhook route: maps the OA's own userId (destination) → branch config
export function getLineConfigByOaId(oaId: string): { config: BranchLineConfig; branchId: string } | null {
  for (const [branchId, config] of Object.entries(BRANCH_LINE_CONFIGS)) {
    if (config.oaId && config.oaId === oaId && config.channelAccessToken) {
      return { config, branchId }
    }
  }
  return null
}
