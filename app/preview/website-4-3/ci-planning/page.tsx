import CILandingTracker from '@/features/ci-planning/components/CILandingTracker';
import CIWizard from '@/features/ci-planning/components/CIWizard';
import { CI_FAQS } from '@/features/ci-planning/content';
import { Website43CIPlanning } from '@/features/website-43-uat/Website43Tools';

export default function Page() {
  return <Website43CIPlanning calculator={<CIWizard subtleMotion />} landingTracker={<CILandingTracker />} faqItems={CI_FAQS} />;
}
