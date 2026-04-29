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

  // ===== パース =====
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
      return {
        code: c[0],
        month: c[1],
        qty: Number(c[2]) || 0
      };
    });

  // ===== AI予測 =====
  const result = useMemo(() => {
    const map = {};
    const itemMap = {};
    itemMaster.forEach(i => itemMap[i.code] = i);

    // 実績
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

    // 履歴整理
    const histMap = {};
    historyData.forEach(r => {
      if (!histMap[r.code]) histMap[r.code] = [];
      histMap[r.code].push(r);
    });

    return Object.keys(map).map(code => {
      const item = map[code];
      const hist = (histMap[code] || [])
        .sort((a,b)=>b.month.localeCompare(a.month));

      // ===== AI① 加重平均 =====
      const weights = [0.5, 0.3, 0.2];
      let weighted = 0;
      let totalW = 0;

      hist.slice(0,3).forEach((h,i) => {
        weighted += h.qty * (weights[i] || 0);
        totalW += (weights[i] || 0);
      });

      const wAvg = totalW ? weighted / totalW : item.sales;

      // ===== AI② トレンド =====
      let trend = 0;
      if (hist.length >= 3) {
        const recent = hist[0].qty;
        const past = hist[2].qty;
        trend = (recent - past) / 2;
      }

      // ===== AI予測 =====
      let forecast = Math.round(wAvg + trend);

      if (forecast < 0) forecast = 0;

      // ===== 季節補正（簡易）=====
      let season = 1;
      if (hist.length >= 12) {
        const sameMonth = hist.filter(h => h.month.slice(5,7) === hist[0].month.slice(5,7));
        const avg = hist.reduce((s,v)=>s+v.qty,0) / hist.length;
        const sm = sameMonth.reduce((s,v)=>s+v.qty,0) / sameMonth.length;
        season = avg ? sm / avg : 1;
      }

      forecast = Math.round(forecast * season);

      // ===== 発注 =====
      const need = forecast * 3;
      const safety = Math.round(forecast * 0.5);
      const order = Math.max(0, Math.round(need + safety - item.stock));

      return {
        code,
        name: itemMap[code]?.name || code,
        category: itemMap[code]?.category || "",
        stock: item.stock,
        sales: item.sales,
        forecast,
        need,
        safety,
        order
      };
    });

  }, [salesData, stockData, itemMaster, historyData]);

  return (
    <div style={{ padding: 20 }}>
      <h2>AI発注ダッシュボード</h2>

      <p>販売CSV</p>
      <input type="file" onChange={e=>readFile(e,setSalesData,parseSales)} />

      <p>在庫CSV</p>
      <input type="file" onChange={e=>readFile(e,setStockData,parseStock)} />

      <p>商品マスタ</p>
      <input type="file" onChange={e=>readFile(e,setItemMaster,parseItem)} />

      <p>過去月販</p>
      <input type="file" onChange={e=>readFile(e,setHistoryData,parseHistory)} />

      <table border="1" style={{ marginTop: 20 }}>
        <thead>
          <tr>
            <th>商品</th>
            <th>在庫</th>
            <th>月販</th>
            <th>AI予測</th>
            <th>必要量</th>
            <th>安全在庫</th>
            <th>発注</th>
          </tr>
        </thead>
        <tbody>
          {result.map((r,i)=>(
            <tr key={i} style={{background: r.order>0 ? "#ffe5e5" : ""}}>
              <td>{r.name}</td>
              <td>{r.stock}</td>
              <td>{r.sales}</td>
              <td>{r.forecast}</td>
              <td>{r.need}</td>
              <td>{r.safety}</td>
              <td><b>{r.order}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}