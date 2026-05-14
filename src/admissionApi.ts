/**
 * 招生活动排行榜 API（见项目上级目录 API_Usage.md）
 * 生产域名默认 leaderboard.liruochen.cn；本地可通过 VITE_LEADERBOARD_API_BASE 覆盖。
 */

export const LEADERBOARD_DEFAULT_BASE = 'https://leaderboard.liruochen.cn';

export const ADMISSION_CAMPAIGN_ID = 'zgca-admission';

export const ADMISSION_GAME_ID = 'zgc-game-html-hjkg';

export function resolveLeaderboardBaseUrl(): string {
  const raw = import.meta.env.VITE_LEADERBOARD_API_BASE as string | undefined;
  const trimmed = raw?.trim();
  if (trimmed) return trimmed.replace(/\/$/, '');
  return LEADERBOARD_DEFAULT_BASE;
}

/** 从汇总页跳转时 URL 查询参数 user_id */
export function parseLinkUserIdFromUrl(): string | null {
  try {
    const id = new URLSearchParams(window.location.search).get('user_id')?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export type AdmissionGameStatusResponse = {
  campaign_id: string;
  campaign_name?: string;
  game_id: string;
  game_name?: string;
  field_id?: string;
  field_name?: string;
  user_id: string;
  cleared: boolean;
  cleared_at: string | null;
  rank: number | null;
};

export type RegisterClearResponse = {
  status?: string;
  message?: string;
  game_status?: AdmissionGameStatusResponse;
  campaign_status?: unknown;
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const url = `${resolveLeaderboardBaseUrl()}${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const detail =
      typeof data === 'object' && data !== null && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : text || res.statusText;
    throw new Error(`HTTP ${res.status}: ${detail}`);
  }
  return data as T;
}

export async function fetchAdmissionGameStatus(userId: string): Promise<AdmissionGameStatusResponse> {
  return postJson<AdmissionGameStatusResponse>('/api/admission/game_status', {
    campaign_id: ADMISSION_CAMPAIGN_ID,
    game_id: ADMISSION_GAME_ID,
    user_id: userId,
  });
}

const registerClearInflight = new Map<string, Promise<RegisterClearResponse>>();

export function registerAdmissionClear(userId: string): Promise<RegisterClearResponse> {
  const existing = registerClearInflight.get(userId);
  if (existing) return existing;
  const p = postJson<RegisterClearResponse>('/api/admission/register_clear', {
    campaign_id: ADMISSION_CAMPAIGN_ID,
    game_id: ADMISSION_GAME_ID,
    user_id: userId,
  }).finally(() => {
    registerClearInflight.delete(userId);
  });
  registerClearInflight.set(userId, p);
  return p;
}
