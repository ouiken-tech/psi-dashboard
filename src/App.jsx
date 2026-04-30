import React, { useState, useMemo } from "react";

export default function App() {
  const [salesData, setSalesData] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [itemMaster, setItemMaster] = useState([]);
  const [historyData, setHistoryData] = useState([]);

  const readFile = (e, setter, parser) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setter(parser(ev.target.result));
    reader.readAsText(file, "Shift_JIS");
  };

  // ===== CSVパース =====
  const parseSales = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return { code: c[7], qty: Number(c[9]) || 0 };
    });

  const parseStock = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return { code: c[0], stock: Number(c[7]) || 0 };
    });

  const parseItem = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return { code: c[0], name: c[1], category: c[2] };
    });

  const parseHistory = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return { code: c[0], month: c[1], qty: Number(c[2]) || 0 };
    });

  // ===== AIロジック =====
  const result = useMemo(() => {
    const map = {};
    const itemMap = {};
    itemMaster.forEach(i => itemMap[i.code] = i);

    salesData.forEach(r => {
      if (!r.code) return;
      if (!map[r.code]) map[r.code] = { sales: 0, stock: 0 };
      map[r.code].sales += r.qty;
    });

    stockData.forEach(r => {
      if (!r.code) return;
      if (!map[r.code]) map[r.code] = { sales: 0, stock: 0 };
      map[r.code].stock += r.stock;
    });

    const histMap = {};
    historyData.forEach(r => {
      if (!histMap[r.code]) histMap[r.code] = [];
      histMap[r.code].push(r);
    });

    return Object.keys(map).map(code => {
      const item = map[code];
      const hist = (histMap[code] || [])
        .sort((a, b) => b.month.localeCompare(a.month));

      // 加重平均
      const weights = [0.5, 0.3, 0.2];
      let weighted = 0;
      let totalW = 0;

      hist.slice(0, 3).forEach((h, i) => {
        weighted += h.qty * (weights[i] || 0);
        totalW += (weights[i] || 0);
      });

      const wAvg = totalW ? weighted / totalW : item.sales;

      // トレンド
      let trend = 0;
      if (hist.length >= 3) {
        trend = (hist[0].qty - hist[2].qty) / 2;
      }

      let forecast = Math.round(Math.max(0, wAvg + trend));

      // 季節補正
      let season = 1;
      if (hist.length >= 6) {
        const avg = hist.reduce((s, v) => s + v.qty, 0) / hist.length;
        const recent = hist.slice(0, 3).reduce((s, v) => s + v.qty, 0) / 3;
        season = avg ? recent / avg : 1;
      }

      forecast = Math.round(forecast * season);

      const need = forecast * 3;
      const safety = Math.round(forecast * 0.5);
      const order = Math.max(0, Math.round(need + safety - item.stock));

      return {
        code,
        name: itemMap[code]?.name || code,
        category: itemMap[code]?.category || "未分類",
        stock: item.stock,
        sales: item.sales,
        forecast,
        need,
        safety,
        order
      };
    });
  }, [salesData, stockData, itemMaster, historyData]);

  // ===== KPI =====
  const kpi = useMemo(() => {
    const totalSales = result.reduce((s, r) => s + r.sales, 0);
    const totalStock = result.reduce((s, r) => s + r.stock, 0);
    const totalOrder = result.reduce((s, r) => s + r.order, 0);
    const risk = result.filter(r => r.order > 20).length;

    return { totalSales, totalStock, totalOrder, risk };
  }, [result]);

  // ===== カテゴリ =====
  const category = useMemo(() => {
    const map = {};
    result.forEach(r => {
      if (!map[r.category]) map[r.category] = { sales: 0, stock: 0, order: 0 };
      map[r.category].sales += r.sales;
      map[r.category].stock += r.stock;
      map[r.category].order += r.order;
    });
    return map;
  }, [result]);

  const explain = (r) => {
    if (r.order > 20) return "⚠ 要発注";
    if (r.forecast > r.sales * 1.5) return "📈 需要増";
    if (r.stock > r.forecast * 3) return "📦 在庫過多";
    return "安定";
  };

  return (
    <div style={styles.page}>

      <h2 style={styles.title}>📊 AI発注ダッシュボード</h2>

      {/* ===== FILE INPUT ===== */}
      <div style={styles.card}>
        <p>販売CSV</p>
        <input type="file" onChange={e => readFile(e, setSalesData, parseSales)} />

        <p>在庫CSV</p>
        <input type="file" onChange={e => readFile(e, setStockData, parseStock)} />

        <p>商品マスタ</p>
        <input type="file" onChange={e => readFile(e, setItemMaster, parseItem)} />

        <p>過去データ</p>
        <input type="file" onChange={e => readFile(e, setHistoryData, parseHistory)} />
      </div>

      {/* ===== KPI ===== */}
      <div style={styles.grid}>
        <div style={styles.card}>売上<br /><b>{kpi.totalSales}</b></div>
        <div style={styles.card}>在庫<br /><b>{kpi.totalStock}</b></div>
        <div style={styles.card}>発注<br /><b>{kpi.totalOrder}</b></div>
        <div style={{ ...styles.card, color: "#ff4d4f" }}>
          リスク<br /><b>{kpi.risk}</b>
        </div>
      </div>

      {/* ===== CATEGORY ===== */}
      <div style={styles.card}>
        <h3>🏬 カテゴリ分析</h3>
        {Object.entries(category).map(([k, v]) => (
          <div key={k} style={styles.row}>
            <span>{k}</span>
            <span>売上:{v.sales} 在庫:{v.stock} 発注:{v.order}</span>
          </div>
        ))}
      </div>

      {/* ===== PRODUCTS ===== */}
      <div style={styles.grid2}>
        {result.map((r, i) => (
          <div key={i} style={styles.card}>
            <h4>{r.name}</h4>
            <p>在庫: {r.stock}</p>
            <p>予測: {r.forecast}</p>
            <p>回転率: {(r.sales / (r.stock || 1)).toFixed(2)}</p>

            <p style={{ fontSize: 12, opacity: 0.7 }}>
              {explain(r)}
            </p>

            {r.order > 0 && (
              <div style={styles.badge}>発注 {r.order}</div>
            )}
          </div>
        ))}
      </div>

    </div>
  );
}

// ===== STYLE =====
const styles = {
  page: {
    padding: 20,
    background: "linear-gradient(180deg,#0b0f1a,#0f172a)",
    color: "#fff",
    minHeight: "100vh",
    fontFamily: "system-ui"
  },
  title: { marginBottom: 20 },
  card: {
    background: "rgba(255,255,255,0.06)",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255,255,255,0.1)"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4,1fr)",
    gap: 10
  },
  grid2: {
    display: "grid",
    gridTemplateColumns: "repeat(3,1fr)",
    gap: 10
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    borderBottom: "1px solid rgba(255,255,255,0.1)"
  },
  badge: {
    marginTop: 10,
    background: "#ff4d4f",
    padding: "4px 10px",
    borderRadius: 999,
    display: "inline-block",
    fontSize: 12
  }
};
