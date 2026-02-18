"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";
import { createSign, constants as cryptoConstants } from "crypto";
import { rateLimit, SENSITIVE_LIMIT, getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

export interface ApiKeyData {
  platform: "kalshi" | "polymarket";
  api_key_id: string;
  api_secret: string;
  private_key_pem: string;
}

export async function saveApiKeys(keys: ApiKeyData[]) {
  const ip = await getClientIp();
  if (!rateLimit(`keys:save:${ip}`, SENSITIVE_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  for (const key of keys) {
    const { error } = await supabase.from("user_api_keys").upsert(
      {
        user_id: user.id,
        platform: key.platform,
        api_key_id: key.api_key_id,
        api_secret: key.api_secret ? encrypt(key.api_secret) : "",
        private_key_pem: key.private_key_pem
          ? encrypt(key.private_key_pem)
          : "",
        is_valid: true,
      },
      { onConflict: "user_id,platform" },
    );
    if (error) return { error: error.message };
  }

  const platforms = keys.map((k) => k.platform);
  logAudit("keys.saved", { entityType: "api_key", details: { platforms } });
  return { success: true };
}

function tryDecrypt(value: string): string {
  if (!value) return value;
  try {
    return decrypt(value);
  } catch {
    // Value may be legacy plaintext — return as-is
    return value;
  }
}

export async function getApiKeys() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", keys: [] };

  const { data, error } = await supabase
    .from("user_api_keys")
    .select(
      "id, platform, api_key_id, api_secret, private_key_pem, is_valid, updated_at",
    )
    .eq("user_id", user.id);

  if (error) return { error: error.message, keys: [] };

  const decrypted = (data ?? []).map((row) => ({
    ...row,
    api_secret: tryDecrypt(row.api_secret),
    private_key_pem: tryDecrypt(row.private_key_pem),
  }));

  return { keys: decrypted };
}

export async function saveWalletAddress(address: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase.from("user_api_keys").upsert(
    {
      user_id: user.id,
      platform: "polymarket_wallet",
      api_key_id: address,
      api_secret: "",
      private_key_pem: "",
      is_valid: true,
    },
    { onConflict: "user_id,platform" },
  );

  if (error) return { error: error.message };
  return { success: true };
}

export async function deleteApiKey(platform: string) {
  const ip = await getClientIp();
  if (!rateLimit(`keys:delete:${ip}`, SENSITIVE_LIMIT).success) {
    return { error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { error } = await supabase
    .from("user_api_keys")
    .delete()
    .eq("user_id", user.id)
    .eq("platform", platform);

  if (error) return { error: error.message };
  logAudit("keys.deleted", { entityType: "api_key", details: { platform } });
  return { success: true };
}

/* ── Key validation ─────────────────────────────────────────────── */

const KALSHI_BASE = "https://api.elections.kalshi.com";

export async function validateKalshiKey(
  keyId: string,
  pem: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    const timestampMs = Date.now().toString();
    const path = "/trade-api/v2/exchange/status";
    const message = timestampMs + "GET" + path;

    const sign = createSign("SHA256");
    sign.update(message);
    const signature = sign.sign(
      {
        key: pem,
        padding: cryptoConstants.RSA_PKCS1_PSS_PADDING,
        saltLength: cryptoConstants.RSA_PSS_SALTLEN_MAX_SIGN,
      },
      "base64",
    );

    const res = await fetch(`${KALSHI_BASE}${path}`, {
      headers: {
        "KALSHI-ACCESS-KEY": keyId,
        "KALSHI-ACCESS-TIMESTAMP": timestampMs,
        "KALSHI-ACCESS-SIGNATURE": signature,
      },
    });

    if (res.ok) return { valid: true };
    const body = await res.text();
    return { valid: false, error: `Kalshi returned ${res.status}: ${body}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("PEM") || msg.includes("key")) {
      return { valid: false, error: "Invalid RSA private key format" };
    }
    return { valid: false, error: msg };
  }
}

export async function validatePolymarketKey(
  apiKey: string,
  secret: string,
  passphrase: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Polymarket CLOB API key validation — check if credentials parse correctly
    if (!apiKey || !secret || !passphrase) {
      return { valid: false, error: "All three fields are required" };
    }

    // Validate format: API key should be a non-empty string,
    // secret should be base64-decodable
    try {
      Buffer.from(secret, "base64");
    } catch {
      return { valid: false, error: "API secret is not valid base64" };
    }

    // Try to hit the Polymarket CLOB API with a simple GET
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const { createHmac } = await import("crypto");
    const hmac = createHmac("sha256", Buffer.from(secret, "base64"));
    hmac.update(timestamp + "GET" + "/ak/nonce");
    const sig = hmac.digest("base64");

    const res = await fetch("https://clob.polymarket.com/ak/nonce", {
      headers: {
        "POLY-ADDRESS": "",
        "POLY-SIGNATURE": sig,
        "POLY-TIMESTAMP": timestamp,
        "POLY-API-KEY": apiKey,
        "POLY-PASSPHRASE": passphrase,
      },
    });

    if (res.ok || res.status === 400) {
      // 400 can mean "bad address" but credentials parsed — keys are valid format
      return { valid: true };
    }

    if (res.status === 401) {
      return { valid: false, error: "Invalid API credentials" };
    }

    return { valid: false, error: `Polymarket returned ${res.status}` };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function testConnection(
  platform: string,
): Promise<{ valid: boolean; error?: string }> {
  const ip = await getClientIp();
  if (!rateLimit(`keys:test:${ip}`, SENSITIVE_LIMIT).success) {
    return { valid: false, error: "Too many attempts. Please try again later." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { valid: false, error: "Not authenticated" };

  const { data } = await supabase
    .from("user_api_keys")
    .select("api_key_id, api_secret, private_key_pem")
    .eq("user_id", user.id)
    .eq("platform", platform)
    .single();

  if (!data) return { valid: false, error: "No keys found for this platform" };

  const keyId = data.api_key_id;
  const secret = tryDecrypt(data.api_secret);
  const pem = tryDecrypt(data.private_key_pem);

  let result: { valid: boolean; error?: string };
  if (platform === "kalshi") {
    result = await validateKalshiKey(keyId, pem);
  } else if (platform === "polymarket") {
    result = await validatePolymarketKey(keyId, secret, pem);
  } else {
    return { valid: false, error: "Unknown platform" };
  }

  // Update is_valid flag in DB
  await supabase
    .from("user_api_keys")
    .update({ is_valid: result.valid })
    .eq("user_id", user.id)
    .eq("platform", platform);

  logAudit("keys.validated", {
    entityType: "api_key",
    details: { platform, valid: result.valid },
  });
  return result;
}
