import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface HistoryOrder {
  key: string;
  serviceName: string;
  orderId: string;
  quantity: number;
  price: number;
  createdAt: number;
  status?: 'selesai' | 'proses' | 'batal' | 'pending';
}

interface Ctx {
  orders: HistoryOrder[];
  addOrder: (o: Omit<HistoryOrder, 'key'>) => void;
}

const STORAGE_KEY = 'boosteryuk-order-history';

function load(): HistoryOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as HistoryOrder[]) : [];
  } catch {
    return [];
  }
}

const PENDING_TO_PROCES_MS = 60 * 60 * 1000; // 1 jam

const OrderHistoryContext = createContext<Ctx>({ orders: [], addOrder: () => {} });

export function OrderHistoryProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<HistoryOrder[]>(load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // ignore quota errors
    }
  }, [orders]);

  const addOrder: Ctx['addOrder'] = (o) => {
    setOrders((prev) =>
      [
        { ...o, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` },
        ...prev,
      ].slice(0, 100),
    );
  };

  // Auto-update "pending" orders → "proses" once 1 hour has passed since creation.
  useEffect(() => {
    const promotePending = () => {
      const now = Date.now();
      setOrders((prev) =>
        prev.map((o) => {
          if (o.status === 'pending' && now - o.createdAt >= PENDING_TO_PROCES_MS) {
            return { ...o, status: 'proses' as const };
          }
          return o;
        }),
      );
    };

    // Run once on mount, then every minute.
    promotePending();
    const timer = window.setInterval(promotePending, 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <OrderHistoryContext.Provider value={{ orders, addOrder }}>
      {children}
    </OrderHistoryContext.Provider>
  );
}

export function useOrderHistory() {
  return useContext(OrderHistoryContext);
}
