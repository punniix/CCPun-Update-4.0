import type { DocumentActionComponent } from "sanity";
import { isStudioDataPlaneAllowed, type AdminEnvironment } from "../../../lib/admin/environment";

// This public identity only selects Studio's browser configuration. Server
// permissions always use the existing authenticated deployment/data-plane guard.
export function isStudioConfigurationAllowed(
  dataset: string | undefined,
  environment: AdminEnvironment,
  projectId: string | undefined,
  publicValues?: Record<string, string | undefined>,
  serverRuntime = typeof process !== "undefined" && process.release?.name === "node",
): boolean {
  if (serverRuntime) return isStudioDataPlaneAllowed(dataset, environment, undefined, undefined, projectId);
  // Keep literal accesses so Next seals nonsecret values into browser bundles.
  const provider = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER : process.env.NEXT_PUBLIC_CCPUN_DEPLOYMENT_PROVIDER;
  const role = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE : process.env.NEXT_PUBLIC_CCPUN_DEPLOYMENT_ROLE;
  const vercelProject = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID : process.env.NEXT_PUBLIC_CCPUN_VERCEL_PROJECT_ID;
  const productionProject = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID : process.env.NEXT_PUBLIC_CCPUN_PRODUCTION_ADMIN_VERCEL_PROJECT_ID;
  if (provider === undefined && role === undefined) {
    return isStudioDataPlaneAllowed(dataset, environment, vercelProject, productionProject, projectId, {});
  }
  const profile = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE : process.env.NEXT_PUBLIC_CCPUN_ADMIN_CAPABILITY_PROFILE;
  const backend = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND : process.env.NEXT_PUBLIC_CCPUN_ARTICLE_SCHEDULER_BACKEND;
  const sha = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_GIT_SHA : process.env.NEXT_PUBLIC_CCPUN_GIT_SHA;
  const ref = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_GIT_REF : process.env.NEXT_PUBLIC_CCPUN_GIT_REF;
  const release = publicValues ? publicValues.NEXT_PUBLIC_CCPUN_RELEASE_ID : process.env.NEXT_PUBLIC_CCPUN_RELEASE_ID;
  const productionRefAllowed = Boolean(
    ref === "v4-production"
    || (sha && ref === `codex/hostinger-release-production-${sha}`),
  );
  if (provider !== "hostinger" || role !== "admin" || vercelProject || productionProject || profile !== "full"
    || !sha || !/^[a-f0-9]{40}$/.test(sha) || !ref || !/^[a-zA-Z0-9._/-]{1,128}$/.test(ref)
    || !release || !/^[a-zA-Z0-9._-]{1,128}$/.test(release)
    || (environment !== "production-admin" && environment !== "admin-uat")
    || (environment === "production-admin" ? !productionRefAllowed || backend !== "disabled" : backend !== "native-neon")) return false;
  return isStudioDataPlaneAllowed(dataset, environment, "", "", projectId, {
    CCPUN_DEPLOYMENT_PROVIDER: provider, CCPUN_DEPLOYMENT_ROLE: role, CCPUN_APP_ENV: environment,
    CCPUN_GIT_SHA: sha, CCPUN_GIT_REF: ref, CCPUN_RELEASE_ID: release,
  });
}

const BLOCKED_NON_PRODUCTION_ACTIONS = new Set(["delete", "publish", "unpublish", "unpublishVersion"]);
const BLOCKED_PRODUCTION_ADMIN_ACTIONS = new Set(["delete", "unpublish", "unpublishVersion"]);
const BLOCKED_PRODUCTION_ADMIN_ARTICLE_ACTIONS = new Set(["unpublishVersion"]);
const BLOCKED_PRODUCTION_ADMIN_DRAFT_ONLY_ACTIONS = new Set([
  "delete",
  "discardChanges",
  "publish",
  "schedule",
  "unpublish",
  "unpublishVersion",
]);
const LOCAL_PRODUCTION_ARTICLE_ACTIONS = new Set(["publish", "unpublish", "delete", "schedule", "discardChanges", "restore"]);
const SYSTEM_DOCUMENT_TYPES = new Set([
  "seoSuggestion",
  "researchSnapshot",
  "ubersuggestAccountSnapshot",
  "ubersuggestGeoSnapshot",
  "auditLog",
  "publishSchedule",
]);
const DRAFT_ONLY_DOCUMENT_TYPES = new Set(["masterContent", "socialVariant"]);
const OWNER_HIDDEN_NEW_DOCUMENT_TYPES = new Set(["category", "blogSettings", ...SYSTEM_DOCUMENT_TYPES]);
const OWNER_HIDDEN_STRUCTURE_DOCUMENT_TYPES = SYSTEM_DOCUMENT_TYPES;

function isUatEditorialEnvironment(environment: AdminEnvironment): boolean {
  return environment === "development" || environment === "local-uat" || environment === "admin-uat";
}

function isDraftOnlyEditorialEnvironment(environment: AdminEnvironment): boolean {
  return isUatEditorialEnvironment(environment) || environment === "production-admin";
}

type StudioAuthProvider = { name: string };
type StudioNewDocumentOption = { templateId: string };
type StudioStructureItem = { getId: () => string | undefined };

export function getStudioArticleEditHref(documentId: string): string {
  const logicalDocumentId = documentId.replace(/^drafts\./, "");
  return `/studio/intent/edit/id=${encodeURIComponent(logicalDocumentId)};type=article`;
}

export function filterStudioAuthProviders<T extends StudioAuthProvider>(
  providers: T[],
  dataset: string,
  environment: AdminEnvironment,
  projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
): T[] {
  if (!isStudioConfigurationAllowed(dataset, environment, projectId)) return [];
  return providers.filter(({ name }) => name === "google");
}

export function filterStudioDocumentActions<T extends { action?: string }>(
  actions: T[],
  dataset: string,
  environment: AdminEnvironment,
  schemaType?: string,
  projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
): T[] {
  if (!isStudioConfigurationAllowed(dataset, environment, projectId)) return [];
  if (schemaType && SYSTEM_DOCUMENT_TYPES.has(schemaType)) return [];
  if (schemaType && DRAFT_ONLY_DOCUMENT_TYPES.has(schemaType) && !isDraftOnlyEditorialEnvironment(environment)) return [];
  if (environment === "local-production") {
    if (schemaType !== "article") return [];
    return actions.filter(({ action }) => Boolean(action && LOCAL_PRODUCTION_ARTICLE_ACTIONS.has(action)));
  }
  if (environment === "production-admin") {
    if (schemaType && DRAFT_ONLY_DOCUMENT_TYPES.has(schemaType)) {
      return actions.filter(({ action }) => !action || !BLOCKED_PRODUCTION_ADMIN_DRAFT_ONLY_ACTIONS.has(action));
    }
    const blockedActions = schemaType === "article"
      ? BLOCKED_PRODUCTION_ADMIN_ARTICLE_ACTIONS
      : BLOCKED_PRODUCTION_ADMIN_ACTIONS;
    return actions.filter(({ action }) => !action || !blockedActions.has(action));
  }
  return actions.filter(({ action }) => !action || !BLOCKED_NON_PRODUCTION_ACTIONS.has(action));
}

function wasEverPublished(props: Parameters<DocumentActionComponent>[0]) {
  return Boolean(props.published || props.draft?.publishedAt);
}

export function createDraftOnlyDeleteAction(originalAction: DocumentActionComponent): DocumentActionComponent {
  const DraftOnlyDeleteAction: DocumentActionComponent = (props) => {
    const result = originalAction(props);
    if (wasEverPublished(props)) return null;
    if (!result) return null;
    return {
      ...result,
      label: "ลบฉบับร่าง",
      title: "ลบฉบับร่าง",
      tone: "critical",
    };
  };
  DraftOnlyDeleteAction.action = "delete";
  DraftOnlyDeleteAction.displayName = "CCPunDraftOnlyDeleteAction";
  return DraftOnlyDeleteAction;
}

export function createSeoSafeUnpublishAction(originalAction: DocumentActionComponent): DocumentActionComponent {
  const SeoSafeUnpublishAction: DocumentActionComponent = (props) => {
    const result = originalAction(props);
    if (!props.published || !result) return null;
    return {
      ...result,
      label: "นำออกจากเว็บไซต์",
      title: "นำออกจากเว็บไซต์",
      tone: "critical",
    };
  };
  SeoSafeUnpublishAction.action = "unpublish";
  SeoSafeUnpublishAction.displayName = "CCPunSeoSafeUnpublishAction";
  return SeoSafeUnpublishAction;
}

export function protectProductionContentLifecycleActions(
  actions: DocumentActionComponent[],
  environment: AdminEnvironment,
  schemaType?: string,
): DocumentActionComponent[] {
  if ((environment !== "local-production" && environment !== "production-admin") || schemaType !== "article") {
    return actions;
  }

  return actions.map((action) => {
    if (action.action === "delete") return createDraftOnlyDeleteAction(action);
    if (action.action === "unpublish") return createSeoSafeUnpublishAction(action);
    return action;
  });
}

export function filterStudioNewDocumentOptions<T extends StudioNewDocumentOption>(
  options: T[],
  dataset: string,
  environment: AdminEnvironment,
  projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
): T[] {
  if (!isStudioConfigurationAllowed(dataset, environment, projectId)) return [];
  if (environment === "local-production") return options.filter(({ templateId }) => templateId === "article");
  return options.filter(({ templateId }) =>
    !OWNER_HIDDEN_NEW_DOCUMENT_TYPES.has(templateId) &&
    (isDraftOnlyEditorialEnvironment(environment) || !DRAFT_ONLY_DOCUMENT_TYPES.has(templateId)),
  );
}

export function filterStudioStructureItems<T extends StudioStructureItem>(
  items: T[],
  environment: AdminEnvironment,
): T[] {
  return items.filter((item) => {
    const documentType = item.getId();
    if (!documentType) return false;
    return (
      !OWNER_HIDDEN_STRUCTURE_DOCUMENT_TYPES.has(documentType) &&
      (isDraftOnlyEditorialEnvironment(environment) || !DRAFT_ONLY_DOCUMENT_TYPES.has(documentType))
    );
  });
}
