import { useEffect } from "react";
import { useIsland, type IslandState } from "./IslandContext";

export const usePageTitle = (state: IslandState, title?: string) => {
  const { setContext } = useIsland();
  useEffect(() => {
    if (!title) return;
    setContext({ state, title });
    return () => setContext(null);
  }, [state, title, setContext]);
};
