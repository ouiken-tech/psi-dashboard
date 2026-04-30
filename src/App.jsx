import React, { useState, useMemo } from "react";

export default function App() {
  // =========================
  // 🧱 Core DB（唯一の正）
  // =========================
  const [db, setDb] = useState({
    products: [],
    stores: [],
    sales: [],
    stock: [],
    history: []
  });

  // =========================
  // 🔁 データ注入
  // =========================
  const ingest = (type, data) => {
    setDb(prev => ({
      ...prev,
      [type]: data
    }));
  };

  // =========================
  // 📥 CSV読み込み
  // =========================
  const readFile = (e, type, parser) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parser(ev.target.result);
      ingest(type, parsed);
    };

    reader.readAsText(file, "UTF-8");
  };

  // =========================
  // 🔧 パーサー
  // =========================
  const parseSales = (t) =>
    t.split("\n").map(l => l.split(/[\t,]/));

  const parseStock = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return {
        code: c[0],
        store: c[1],
        qty: Number(c[2]) || 0
      };
    });

  const parseProduct = (t) =>
    t.split("\n").map(l => l.split(/[\t,]/));

  const parseStore = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);
      return {
        storeId: c[2],
        storeName: c[3]
      };
    });

  // =========================
  // 🧠 正規化レイヤー
  // =========================
  const normalize = {
    product: (p) => ({
      code: p[4],
      name: p[5],
      major: p[0],
      middle: p[1],
      cost: Number(p[12] || 0),
      price: Number(p[11] || 0)
    }),

    sales: (s) => ({
      code: s[7],
      store: s[2],
      date: s[3],
      qty: Number(s[9] || 0),
      price: Number(s[11] || 0),
      cost: Number(s[10] || 0)
    }),

    store: (s) => ({
      storeId: s.storeId,
      storeName: s.storeName
    }),

    stock: (s) => ({
      code: s.code,
      store: s.store,
      qty: Number(s.qty || 0)
    })
  };

  // =========================
  // 🧱 正規化DB
  // =========================
  const normalizedDB = useMemo(() => {
    return {
      products: db.products.map(normalize.product),
      sales: db.sales.map(normalize.sales),
      stock: db.stock.map(normalize.stock),
      stores: db.stores.map(normalize.store),
      history: db.history
    };
  }, [db]);

  // =========================
  // 🔗 JOINエンジン
  // =========================
  const joined = useMemo(() => {
    const productMap = new Map(
      normalizedDB.products.map(p => [p.code, p])
    );

    const storeMap = new Map(
      normalizedDB.stores.map(s => [s.storeId, s])
    );

    return normalizedDB.sales.map(s => ({
      ...s,
      product: productMap.get(s.code),
      store: storeMap.get(s.store)
    }));
  }, [normalizedDB]);

  // =========================
  // 📊 KPIエンジン
  // =========================
  const kpi = useMemo(() => {
    const totalSales = normalizedDB.sales.reduce(
      (sum, s) => sum + s.qty * s.price,
      0
    );

    const totalProfit = normalizedDB.sales.reduce(
      (sum, s) => sum + (s.price - s.cost) * s.qty,
      0
    );

    const totalStock = normalizedDB.stock.reduce(
      (sum, s) => sum + s.qty,
      0
    );

    return { totalSales, totalProfit, totalStock };
  }, [normalizedDB]);

  // =========================
  // 🧪 UI
  // =========================
  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>📦 統合データエンジン（Core）</h2>

      {/* INPUT */}
      <div>
        <p>販売データ</p>
        <input type="file" onChange={e => readFile(e,"sales",parseSales)} />

        <p>在庫データ</p>
        <input type="file" onChange={e => readFile(e,"stock",parseStock)} />

        <p>商品マスタ</p>
        <input type="file" onChange={e => readFile(e,"products",parseProduct)} />

        <p>店舗マスタ</p>
        <input type="file" onChange={e => readFile(e,"stores",parseStore)} />
      </div>

      {/* KPI */}
      <div style={{ marginTop: 20 }}>
        <h3>📊 KPI</h3>
        <p>売上: {kpi.totalSales}</p>
        <p>利益: {kpi.totalProfit}</p>
        <p>在庫: {kpi.totalStock}</p>
      </div>

      {/* JOIN確認 */}
      <div style={{ marginTop: 20 }}>
        <h3>🔗 JOIN結果（確認用）</h3>
        <table border="1">
          <thead>
            <tr>
              <th>商品</th>
              <th>店舗</th>
              <th>数量</th>
              <th>売上</th>
            </tr>
          </thead>
          <tbody>
            {joined.slice(0, 10).map((j, i) => (
              <tr key={i}>
                <td>{j.product?.name || j.code}</td>
                <td>{j.store?.storeName || j.store}</td>
                <td>{j.qty}</td>
                <td>{j.qty * j.price}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
