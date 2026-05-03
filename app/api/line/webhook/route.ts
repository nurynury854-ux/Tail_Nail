import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getLineConfigByOaId } from '@/lib/lineConfig'

function verifyLineSignature(body: string, signature: string | null, channelSecret: string): boolean {
  if (!signature) return false

  const computed = createHmac('sha256', channelSecret).update(body).digest('base64')
  const signatureBuffer = Buffer.from(signature)
  const computedBuffer = Buffer.from(computed)

  if (signatureBuffer.length !== computedBuffer.length) return false
  return timingSafeEqual(signatureBuffer, computedBuffer)
}

async function sendLineReply(replyToken: string, message: string, accessToken: string): Promise<void> {
  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text: message }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`LINE reply failed (${response.status}): ${errorBody}`)
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-line-signature')
    const rawBody = await request.text()

    // Parse body first to read `destination` (OA's own userId), then verify with the matching branch secret
    const body = JSON.parse(rawBody) as {
      destination?: string
      events?: Array<{
        type?: string
        mode?: string
        timestamp?: number
        replyToken?: string
        source?: { type?: string; userId?: string }
        message?: { id?: string; type?: string; text?: string }
      }>
    }

    const destination = body.destination ?? ''
    const branchMatch = getLineConfigByOaId(destination)

    if (!branchMatch) {
      console.warn(`[LINE webhook] Unknown OA destination: ${destination} — no matching branch config`)
      // Return 200 so LINE doesn't keep retrying; we just don't process it
      return NextResponse.json({ message: 'Unknown OA' }, { status: 200 })
    }

    const { config, branchId } = branchMatch

    if (!config.channelSecret) {
      return NextResponse.json({ message: 'Channel secret not configured for this branch' }, { status: 500 })
    }

    const isValid = verifyLineSignature(rawBody, signature, config.channelSecret)
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 })
    }

    console.log(`[LINE webhook] branch: ${branchId}, destination: ${destination}`)
    for (const event of body.events ?? []) {
      console.log('[LINE webhook] event:', {
        type: event.type,
        mode: event.mode,
        timestamp: event.timestamp,
        sourceType: event.source?.type,
        userId: event.source?.userId,
        messageType: event.message?.type,
        text: event.message?.text,
      })

      if (
        event.type === 'message' &&
        event.message?.type === 'text' &&
        event.message.text === '快速預約' &&
        event.source?.userId &&
        event.replyToken
      ) {
        const userId = event.source.userId
        const bookingUrl = `${process.env.NEXT_PUBLIC_BOOKING_URL || 'https://tail-nail.vercel.app/booking'}?userId=${encodeURIComponent(userId)}`

        try {
          await sendLineReply(
            event.replyToken,
            `測試勿點\n${bookingUrl}`,
            config.channelAccessToken
          )
          console.log(`[LINE webhook] Sent booking link to userId: ${userId} (branch ${branchId})`)
        } catch (replyError) {
          console.error('[LINE webhook] Failed to send reply:', replyError)
        }
      }
    }

    return NextResponse.json({ message: 'Webhook received' }, { status: 200 })
  } catch (error) {
    console.error('[LINE webhook] error:', error)
    return NextResponse.json({ message: 'Error' }, { status: 500 })
  }
}
