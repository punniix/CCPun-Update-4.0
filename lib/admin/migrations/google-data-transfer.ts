if (typeof window !== "undefined") throw new Error("MIGRATION_SERVER_ONLY");

export const MIGRATION_ORIGIN = "https://admin.ccpun.com";
type Variables = Record<string, string | undefined>;
type Identity = { actor: string; role: string; actorType: string; authSource: string } | null;
type RetiredMigrationMetadata = {
  ownerActorSha256: string; exporterSha: string; deploymentHost: string;
  sourceProjectId: string; sourceRef: string;
};

// The retired platform exporter has no native transport or migration authority.
export function migrationOwnerMetadata(_request: Request, _identity: Identity, _variables: Variables): RetiredMigrationMetadata {
  throw new Error("MIGRATION_DENIED");
}
