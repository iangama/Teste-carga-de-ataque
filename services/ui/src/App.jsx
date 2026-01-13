import React, { useEffect, useMemo, useState } from "react";

const API = {
  ingest: "/api/ingest",
  observe: "/api/observe",
  diagnose: "/api/diagnose",
};

function Card({ title, children }) {
  return (
    <div style={{
      background:"#0f1731", border:"1px solid #1f2a52", borderRadius:16,
      padding:16, boxShadow:"0 10px 30px rgba(0,0,0,.25)"
    }}>
      <h3 style={{margin:"0 0 12px", fontSize:14, letterSpacing:.5, color:"#bcd1ff"}}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Pill({ text, tone }) {
  const map = {
    stable: ["#0b2a1a","#1ad67a"],
    pressure: ["#2a250b","#ffd34d"],
    hostile: ["#2a0b0b","#ff5a5a"],
    commercial_attack: ["#25102a","#d98cff"],
    unknown: ["#131a2f","#93a6d6"]
  };
  const [bg, fg] = map[tone] || map.unknown;
  return (
    <span style={{
      padding:"6px 10px",
      borderRadius:999,
      background:bg,
      color:fg,
      fontSize:12,
      border:`1px solid ${fg}33`
    }}>
      {text}
    </span>
  );
}

/* ===========================
   FETCH HELPER (FIX DEFINITIVO)
   =========================== */
async function j(method, url, body) {
  const hasBody = body !== undefined && body !== null;
  const headers = hasBody ? { "content-type": "application/json" } : {};

  const r = await fetch(url, {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(body) } : {})
  });

  const t = await r.text();
  let data = null;
  try { data = t ? JSON.parse(t) : null; }
  catch { data = { raw: t }; }

  if (!r.ok) {
    throw new Error(`${r.status} ${r.statusText}: ${JSON.stringify(data)}`);
  }
  return data;
}

export default function App() {
  const [inputs, setInputs] = useState([]);
  const [obs, setObs] = useState([]);
  const [episodes, setEpisodes] = useState([]);
  const [busy, setBusy] = useState(false);

  const latest = useMemo(() => episodes?.[0], [episodes]);

  async function refresh() {
    const a = await fetch(`${API.ingest}/inputs/recent`).then(r=>r.json());
    const b = await fetch(`${API.observe}/recent`).then(r=>r.json());
    const c = await fetch(`${API.diagnose}/episodes`).then(r=>r.json());
    setInputs(a.inputs || []);
    setObs(b.observations || []);
    setEpisodes(c.episodes || []);
  }

  async function ingestOne(payload) {
    return j("POST", `${API.ingest}/inputs`, { source: "ui", payload });
  }

  async function runObserve() {
    return j("POST", `${API.observe}/run`);
  }

  async function runDiagnose() {
    return j("POST", `${API.diagnose}/run`);
  }

  async function doAll() {
    setBusy(true);
    try {
      await runObserve();
      await runDiagnose();
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function seedNormal() {
    setBusy(true);
    try {
      await ingestOne("texto normal sobre um tema técnico, sem spam.");
      await ingestOne("discussão curta e neutra, baixa repetição.");
      await doAll();
    } finally {
      setBusy(false);
    }
  }

  async function simulateAttack() {
    setBusy(true);
    try {
      const payloads = [
        "aaaaaaaaaaaaaaa free promo http://x.com",
        "clique clique clique giveaway http://bit.ly/abc",
        "aaaaaaaaaaaaaaa aaaaaaaaaaaaaaa aaaaaaaaaaaaaaa",
        "FREE promo click giveaway http://t.co/xyz",
        "aaaaaaaaaaaaaaa free free free http://x.com"
      ];
      for (const p of payloads) await ingestOne(p);
      await doAll();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const stateTone = latest?.state || "unknown";
  const confidence = latest?.confidence ?? 0;
  const unknowns = latest?.unknowns || [];
  const counters = latest?.counters || {};

  return (
    <div style={{padding:24, maxWidth:1100, margin:"0 auto"}}>
      <h1 style={{marginBottom:8}}>N26 — NOXGUARD</h1>

      <div style={{display:"flex", gap:10, marginBottom:16}}>
        <button disabled={busy} onClick={seedNormal}>Semear normal</button>
        <button disabled={busy} onClick={simulateAttack}>Simular ataque</button>
        <button disabled={busy} onClick={doAll}>
          {busy ? "Rodando..." : "Rodar pipeline"}
        </button>
      </div>

      <div style={{display:"grid", gridTemplateColumns:"1.2fr .8fr", gap:14}}>
        <Card title="Estado do Sistema (Diagnose)">
          <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
            <Pill text={`state: ${latest?.state || "-"}`} tone={stateTone} />
            <Pill text={`confidence: ${confidence}`} tone="pressure" />
          </div>
          <pre>{JSON.stringify(counters, null, 2)}</pre>
          <div style={{display:"flex", gap:6, flexWrap:"wrap"}}>
            {unknowns.map((u,i)=><Pill key={i} text={u} tone="unknown" />)}
          </div>
        </Card>

        <Card title="Ações & Links">
          <a href="http://localhost:3000" target="_blank">Abrir Grafana</a><br/>
          <a href="http://localhost:9090" target="_blank">Abrir Prometheus</a>
        </Card>
      </div>

      <div style={{marginTop:16}}>
        <Card title="Inputs recentes">
          {inputs.map(i=>(
            <div key={i.id}>#{i.id} — {i.payload}</div>
          ))}
        </Card>
      </div>
    </div>
  );
}
