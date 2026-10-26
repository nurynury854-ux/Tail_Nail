import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// GET /api/analytics/openapi — OpenAPI schema for the analytics API, for
// "Import from URL" in a ChatGPT Custom GPT Action. Public: it describes the
// API but contains no data. The server URL follows whichever host served it.
export async function GET(request: NextRequest) {
  const origin = new URL(request.url).origin

  return NextResponse.json({
    openapi: '3.1.0',
    info: {
      title: 'Tail & Nail Business Analytics',
      version: '1.0.0',
      description:
        'Read-only business summary for Tail & Nail nail salons (Taiwan, TWD). Revenue, orders, branches, technicians, services, customers (new vs returning) and online bookings for a date range. Contains no customer personal data.',
    },
    servers: [{ url: origin }],
    paths: {
      '/api/analytics/summary': {
        get: {
          operationId: 'getBusinessSummary',
          summary: 'Business summary for a date range',
          description:
            'Returns totals and breakdowns for confirmed orders and online bookings between from and to (inclusive, salon business days, Asia/Taipei). Defaults to the current month. Max 366 days per call; to compare periods (e.g. this month vs last month, or year over year), call once per period.',
          parameters: [
            {
              name: 'from',
              in: 'query',
              required: false,
              description: 'First business day, YYYY-MM-DD (inclusive). Defaults to the first day of the current month.',
              schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            },
            {
              name: 'to',
              in: 'query',
              required: false,
              description: 'Last business day, YYYY-MM-DD (inclusive). Defaults to the last day of the current month.',
              schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            },
          ],
          responses: {
            '200': {
              description:
                'Summary. See the notes array in the response for how each figure is defined. Sections: totals, pendingOrders, paymentMethods, discountUsage, orderSource, customers, byBranch, byStylist (technicians), byService, byDay, byWeekday, bookings, tillReconciliation.',
              content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
            },
            '400': { description: 'Bad date range' },
            '401': { description: 'Missing or wrong API key' },
          },
        },
      },
    },
    components: {
      schemas: {},
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
    },
    security: [{ bearerAuth: [] }],
  })
}
