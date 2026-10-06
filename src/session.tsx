import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, message } from "./api";
import type { Session } from "./types";
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<Session>;
  setSession: (session: Session) => void;
}>({
  session: null,
  loading: true,
  error: "",
  refresh: async () => {
    throw new Error("未初始化");
  },
  setSession: () => {},
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const refresh = async () => {
    try {
      const next = await api<Session>("/auth/session");
      setSession(next);
      setError("");
      return next;
    } catch (e) {
      setError(message(e));
      throw e;
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh().catch(() => {});
  }, []);
  return (
    <Context.Provider value={{ session, loading, error, refresh, setSession }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
