import LifeCoverageWizard from '@/features/financial-health-check/components/LifeCoverageWizard';
import { Website43FinancialHealthCheck } from '@/features/website-43-uat/Website43Tools';

export default function Page() {
  return <Website43FinancialHealthCheck calculator={<LifeCoverageWizard subtleMotion />} />;
}
