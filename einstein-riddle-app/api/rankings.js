import { randomUUID } from "node:crypto";
import { checkPin } from "../lib/pin.mjs";
import { upsertBestEntry } from "../lib/ranking-logic.mjs";
import { isValidDifficulty, normalizeRankingPost } from "../lib/ranking-api.mjs";
import { redisGetJson, redisSetJson } from "../lib/redis.mjs";

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

function rankingKey(difficulty) {
  return `rankings:${difficulty}`;
}

async function loadEntries(difficulty) {
  const raw = await redisGetJson(rankingKey(difficulty));
  return Array.isArray(raw) ? raw : [];
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", "http://localhost");
      const difficulty = String(
        req.query?.difficulty ?? url.searchParams.get("difficulty") ?? "",
      );
      if (!isValidDifficulty(difficulty)) {
        sendJson(res, 400, { error: "difficulty_invalid" });
        return;
      }
      const entries = await loadEntries(difficulty);
      sendJson(res, 200, { difficulty, entries });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const pinResult = checkPin(body.pin, process.env.LOGIN_PIN);
      if (!pinResult.ok) {
        sendJson(res, pinResult.error === "misconfigured" ? 503 : 401, {
          error: pinResult.error,
        });
        return;
      }

      const normalized = normalizeRankingPost(body);
      if (normalized.error) {
        sendJson(res, 400, { error: normalized.error });
        return;
      }

      const { name, role, school, difficulty, timeMs } = normalized.value;
      const incoming = {
        id: randomUUID(),
        name,
        role,
        school,
        timeMs,
        difficulty,
        createdAt: new Date().toISOString(),
      };

      const current = await loadEntries(difficulty);
      const result = upsertBestEntry(current, incoming);
      if (result.status === "saved") {
        await redisSetJson(rankingKey(difficulty), result.entries);
      }
      sendJson(res, 200, {
        status: result.status,
        entries: result.entries,
        ...(result.message ? { message: result.message } : {}),
      });
      return;
    }

    sendJson(res, 405, { error: "method_not_allowed" });
  } catch (error) {
    const detail = error?.code || error?.message || "redis_unavailable";
    sendJson(res, 503, {
      error: "redis_unavailable",
      detail: String(detail).slice(0, 160),
      hasUrl: Boolean(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
      hasToken: Boolean(process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN),
    });
  }
}
