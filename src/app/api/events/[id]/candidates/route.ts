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

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const eventId = Number(id);

    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("candidates")
      .select("*")
      .eq("event_id", eventId)
      .order("id", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data ?? []);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch candidates" }, { status: 500 });
  }
}

type UpdateCandidatePayload = {
  name?: string;
  description?: string;
  image_url?: string;
};

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);

    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const searchParams = new URL(request.url).searchParams;
    const candidateId = searchParams.get("candidate_id");

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 });
    }

    const payload = (await request.json()) as UpdateCandidatePayload;
    const updatePayload: Record<string, string | null> = {};

    if (payload.name !== undefined) {
      const name = payload.name.trim();
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      updatePayload.name = name;
    }

    if (payload.description !== undefined) {
      updatePayload.description = payload.description.trim() || null;
    }

    if (payload.image_url !== undefined) {
      updatePayload.image_url = payload.image_url || null;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: "No changes provided" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("candidates")
      .update(updatePayload)
      .eq("id", Number(candidateId))
      .eq("event_id", eventId)
      .select("*")
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    return NextResponse.json(data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update candidate" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { id } = await context.params;
    const eventId = Number(id);

    if (Number.isNaN(eventId)) {
      return NextResponse.json({ error: "Invalid event ID" }, { status: 400 });
    }

    const searchParams = new URL(request.url).searchParams;
    const candidateId = searchParams.get("candidate_id");

    if (!candidateId) {
      return NextResponse.json({ error: "candidate_id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("candidates")
      .delete()
      .eq("id", Number(candidateId))
      .eq("event_id", eventId)
      .select("id")
      .single();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Candidate not found" }, { status: 404 });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete candidate" }, { status: 500 });
  }
}
