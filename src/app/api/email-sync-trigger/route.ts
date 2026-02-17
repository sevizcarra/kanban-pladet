/**
 * POST /api/email-sync-trigger
 *
 * Internal proxy that triggers email sync without exposing CRON_SECRET to the client.
 * Only accessible to authenticated admin users (checked via session/cookie).
 */

import { NextResponse } from "next/server";

export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  // Call the actual sync endpoint with the secret
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  try {
    const res = await fetch(`${baseUrl}/api/email-sync?secret=${encodeURIComponent(cronSecret)}`, {
      method: "GET",
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("Error triggering sync:", err);
    return NextResponse.json({ error: "Failed to trigger sync" }, { status: 500 });
  }
}
