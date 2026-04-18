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
        source?: { type?: string; userId?: string }
        message?: { id?: string; type?: string; text?: string }
      }>
    }

    // For showcase/demo visibility in Vercel logs.
    console.log('[LINE webhook] destination:', body.destination ?? 'unknown')
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
    }

    return NextResponse.json({ message: 'Webhook received' }, { status: 200 })
  } catch (error) {
    console.error('[LINE webhook] error:', error)
    return NextResponse.json({ message: 'Error' }, { status: 500 })
  }
}
