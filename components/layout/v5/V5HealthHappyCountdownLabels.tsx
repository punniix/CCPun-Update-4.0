"use client";

import HealthHappyCountdown from "@/components/ui/health-happy/HealthHappyCountdown";
import { PublicCopyProvider, usePublicCopy } from "@/components/ui/PublicCopyProvider";

/**
 * v5 placement of the shared Health Happy countdown (owner-approved 2026-10-25, audit #4).
 * The countdown, its deadline and its analytics stay single-owner; v5 only feeds it the Thai
 * unit labels (วัน / ชั่วโมง / นาที / วินาที, same meaning as DAYS / HOURS / MINUTES / SECONDS)
 * from their own editable site-copy keys.
 */
export default function V5HealthHappyCountdownLabels({ placement }: { placement: "home" | "blog" | "article" }) {
  const text = usePublicCopy();
  return (
    <PublicCopyProvider values={{
      "site.campaign.days": text("site.campaign.unitDays"),
      "site.campaign.hours": text("site.campaign.unitHours"),
      "site.campaign.minutes": text("site.campaign.unitMinutes"),
      "site.campaign.seconds": text("site.campaign.unitSeconds"),
    }}>
      <HealthHappyCountdown placement={placement} splitDigits />
    </PublicCopyProvider>
  );
}
