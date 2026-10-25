"use client";

import { createContext, useContext, type ReactNode } from "react";

// The server flag (lib/runtime/result-email-availability.ts) reaches client result screens through
// this context, provided once by the v5 page frame. Default false: outside a provider, or with the
// flag off, ResultEmailControl renders nothing. It renders no markup of its own.
const ResultEmailAvailabilityContext = createContext(false);

export function ResultEmailAvailability({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <ResultEmailAvailabilityContext.Provider value={enabled}>{children}</ResultEmailAvailabilityContext.Provider>;
}

export function useResultEmailEnabled(): boolean {
  return useContext(ResultEmailAvailabilityContext);
}
