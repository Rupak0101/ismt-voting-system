import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { parse } from "csv-parse/sync";
import { supabase } from "@/lib/supabase";
import { requireAdminRequest } from "@/lib/admin-route-auth";

type CsvUserRow = {
  name: string;
  role: string;
  email: string;
};

type ManualUserPayload = {
  name?: string;
  role?: string;
  email?: string;
};

type UpsertUser = {
  college_id: string;
  name: string;
  role: string;
  email: string;
};

function buildCollegeIdFromEmail(email: string): string {
  return `email:${email}`;
}

async function resolveCollegeIdByEmail(email: string): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("college_id")
    .eq("email", email)
    .order("college_id", { ascending: true })
    .limit(1);

  if (error) throw error;
  return data?.[0]?.college_id ?? buildCollegeIdFromEmail(email);
}

export async function POST(request: NextRequest) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await request.json()) as ManualUserPayload;
      const normalizedName = payload.name?.trim();
      const normalizedRole = payload.role?.trim().toLowerCase();
      const normalizedEmail = payload.email?.trim().toLowerCase();

      if (!normalizedName || !normalizedRole || !normalizedEmail) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      const collegeId = await resolveCollegeIdByEmail(normalizedEmail);
      const { error } = await supabase.from("users").upsert(
        [
          {
            college_id: collegeId,
            name: normalizedName,
            role: normalizedRole,
            email: normalizedEmail,
          },
        ],
        { onConflict: "college_id" }
      );

      if (error) throw error;

      return NextResponse.json({ message: "Voter registered successfully" }, { status: 201 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const fileContent = await file.text();
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvUserRow[];

    const firstInvalidRow = records.findIndex((user) => !user.name || !user.role || !user.email?.trim());
    if (firstInvalidRow !== -1) {
      return NextResponse.json(
        { error: `Invalid CSV row ${firstInvalidRow + 2}. name, role, and email are required.` },
        { status: 400 }
      );
    }

    const dedupedByEmail = new Map<string, Omit<UpsertUser, "college_id">>();
    records.forEach((user) => {
      const normalizedEmail = user.email.trim().toLowerCase();
      dedupedByEmail.set(normalizedEmail, {
        name: user.name.trim(),
        role: user.role.trim().toLowerCase(),
        email: normalizedEmail,
      });
    });

    const users = await Promise.all(
      Array.from(dedupedByEmail.values()).map(async (user): Promise<UpsertUser> => ({
        ...user,
        college_id: await resolveCollegeIdByEmail(user.email),
      }))
    );

    let inserted = 0;
    if (users.length > 0) {
      const { data, error } = await supabase
        .from("users")
        .upsert(users, { onConflict: "college_id" })
        .select("college_id");

      if (error) throw error;
      inserted = data?.length ?? 0;
    }

    return NextResponse.json(
      { message: `Successfully imported ${inserted} users`, totalRead: records.length },
      { status: 200 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to parse or insert CSV" }, { status: 500 });
  }
}
export async function GET(request: NextRequest) {
  try {
    const unauthorizedResponse = requireAdminRequest(request);
    if (unauthorizedResponse) return unauthorizedResponse;

    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
