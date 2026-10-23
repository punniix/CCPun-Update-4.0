import { PUBLIC_COPY_SCOPES, parsePublicCopy, publicCopyDocumentId, publicCopyInitialEntries, type PublicCopyScope } from "../lib/content/public-copy-registry";

// Dry export only. The parent uses the verified UAT connector for any actual mutation.
const requested = process.argv.slice(2);
const scopes = requested.length ? requested : Object.keys(PUBLIC_COPY_SCOPES);
const documents = scopes.map(scope => {
  if (!Object.hasOwn(PUBLIC_COPY_SCOPES, scope)) throw new Error("PUBLIC_COPY_SCOPE_INVALID");
  const knownScope = scope as PublicCopyScope;
  const document = { _id: publicCopyDocumentId(knownScope), _type: "publicPageCopy", scope: knownScope, locale: "th", entries: publicCopyInitialEntries(knownScope) };
  parsePublicCopy(knownScope, document);
  return document;
});
process.stdout.write(JSON.stringify({ projectId: "ccb9lnw5", dataset: "uat", documents }));
