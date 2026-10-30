import V5LegacyBridge from "./V5LegacyBridge";
import V5HealthHappyCountdownLabels from "./V5HealthHappyCountdownLabels";
import styles from "./V5.module.css";

/** Same deadline as components/ui/health-happy/HealthHappyCountdown.tsx (the campaign ends after 30 Nov 2026). */
export const V5_HEALTH_HAPPY_DEADLINE = "2026-11-30T23:59:59+07:00";

/*
  Runs while the HTML is parsed, before the slot paints: once the deadline has passed it marks <html>,
  and CSS removes the whole slot (no reserved space). This works on statically generated or cached
  HTML without a rebuild, and the countdown component itself still returns null after hydration.
*/
export const V5_HEALTH_HAPPY_ENDED_CHECK = `(function(){try{if(Date.now()>=Date.parse(${JSON.stringify(V5_HEALTH_HAPPY_DEADLINE)}))document.documentElement.setAttribute("data-v5-countdown-ended","")}catch(e){}})()`;

/** v5 slot for the Health Happy countdown (home, blog, Health Happy article). */
export default function V5HealthHappyCountdown({ placement, className = "" }: { placement: "home" | "blog" | "article"; className?: string }) {
  return (
    <div className={`${styles.countdownSlot} ${className}`.trim()} data-v5-countdown-slot="">
      <script dangerouslySetInnerHTML={{ __html: V5_HEALTH_HAPPY_ENDED_CHECK }} />
      <V5LegacyBridge><V5HealthHappyCountdownLabels placement={placement} /></V5LegacyBridge>
    </div>
  );
}
