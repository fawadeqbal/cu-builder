import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * False on the server and during hydration, true after. The session is only known in the
 * browser, so anything that depends on it waits for this to keep the server HTML matching.
 */
export const useHydrated = (): boolean => useSyncExternalStore(noop, () => true, () => false);
