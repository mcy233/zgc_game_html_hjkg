/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 排行榜 API 根地址，默认 https://leaderboard.liruochen.cn */
  readonly VITE_LEADERBOARD_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
