import { supabaseAdmin } from "@/lib/supabase/admin";

export const FREE_PLAYGROUND_SIMULATIONS_PER_DAY = 5;
export const FREE_PLAYGROUND_IDEA_REQUESTS_PER_DAY = 10;

export const QUOTA_BUCKETS = {
  playgroundSimulation: "playground_simulation",
  playgroundIdea: "playground_idea",
} as const;

interface QuotaState {
  used_count: number;
  remaining: number;
  usage_date: string;
}

interface ConsumedQuotaState extends QuotaState {
  allowed: boolean;
}

function isMissingQuotaRpc(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : null;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  return code === "PGRST202" || message.includes("operator_daily_quota");
}

function fallbackQuotaState(dailyLimit: number): QuotaState {
  return {
    used_count: 0,
    remaining: dailyLimit,
    usage_date: new Date().toISOString().slice(0, 10),
  };
}

export async function getDailyQuotaState(
  userId: string,
  bucket: string,
  dailyLimit: number
): Promise<QuotaState> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("get_operator_daily_quota", {
    p_user_id: userId,
    p_bucket: bucket,
    p_daily_limit: dailyLimit,
  });

  if (error) {
    if (process.env.NODE_ENV !== "production" && isMissingQuotaRpc(error)) {
      return fallbackQuotaState(dailyLimit);
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      ...fallbackQuotaState(dailyLimit),
    };
  }

  return row as QuotaState;
}

export async function consumeDailyQuota(
  userId: string,
  bucket: string,
  dailyLimit: number,
  amount = 1
): Promise<ConsumedQuotaState> {
  const db = supabaseAdmin();
  const { data, error } = await db.rpc("consume_operator_daily_quota", {
    p_user_id: userId,
    p_bucket: bucket,
    p_daily_limit: dailyLimit,
    p_amount: amount,
  });

  if (error) {
    if (process.env.NODE_ENV !== "production" && isMissingQuotaRpc(error)) {
      return {
        allowed: true,
        ...fallbackQuotaState(dailyLimit),
      };
    }
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return {
      allowed: false,
      used_count: dailyLimit,
      remaining: 0,
      usage_date: new Date().toISOString().slice(0, 10),
    };
  }

  // Map prefixed column names from RPC to our interface
  return {
    allowed: row.out_allowed ?? row.allowed,
    used_count: row.out_used_count ?? row.used_count,
    remaining: row.out_remaining ?? row.remaining,
    usage_date: row.out_usage_date ?? row.usage_date,
  } as ConsumedQuotaState;
}

export async function refundDailyQuota(
  userId: string,
  bucket: string,
  amount = 1
): Promise<void> {
  if (amount <= 0) {
    return;
  }

  const db = supabaseAdmin();
  const { error } = await db.rpc("adjust_operator_daily_quota", {
    p_user_id: userId,
    p_bucket: bucket,
    p_delta: -Math.abs(amount),
  });

  if (error) {
    if (process.env.NODE_ENV !== "production" && isMissingQuotaRpc(error)) {
      return;
    }
    throw error;
  }
}
