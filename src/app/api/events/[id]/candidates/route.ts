import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminRequest } from "@/lib/admin-route-auth";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);
    const { name, description, image_url } = (await request.json()) as {
      name?: string;
      description?: string;
      image_url?: string;
    };

    if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (Number.isNaN(eventId)) return NextResponse.json({ error: "Failed to add candidate" }, { status: 500 });

    const { data, error } = await supabase
      .from("candidates")
      .insert([{ event_id: eventId, name, description: description ?? null, image_url: image_url ?? null }])
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to add candidate" }, { status: 500 });
  }
}
