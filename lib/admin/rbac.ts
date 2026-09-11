import { getAdminEnvironment, type AdminEnvironment } from "./environment";

export const ADMIN_ROLES = ["owner", "editor", "seo-manager", "reviewer", "analyst", "viewer"] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  "dashboard:read",
  "content:read",
  "content:propose",
  "content:schedule",
  "seo:read",
  "seo:propose",
  "research:read",
  "research:create",
  "research:provider-query",
  "reviews:read",
  "reviews:approve",
  "reviews:edit",
  "reviews:reject",
  "audit:read",
  "settings:read",
  "social:read",
  "media:upload",
  "draft:apply",
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<AdminRole, ReadonlySet<AdminPermission>> = {
  owner: new Set(ADMIN_PERMISSIONS),
  editor: new Set([
    "dashboard:read",
    "content:read",
    "content:propose",
    "seo:read",
    "seo:propose",
    "research:read",
    "research:create",
    "reviews:read",
  ]),
  "seo-manager": new Set([
    "dashboard:read",
    "content:read",
    "content:propose",
    "seo:read",
    "seo:propose",
    "research:read",
    "research:create",
    "research:provider-query",
    "reviews:read",
  ]),
  reviewer: new Set([
    "dashboard:read",
    "content:read",
    "seo:read",
    "research:read",
    "reviews:read",
    "reviews:approve",
    "reviews:edit",
    "reviews:reject",
  ]),
  analyst: new Set([
    "dashboard:read",
    "content:read",
    "seo:read",
    "research:read",
    "research:create",
    "reviews:read",
  ]),
  viewer: new Set([
    "dashboard:read",
    "content:read",
    "seo:read",
    "research:read",
    "reviews:read",
  ]),
};

const ROLE_ENV_KEYS: Record<AdminRole, string> = {
  owner: "CCPUN_ADMIN_OWNER_EMAILS",
  editor: "CCPUN_ADMIN_EDITOR_EMAILS",
  "seo-manager": "CCPUN_ADMIN_SEO_MANAGER_EMAILS",
  reviewer: "CCPUN_ADMIN_REVIEWER_EMAILS",
  analyst: "CCPUN_ADMIN_ANALYST_EMAILS",
  viewer: "CCPUN_ADMIN_VIEWER_EMAILS",
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseEmailList(raw: string | undefined): Set<string> {
  if (!raw) return new Set();

  return new Set(
    raw
      .split(",")
      .map(normalizeEmail)
      .filter(Boolean),
  );
}

export function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && ADMIN_ROLES.includes(value as AdminRole);
}

export function getAdminRoleForEmail(email: string | null | undefined): AdminRole | null {
  if (!email) return null;

  const normalized = normalizeEmail(email);
  const matches = ADMIN_ROLES.filter((role) => parseEmailList(process.env[ROLE_ENV_KEYS[role]]).has(normalized));
  return matches.length === 1 ? matches[0] : null;
}

export function getConfiguredAdminRole(
  email: string | null | undefined,
  authConfigured: boolean,
  environment: AdminEnvironment = getAdminEnvironment(),
): AdminRole | null {
  if (!authConfigured) return null;
  const role = getAdminRoleForEmail(email);
  return environment === "local-production" && role !== "owner" ? null : role;
}

export function getVerifiedGoogleAdminRole({
  provider,
  email,
  emailVerified,
  environment = getAdminEnvironment(),
}: {
  provider: string | null | undefined;
  email: string | null | undefined;
  emailVerified: unknown;
  environment?: AdminEnvironment;
}): AdminRole | null {
  if (provider !== "google" || emailVerified !== true) return null;
  const role = getAdminRoleForEmail(email);
  return environment === "local-production" && role !== "owner" ? null : role;
}

export function hasConfiguredAdminUsers(environment: AdminEnvironment = getAdminEnvironment()): boolean {
  if (environment === "local-production") return parseEmailList(process.env.CCPUN_ADMIN_OWNER_EMAILS).size > 0;
  return ADMIN_ROLES.some((role) => parseEmailList(process.env[ROLE_ENV_KEYS[role]]).size > 0);
}

export function hasAdminPermission(
  role: AdminRole | null | undefined,
  permission: AdminPermission,
): boolean {
  return role ? ROLE_PERMISSIONS[role].has(permission) : false;
}
