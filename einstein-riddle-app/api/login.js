import { checkPin } from "../lib/pin.mjs";

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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { ok: false, error: "method_not_allowed" });
    return;
  }

  try {
    const body = await readJson(req);
    const result = checkPin(body.pin, process.env.LOGIN_PIN);
    if (!result.ok) {
      sendJson(res, result.error === "misconfigured" ? 503 : 401, {
        ok: false,
        error: result.error,
      });
      return;
    }
    sendJson(res, 200, { ok: true });
  } catch {
    sendJson(res, 400, { ok: false, error: "bad_request" });
  }
}
