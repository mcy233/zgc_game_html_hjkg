import type { GameItem, ItemType, ShopItemType, ShopOffer } from './types';

export const CANVAS_WIDTH = 800;
export const CANVAS_HEIGHT = 600;
export const MINER_X = CANVAS_WIDTH / 2;
/** 略低于画布顶，给左侧碎碎念气泡留出垂直空间，避免与小人重叠 */
export const MINER_Y = 96;
export const HOOK_RADIUS = 10;
export const INITIAL_ROPE_LENGTH = 40;
export const SWING_SPEED = 0.016;
export const EXTEND_SPEED = 7;
export const RETRACT_SPEED = 7;
export const BASE_PULL_SPEED = 7;

export const ITEM_CONFIGS: Record<ItemType, { radius: number; value: number; weight: number; color: string; labels: string[] }> = {
  DATA_POINT: {
    radius: 15,
    value: 50,
    weight: 1,
    color: '#4ade80', // green-400
    labels: ['先导课实验数据', '表征空间初探', '有效训练样本', '课程小作业成果'],
  },
  DATASET: {
    radius: 25,
    value: 150,
    weight: 3,
    color: '#22c55e', // green-500
    labels: ['组会展示用集', '跨模态标注数据', '验证与消融集', '高质量训练池'],
  },
  CORPUS: {
    radius: 40,
    value: 500,
    weight: 8,
    color: '#16a34a', // green-600
    labels: ['学院联合语料', '开源大模型数据池', '多模态知识库', '校企共建数据集'],
  },
  ROCK: {
    radius: 30,
    value: 10,
    weight: 10,
    color: '#94a3b8', // slate-400
    labels: ['盲审意见 #2', '培养环节 DDL', '机房排队', '显存告急', '环境配置玄学'],
  },
  DIAMOND: {
    radius: 12,
    value: 1000,
    weight: 1,
    color: '#38bdf8', // sky-400
    labels: ['顶会 Oral', 'SOTA 突破', '学院表彰成果', '核心算法创新'],
  },
  BAG: {
    radius: 20,
    value: 0, // Randomly assigned
    weight: 4,
    color: '#fbbf24', // amber-400
    labels: ['校企课题彩蛋', '神秘算力券', '黑盒基础模型', '预研种子基金'],
  },
  TNT: {
    radius: 20,
    value: 0,
    weight: 1,
    color: '#ef4444', // red-500
    labels: ['集群维护窗口', 'GPU 过热保护', '误触 rm -rf'],
  },
  INTERN: {
    radius: 18,
    value: 20,
    weight: 2,
    color: '#f472b6', // pink-400
    labels: ['同届博士互助', '低年级博士生递样本', '跨组联培伙伴', '学术交流搭子'],
  },
};

export const LEVELS = [
  {
    target: 1200,
    time: 42,
    title: '第一学年 · 博一上｜新生进站',
    desc: '你来到北京中关村学院，成为主攻人工智能方向的博士生新生。学院扎根中关村创新核心区，导师组已就位——先在「潜空间」里熟悉数据与实验管线，把先导课的底子打牢。',
    challenge: '新生适应与数据采集',
  },
  {
    target: 3500,
    time: 42,
    title: '第一学年 · 博一下｜选题与立项',
    desc: '培养方案进入选题季：方向要对准 AI 前沿与中关村产业需求的交汇点。多攒标注与验证集，把想法落成学院认可的正式课题。',
    challenge: '选题论证与初步验证',
  },
  {
    target: 6000,
    time: 42,
    title: '第二学年 · 博二上｜开题攻坚',
    desc: '学院开题季，评审意见会像潜空间里的巨石一样砸下来。用扎实的实验回应质疑，证明你的方案配得上「拔尖创新人才」的培养目标。',
    challenge: '开题报告与评审压力',
  },
  {
    target: 9000,
    time: 42,
    title: '第二学年 · 博二下｜中期考核',
    desc: '培养方案中的中期节点到了。指标波动？补给站的一杯续命咖啡、一颗标准随机种子，都是中关村博士的「隐藏装备」。',
    challenge: '中期考核',
  },
  {
    target: 12500,
    time: 42,
    title: '第三学年 · 博三上｜成果与投稿',
    desc: '要把成果带上顶会榜单，也为学院争光。机房与算力风险同时上升——稳住节奏，挖出真正的突破点。',
    challenge: '论文撰写与投稿冲刺',
  },
  {
    target: 16500,
    time: 42,
    title: '第三学年 · 博三下｜修改再投',
    desc: '审稿意见已至。师兄姐常说：拒稿是常态，改完再投是中关村学院博士的基本功。这一阶段拼的是韧性与迭代速度。',
    challenge: '抗压与论文迭代',
  },
  {
    target: 21000,
    time: 42,
    title: '第四学年 · 博四上｜学位论文',
    desc: '大论文要把几年来自主创新的线索串成体系，像在潜空间里筑起一座属于你的学术语料山，回应学院的学位授予标准。',
    challenge: '学位论文综合撰写',
  },
  {
    target: 26000,
    time: 42,
    title: '第四学年 · 博四下｜学位答辩',
    desc: '答辩厅的灯亮了。多年在学院与中关村创新生态中的积累，将凝成潜空间里最亮的那颗成果钻石——祝你顺利通过学位答辩！',
    challenge: '学位论文答辩',
  },
];

export type ShopEntryColor = 'amber' | 'sky' | 'red' | 'purple' | 'green' | 'orange' | 'pink' | 'slate';

/** 补给站商品定义；价格在进店时于 [minPrice, maxPrice] 内随机（类似经典黄金矿工） */
export const SHOP_ENTRY_DEFS: {
  type: ShopItemType;
  title: string;
  desc: string;
  minPrice: number;
  maxPrice: number;
  color: ShopEntryColor;
}[] = [
  {
    type: 'COFFEE',
    title: '学术交流区续命拿铁',
    desc: '收回探索向量更快',
    minPrice: 35,
    maxPrice: 320,
    color: 'amber',
  },
  {
    type: 'GPU',
    title: '学院算力配额（H100）',
    desc: '拉取重物更省力',
    minPrice: 120,
    maxPrice: 720,
    color: 'sky',
  },
  {
    type: 'SHREDDER',
    title: '稿件回收通道',
    desc: '收回时可丢弃当前抓取',
    minPrice: 28,
    maxPrice: 260,
    color: 'red',
  },
  {
    type: 'SEED',
    title: '学院标准随机种子 42',
    desc: '神秘袋学分更高',
    minPrice: 70,
    maxPrice: 480,
    color: 'purple',
  },
  {
    type: 'DIAMOND_CERT',
    title: '成果认定证书',
    desc: '💎 与手捧钻石各 +200 分',
    minPrice: 95,
    maxPrice: 620,
    color: 'green',
  },
  {
    type: 'ROCK_HANDLER',
    title: '代码调试特训',
    desc: '绊脚石抓取 +55 分',
    minPrice: 55,
    maxPrice: 380,
    color: 'slate',
  },
  {
    type: 'DEBUG_KIT',
    title: 'Debug 急救包',
    desc: '绊脚石再 +40 分，钩子略大',
    minPrice: 65,
    maxPrice: 420,
    color: 'orange',
  },
  {
    type: 'WIDE_HOOK',
    title: '宽口径探索钩',
    desc: '钩子碰撞半径 +12',
    minPrice: 45,
    maxPrice: 340,
    color: 'pink',
  },
  {
    type: 'TIME_BONUS',
    title: '培养时限延期条',
    desc: '本关限时 60 秒',
    minPrice: 88,
    maxPrice: 520,
    color: 'green',
  },
  {
    type: 'SAMPLER_PRO',
    title: '数据采样增强',
    desc: '小数据 +40、数据集 +100 分',
    minPrice: 80,
    maxPrice: 480,
    color: 'sky',
  },
  {
    type: 'CORPUS_LENS',
    title: '语料放大镜',
    desc: '大型语料 +150 分',
    minPrice: 100,
    maxPrice: 560,
    color: 'purple',
  },
];

export function rollRandomShopOffers(): ShopOffer[] {
  const pool = [...SHOP_ENTRY_DEFS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = 3 + Math.floor(Math.random() * 4);
  return pool.slice(0, count).map((d) => ({
    type: d.type,
    price: Math.floor(d.minPrice + Math.random() * (d.maxPrice - d.minPrice + 1)),
  }));
}

/** 手捧钻石的实习生（固定关卡配置用） */
export type LevelSpawnToken = ItemType | 'INTERN_D';

/** 确定性 PRNG（固定种子），用于生成「看起来像随机」的矿坑坐标 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 生成与旧版「随机落点」同一边界内的散点：x/y 在画布下部不规则分布，且槽位间保持最小间距，避免叠成一团。
 * 结果仅依赖固定种子，全关共用、每次运行一致。
 */
function buildFixedScatterMineSlots(slotCount: number): { x: number; y: number }[] {
  const rand = mulberry32(0x5c07d);
  const out: { x: number; y: number }[] = [];
  /** 与旧逻辑一致的可投放区：y 从地表线 150 以下；留边给最大半径语料等 */
  const pad = 44;
  const xMin = pad;
  const xMax = CANVAS_WIDTH - pad;
  const yMin = 150 + pad;
  const yMax = CANVAS_HEIGHT - pad;
  /** 槽位中心最小间距（近似旧版两物半径和 + 10，取折中以容纳 30 点） */
  let minSep = 48;
  const minSepFloor = 40;

  const tooClose = (x: number, y: number) => {
    for (const p of out) {
      if (Math.hypot(p.x - x, p.y - y) < minSep) return true;
    }
    return false;
  };

  for (let i = 0; i < slotCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 420 && !placed; attempt++) {
      const x = xMin + rand() * (xMax - xMin);
      const y = yMin + rand() * (yMax - yMin);
      if (!tooClose(x, y)) {
        out.push({ x: Math.round(x), y: Math.round(y) });
        placed = true;
      }
    }
    if (!placed) {
      if (minSep > minSepFloor) {
        minSep -= 2;
        i--;
        continue;
      }
      // 极端情况：螺旋式兜底，仍保持不规则
      const t = i / Math.max(slotCount - 1, 1);
      const ang = i * 2.39996322972865332 + rand() * 0.9;
      const rx = (xMax - xMin) * 0.42 * Math.sqrt(t + 0.08);
      const ry = (yMax - yMin) * 0.38 * Math.sqrt(t + 0.08);
      const cx = (xMin + xMax) / 2 + (rand() - 0.5) * 70;
      const cy = yMin + (yMax - yMin) * 0.55;
      let x = cx + Math.cos(ang) * rx;
      let y = cy + Math.sin(ang) * ry;
      x = clamp(x, xMin, xMax);
      y = clamp(y, yMin, yMax);
      out.push({ x: Math.round(x), y: Math.round(y) });
    }
  }

  return out;
}

/**
 * 全关共用的固定矿坑坐标（像素，逻辑分辨率 800×600）。
 * 散点由固定种子算法生成，视觉上接近旧版随机摆放，但每关、每台设备一致。
 */
export const MINE_SLOT_POSITIONS: readonly { readonly x: number; readonly y: number }[] = Object.freeze(
  buildFixedScatterMineSlots(30)
);

/**
 * 8 关固定生成表：类型与顺序绑定到 MINE_SLOT_POSITIONS 下标。
 * 设计原则：前期多小数据、少障碍；中后期增加语料/钻石/雷与「绊脚石」，实习生手捧钻石逐步增多。
 */
export const LEVEL_SPAWN_PLANS: readonly (readonly LevelSpawnToken[])[] = [
  // L1 博一上｜新生进站 — 先导课与基础数据为主；穿插 1 个语料作高价值目标，顺序绑定槽位以拉开大物体间距
  [
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'DATASET', 'DATASET', 'CORPUS', 'DATASET', 'DATASET', 'DATASET',
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'ROCK', 'BAG', 'DIAMOND', 'INTERN',
  ],
  // L2 博一下｜选题 — 标注集、验证集增多
  [
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET',
    'CORPUS',
    'ROCK', 'ROCK',
    'BAG', 'DIAMOND', 'INTERN',
  ],
  // L3 博二上｜开题 — 评审压力：大石、首颗雷、双高价值成果
  [
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET',
    'CORPUS', 'CORPUS',
    'ROCK', 'ROCK', 'ROCK',
    'TNT',
    'BAG', 'DIAMOND', 'DIAMOND',
    'INTERN', 'INTERN_D',
  ],
  // L4 博二下｜中期 — 资源参差、神秘袋与机动人更多
  [
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET',
    'CORPUS', 'CORPUS',
    'ROCK', 'ROCK', 'ROCK', 'ROCK',
    'TNT',
    'BAG', 'BAG', 'DIAMOND', 'DIAMOND',
    'INTERN', 'INTERN_D',
  ],
  // L5 博三上｜投稿 — 大语料、机房风险、冲刺成果
  [
    'DATA_POINT', 'DATA_POINT',
    'DATASET', 'DATASET', 'DATASET', 'DATASET', 'DATASET',
    'CORPUS', 'CORPUS', 'CORPUS',
    'ROCK', 'ROCK', 'ROCK', 'ROCK',
    'TNT', 'TNT',
    'BAG', 'BAG', 'DIAMOND', 'DIAMOND',
    'INTERN', 'INTERN_D', 'INTERN', 'INTERN_D',
  ],
  // L6 博三下｜再投 — 前置语料与数据集交错，雷在中段（总量与原 24 相当）
  [
    'DATASET', 'CORPUS', 'DATA_POINT', 'DATASET', 'CORPUS',
    'DATASET', 'DATA_POINT', 'CORPUS', 'DATASET',
    'TNT', 'ROCK', 'ROCK', 'DATASET',
    'ROCK', 'ROCK', 'TNT',
    'BAG', 'DIAMOND', 'BAG', 'DIAMOND',
    'INTERN', 'INTERN_D', 'INTERN', 'INTERN_D',
  ],
  // L7 博四上｜学位论文 — 小数据开路，语料+数据集混排，双雷分隔
  [
    'DATA_POINT', 'DATA_POINT', 'DATA_POINT',
    'CORPUS', 'CORPUS', 'DATASET', 'CORPUS', 'DATASET', 'CORPUS', 'DATASET',
    'ROCK', 'TNT', 'ROCK', 'ROCK',
    'BAG', 'DIAMOND', 'ROCK',
    'TNT', 'BAG', 'DIAMOND', 'DIAMOND',
    'INTERN', 'INTERN_D', 'INTERN', 'INTERN_D', 'INTERN_D',
  ],
  // L8 博四下｜答辩 — 障碍贴顶、成果沉底，TNT 分居两侧，机动人环伺
  [
    'ROCK', 'TNT', 'ROCK', 'CORPUS', 'ROCK', 'DATASET',
    'CORPUS', 'DATASET', 'CORPUS', 'BAG',
    'ROCK', 'ROCK', 'CORPUS', 'DATASET',
    'TNT', 'DIAMOND', 'DATA_POINT', 'BAG',
    'DIAMOND', 'DIAMOND', 'DIAMOND', 'DATASET',
    'INTERN', 'INTERN_D', 'INTERN', 'INTERN_D', 'INTERN_D', 'INTERN_D',
  ],
];

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** 后三关对槽位下标做不同洗牌，避免视觉上与前几关「同一套坐标顺序」雷同 */
function shuffledSlotIndices(planLength: number, level: number): number[] {
  const arr = Array.from({ length: planLength }, (_, i) => i);
  if (level < 6) return arr;
  const seed0 = level === 6 ? 0x61ea00 : level === 7 ? 0x71ea01 : 0x81ea02;
  let seed = seed0;
  for (let k = arr.length - 1; k > 0; k--) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const j = seed % (k + 1);
    [arr[k], arr[j]] = [arr[j], arr[k]];
  }
  return arr;
}

/** 按关卡（1–8）生成固定布局的场上物品 */
export function buildLevelItems(level: number): GameItem[] {
  const lv = clamp(level, 1, 8);
  const plan = LEVEL_SPAWN_PLANS[lv - 1];
  const items: GameItem[] = [];
  const slotOrder = shuffledSlotIndices(plan.length, lv);

  plan.forEach((token, i) => {
    const slotIdx = slotOrder[i] ?? i;
    const slot = MINE_SLOT_POSITIONS[slotIdx];
    if (!slot) return;

    const type: ItemType = token === 'INTERN_D' ? 'INTERN' : token;
    const carriedItem: ItemType | undefined = token === 'INTERN_D' ? 'DIAMOND' : undefined;

    const config = ITEM_CONFIGS[type];
    const { radius } = config;
    const x = clamp(slot.x, radius + 2, CANVAS_WIDTH - radius - 2);
    const y = clamp(slot.y, 150 + radius + 2, CANVAS_HEIGHT - radius - 2);

    let itemValue = config.value;
    if (carriedItem) itemValue += 1000;

    const labelIdx = (lv * 17 + i * 11) % config.labels.length;
    const label = config.labels[labelIdx];

    let vx: number | undefined;
    let rangeMin: number | undefined;
    let rangeMax: number | undefined;
    let movePauseTimer: number | undefined;

    if (type === 'INTERN') {
      const sign = (lv * 31 + i * 7) % 2 === 0 ? 1 : -1;
      const speed = 0.68 + ((lv * 13 + i * 19) % 55) / 100;
      vx = sign * speed;
      const rangeWidth = Math.min(
        CANVAS_WIDTH - 2 * radius - 24,
        240 + ((lv + i) * 41) % 300
      );
      rangeMin = Math.max(radius, x - rangeWidth / 2);
      rangeMax = Math.min(CANVAS_WIDTH - radius, x + rangeWidth / 2);
      movePauseTimer = 0;
    }

    items.push({
      id: `L${lv}-S${i}-${type}`,
      type,
      x,
      y,
      radius,
      value: type === 'BAG' ? 0 : itemValue,
      weight: carriedItem ? config.weight + 1 : config.weight,
      label,
      color: config.color,
      vx,
      rangeMin,
      rangeMax,
      movePauseTimer,
      carriedItem,
    });
  });

  return items;
}
