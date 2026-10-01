// Public, reviewed, one-transfer pins only. Never place credentials or a private key here.
// Enable only after recipient preparation, then remove this temporary route after acceptance.
export const googleDataMigrationConfig = {
  enabled: false,
  ownerActorSha256: "",
  recipientPublicKeyPem: "",
  recipientFingerprint: "",
  transferId: "",
  expiresAt: 0,
} as const;

export type GoogleDataMigrationConfig = {
  enabled: boolean;
  ownerActorSha256: string;
  recipientPublicKeyPem: string;
  recipientFingerprint: string;
  transferId: string;
  expiresAt: number;
};
