import { createContext, useContext, useEffect } from 'react';

export const SplashContext = createContext<(ready: boolean) => void>(() => {});

/** Call from whichever screen is showing; the launch splash stays until `ready`. */
export function useSplashReady(ready: boolean) {
  const setReady = useContext(SplashContext);
  useEffect(() => {
    setReady(ready);
  }, [ready, setReady]);
}
