import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest } from '@/lib/adminAuth'
import { getBranchLineConfig } from '@/lib/lineConfig'
import { BRANCHES } from '@/lib/types'

export const runtime = 'nodejs'

// GET /api/admin/line-status — admin only.
// Diagnoses why LINE confirmations aren't arriving, per branch:
//   quota      — the monthly push allowance ('none' = unlimited, 'limited' = capped)
//   used       — how many push messages have been consumed this month
//   remaining  — quota - used  (0 means pushes now fail with HTTP 429)
//   error      — 401 invalid/expired token, 403 plan issue, etc.
// Never returns the token itself.
async function lineGet(path: string, token: string) {
  const res = await fetch(`https://api.line.me/v2/bot/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`${res.status}: ${body}`)
  return JSON.parse(body) as Record<string, unknown>
}

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = await Promise.all(
    BRANCHES.map(async (branch) => {
      const config = getBranchLineConfig(branch.id)
      if (!config) {
        return {
          branch_id: branch.id,
          branch: branch.name,
          configured: false,
          hint: `Missing LINE_BRANCH_${branch.id}_CHANNEL_ACCESS_TOKEN`,
        }
      }

      try {
        const [quota, consumption] = await Promise.all([
          lineGet('message/quota', config.channelAccessToken),
          lineGet('message/quota/consumption', config.channelAccessToken),
        ])
        const limited = quota.type === 'limited'
        const limit = typeof quota.value === 'number' ? quota.value : null
        const used = typeof consumption.totalUsage === 'number' ? consumption.totalUsage : null

        return {
          branch_id: branch.id,
          branch: branch.name,
          configured: true,
          token_valid: true,
          quota: limited ? limit : 'unlimited',
          used,
          remaining: limited && limit !== null && used !== null ? limit - used : null,
          exhausted: limited && limit !== null && used !== null ? used >= limit : false,
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        return {
          branch_id: branch.id,
          branch: branch.name,
          configured: true,
          token_valid: !message.startsWith('401'),
          error: message,
          hint: message.startsWith('401')
            ? 'Channel access token is invalid or expired — reissue it in the LINE Developers console.'
            : message.startsWith('403')
              ? 'Plan/permission issue — the OA may not be allowed to send push messages.'
              : undefined,
        }
      }
    }),
  )

  return NextResponse.json(results)
}
