import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const KEY = 'eval_compare_ids';

interface CompareCtx {
  ids: number[];
  toggle: (id: number) => void;
  has: (id: number) => boolean;
  remove: (id: number) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx>(null!);
export const useCompare = () => useContext(Ctx);

// 「加入对比」的全局选择，持久化到 localStorage，跨页面共享
export function CompareProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<number[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(ids));
  }, [ids]);

  const toggle = (id: number) =>
    setIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const remove = (id: number) => setIds((p) => p.filter((x) => x !== id));
  const has = (id: number) => ids.includes(id);
  const clear = () => setIds([]);

  return <Ctx.Provider value={{ ids, toggle, has, remove, clear }}>{children}</Ctx.Provider>;
}
