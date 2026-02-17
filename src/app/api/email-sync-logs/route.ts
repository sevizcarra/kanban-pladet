import { NextResponse } from "next/server";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";

export async function GET() {
  try {
    const q = query(
      collection(db, "email-sync-log"),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    return NextResponse.json(logs);
  } catch (err) {
    return NextResponse.json({ error: "Error fetching logs" }, { status: 500 });
  }
}
