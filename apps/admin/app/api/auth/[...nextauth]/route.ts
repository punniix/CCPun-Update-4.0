import type { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { observeAdminAuthHandler } from "@/lib/admin/auth-route-observer";

export async function GET(request: NextRequest) {
  return observeAdminAuthHandler(request, (input) => handlers.GET(input));
}

export async function POST(request: NextRequest) {
  return observeAdminAuthHandler(request, (input) => handlers.POST(input));
}
