// Public, reviewed, one-transfer pins only. Never place credentials or a private key here.
// Enable only after recipient preparation, then remove this temporary route after acceptance.
export const googleDataMigrationConfig = {
  enabled: true,
  ownerActorSha256: "f22598b43b2ff7f6c28eee1b65f413282f3e6a8c0d633fa5d84011013eb80103",
  recipientPublicKeyPem: "-----BEGIN PUBLIC KEY-----\nMIIBojANBgkqhkiG9w0BAQEFAAOCAY8AMIIBigKCAYEAtgINtt6O05w69LKFVNJq\n/7srjQryPuVm2/IbxGniOZsw+Q5g398vYda9YVTZ1R41koezha3DeM5N624JUWpl\n+lKfetuwNZ//SyUrp70LScJeeYQUs5qd+E6kwDLjWXytH4d/410dRiZuZgNPSVqx\nbYMnlvzbTRkpwXhD1PBBGe7wICa5Q9Fkdh4eVoq+7MBlWzB1EWOAivYy0N3p7Ju6\nvne3RFU+yuDFg42IZ9marEixmdpi6EvBIBQWOKK6MbiMH5I1HXWKvBgBT8ftMKMC\nB4+qWg2n4GDk9t5M7iamEbA6H92U6DEcr4n24vtnYfI4cCMSe1tjUBWp4zDVB7Fx\nzNmTWjEXMk3Ezx/yWqWYaBUxQIlvWfXJ5ArHU6wCcj+LzZSs1NzBJqwLzh+fv5nK\nCjSD/e640JIchzttWJBS6vwXtyT8N9YwxVz79sGWICn8e1fcihR0FC/FVxk2w6p0\ntqcigofQs+3Md2w5JlifuHo81qELN3glR9hIVP22K2lVAgMBAAE=\n-----END PUBLIC KEY-----\n",
  recipientFingerprint: "bf9ce0bad31f8d5e64081f48c7550e59340108b92a94608bb0ba75d045be84ef",
  transferId: "674f83b70cea58e5dc3841af5f576d9e",
  expiresAt: 1790850720,
} as const;

export type GoogleDataMigrationConfig = {
  enabled: boolean;
  ownerActorSha256: string;
  recipientPublicKeyPem: string;
  recipientFingerprint: string;
  transferId: string;
  expiresAt: number;
};
