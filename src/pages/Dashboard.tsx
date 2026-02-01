import { useEffect, useState, useCallback, useMemo } from "react";
import api from "../services/api";
import {
  TriangleAlert,
  Package,
  ShoppingCart,
  Wallet,
  Trophy,
  ChartLine,
} from "lucide-react";

interface LowStockItem {
  sku: string;
  stock: number;
  reorderPoint: number;
}

interface PurchaseOrderItem {
  sku: string;
  quantity: number;
}

interface PendingPO {
  items?: PurchaseOrderItem[];
}

interface TopSeller {
  productId: string;
  name: string;
  totalQty: number;
}

interface StockMovement {
  inbound?: number;
  outbound?: number;
}

interface DashboardData {
  inventoryValue?: number;
  lowStock?: LowStockItem[];
  pendingPOs?: PendingPO[];
  totalProducts?: number;
  totalOrders?: number;
  topSellers?: TopSeller[];
  stockMovements?: StockMovement[];
}

interface TenantInfo {
  name?: string;
  currentUser?: {
    role?: string;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);

  const filters = useMemo(() => ({ category: "all", supplier: "all" }), []);

  const fetchDashboard = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);

    try {
      const res = await api.get<DashboardData>("/dashboard", {
        params: { timeRange, ...filters },
      });
      setData(res.data || {});

      try {
        const tenantRes = await api.get<TenantInfo>("/tenant/info");
        setTenantInfo(tenantRes.data);
      } catch {
        setTenantInfo(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, filters, refreshing]);

  useEffect(() => {
    fetchDashboard();
    const i = setInterval(fetchDashboard, 30000);
    return () => clearInterval(i);
  }, [fetchDashboard]);

  const smartLowStock = useMemo(() => {
    const lowStock = data.lowStock ?? [];
    const pendingPOs = data.pendingPOs ?? [];

    return lowStock.filter((item) => {
      const pending = pendingPOs.reduce((s, po) => {
        const found = po.items?.find((i) => i.sku === item.sku);
        return s + (found?.quantity ?? 0);
      }, 0);

      return item.stock + pending < item.reorderPoint;
    });
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header className="flex justify-between items-center bg-white p-5 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500 text-white grid place-items-center font-bold">
            {tenantInfo?.name?.[0] || "B"}
          </div>
          <div>
            <h2>{tenantInfo?.name || "Your Business"}</h2>
            <p className="text-sm">{tenantInfo?.currentUser?.role || "User"}</p>
          </div>
        </div>

        <button onClick={fetchDashboard} disabled={refreshing}>
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={<Wallet size={18} />}
          title="Inventory Value"
          value={`₹${(data.inventoryValue ?? 0).toLocaleString()}`}
        />
        <Kpi
          icon={<TriangleAlert size={18} />}
          title="Low Stock"
          value={smartLowStock.length}
        />
        <Kpi
          icon={<Package size={18} />}
          title="Products"
          value={data.totalProducts ?? 0}
        />
        <Kpi
          icon={<ShoppingCart size={18} />}
          title="Orders"
          value={data.totalOrders ?? 0}
        />
      </div>

      <Card icon={<Trophy />} title="Top Sellers">
        {data.topSellers?.length ? (
          <ul>
            {data.topSellers.map((item) => (
              <li key={item.productId}>
                {item.name} — {item.totalQty}
              </li>
            ))}
          </ul>
        ) : (
          <Empty message="No sales data yet" />
        )}
      </Card>

      <Card icon={<ChartLine />} title="Stock Movements">
        <MiniStockChart data={data.stockMovements ?? []} />
      </Card>
    </div>
  );
}

import { ReactNode } from "react";

function Card({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="bg-white p-5 rounded-xl">
      <div className="flex gap-3 mb-3">
        {icon}
        <h3>{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Kpi({
  title,
  value,
  icon,
}: {
  title: string;
  value: number | string;
  icon: ReactNode;
}) {
  return (
    <div className="bg-white p-4 rounded-xl">
      <div className="flex gap-2">
        {icon}
        {title}
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function MiniStockChart({
  data,
}: {
  data: { inbound?: number; outbound?: number }[];
}) {
  if (!data.length) return <Empty message="No stock movement data" />;

  const max = Math.max(
    1,
    ...data.map((d) => Math.max(d.inbound ?? 0, d.outbound ?? 0)),
  );

  return (
    <div className="flex gap-2 h-32 items-end">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex gap-1 items-end">
          <div style={{ height: `${((d.inbound ?? 0) / max) * 100}%` }} />
          <div style={{ height: `${((d.outbound ?? 0) / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="text-center text-sm text-gray-400">{message}</div>;
}
