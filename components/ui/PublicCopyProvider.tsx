"use client";

import { createContext, useContext, useCallback, type ReactNode } from "react";
import { SITE_COPY_DEFAULTS } from "@/lib/content/site-copy-defaults";
import type { PublicCopyValues } from "@/lib/content/public-copy-registry";

const PublicCopyContext = createContext<PublicCopyValues>(SITE_COPY_DEFAULTS);

export function PublicCopyProvider({ values, children }: { values: PublicCopyValues; children?: ReactNode }) {
  const inherited = useContext(PublicCopyContext);
  return <PublicCopyContext.Provider value={{ ...inherited, ...values }}>{children}</PublicCopyContext.Provider>;
}

export function usePublicCopy<T extends Record<string, string> = typeof SITE_COPY_DEFAULTS>(defaults: T = SITE_COPY_DEFAULTS as unknown as T) {
  const values = useContext(PublicCopyContext);
  return useCallback((key: keyof T & string): string => (values as Record<string, string>)[key] ?? defaults[key], [values, defaults]);
}
