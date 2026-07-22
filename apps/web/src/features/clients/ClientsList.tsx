import React, { useEffect, useState } from "react";
import { apiGetSourced } from "../../lib/api";
import { DemoModeBanner } from "../../components/DemoModeBanner";
import seed from "../../seed/clients.json";

type Row = { id: string; name: string; structure: string; country: string; riskLevel: string };
export function ClientsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [demo, setDemo] = useState(false);
  useEffect(() => { apiGetSourced<{ data: Row[] }>("/v1/clients", { data: seed as Row[] })
    .then(r => { setRows(r.data.data); setDemo(r.isDemo); }); }, []);
  return <div>
    {demo && <DemoModeBanner/>}
    <h2>Clients — {rows.length}</h2>
    <table cellPadding={6}><thead><tr>
      <th align="left">Nom</th><th>Structure</th><th>Pays</th><th>Risque</th></tr></thead>
      <tbody>{rows.map(c => <tr key={c.id}>
        <td>{c.name}</td><td align="center">{c.structure}</td>
        <td align="center">{c.country}</td><td align="center">{c.riskLevel}</td></tr>)}
      </tbody></table>
  </div>;
}
