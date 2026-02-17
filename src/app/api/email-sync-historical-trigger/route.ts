/**
 * POST /api/email-sync-historical-trigger
 *
 * Internal proxy for historical processing. Passes CRON_SECRET server-side.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  let body: { offset?: number } = {};
  try {
    body = await req.json();
  } catch {
    // no body
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/email-sync-historical`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cronSecret}`,
      },
      body: JSON.stringify({ offset: body.offset || 0 }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Error triggering historical sync:", err);
    return NextResponse.json({ error: "Failed to trigger historical sync" }, { status: 500 });
  }
}
