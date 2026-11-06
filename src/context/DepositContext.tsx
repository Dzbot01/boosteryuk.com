import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface DepositRecord {
  id: string;
  username: string;
  amount: number;
  createdAt: number;
}

interface DepositCtx {
  deposits: DepositRecord[];
  addDeposit: (d: Omit<DepositRecord, 'id' | 'createdAt'>) => void;
}

const DepositContext = createContext<DepositCtx>({
  deposits: [],
  addDeposit: () => {},
});

const STORAGE_KEY = 'boosteryuk-deposits';

function load(): DepositRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as DepositRecord[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function DepositProvider({ children }: { children: ReactNode }) {
  const [deposits, setDeposits] = useState<DepositRecord[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(deposits));
    } catch {
      // ignore
    }
  }, [deposits]);

  // Live sync across tabs / admin & user side-by-side
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDeposits(load());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addDeposit: DepositCtx['addDeposit'] = (d) => {
    const rec: DepositRecord = {
      ...d,
      id: `DEP-${Date.now()}`,
      createdAt: Date.now(),
    };
    setDeposits((prev) => [rec, ...prev].slice(0, 50));
  };

  return (
    <DepositContext.Provider value={{ deposits, addDeposit }}>{children}</DepositContext.Provider>
  );
}

export function useDeposits() {
  return useContext(DepositContext);
}
