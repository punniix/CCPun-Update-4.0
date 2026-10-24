import { auth } from "@/auth";
import ProtectedAdminLayout from "../(control-plane)/layout";

// Show the embedded Studio inside the Admin shell for a signed-in Admin user.
// Sanity Dashboard embeds Studio cross-site without the Admin session cookie, so
// that path keeps the bare Studio. Studio's own lane, project/dataset and Sanity
// login guards are unchanged either way (see ./[[...tool]]/page.tsx).
export default async function StudioShellLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.role) return <>{children}</>;
  return <ProtectedAdminLayout>{children}</ProtectedAdminLayout>;
}
