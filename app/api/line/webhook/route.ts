import { createHmac, timingSafeEqual } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

function verifyLineSignature(body: string, signature: string | null, channelSecret: string): boolean {
  if (!signature) return false

  const computed = createHmac('sha256', channelSecret).update(body).digest('base64')
  const signatureBuffer = Buffer.from(signature)
  const computedBuffer = Buffer.from(computed)

  if (signatureBuffer.length !== computedBuffer.length) return false
  return timingSafeEqual(signatureBuffer, computedBuffer)
}

async function sendLineReply(replyToken: string, message: string): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
  if (!token) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured')
  }

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
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

function shouldAutoReply(): boolean {
  return process.env.LINE_WEBHOOK_AUTO_REPLY === 'true'
}

export async function POST(request: NextRequest) {
  try {
    const channelSecret = process.env.LINE_CHANNEL_SECRET
    if (!channelSecret) {
      return NextResponse.json({ message: 'LINE_CHANNEL_SECRET is not configured' }, { status: 500 })
    }

    const signature = request.headers.get('x-line-signature')
    const rawBody = await request.text()

    const isValid = verifyLineSignature(rawBody, signature, channelSecret)
    if (!isValid) {
      return NextResponse.json({ message: 'Invalid signature' }, { status: 401 })
    }

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

    const autoReplyEnabled = shouldAutoReply()

    console.log('[LINE webhook] destination:', body.destination ?? 'unknown')
    console.log('[LINE webhook] auto-reply enabled:', autoReplyEnabled)
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

      // Silent mode is the default so existing LINE OA auto responses are not duplicated.
      if (
        autoReplyEnabled &&
        event.type === 'message' &&
        event.message?.type === 'text' &&
        event.source?.userId &&
        event.replyToken
      ) {
        const userId = event.source.userId
        const bookingUrl = `${process.env.NEXT_PUBLIC_BOOKING_URL || 'https://tail-nail.vercel.app/booking'}?userId=${encodeURIComponent(userId)}`

        try {
          await sendLineReply(
            event.replyToken,
            `Thanks for reaching out! 💅\n\nClick here to book your appointment:\n${bookingUrl}`
          )
          console.log(`[LINE webhook] Sent booking link to userId: ${userId}`)
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
