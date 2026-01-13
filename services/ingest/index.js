import Fastify from "fastify";
import { Pool } from "pg";
import client from "prom-client";

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

client.collectDefaultMetrics();

const inputsTotal = new client.Counter({
  name: "noxguard_inputs_total",
  help: "Total inputs ingested",
  labelNames: ["source"]
});

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true };
});

app.post("/inputs", async (req, reply) => {
  const { source, payload } = req.body ?? {};
  if (!source || typeof source !== "string") return reply.code(400).send({ error: "source_required" });
  if (!payload || typeof payload !== "string" || payload.length < 3) return reply.code(400).send({ error: "payload_too_short" });

  inputsTotal.inc({ source });

  const r = await pool.query(
    "INSERT INTO core.inputs(source,payload) VALUES($1,$2) RETURNING id, ts",
    [source, payload]
  );
  return { ok: true, id: r.rows[0].id, ts: r.rows[0].ts };
});

app.get("/inputs/recent", async () => {
  const r = await pool.query("SELECT id, ts, source, left(payload,160) payload FROM core.inputs ORDER BY ts DESC LIMIT 20");
  return { inputs: r.rows };
});

app.get("/metrics", async (_, reply) => {
  reply.type(client.register.contentType);
  return client.register.metrics();
});

app.listen({ port: Number(process.env.PORT || 4301), host: "0.0.0.0" });
