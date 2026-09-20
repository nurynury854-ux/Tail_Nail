export interface BranchLineConfig {
  channelSecret: string
  channelAccessToken: string
  notifyTo?: string
  oaId?: string
}

// Vercel keeps whatever whitespace was pasted; a trailing space or newline on an
// OA id makes the webhook's exact `destination` match fail as "Unknown OA".
function env(name: string): string | undefined {
  const value = process.env[name]?.trim()
  return value ? value : undefined
}

const BRANCH_LINE_CONFIGS: Record<string, BranchLineConfig> = {
  '1': {
    channelSecret: env('LINE_BRANCH_1_CHANNEL_SECRET') ?? '',
    channelAccessToken: env('LINE_BRANCH_1_CHANNEL_ACCESS_TOKEN') ?? '',
    notifyTo: env('LINE_BRANCH_1_NOTIFY_TO'),
    oaId: env('LINE_BRANCH_1_OA_ID'),
  },
  '2': {
    channelSecret: env('LINE_BRANCH_2_CHANNEL_SECRET') ?? '',
    channelAccessToken: env('LINE_BRANCH_2_CHANNEL_ACCESS_TOKEN') ?? '',
    notifyTo: env('LINE_BRANCH_2_NOTIFY_TO'),
    oaId: env('LINE_BRANCH_2_OA_ID'),
  },
  '3': {
    channelSecret: env('LINE_BRANCH_3_CHANNEL_SECRET') ?? '',
    channelAccessToken: env('LINE_BRANCH_3_CHANNEL_ACCESS_TOKEN') ?? '',
    notifyTo: env('LINE_BRANCH_3_NOTIFY_TO'),
    oaId: env('LINE_BRANCH_3_OA_ID'),
  },
  '4': {
    channelSecret: env('LINE_BRANCH_4_CHANNEL_SECRET') ?? '',
    channelAccessToken: env('LINE_BRANCH_4_CHANNEL_ACCESS_TOKEN') ?? '',
    notifyTo: env('LINE_BRANCH_4_NOTIFY_TO'),
    oaId: env('LINE_BRANCH_4_OA_ID'),
  },
  '5': {
    channelSecret: env('LINE_BRANCH_5_CHANNEL_SECRET') ?? '',
    channelAccessToken: env('LINE_BRANCH_5_CHANNEL_ACCESS_TOKEN') ?? '',
    notifyTo: env('LINE_BRANCH_5_NOTIFY_TO'),
    oaId: env('LINE_BRANCH_5_OA_ID'),
  },
}

export function getBranchLineConfig(branchId: string): BranchLineConfig | null {
  const config = BRANCH_LINE_CONFIGS[branchId]
  if (!config || !config.channelAccessToken) return null
  return config
}

// One line per branch for the webhook's "Unknown OA" warning, so the log itself
// shows whether the id is unset, has no token, or simply doesn't match.
export function describeOaConfig(): string {
  return Object.entries(BRANCH_LINE_CONFIGS)
    .map(([branchId, config]) => {
      const id = config.oaId ? `${config.oaId.slice(0, 5)}…${config.oaId.slice(-4)}` : '(OA_ID unset)'
      const token = config.channelAccessToken ? '' : ' (no token)'
      return `branch ${branchId}: ${id}${token}`
    })
    .join(', ')
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
