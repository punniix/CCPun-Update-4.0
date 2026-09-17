import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminEnvironment, getEnvironmentLabel } from "@/lib/admin/environment";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role ?? null;

  if (!role) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const environment = getAdminEnvironment();

  return NextResponse.json({
    authenticated: true,
    authSource: "authjs",
    user: {
      email: session?.user?.email ?? null,
      name: session?.user?.name ?? null,
      role,
    },
    environment: {
      id: environment,
      label: getEnvironmentLabel(environment),
    },
  });
}
