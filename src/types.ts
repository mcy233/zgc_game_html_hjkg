export type ItemType = 'DATA_POINT' | 'DATASET' | 'CORPUS' | 'ROCK' | 'DIAMOND' | 'BAG' | 'TNT' | 'INTERN';

export type ShopItemType =
  | 'COFFEE'
  | 'GPU'
  | 'SHREDDER'
  | 'SEED'
  | 'DIAMOND_CERT'
  | 'ROCK_HANDLER'
  | 'DEBUG_KIT'
  | 'WIDE_HOOK'
  | 'TIME_BONUS'
  | 'SAMPLER_PRO'
  | 'CORPUS_LENS';

export interface ShopOffer {
  type: ShopItemType;
  price: number;
}

export interface GameItem {
  id: string;
  type: ItemType;
  x: number;
  y: number;
  radius: number;
  value: number;
  weight: number; // Affects pull speed
  label: string;
  color: string;
  vx?: number; // Horizontal velocity for moving items
  rangeMin?: number; // Minimum x for movement
  rangeMax?: number; // Maximum x for movement
  movePauseTimer?: number; // Pause when changing direction
  carriedItem?: ItemType; // Item being carried (e.g., DIAMOND)
}

export interface GameState {
  score: number;
  level: number;
  targetScore: number;
  timeLeft: number;
  status: 'START' | 'TUTORIAL_OVERLAY' | 'PLAYING' | 'SHOP' | 'GAME_OVER' | 'LEVEL_COMPLETE' | 'INTRO' | 'GRADUATED';
  strength: number;
  pullSpeedMultiplier: number;
  hasShredder: number; // Number of paper shredders (dynamite)
  luck: number;
  /** 补给站本轮随机报价（每种商品至多出现一次） */
  availableShopOffers: ShopOffer[];
  purchasedItems: ShopItemType[];
  pauseTimer: number; // For hook pause effect
  /** 本关生效：抓取 💎 时额外加分（含实习生手捧钻石） */
  diamondValueBonus: number;
  /** 本关生效：抓取绊脚石类（ROCK）额外加分 */
  rockValueBonus: number;
  /** 本关生效：钩子碰撞半径加成 */
  hookRadiusBonus: number;
  /** 本关生效：关卡倒计时额外秒数（已在 timeLeft 中体现） */
  extraTimeSeconds: number;
  dataPointBonus: number;
  datasetBonus: number;
  corpusBonus: number;
}
