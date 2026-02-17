/**
 * Email Reader — connects to pladet@usach.cl via IMAP (Google Workspace)
 * Reads unread emails and returns structured data for processing.
 */

import { ImapFlow } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";

export interface ParsedEmail {
  uid: number;
  messageId: string;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;        // plain text
  htmlBody: string;    // HTML version
  date: Date;
  attachments: {
    filename: string;
    contentType: string;
    size: number;
  }[];
  inReplyTo?: string;  // for threading
  references?: string[];
}

const IMAP_CONFIG = {
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: process.env.PLADET_EMAIL || "pladet@usach.cl",
    pass: process.env.PLADET_APP_PASSWORD || "",
  },
  logger: false as const,
};

/**
 * Fetch unread emails from the inbox.
 * Marks them as seen after reading.
 */
export async function fetchUnreadEmails(limit = 20): Promise<ParsedEmail[]> {
  if (!IMAP_CONFIG.auth.pass) {
    throw new Error("PLADET_APP_PASSWORD not configured");
  }

  const client = new ImapFlow(IMAP_CONFIG);
  const emails: ParsedEmail[] = [];

  try {
    await client.connect();

    // Open INBOX
    const lock = await client.getMailboxLock("INBOX");

    try {
      // Search for unseen messages
      const uids = await client.search({ seen: false }, { uid: true });

      if (!uids || uids.length === 0) {
        return [];
      }

      // Limit to prevent timeouts
      const uidsToProcess = uids.slice(0, limit);

      for (const uid of uidsToProcess) {
        try {
          const message = await client.fetchOne(String(uid), {
            source: true,
            uid: true,
          });

          if (!message || !("source" in message) || !message.source) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed: ParsedMail = await simpleParser((message as any).source);

          const email: ParsedEmail = {
            uid: message.uid,
            messageId: parsed.messageId || "",
            from: parsed.from?.value?.[0]?.address || "",
            fromName: parsed.from?.value?.[0]?.name || "",
            to: (parsed.to && !Array.isArray(parsed.to)
              ? parsed.to.value
              : Array.isArray(parsed.to)
              ? parsed.to.flatMap((t) => t.value)
              : []
            ).map((v) => v.address || ""),
            cc: (parsed.cc && !Array.isArray(parsed.cc)
              ? parsed.cc.value
              : Array.isArray(parsed.cc)
              ? parsed.cc.flatMap((c) => c.value)
              : []
            ).map((v) => v.address || ""),
            subject: parsed.subject || "(sin asunto)",
            body: parsed.text || "",
            htmlBody: parsed.html || "",
            date: parsed.date || new Date(),
            attachments: (parsed.attachments || []).map((a) => ({
              filename: a.filename || "sin_nombre",
              contentType: a.contentType || "application/octet-stream",
              size: a.size || 0,
            })),
            inReplyTo: parsed.inReplyTo as string | undefined,
            references: parsed.references
              ? Array.isArray(parsed.references)
                ? parsed.references
                : [parsed.references]
              : undefined,
          };

          emails.push(email);

          // Mark as seen
          await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
        } catch (err) {
          console.error(`Error processing email UID ${uid}:`, err);
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();
  } catch (err) {
    console.error("IMAP connection error:", err);
    throw err;
  }

  return emails;
}
