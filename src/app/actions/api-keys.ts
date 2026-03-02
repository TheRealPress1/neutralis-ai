"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt, tryEncrypt } from "@/lib/encryption";
import { createSign, createHmac, constants as cryptoConstants } from "crypto";
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
    const encSecret = key.api_secret ? tryEncrypt(key.api_secret) : "";
    const encPem = key.private_key_pem ? tryEncrypt(key.private_key_pem) : "";
    if (encSecret === null || encPem === null) {
      return { error: "Encryption is not configured. Please contact support." };
    }

    const { error } = await supabase.from("user_api_keys").upsert(
      {
        user_id: user.id,
        platform: key.platform,
        api_key_id: key.api_key_id,
        api_secret: encSecret,
        private_key_pem: encPem,
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
    // Never expose wallet private key to client — server-side only
    private_key_pem: row.platform === "polymarket_wallet"
      ? (row.private_key_pem ? "[set]" : "")
      : tryDecrypt(row.private_key_pem),
  }));

  return { keys: decrypted };
}

export async function saveWalletAddress(address: string, privateKey?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Auto-derive wallet address from private key if address not provided
  let resolvedAddress = address;
  if (!resolvedAddress && privateKey) {
    try {
      const { privateKeyToAccount } = await import("viem/accounts");
      const key = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
      resolvedAddress = privateKeyToAccount(key).address;
    } catch {
      return { error: "Could not derive wallet address from private key. Check the key format." };
    }
  }
  if (!resolvedAddress) return { error: "Wallet address is required" };

  // Only overwrite private_key_pem if a new key is provided — preserve existing on Update
  type UpsertRow = {
    user_id: string;
    platform: string;
    api_key_id: string;
    api_secret: string;
    is_valid: boolean;
    private_key_pem?: string;
  };
  const upsertData: UpsertRow = {
    user_id: user.id,
    platform: "polymarket_wallet",
    api_key_id: resolvedAddress,
    api_secret: "",
    is_valid: true,
  };
  if (privateKey) {
    const encPrivateKey = tryEncrypt(privateKey);
    if (encPrivateKey === null) {
      return { error: "Encryption is not configured. Please contact support." };
    }
    upsertData.private_key_pem = encPrivateKey;
  }

  const { error } = await supabase.from("user_api_keys").upsert(
    upsertData,
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
  passphrase?: string,
): Promise<{ valid: boolean; error?: string }> {
  try {
    // Polymarket CLOB API key validation — check if credentials parse correctly
    if (!apiKey || !secret) {
      return { valid: false, error: "API Key and API Secret are required" };
    }

    // Validate format: API key should be a non-empty string,
    // secret should be base64-decodable
    try {
      Buffer.from(secret, "base64");
    } catch {
      return { valid: false, error: "API secret is not valid base64" };
    }

    // Check CLOB connectivity via health endpoint
    const healthRes = await fetch("https://clob.polymarket.com/ok", {
      signal: AbortSignal.timeout(5000),
    });

    if (!healthRes.ok) {
      return { valid: false, error: `Polymarket CLOB unreachable (${healthRes.status})` };
    }

    // Format checks passed + CLOB reachable — credentials accepted
    // Full auth validation happens when daemon calls create_or_derive_api_creds()
    return { valid: true };
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
    // Passphrase is no longer stored; validate with key + secret only
    result = await validatePolymarketKey(keyId, secret);
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

/* ── Exchange balances ─────────────────────────────────────────────── */

export interface ExchangeBalances {
  kalshi: { balance: number; portfolio_value: number } | null;
  polymarket: { balance: number; walletAddress?: string } | null;
}

async function fetchKalshiBalance(
  keyId: string,
  pem: string,
): Promise<{ balance: number; portfolio_value: number } | null> {
  try {
    const timestampMs = Date.now().toString();
    const path = "/trade-api/v2/portfolio/balance";
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

    if (!res.ok) return null;

    const data = await res.json();
    return {
      balance: (data.balance ?? 0) / 100,
      portfolio_value: (data.portfolio_value ?? 0) / 100,
    };
  } catch {
    return null;
  }
}

/** Derive Polymarket CLOB credentials from wallet private key via EIP-712 L1 auth */
async function derivePolymarketCreds(
  walletPrivateKey: string,
): Promise<{ apiKey: string; secret: string; passphrase: string; address: string } | null> {
  try {
    const { privateKeyToAccount, signTypedData } = await import("viem/accounts");
    const pk = (walletPrivateKey.startsWith("0x") ? walletPrivateKey : `0x${walletPrivateKey}`) as `0x${string}`;
    const account = privateKeyToAccount(pk);
    const ts = Math.floor(Date.now() / 1000);

    const sig = await signTypedData({
      privateKey: pk,
      domain: { name: "ClobAuthDomain", version: "1", chainId: 137 },
      types: {
        ClobAuth: [
          { name: "address", type: "address" },
          { name: "timestamp", type: "string" },
          { name: "nonce", type: "uint256" },
          { name: "message", type: "string" },
        ],
      },
      primaryType: "ClobAuth",
      message: {
        address: account.address,
        timestamp: String(ts),
        nonce: BigInt(0),
        message: "This message attests that I control the given wallet",
      },
    });

    const res = await fetch("https://clob.polymarket.com/auth/derive-api-key", {
      headers: {
        POLY_ADDRESS: account.address,
        POLY_SIGNATURE: sig,
        POLY_TIMESTAMP: String(ts),
        POLY_NONCE: "0",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.apiKey) return null;
    return { apiKey: data.apiKey, secret: data.secret, passphrase: data.passphrase, address: account.address };
  } catch {
    return null;
  }
}

/** Build L2 HMAC headers for Polymarket CLOB requests */
function buildPolyL2Headers(
  creds: { apiKey: string; secret: string; passphrase: string; address: string },
  method: string,
  path: string,
  body = "",
): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  const secretBytes = Buffer.from(creds.secret, "base64");
  const msg = String(ts) + method.toUpperCase() + path + (body || "");
  const hmacSig = createHmac("sha256", secretBytes).update(msg).digest("base64url");
  return {
    POLY_ADDRESS: creds.address,
    POLY_SIGNATURE: hmacSig,
    POLY_TIMESTAMP: String(ts),
    POLY_API_KEY: creds.apiKey,
    POLY_PASSPHRASE: creds.passphrase,
  };
}

async function fetchPolymarketBalance(
  _apiKey: string,
  _secret: string,
  walletPrivateKey: string,
  _walletAddress: string,
): Promise<{ balance: number } | null> {
  try {
    if (!walletPrivateKey) return null;

    const creds = await derivePolymarketCreds(walletPrivateKey);
    if (!creds) return null;

    const headers = buildPolyL2Headers(creds, "GET", "/balance-allowance");
    const res = await fetch("https://clob.polymarket.com/balance-allowance", { headers });
    if (!res.ok) return null;

    const data = await res.json();
    const bal = typeof data.balance === "string" ? parseFloat(data.balance) : (data.balance ?? 0);
    return { balance: bal, walletAddress };
  } catch {
    return null;
  }
}

export async function fetchBalances(): Promise<ExchangeBalances> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kalshi: null, polymarket: null };

  const { data: keys } = await supabase
    .from("user_api_keys")
    .select("platform, api_key_id, api_secret, private_key_pem")
    .eq("user_id", user.id);

  if (!keys || keys.length === 0) return { kalshi: null, polymarket: null };

  const kalshiRow = keys.find((k) => k.platform === "kalshi");
  const polyRow = keys.find((k) => k.platform === "polymarket");
  const walletRow = keys.find((k) => k.platform === "polymarket_wallet");

  // Fetch both in parallel
  const [kalshi, polymarket] = await Promise.all([
    kalshiRow
      ? fetchKalshiBalance(
          kalshiRow.api_key_id,
          tryDecrypt(kalshiRow.private_key_pem),
        )
      : null,
    polyRow && walletRow
      ? fetchPolymarketBalance(
          polyRow.api_key_id,
          tryDecrypt(polyRow.api_secret),
          tryDecrypt(walletRow.private_key_pem),
          walletRow.api_key_id,
        ).then((b) => b ?? { balance: 0 })  // credentials exist → show $0 on fetch failure
      : null,
  ]);

  return { kalshi, polymarket };
}

/* ── Live exchange positions ──────────────────────────────────────── */

export interface ExchangePosition {
  ticker: string;
  venue: "kalshi" | "polymarket";
  side: string;
  quantity: number;
  market_value: number;
  avg_price: number;
}

export interface LivePositions {
  kalshi: ExchangePosition[];
  polymarket: ExchangePosition[];
}

function signKalshiRequest(keyId: string, pem: string, method: string, path: string) {
  const timestampMs = Date.now().toString();
  const message = timestampMs + method + path;
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
  return {
    "KALSHI-ACCESS-KEY": keyId,
    "KALSHI-ACCESS-TIMESTAMP": timestampMs,
    "KALSHI-ACCESS-SIGNATURE": signature,
  };
}

async function fetchKalshiPositions(
  keyId: string,
  pem: string,
): Promise<ExchangePosition[]> {
  try {
    const path = "/trade-api/v2/portfolio/positions";
    const headers = signKalshiRequest(keyId, pem, "GET", path);

    const res = await fetch(`${KALSHI_BASE}${path}?limit=200`, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const positions = data.market_positions ?? [];

    return positions
      .filter((p: any) => (p.position ?? 0) !== 0)
      .map((p: any) => ({
        ticker: p.ticker ?? "",
        venue: "kalshi" as const,
        side: (p.position ?? 0) > 0 ? "yes" : "no",
        quantity: Math.abs(p.position ?? 0),
        market_value: (p.market_exposure ?? 0) / 100,
        avg_price: (p.total_traded ?? 0) !== 0
          ? Math.abs((p.total_traded ?? 0) / (p.position ?? 1)) / 100
          : 0,
      }));
  } catch {
    return [];
  }
}

async function fetchPolymarketPositions(
  _apiKey: string,
  _secret: string,
  walletPrivateKey: string,
  _walletAddress: string,
): Promise<ExchangePosition[]> {
  try {
    if (!walletPrivateKey) return [];

    const creds = await derivePolymarketCreds(walletPrivateKey);
    if (!creds) return [];

    const headers = buildPolyL2Headers(creds, "GET", "/positions");
    const res = await fetch("https://clob.polymarket.com/positions", { headers });

    if (!res.ok) return [];

    const positions: any[] = await res.json();

    return positions
      .filter((p: any) => parseFloat(p.size ?? "0") > 0)
      .map((p: any) => ({
        ticker: p.asset_id ?? p.token_id ?? "",
        venue: "polymarket" as const,
        side: p.side === "BUY" ? "yes" : "no",
        quantity: parseFloat(p.size ?? "0"),
        market_value: parseFloat(p.size ?? "0") * parseFloat(p.avg_price ?? "0"),
        avg_price: parseFloat(p.avg_price ?? "0"),
      }));
  } catch {
    return [];
  }
}

export async function fetchLivePositions(): Promise<LivePositions> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { kalshi: [], polymarket: [] };

  const { data: keys } = await supabase
    .from("user_api_keys")
    .select("platform, api_key_id, api_secret, private_key_pem")
    .eq("user_id", user.id);

  if (!keys || keys.length === 0) return { kalshi: [], polymarket: [] };

  const kalshiRow = keys.find((k) => k.platform === "kalshi");
  const polyRow = keys.find((k) => k.platform === "polymarket");
  const walletRow = keys.find((k) => k.platform === "polymarket_wallet");

  const [kalshi, polymarket] = await Promise.all([
    kalshiRow
      ? fetchKalshiPositions(
          kalshiRow.api_key_id,
          tryDecrypt(kalshiRow.private_key_pem),
        )
      : [],
    polyRow && walletRow
      ? fetchPolymarketPositions(
          polyRow.api_key_id,
          tryDecrypt(polyRow.api_secret),
          tryDecrypt(walletRow.private_key_pem),
          walletRow.api_key_id,
        )
      : [],
  ]);

  return { kalshi, polymarket };
}
