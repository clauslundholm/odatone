"use client";

import { createContext, useContext, useMemo } from "react";

import { applyCopy, type Overrides } from "@/lib/copy-apply";

const CopyContext = createContext<Overrides>({});

export function CopyProvider({
  overrides,
  children,
}: {
  overrides: Overrides;
  children: React.ReactNode;
}) {
  return <CopyContext.Provider value={overrides}>{children}</CopyContext.Provider>;
}

/** Client-side counterpart to reading overrides on the server: hand it the
    imported defaults and get back the edited text. With no overrides in play
    it returns a structural copy of the defaults, so behaviour is identical
    whether or not the store is configured. */
export function useCopy<T>(defaults: T): T {
  const overrides = useContext(CopyContext);
  return useMemo(() => applyCopy(defaults, overrides), [defaults, overrides]);
}
