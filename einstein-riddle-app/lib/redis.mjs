function creds() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    const err = new Error("redis_misconfigured");
    err.code = "redis_misconfigured";
    throw err;
  }
  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand(command) {
  const { url, token } = creds();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) {
    throw new Error(`redis_${res.status}`);
  }
  return res.json();
}

export async function redisGetJson(key) {
  const data = await redisCommand(["GET", key]);
  if (data.result == null) return null;
  if (typeof data.result === "object") return data.result;
  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

export async function redisSetJson(key, value) {
  const data = await redisCommand(["SET", key, JSON.stringify(value)]);
  if (data.error) throw new Error(String(data.error));
}
