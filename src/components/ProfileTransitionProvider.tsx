import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Phase = "idle" | "expanding" | "open" | "collapsing";

interface Origin {
  x: number;
  y: number;
  size: number;
}

interface Ctx {
  origin: Origin | null;
  phase: Phase;
  setOrigin: (o: Origin | null) => void;
  setPhase: (p: Phase) => void;
  beginExpand: (o: Origin) => void;
}

const ProfileTransitionContext = createContext<Ctx | null>(null);

export const ProfileTransitionProvider = ({ children }: { children: ReactNode }) => {
  const [origin, setOrigin] = useState<Origin | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");

  const beginExpand = useCallback((o: Origin) => {
    setOrigin(o);
    setPhase("expanding");
  }, []);

  return (
    <ProfileTransitionContext.Provider value={{ origin, phase, setOrigin, setPhase, beginExpand }}>
      {children}
    </ProfileTransitionContext.Provider>
  );
};

export const useProfileTransition = () => {
  const ctx = useContext(ProfileTransitionContext);
  if (!ctx) throw new Error("useProfileTransition must be used within ProfileTransitionProvider");
  return ctx;
};
