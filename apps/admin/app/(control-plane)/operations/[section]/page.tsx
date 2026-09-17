import { notFound } from "next/navigation";
import AdminDeploymentsPage from "@/features/admin/operations/DeploymentsPage";
import AdminJobsPage from "@/features/admin/operations/JobsPage";

export default async function OperationsSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "deployments") return <AdminDeploymentsPage />;
  if (section === "jobs") return <AdminJobsPage />;
  notFound();
}
