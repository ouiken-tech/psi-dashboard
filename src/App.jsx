import React, { useState, useMemo } from "react";

export default function App() {
  // =====================
  // 🧱 Core DB
  // =====================
  const [db, setDb] = useState({
    products: [],
    stores: [],
    sales: []
  });

  // =====================
  // 🔁 Ingest
  // =====================
  const ingest = (type, data) => {
    setDb(prev => ({
      ...prev,
      [type]: data
    }));
  };

  // =====================
  // 📥 CSV reader
  // =====================
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

  // =====================
  // 🧠 KEY NORMALIZER（重要）
  // =====================
  const normalizeCode = (code) => {
    if (!code) return "";
    return code.split("-")[0].trim(); // ★ここが核心
  };

  const normalizeStore = (store) => {
    if (!store) return "";
    return store.trim();
  };

  // =====================
  // 🔧 Parsers
  // =====================
  const parseSales = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);

      return {
        code: normalizeCode(c[0]),   // P0001-001 → P0001
        store: normalizeStore(c[1]),
        qty: Number(c[2]) || 0,
        price: Number(c[3]) || 0
      };
    });

  const parseProducts = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);

      return {
        code: normalizeCode(c[0]),
        name: c[1] || c[5] || "",
        cost: Number(c[2]) || 0,
        price: Number(c[3]) || 0
      };
    });

  const parseStores = (t) =>
    t.split("\n").map(l => {
      const c = l.split(/[\t,]/);

      return {
        storeId: normalizeStore(c[0]),
        storeName: c[1] || c[3]
      };
    });

  // =====================
  // 🧱 JOIN ENGINE（壊れない版）
  // =====================
  const joined = useMemo(() => {
    const productMap = new Map(
      db.products.map(p => [p.code, p])
    );

    const storeMap = new Map(
      db.stores.map(s => [s.storeId, s])
    );

    return db.sales.map(s => {
      const product = productMap.get(s.code);
      const store = storeMap.get(s.store);

      return {
        ...s,
        product,
        store,
        revenue: s.qty * s.price,
        profit: (s.price - (product?.cost || 0)) * s.qty
      };
    });
  }, [db]);

  // =====================
  // 📊 KPI ENGINE
  // =====================
  const kpi = useMemo(() => {
    const totalSales = joined.reduce((a,b)=>a + b.revenue, 0);
    const totalProfit = joined.reduce((a,b)=>a + b.profit, 0);
    const totalQty = joined.reduce((a,b)=>a + b.qty, 0);

    return { totalSales, totalProfit, totalQty };
  }, [joined]);

  // =====================
  // 📊 STORE VIEW
  // =====================
  const storeAgg = useMemo(() => {
    const map = {};

    joined.forEach(j => {
      const key = j.store?.storeName || "不明";

      if (!map[key]) {
        map[key] = { qty: 0, sales: 0, profit: 0 };
      }

      map[key].qty += j.qty;
      map[key].sales += j.revenue;
      map[key].profit += j.profit;
    });

    return map;
  }, [joined]);

  // =====================
  // 📊 PRODUCT VIEW
  // =====================
  const productAgg = useMemo(() => {
    const map = {};

    joined.forEach(j => {
      const key = j.product?.name || j.code;

      if (!map[key]) {
        map[key] = { qty: 0, sales: 0, profit: 0 };
      }

      map[key].qty += j.qty;
      map[key].sales += j.revenue;
      map[key].profit += j.profit;
    });

    return map;
  }, [joined]);

  // =====================
  // 🧪 UI
  // =====================
  return (
    <div style={{ padding: 20 }}>
      <h2>📦 データ統合エンジン（完成版）</h2>

      {/* INPUT */}
      <div>
        <p>販売データ</p>
        <input onChange={e=>readFile(e,"sales",parseSales)} type="file" />

        <p>商品マスタ</p>
        <input onChange={e=>readFile(e,"products",parseProducts)} type="file" />

        <p>店舗マスタ</p>
        <input onChange={e=>readFile(e,"stores",parseStores)} type="file" />
      </div>

      {/* KPI */}
      <div style={{ marginTop: 20 }}>
        <h3>📊 KPI</h3>
        <p>売上: {kpi.totalSales}</p>
        <p>利益: {kpi.totalProfit}</p>
        <p>数量: {kpi.totalQty}</p>
      </div>

      {/* STORE */}
      <div style={{ marginTop: 20 }}>
        <h3>🏬 店舗別</h3>
        {Object.entries(storeAgg).map(([k,v])=>(
          <div key={k}>
            {k} / 売上:{v.sales} / 利益:{v.profit}
          </div>
        ))}
      </div>

      {/* PRODUCT */}
      <div style={{ marginTop: 20 }}>
        <h3>📦 商品別</h3>
        {Object.entries(productAgg).map(([k,v])=>(
          <div key={k}>
            {k} / 売上:{v.sales} / 利益:{v.profit}
          </div>
        ))}
      </div>

      {/* JOIN DEBUG */}
      <div style={{ marginTop: 20 }}>
        <h3>🔗 JOIN確認</h3>
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
            {joined.slice(0,10).map((j,i)=>(
              <tr key={i}>
                <td>{j.product?.name || j.code}</td>
                <td>{j.store?.storeName || j.store}</td>
                <td>{j.qty}</td>
                <td>{j.revenue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
