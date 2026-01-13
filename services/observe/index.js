import Fastify from "fastify";
import { Pool } from "pg";
import client from "prom-client";

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

client.collectDefaultMetrics();

const obsTotal = new client.Counter({
  name: "noxguard_observations_total",
  help: "Total observations created",
  labelNames: ["pattern"]
});

function detect(text) {
  const t = String(text || "");
  const out = [];
  if (/(.)\1{6,}/.test(t)) out.push({ pattern: "repetition", score: 70 });
  if (/http/i.test(t)) out.push({ pattern: "link", score: 40 });
  if (/\bfree\b|\bpromo\b|\bclick\b|\bgiveaway\b/i.test(t)) out.push({ pattern: "spam", score: 60 });
  if (t.length > 800) out.push({ pattern: "wall_of_text", score: 35 });
  return out;
}

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true };
});

app.post("/run", async () => {
  const r = await pool.query(`
    SELECT id, payload
    FROM core.inputs
    WHERE id NOT IN (SELECT DISTINCT input_id FROM core.observations)
    ORDER BY id ASC
    LIMIT 200
  `);

  let created = 0;

  for (const row of r.rows) {
    const patterns = detect(row.payload);
    for (const p of patterns) {
      await pool.query(
        "INSERT INTO core.observations(input_id,pattern,score) VALUES($1,$2,$3)",
        [row.id, p.pattern, p.score]
      );
      obsTotal.inc({ pattern: p.pattern });
      created++;
    }
  }

  return { ok: true, scanned: r.rows.length, created };
});

app.get("/recent", async () => {
  const r = await pool.query(`
    SELECT o.id, o.ts, o.input_id, o.pattern, o.score
    FROM core.observations o
    ORDER BY o.ts DESC
    LIMIT 30
  `);
  return { observations: r.rows };
});

app.get("/metrics", async (_, reply) => {
  reply.type(client.register.contentType);
  return client.register.metrics();
});

app.listen({ port: Number(process.env.PORT || 4302), host: "0.0.0.0" });
