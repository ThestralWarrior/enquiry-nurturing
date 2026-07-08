import { NextResponse } from "next/server";
import { listLeads, createLead } from "@/lib/store";
import { normalizePhone } from "@/lib/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const leads = await listLeads();
  return NextResponse.json(
    { leads },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const rawPhone = typeof body.phone === "string" ? body.phone : "";
  const phone = normalizePhone(rawPhone);
  const initialMessage =
    typeof body.initialMessage === "string" ? body.initialMessage.trim() : "";

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter the client's name." },
      { status: 400 },
    );
  }
  if (phone.length !== 10) {
    return NextResponse.json(
      { error: "Please enter a valid 10-digit mobile number." },
      { status: 400 },
    );
  }
  if (!initialMessage) {
    return NextResponse.json(
      { error: "Please tell us what you're looking for." },
      { status: 400 },
    );
  }

  const lead = await createLead({
    name,
    phone,
    email: typeof body.email === "string" ? body.email : null,
    source: typeof body.source === "string" ? body.source : "Website",
    locality: typeof body.locality === "string" ? body.locality : null,
    budget: typeof body.budget === "string" ? body.budget : null,
    initialMessage,
  });

  return NextResponse.json({ lead }, { status: 201 });
}
