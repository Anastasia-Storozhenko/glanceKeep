import type { SQLiteDatabase } from 'expo-sqlite';

export type AuthProvider = 'none' | 'email' | 'apple' | 'google';
export type BillingPeriod = 'monthly' | 'yearly' | null;
export type PlanType = 'free' | 'premium';

export type AccountUsage = {
  accountId: string | null;
  authProvider: AuthProvider;
  billingPeriod: BillingPeriod;
  monthlyRequestLimit: number;
  monthlyRequestsUsed: number;
  plan: PlanType;
  resetsAt: string | null;
  tokensUsed: number;
  usageAuthority: string | null;
};

type AccountUsageRow = {
  account_id: string | null;
  auth_provider: AuthProvider;
  billing_period: BillingPeriod;
  plan: PlanType;
  request_limit: number;
  requests_used: number;
  resets_at: string | null;
  tokens_used: number;
  usage_authority: string | null;
};

export async function getAccountUsage(
  database: SQLiteDatabase,
  defaults: AccountUsage,
): Promise<AccountUsage> {
  const row = await database.getFirstAsync<AccountUsageRow>(
    'SELECT * FROM account_usage WHERE id = 1',
  );

  if (!row) return defaults;

  return {
    accountId: row.account_id,
    authProvider: row.auth_provider,
    billingPeriod: row.billing_period,
    monthlyRequestLimit: row.request_limit,
    monthlyRequestsUsed: row.requests_used,
    plan: row.plan,
    resetsAt: row.resets_at,
    tokensUsed: row.tokens_used,
    usageAuthority: row.usage_authority,
  };
}

export async function saveAccountUsage(
  database: SQLiteDatabase,
  usage: AccountUsage,
): Promise<void> {
  await database.runAsync(
    `
      INSERT INTO account_usage (
        id, account_id, auth_provider, plan, billing_period,
        requests_used, request_limit, resets_at, tokens_used, usage_authority
      ) VALUES (
        1, $accountId, $authProvider, $plan, $billingPeriod,
        $requestsUsed, $requestLimit, $resetsAt, $tokensUsed, $usageAuthority
      )
      ON CONFLICT(id) DO UPDATE SET
        account_id = excluded.account_id,
        auth_provider = excluded.auth_provider,
        plan = excluded.plan,
        billing_period = excluded.billing_period,
        requests_used = excluded.requests_used,
        request_limit = excluded.request_limit,
        resets_at = excluded.resets_at,
        tokens_used = excluded.tokens_used,
        usage_authority = excluded.usage_authority
    `,
    {
      $accountId: usage.accountId,
      $authProvider: usage.authProvider,
      $billingPeriod: usage.billingPeriod,
      $plan: usage.plan,
      $requestLimit: usage.monthlyRequestLimit,
      $requestsUsed: usage.monthlyRequestsUsed,
      $resetsAt: usage.resetsAt,
      $tokensUsed: usage.tokensUsed,
      $usageAuthority: usage.usageAuthority,
    },
  );
}
