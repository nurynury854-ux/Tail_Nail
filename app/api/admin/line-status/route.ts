import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { getBranchLineConfig } from '@/lib/lineConfig'
import { BRANCHES } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/admin/line-status — admin only. Full LINE health check per branch.
// Verifies every setting that can silently break booking confirmations:
//   chat_mode        'bot' required. 'chat' => LINE does NOT deliver webhooks.
//   webhook_active   webhook must be enabled, with the right URL.
//   oa_id_matches    LINE_BRANCH_<id>_OA_ID must equal the OA's own userId
//                    (sent as `destination`), or the webhook is ignored.
//   channel_secret_set  wrong/missing => signature check fails (401), no reply.
//   quota/exhausted  push quota; 0 remaining => pushes fail with 429.
// Never returns tokens or secrets.

async function lineGet(path: string, token: string): Promise<Record<string, unknown>> {
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${body}`)
  return JSON.parse(body) as Record<string, unknown>
}

async function safe(path: string, token: string) {
  try {
    return { ok: true as const, data: await lineGet(path, token) }
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const autoReplyEnabled = process.env.LINE_WEBHOOK_AUTO_REPLY === 'true'

  const branches = await Promise.all(
    BRANCHES.map(async (branch) => {
      const config = getBranchLineConfig(branch.id)
      if (!config) {
        return {
          branch_id: branch.id,
          branch: branch.name,
          configured: false,
          problem: `Missing LINE_BRANCH_${branch.id}_CHANNEL_ACCESS_TOKEN`,
        }
      }

      const [info, webhook, quota, consumption] = await Promise.all([
        safe('info', config.channelAccessToken),
        safe('channel/webhook/endpoint', config.channelAccessToken),
        safe('message/quota', config.channelAccessToken),
        safe('message/quota/consumption', config.channelAccessToken),
      ])

      const botUserId = info.ok ? (info.data.userId as string | undefined) : undefined
      const chatMode = info.ok ? (info.data.chatMode as string | undefined) : undefined
      const limited = quota.ok && quota.data.type === 'limited'
      const limit = quota.ok && typeof quota.data.value === 'number' ? quota.data.value : null
      const used = consumption.ok && typeof consumption.data.totalUsage === 'number' ? consumption.data.totalUsage : null

      const problems: string[] = []
      // NOTE: chat_mode only reports whether the OA's manual Chat feature is on.
      // It does NOT disable webhooks — `webhook_active` is the authoritative signal.
      if (webhook.ok && webhook.data.active === false) {
        problems.push('Webhook is DISABLED for this channel — enable "Use webhook" in LINE Developers.')
      }
      if (!webhook.ok) problems.push(`Webhook endpoint not readable (${webhook.error}) — is a webhook URL set?`)
      if (!config.oaId) {
        problems.push(`LINE_BRANCH_${branch.id}_OA_ID is not set — the webhook cannot map this OA to a branch and will ignore it.`)
      } else if (botUserId && config.oaId !== botUserId) {
        problems.push(`LINE_BRANCH_${branch.id}_OA_ID does not match this channel's real OA userId — the webhook will ignore it as "Unknown OA".`)
      }
      if (!config.channelSecret) {
        problems.push(`LINE_BRANCH_${branch.id}_CHANNEL_SECRET is not set — signature check fails (401) and the bot never replies.`)
      }
      if (limited && limit !== null && used !== null && used >= limit) {
        problems.push('Push quota exhausted — pushes fail with 429.')
      }
      if (!info.ok) problems.push(`Token/channel error: ${info.error}`)

      return {
        branch_id: branch.id,
        branch: branch.name,
        configured: true,
        oa_name: info.ok ? info.data.displayName : undefined,
        chat_mode: chatMode, // informational only — does not affect webhook delivery
        webhook_url: webhook.ok ? webhook.data.endpoint : undefined,
        webhook_active: webhook.ok ? webhook.data.active : undefined,
        oa_id_matches: config.oaId && botUserId ? config.oaId === botUserId : false,
        channel_secret_set: Boolean(config.channelSecret),
        quota: limited ? limit : 'unlimited',
        used,
        remaining: limited && limit !== null && used !== null ? limit - used : null,
        healthy: problems.length === 0,
        problems,
      }
    }),
  )

  return NextResponse.json({
    auto_reply_enabled: autoReplyEnabled,
    auto_reply_note: autoReplyEnabled
      ? 'OK — the bot replies with the booking link when a customer sends 快速預約.'
      : 'LINE_WEBHOOK_AUTO_REPLY is not "true" — the bot will NEVER send the booking link, so no booking can carry a userId.',
    expected_webhook_url: 'https://tail-nail.vercel.app/api/line/webhook',
    branches,
  })
}
