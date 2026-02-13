"use server";

import { createClient } from "@/lib/supabase/server";
import { encrypt, decrypt } from "@/lib/encryption";

export interface ApiKeyData {
  platform: "kalshi" | "polymarket";
  api_key_id: string;
  api_secret: string;
  private_key_pem: string;
}

export async function saveApiKeys(keys: ApiKeyData[]) {
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

export async function deleteApiKey(platform: string) {
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
  return { success: true };
}
