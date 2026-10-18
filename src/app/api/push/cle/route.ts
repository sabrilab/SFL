// La clé publique VAPID, que le téléphone donne au service de push quand il
// s'abonne aux notifications (lib/sfl/notifications.ts). Publique par nature.

import { NextResponse } from "next/server";
import { cleVapid } from "@/lib/server/web-push";

export const dynamic = "force-dynamic";

export function GET() {
  const cle = cleVapid();
  if (!cle) return NextResponse.json({ error: "Notifications pas encore branchées." }, { status: 503 });
  return NextResponse.json({ cle: cle.publique });
}
