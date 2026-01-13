import Fastify from "fastify";
import { Pool } from "pg";
import client from "prom-client";

const app = Fastify({ logger: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

client.collectDefaultMetrics();

const episodesTotal = new client.Counter({
  name: "noxguard_episodes_total",
  help: "Total diagnosis episodes emitted",
  labelNames: ["state"]
});

function decide({ count10m, avgScore10m, topPatterns }) {
  const unknowns = [];
  let state = "stable";
  let confidence = 20;

  if (count10m < 5) unknowns.push("low_sample");
  if (avgScore10m === 0 && count10m > 0) unknowns.push("no_patterns_detected");

  if (count10m >= 10 && avgScore10m >= 45) { state = "pressure"; confidence = 65; }
  if (count10m >= 25 && avgScore10m >= 55) { state = "hostile"; confidence = 85; }
  if (topPatterns.spam >= 8 && count10m >= 12) { state = "commercial_attack"; confidence = Math.max(confidence, 80); }

  const distinctPatterns = Object.entries(topPatterns).filter(([,v]) => v > 0).length;
  if (distinctPatterns >= 4 && confidence > 40) unknowns.push("mixed_signals");

  return { state, confidence, unknowns };
}

app.get("/health", async () => {
  await pool.query("SELECT 1");
  return { ok: true };
});

app.post("/run", async () => {
  const windowName = "10m";

  const r = await pool.query(`
    SELECT count(*)::int AS c, coalesce(avg(score),0)::int AS avg
    FROM core.observations
    WHERE ts > now() - interval '10 minutes'
  `);

  const patterns = await pool.query(`
    SELECT pattern, count(*)::int AS c
    FROM core.observations
    WHERE ts > now() - interval '10 minutes'
    GROUP BY pattern
  `);

  const topPatterns = { repetition: 0, link: 0, spam: 0, wall_of_text: 0 };
  for (const row of patterns.rows) {
    if (topPatterns[row.pattern] !== undefined) topPatterns[row.pattern] = row.c;
  }

  const count10m = Number(r.rows[0].c);
  const avgScore10m = Number(r.rows[0].avg);

  const { state, confidence, unknowns } = decide({ count10m, avgScore10m, topPatterns });

  episodesTotal.inc({ state });

  await pool.query(
    "INSERT INTO core.episodes(window_name,state,confidence,unknowns,counters) VALUES($1,$2,$3,$4::jsonb,$5::jsonb)",
    [windowName, state, confidence, JSON.stringify(unknowns), JSON.stringify({ count10m, avgScore10m, topPatterns })]
  );

  await pool.query(
    "INSERT INTO core.system_state(episodes_10m,avg_confidence,unstable) VALUES($1,$2,$3)",
    [count10m, confidence, confidence >= 80]
  );

  return { ok: true, window: windowName, state, confidence, unknowns, counters: { count10m, avgScore10m, topPatterns } };
});

app.get("/episodes", async () => {
  const r = await pool.query("SELECT * FROM core.episodes ORDER BY ts DESC LIMIT 15");
  return { episodes: r.rows };
});

app.get("/metrics", async (_, reply) => {
  reply.type(client.register.contentType);
  return client.register.metrics();
});

app.listen({ port: Number(process.env.PORT || 4303), host: "0.0.0.0" });
