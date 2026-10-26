export const AFPT_CREDENTIAL = Object.freeze({
  name: "AFPT™",
  issuer: "TFPA",
  number: "AFPT260195",
  issuedOn: "2026-09-22",
  expiresOn: "2028-12-31",
  reminderDays: 90,
});

const bangkokDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit",
});

/** Calendar days in Bangkok: the credential remains valid throughout its expiry date. */
export function getAfptRenewalReminder(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new RangeError("Invalid reminder date");
  const parts = Object.fromEntries(bangkokDate.formatToParts(now).map(({ type, value }) => [type, value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const expiry = Date.parse(`${AFPT_CREDENTIAL.expiresOn}T00:00:00Z`);
  const daysRemaining = (expiry - today) / 86_400_000;
  return daysRemaining > AFPT_CREDENTIAL.reminderDays ? null : { daysRemaining, expired: daysRemaining < 0 };
}
