import { list, put } from "@vercel/blob";

function pathFor(key) {
  return `rankings/${String(key).replace(/[^a-zA-Z0-9:_-]/g, "_")}.json`;
}

function ensureToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    const err = new Error("blob_misconfigured");
    err.code = "blob_misconfigured";
    throw err;
  }
}

export async function redisGetJson(key) {
  ensureToken();
  const pathname = pathFor(key);
  const { blobs } = await list({
    prefix: pathname,
    limit: 10,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
  const match = blobs.find((b) => b.pathname === pathname);
  if (!match?.url) return null;
  const res = await fetch(match.url, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`blob_get_${res.status}`);
  return res.json();
}

export async function redisSetJson(key, value) {
  ensureToken();
  const pathname = pathFor(key);
  await put(pathname, JSON.stringify(value), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });
}
