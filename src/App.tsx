/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ViewportScaleFit } from './ViewportScaleFit';
import { 
  Coffee, 
  Trash2, 
  Dice5, 
  Play, 
  RotateCcw, 
  ShoppingCart, 
  Cpu,
  Sparkles,
  LogOut,
  Gem,
  Bug,
  Crosshair,
  Clock,
  Layers,
  BookOpen,
  Wrench,
} from 'lucide-react';
import { 
  CANVAS_WIDTH, 
  CANVAS_HEIGHT, 
  MINER_X, 
  MINER_Y, 
  HOOK_RADIUS, 
  INITIAL_ROPE_LENGTH, 
  SWING_SPEED, 
  EXTEND_SPEED, 
  RETRACT_SPEED, 
  BASE_PULL_SPEED,
  LEVELS,
  SHOP_ENTRY_DEFS,
  rollRandomShopOffers,
  buildLevelItems,
} from './constants';
import {
  parseLinkUserIdFromUrl,
  fetchAdmissionGameStatus,
  registerAdmissionClear,
} from './admissionApi';
import { GameItem, GameState, ShopItemType } from './types';
import { getCatchMumble, getShredderMumble } from './phdMumbles';

const ART_ASSET_BASE = `${import.meta.env.BASE_URL}assets`;

const ITEM_ART: Record<GameItem['type'], string> = {
  DATA_POINT: `${ART_ASSET_BASE}/sprites/items/data-point.webp`,
  DATASET: `${ART_ASSET_BASE}/sprites/items/dataset.webp`,
  CORPUS: `${ART_ASSET_BASE}/sprites/items/corpus.webp`,
  ROCK: `${ART_ASSET_BASE}/sprites/items/rock.webp`,
  DIAMOND: `${ART_ASSET_BASE}/sprites/items/diamond.webp`,
  BAG: `${ART_ASSET_BASE}/sprites/items/bag.webp`,
  TNT: `${ART_ASSET_BASE}/sprites/items/tnt.webp`,
  INTERN: `${ART_ASSET_BASE}/sprites/characters/intern-helper.webp`,
};

const SHOP_ICON_ART: Partial<Record<ShopItemType, string>> = {
  COFFEE: `${ART_ASSET_BASE}/sprites/shop_items/学术交流区续命拿铁.webp`,
  GPU: `${ART_ASSET_BASE}/sprites/shop_items/学院算力配额.webp`,
  SHREDDER: `${ART_ASSET_BASE}/sprites/shop_items/稿件回收通道.webp`,
  SEED: `${ART_ASSET_BASE}/sprites/shop_items/学院标准随机种子 42.webp`,
  DIAMOND_CERT: `${ART_ASSET_BASE}/sprites/shop_items/成果认定证书.webp`,
  ROCK_HANDLER: `${ART_ASSET_BASE}/sprites/shop_items/代码调试特训.webp`,
  DEBUG_KIT: `${ART_ASSET_BASE}/sprites/shop_items/Debug 急救包.webp`,
  WIDE_HOOK: `${ART_ASSET_BASE}/sprites/shop_items/宽口径探索钩.webp`,
  TIME_BONUS: `${ART_ASSET_BASE}/sprites/shop_items/培养时限延期条.webp`,
  SAMPLER_PRO: `${ART_ASSET_BASE}/sprites/shop_items/数据采样增强.webp`,
  CORPUS_LENS: `${ART_ASSET_BASE}/sprites/shop_items/语料放大镜.webp`,
};

type MinerMood = 'normal' | 'blink' | 'cry' | 'happy' | 'excited';

const MINER_MOOD_ART: Record<MinerMood, string> = {
  normal: `${ART_ASSET_BASE}/sprites/characters/miner-state-normal.webp`,
  blink: `${ART_ASSET_BASE}/sprites/characters/miner-state-blink.webp`,
  cry: `${ART_ASSET_BASE}/sprites/characters/miner-state-cry.webp`,
  happy: `${ART_ASSET_BASE}/sprites/characters/miner-state-happy.webp`,
  excited: `${ART_ASSET_BASE}/sprites/characters/miner-state-excited.webp`,
};

const CANVAS_BOOT_ASSET_PATHS = [
  `${ART_ASSET_BASE}/backgrounds/latent-space-portrait.webp`,
  `${ART_ASSET_BASE}/sprites/hook/hook-open.webp`,
  `${ART_ASSET_BASE}/sprites/hook/rope-segmented.webp`,
  MINER_MOOD_ART.normal,
] as const;

const CANVAS_GAMEPLAY_ASSET_PATHS = [
  `${ART_ASSET_BASE}/sprites/hook/hook-closed.webp`,
  ...Object.values(ITEM_ART),
  MINER_MOOD_ART.blink,
  MINER_MOOD_ART.cry,
  MINER_MOOD_ART.happy,
  MINER_MOOD_ART.excited,
] as const;

const canvasImageCache = new Map<string, HTMLImageElement>();

function getLoadedCanvasImage(path: string): HTMLImageElement | undefined {
  const img = canvasImageCache.get(path);
  return img?.complete && img.naturalWidth > 0 ? img : undefined;
}

function preloadCanvasImages(paths: readonly string[], onLoad: () => void, isCancelled: () => boolean) {
  if (typeof Image === 'undefined') return;
  paths.forEach((path) => {
    if (canvasImageCache.has(path)) return;
    const img = new Image();
    img.src = path;
    img.onload = () => {
      if (!isCancelled()) onLoad();
    };
    canvasImageCache.set(path, img);
  });
}

function drawImageCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const imgRatio = img.naturalWidth / img.naturalHeight;
  const boxRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (imgRatio > boxRatio) {
    sw = img.naturalHeight * boxRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = img.naturalWidth / boxRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function scoreValueForMood(item: GameItem, gameState: GameState): number {
  if (item.type === 'TNT') return 0;
  if (item.type === 'BAG') return 150;

  let base = item.value;
  if (item.type === 'DIAMOND' || (item.type === 'INTERN' && item.carriedItem === 'DIAMOND')) {
    base += gameState.diamondValueBonus || 0;
  }
  if (item.type === 'ROCK') base += gameState.rockValueBonus || 0;
  if (item.type === 'DATA_POINT') base += gameState.dataPointBonus || 0;
  if (item.type === 'DATASET') base += gameState.datasetBonus || 0;
  if (item.type === 'CORPUS') base += gameState.corpusBonus || 0;
  return Math.max(0, Math.floor(base));
}

function moodForCatch(item: GameItem, gameState: GameState): MinerMood {
  const value = scoreValueForMood(item, gameState);
  if (value >= 1000) return 'excited';
  if (value < 50) return 'cry';
  return 'happy';
}

function DesignCanvasFit({
  children,
  width,
  height,
  className = '',
  innerClassName = '',
}: {
  children: React.ReactNode;
  width: number;
  height: number;
  className?: string;
  innerClassName?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const outer = outerRef.current;
      if (!outer) return;
      const cw = outer.clientWidth;
      const ch = outer.clientHeight;
      if (cw < 4 || ch < 4) return;
      setScale(Math.min(cw / width, ch / height));
    };

    update();
    const ro = new ResizeObserver(update);
    if (outerRef.current) ro.observe(outerRef.current);
    window.addEventListener('orientationchange', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('orientationchange', update);
    };
  }, [height, width]);

  return (
    <div ref={outerRef} className={`flex min-h-0 w-full items-center justify-center overflow-hidden ${className}`}>
      <div className="relative shrink-0" style={{ width: width * scale, height: height * scale }}>
        <div
          className={innerClassName}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function formatApiTime(value: string): string {
  let parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    parsed = new Date(value.replace(' ', 'T') + 'Z');
  }

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  const seconds = String(parsed.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function shopRowIcon(type: ShopItemType, iconClass = 'w-7 h-7'): React.ReactNode {
  const artSrc = SHOP_ICON_ART[type];
  if (artSrc) {
    return <img src={artSrc} alt="" className={`${iconClass} object-contain drop-shadow`} draggable={false} />;
  }

  switch (type) {
    case 'COFFEE': return <Coffee className={iconClass} />;
    case 'GPU': return <Cpu className={iconClass} />;
    case 'SHREDDER': return <Trash2 className={iconClass} />;
    case 'SEED': return <Dice5 className={iconClass} />;
    case 'DIAMOND_CERT': return <Gem className={iconClass} />;
    case 'ROCK_HANDLER': return <Bug className={iconClass} />;
    case 'DEBUG_KIT': return <Wrench className={iconClass} />;
    case 'WIDE_HOOK': return <Crosshair className={iconClass} />;
    case 'TIME_BONUS': return <Clock className={iconClass} />;
    case 'SAMPLER_PRO': return <Layers className={iconClass} />;
    case 'CORPUS_LENS': return <BookOpen className={iconClass} />;
    default: return <ShoppingCart className={iconClass} />;
  }
}

// --- Visual Effect Classes ---

class Particle {
  x: number; y: number; vx: number; vy: number; life: number; color: string; size: number;
  constructor(x: number, y: number, color: string) {
    this.x = x; this.y = y;
    this.vx = (Math.random() - 0.5) * 8;
    this.vy = (Math.random() - 0.5) * 8;
    this.life = 1.0;
    this.color = color;
    this.size = Math.random() * 4 + 2;
  }
  update(dt = 1) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= 0.02 * dt; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1.0;
  }
}

class FloatingText {
  x: number; y: number; text: string; life: number; color: string;
  constructor(x: number, y: number, text: string, color: string) {
    this.x = x; this.y = y; this.text = text; this.life = 1.0; this.color = color;
  }
  update(dt = 1) { this.y -= 1 * dt; this.life -= 0.015 * dt; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1.0;
  }
}

type StageMode = 'desktop' | 'portrait';

type StageConfig = {
  mode: StageMode;
  width: number;
  height: number;
  minerX: number;
  minerY: number;
  itemTop: number;
  itemBottom: number;
  itemScale: number;
  hookSpeedScale: number;
  maxCssWidth: string;
};

const DESKTOP_STAGE: StageConfig = {
  mode: 'desktop',
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  minerX: MINER_X,
  minerY: MINER_Y,
  itemTop: 150,
  itemBottom: CANVAS_HEIGHT - 44,
  itemScale: 1,
  hookSpeedScale: 1,
  maxCssWidth: '800px',
};

const PORTRAIT_STAGE: StageConfig = {
  mode: 'portrait',
  width: 720,
  height: 1600,
  minerX: 360,
  minerY: 330,
  itemTop: 460,
  itemBottom: 1245,
  itemScale: 1.55,
  hookSpeedScale: 2.35,
  maxCssWidth: '520px',
};

function shouldUsePortraitStage() {
  if (typeof window === 'undefined') return false;
  const { innerWidth: w, innerHeight: h } = window;
  return h > w && w <= 820 && h / Math.max(w, 1) >= 1.35;
}

function getResponsiveStage(): StageConfig {
  return shouldUsePortraitStage() ? PORTRAIT_STAGE : DESKTOP_STAGE;
}

function createInitialHook() {
  return {
    angle: Math.PI / 2,
    length: INITIAL_ROPE_LENGTH,
    state: 'SWINGING' as 'SWINGING' | 'EXTENDING' | 'RETRACTING',
    swingDirection: 1,
    caughtItem: null as GameItem | null,
  };
}

function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function mapBaseItemToStage(item: GameItem, stage: StageConfig): GameItem {
  if (stage.mode === 'desktop') return { ...item };

  const radius = item.radius * stage.itemScale;
  const xScale = stage.width / CANVAS_WIDTH;
  const baseTop = 150;
  const baseBottom = CANVAS_HEIGHT - 44;
  const yT = (item.y - baseTop) / Math.max(1, baseBottom - baseTop);
  const x = item.x * xScale;
  const y = stage.itemTop + yT * (stage.itemBottom - stage.itemTop);
  const finalX = Math.max(radius + 18, Math.min(stage.width - radius - 18, x));
  const rangePadding = Math.max(56, radius + 18);
  const moveRange = 132;

  return {
    ...item,
    x: finalX,
    y: Math.max(stage.itemTop + radius, Math.min(stage.itemBottom - radius, y)),
    radius,
    vx: item.vx == null ? undefined : item.vx * 0.9,
    rangeMin: item.vx == null ? undefined : Math.max(rangePadding, finalX - moveRange / 2),
    rangeMax: item.vx == null ? undefined : Math.min(stage.width - rangePadding, finalX + moveRange / 2),
  };
}

function buildPortraitLevelItems(level: number, stage: StageConfig): GameItem[] {
  const baseItems = buildLevelItems(level);
  if (level === 3) {
    return baseItems.map((item) => mapBaseItemToStage(item, stage));
  }

  const rand = seededRandom(0x9107 + level * 0x1009);
  const placed: GameItem[] = [];

  baseItems.forEach((item, index) => {
    const radius = item.radius * stage.itemScale;
    const minX = radius + 36;
    const maxX = stage.width - radius - 36;
    const minY = stage.itemTop + radius;
    const maxY = stage.itemBottom - radius;
    const bandCount = Math.max(5, Math.ceil(baseItems.length / 3));
    const band = (index * 7 + level * 3) % bandCount;
    const bandH = (maxY - minY) / bandCount;
    const targetBandY = minY + bandH * (band + 0.5);
    let finalX = minX + rand() * (maxX - minX);
    let finalY = Math.max(minY, Math.min(maxY, targetBandY + (rand() - 0.5) * bandH * 0.92));

    for (let attempt = 0; attempt < 90; attempt++) {
      const x = minX + rand() * (maxX - minX);
      const y = Math.max(minY, Math.min(maxY, targetBandY + (rand() - 0.5) * bandH * 1.18));
      const tooClose = placed.some((other) => {
        const minSep = Math.max(94, radius + other.radius + 42);
        return Math.hypot(other.x - x, other.y - y) < minSep;
      });
      if (!tooClose) {
        finalX = x;
        finalY = y;
        break;
      }
      if (attempt > 55) {
        finalX = x;
        finalY = y;
      }
    }

    const rangePadding = Math.max(56, radius + 18);
    const moveRange = 132;
    placed.push({
      ...item,
      x: finalX,
      y: finalY,
      radius,
      vx: item.vx == null ? undefined : item.vx * 0.9,
      rangeMin: item.vx == null ? undefined : Math.max(rangePadding, finalX - moveRange / 2),
      rangeMax: item.vx == null ? undefined : Math.min(stage.width - rangePadding, finalX + moveRange / 2),
    });
  });

  return placed;
}

function remapItemBetweenStages(item: GameItem, from: StageConfig, to: StageConfig): GameItem {
  if (from.mode === to.mode) return { ...item };

  const xT = item.x / Math.max(1, from.width);
  const yT = (item.y - from.itemTop) / Math.max(1, from.itemBottom - from.itemTop);
  const radiusScale = to.itemScale / Math.max(0.001, from.itemScale);
  const xVelocityScale = to.width / Math.max(1, from.width);

  return {
    ...item,
    x: xT * to.width,
    y: to.itemTop + yT * (to.itemBottom - to.itemTop),
    radius: item.radius * radiusScale,
    vx: item.vx == null ? undefined : item.vx * xVelocityScale,
    rangeMin: item.rangeMin == null ? undefined : (item.rangeMin / Math.max(1, from.width)) * to.width,
    rangeMax: item.rangeMax == null ? undefined : (item.rangeMax / Math.max(1, from.width)) * to.width,
  };
}

function buildStageLevelItems(level: number, stage: StageConfig): GameItem[] {
  if (stage.mode === 'portrait') return buildPortraitLevelItems(level, stage);
  return buildLevelItems(level).map((item) => mapBaseItemToStage(item, stage));
}

export default function App() {
  // Game State
  const [gameState, setGameState] = useState<GameState>({
    score: 0, level: 1, targetScore: LEVELS[0].target, timeLeft: LEVELS[0].time,
    status: 'START', strength: 1, pullSpeedMultiplier: 1, hasShredder: 0, luck: 1,
    availableShopOffers: [], purchasedItems: [], pauseTimer: 0,
    diamondValueBonus: 0, rockValueBonus: 0, hookRadiusBonus: 0, extraTimeSeconds: 0,
    dataPointBonus: 0, datasetBonus: 0, corpusBonus: 0,
  });

  const [stage, setStage] = useState<StageConfig>(() => getResponsiveStage());
  const [items, setItems] = useState<GameItem[]>([]);
  const [mumbleBubble, setMumbleBubble] = useState<string | null>(null);
  const [hook, setHook] = useState(createInitialHook);
  const [assetVersion, setAssetVersion] = useState(0);
  const [minerMood, setMinerMood] = useState<MinerMood>('normal');

  const [shopSelectedType, setShopSelectedType] = useState<ShopItemType | null>(null);
  const [selectedBuffType, setSelectedBuffType] = useState<ShopItemType | null>(null);
  const shopVisitActiveRef = useRef(false);

  /** 汇总页 URL 参数 user_id；无参数时为 null，界面保持原样 */
  const [linkUserId, setLinkUserId] = useState<string | null>(null);
  const [remoteCleared, setRemoteCleared] = useState<boolean | null>(null);
  const [remoteClearedAt, setRemoteClearedAt] = useState<string | null>(null);
  const [remoteRank, setRemoteRank] = useState<number | null>(null);
  const [admissionStatusLoading, setAdmissionStatusLoading] = useState(false);
  const [admissionStatusError, setAdmissionStatusError] = useState<string | null>(null);
  /** 每次进入学位授予典礼递增，用于同一会话内多次通关时重复触发登记 */
  const [graduationTick, setGraduationTick] = useState(0);
  const [registerSyncState, setRegisterSyncState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle');
  const [registerSyncDetail, setRegisterSyncDetail] = useState<string | null>(null);

  // Refs for game loop to avoid stale closures and React update issues
  const stageRef = useRef<StageConfig>(stage);
  const itemsRef = useRef<GameItem[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const hookRef = useRef(hook);
  const minerMoodRef = useRef<MinerMood>('normal');
  const minerMoodUntilRef = useRef(0);
  const nextBlinkAtRef = useRef(2500 + Math.random() * 4500);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const lastTimeRef = useRef(0);
  const tickRef = useRef(0);

  const scheduleNextBlink = useCallback((baseTime = performance.now()) => {
    nextBlinkAtRef.current = baseTime + 3500 + Math.random() * 5500;
  }, []);

  const setMinerMoodState = useCallback((mood: MinerMood, until = 0) => {
    minerMoodUntilRef.current = until;
    if (mood === 'normal') scheduleNextBlink();
    if (minerMoodRef.current === mood) return;
    minerMoodRef.current = mood;
    setMinerMood(mood);
  }, [scheduleNextBlink]);

  useEffect(() => {
    let cancelled = false;
    preloadCanvasImages(CANVAS_BOOT_ASSET_PATHS, () => setAssetVersion((v) => v + 1), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (gameState.status === 'START') return;
    let cancelled = false;
    preloadCanvasImages(CANVAS_GAMEPLAY_ASSET_PATHS, () => setAssetVersion((v) => v + 1), () => cancelled);
    return () => {
      cancelled = true;
    };
  }, [gameState.status]);

  useEffect(() => {
    setLinkUserId(parseLinkUserIdFromUrl());
  }, []);

  useEffect(() => {
    const updateStage = () => {
      const next = getResponsiveStage();
      setStage((prev) => (prev.mode === next.mode ? prev : next));
    };

    updateStage();
    window.addEventListener('resize', updateStage);
    window.addEventListener('orientationchange', updateStage);
    return () => {
      window.removeEventListener('resize', updateStage);
      window.removeEventListener('orientationchange', updateStage);
    };
  }, []);

  useEffect(() => {
    if (!linkUserId) {
      setRemoteCleared(null);
      setRemoteClearedAt(null);
      setRemoteRank(null);
      setAdmissionStatusLoading(false);
      setAdmissionStatusError(null);
      return;
    }
    let cancelled = false;
    setAdmissionStatusLoading(true);
    setAdmissionStatusError(null);
    fetchAdmissionGameStatus(linkUserId)
      .then((s) => {
        if (cancelled) return;
        setRemoteCleared(s.cleared);
        setRemoteClearedAt(s.cleared_at);
        setRemoteRank(s.rank);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRemoteCleared(null);
        setRemoteClearedAt(null);
        setRemoteRank(null);
        setAdmissionStatusError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setAdmissionStatusLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkUserId]);

  useEffect(() => {
    if (gameState.status !== 'GRADUATED' || !linkUserId) return;
    setRegisterSyncState('pending');
    setRegisterSyncDetail(null);
    registerAdmissionClear(linkUserId)
      .then((res) => {
        const gs = res.game_status;
        if (gs) {
          setRemoteCleared(gs.cleared);
          setRemoteClearedAt(gs.cleared_at ?? null);
          setRemoteRank(gs.rank ?? null);
        }
        setRegisterSyncState('ok');
        setRegisterSyncDetail(res.message ?? '通关已登记');
      })
      .catch((e: unknown) => {
        setRegisterSyncState('error');
        setRegisterSyncDetail(e instanceof Error ? e.message : String(e));
      });
  }, [gameState.status, linkUserId, graduationTick]);

  useEffect(() => {
    if (!mumbleBubble) return;
    const t = window.setTimeout(() => setMumbleBubble(null), 2800);
    return () => window.clearTimeout(t);
  }, [mumbleBubble]);

  useEffect(() => {
    if (gameState.status === 'SHOP') {
      if (!shopVisitActiveRef.current) {
        shopVisitActiveRef.current = true;
        const first = gameState.availableShopOffers[0];
        setShopSelectedType(first?.type ?? null);
      }
    } else {
      shopVisitActiveRef.current = false;
      setShopSelectedType(null);
    }
  }, [gameState.status, gameState.availableShopOffers]);

  useEffect(() => {
    if (gameState.status !== 'PLAYING') {
      setSelectedBuffType(null);
      setMinerMoodState('normal');
    }
  }, [gameState.status, setMinerMoodState]);

  // Sync refs with state
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { hookRef.current = hook; }, [hook]);

  useEffect(() => {
    const prev = stageRef.current;
    if (prev.mode !== stage.mode) {
      const mappedItems = itemsRef.current.map((item) => remapItemBetweenStages(item, prev, stage));
      itemsRef.current = mappedItems;
      setItems(mappedItems);
      const newHook = createInitialHook();
      hookRef.current = newHook;
      setHook(newHook);
      setMinerMoodState('normal');
      particlesRef.current = [];
      floatingTextsRef.current = [];
    }
    stageRef.current = stage;
  }, [stage, setMinerMoodState]);

  const tryFireHook = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (hookRef.current.state !== 'SWINGING') return;
    const h = { ...hookRef.current, state: 'EXTENDING' as const };
    setMinerMoodState('normal');
    hookRef.current = h;
    setHook(h);
  }, [setMinerMoodState]);

  const tryUseShredder = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (gameStateRef.current.hasShredder <= 0) return;
    const h = { ...hookRef.current };

    if (h.state === 'RETRACTING' && h.caughtItem) {
      const caught = h.caughtItem;
      const gs = gameStateRef.current;
      setMumbleBubble(getShredderMumble(caught, gs, (tickRef.current ^ caught.id.length * 31) & 0xffff));
      setGameState((prev) => ({ ...prev, hasShredder: prev.hasShredder - 1 }));
      const newHook = { ...h, caughtItem: null };
      setMinerMoodState('normal');
      hookRef.current = newHook;
      setHook(newHook);
      const currentStage = stageRef.current;
      for (let i = 0; i < 10; i++) {
        particlesRef.current.push(
          new Particle(
            currentStage.minerX + Math.cos(h.angle) * h.length,
            currentStage.minerY + Math.sin(h.angle) * h.length,
            '#ef4444'
          )
        );
      }
      return;
    }

    if (h.state === 'EXTENDING') {
      setGameState((prev) => ({ ...prev, hasShredder: prev.hasShredder - 1 }));
      const newHook = { ...h, state: 'RETRACTING' as const };
      setMinerMoodState('cry');
      hookRef.current = newHook;
      setHook(newHook);
      return;
    }

    if (h.state === 'RETRACTING' && !h.caughtItem) {
      setGameState((prev) => ({ ...prev, hasShredder: prev.hasShredder - 1 }));
      const newHook = {
        ...h,
        length: INITIAL_ROPE_LENGTH,
        state: 'SWINGING' as const,
      };
      setMinerMoodState('normal');
      hookRef.current = newHook;
      setHook(newHook);
    }
  }, [setMinerMoodState]);

  const initLevel = useCallback((level: number) => {
    const newItems = buildStageLevelItems(level, stageRef.current);
    setItems(newItems);
    itemsRef.current = newItems;
  }, []);

  const startGame = () => {
    setRegisterSyncState('idle');
    setRegisterSyncDetail(null);
    const newState: GameState = { 
      ...gameState, 
      score: 0, 
      level: 1, 
      targetScore: LEVELS[0].target, 
      timeLeft: LEVELS[0].time, 
      status: 'INTRO',
      strength: 1,
      pullSpeedMultiplier: 1,
      hasShredder: 0,
      luck: 1,
      availableShopOffers: [],
      purchasedItems: [],
      pauseTimer: 0,
      diamondValueBonus: 0,
      rockValueBonus: 0,
      hookRadiusBonus: 0,
      extraTimeSeconds: 0,
      dataPointBonus: 0,
      datasetBonus: 0,
      corpusBonus: 0,
    };
    setGameState(newState);
    gameStateRef.current = newState;
    initLevel(1);
    const newHook = createInitialHook();
    setHook(newHook);
    hookRef.current = newHook;
    setMinerMoodState('normal');
  };

  const nextLevel = () => {
    const nextLvl = gameState.level + 1;
    if (nextLvl > LEVELS.length) {
      setGameState(prev => ({ ...prev, status: 'GAME_OVER' }));
      return;
    }

    setGameState(prev => ({ 
      ...prev, 
      level: nextLvl,
      status: 'SHOP',
      availableShopOffers: rollRandomShopOffers(),
      purchasedItems: [],
    }));
  };

  const startActualLevel = () => {
    const levelToStart = gameState.status === 'START' ? 1 : gameState.level;

    setGameState((prev) => {
      let newStrength = 1;
      let newPullSpeed = 1;
      let newLuck = 1;
      let diamondValueBonus = 0;
      let rockValueBonus = 0;
      let hookRadiusBonus = 0;
      let extraTimeSeconds = 0;
      let dataPointBonus = 0;
      let datasetBonus = 0;
      let corpusBonus = 0;

      prev.purchasedItems.forEach((item) => {
        switch (item) {
          case 'COFFEE': newPullSpeed += 0.5; break;
          case 'GPU': newStrength += 3; break;
          case 'SEED': newLuck += 1; break;
          case 'DIAMOND_CERT': diamondValueBonus += 200; break;
          case 'ROCK_HANDLER': rockValueBonus += 55; break;
          case 'DEBUG_KIT': rockValueBonus += 40; hookRadiusBonus += 5; break;
          case 'WIDE_HOOK': hookRadiusBonus += 12; break;
          case 'TIME_BONUS': extraTimeSeconds += 18; break;
          case 'SAMPLER_PRO': dataPointBonus += 40; datasetBonus += 100; break;
          case 'CORPUS_LENS': corpusBonus += 150; break;
          default: break;
        }
      });

      const baseTime = LEVELS[prev.level - 1].time;
      const newState: GameState = {
        ...prev,
        status: prev.level === 1 ? 'TUTORIAL_OVERLAY' : 'PLAYING',
        strength: newStrength,
        pullSpeedMultiplier: newPullSpeed,
        luck: newLuck,
        targetScore: LEVELS[prev.level - 1].target,
        timeLeft: baseTime + extraTimeSeconds,
        diamondValueBonus,
        rockValueBonus,
        hookRadiusBonus,
        extraTimeSeconds,
        dataPointBonus,
        datasetBonus,
        corpusBonus,
      };
      gameStateRef.current = newState;
      return newState;
    });

    initLevel(levelToStart);
    const newHook = createInitialHook();
    setHook(newHook);
    hookRef.current = newHook;
    setMinerMoodState('normal');
  };

  const goToLevelIntro = () => {
    setGameState(prev => ({ ...prev, status: 'INTRO' }));
  };

  const beginLevelAfterTutorial = () => {
    setGameState((prev) => {
      if (prev.status !== 'TUTORIAL_OVERLAY') return prev;
      const next: GameState = { ...prev, status: 'PLAYING' };
      gameStateRef.current = next;
      return next;
    });
  };

  const exitLevel = useCallback(() => {
    setGameState((prev) => {
      if (prev.status === 'TUTORIAL_OVERLAY') {
        const next: GameState = { ...prev, status: 'INTRO' };
        gameStateRef.current = next;
        return next;
      }
      if (prev.status === 'PLAYING') {
        const passed = prev.score >= prev.targetScore;
        const next: GameState = { ...prev, status: passed ? 'LEVEL_COMPLETE' : 'GAME_OVER' };
        gameStateRef.current = next;
        return next;
      }
      return prev;
    });
  }, [setMinerMoodState]);

  const update = useCallback((timestamp: number) => {
    requestRef.current = requestAnimationFrame(update);

    if (gameStateRef.current.status !== 'PLAYING') {
      lastTimeRef.current = timestamp;
      return;
    }

    const rawDt = lastTimeRef.current ? timestamp - lastTimeRef.current : 16.67;
    lastTimeRef.current = timestamp;
    const dt = Math.min(rawDt, 50);
    const dtFactor = dt / 16.67;
    const currentStage = stageRef.current;
    const h = { ...hookRef.current };

    if (minerMoodRef.current === 'blink' && timestamp >= minerMoodUntilRef.current) {
      setMinerMoodState('normal');
    } else if (h.state === 'SWINGING' && minerMoodRef.current === 'normal' && timestamp >= nextBlinkAtRef.current) {
      setMinerMoodState('blink', timestamp + 180);
    }

    tickRef.current += 1;
    let itemsChanged = false;
    let scoreChanged = 0;
    let bagShredBonus = 0;
    let bagStrengthBonus = 0;

    itemsRef.current.forEach(item => {
      if (item.vx !== undefined) {
        if (item.movePauseTimer && item.movePauseTimer > 0) {
          item.movePauseTimer -= dt;
        } else {
          item.x += item.vx * dtFactor;
          if (item.x < (item.rangeMin || item.radius) || item.x > (item.rangeMax || currentStage.width - item.radius)) {
            item.vx *= -1;
            item.movePauseTimer = 1000;
          }
        }
      }
    });
    itemsChanged = true;

    let isHookPaused = false;
    if (gameStateRef.current.pauseTimer > 0) {
      const newTimer = Math.max(0, gameStateRef.current.pauseTimer - dt);
      
      if (newTimer === 0 && gameStateRef.current.pauseTimer > 0) {
        h.angle = Math.PI * 0.1 + Math.random() * (Math.PI * 0.8);
        hookRef.current = h;
        setHook(h);
      }
      
      setGameState(prev => ({ ...prev, pauseTimer: newTimer }));
      isHookPaused = true;
    }

    if (!isHookPaused) {
      if (h.state === 'SWINGING') {
        h.angle += SWING_SPEED * h.swingDirection * dtFactor;
        if (h.angle > Math.PI * 0.9 || h.angle < Math.PI * 0.1) h.swingDirection *= -1;
      } else if (h.state === 'EXTENDING') {
      h.length += EXTEND_SPEED * currentStage.hookSpeedScale * dtFactor;
      const hX = currentStage.minerX + Math.cos(h.angle) * h.length;
      const hY = currentStage.minerY + Math.sin(h.angle) * h.length;
      const hookBottomBoundary = currentStage.mode === 'portrait'
        ? currentStage.itemBottom + 20
        : currentStage.height;
      
      const hitBoundary = hX < 0 || hX > currentStage.width || hY > hookBottomBoundary;
      if (hitBoundary) {
        if (hY > hookBottomBoundary && Math.sin(h.angle) > 0.01) {
          h.length = Math.max(INITIAL_ROPE_LENGTH, (hookBottomBoundary - currentStage.minerY) / Math.sin(h.angle));
        }
        h.state = 'RETRACTING';
      }

      const hookHitR = (HOOK_RADIUS + (gameStateRef.current.hookRadiusBonus || 0)) * currentStage.itemScale;
      const hitIdx = itemsRef.current.findIndex(item => {
        const dx = item.x - hX;
        const dy = item.y - hY;
        return Math.sqrt(dx * dx + dy * dy) < item.radius + hookHitR;
      });

      if (hitIdx !== -1) {
        const hitItem = itemsRef.current[hitIdx];
        if (hitItem.type === 'TNT') {
          setMinerMoodState('cry');
          for (let i = 0; i < 30; i++) particlesRef.current.push(new Particle(hitItem.x, hitItem.y, '#ef4444'));
          const nearby = itemsRef.current.filter(it => {
            const dx = it.x - hitItem.x;
            const dy = it.y - hitItem.y;
            return Math.sqrt(dx * dx + dy * dy) < 120;
          });
          itemsRef.current = itemsRef.current.filter(it => !nearby.includes(it));
          itemsChanged = true;
          h.state = 'RETRACTING';
          setMumbleBubble(getCatchMumble(hitItem, tickRef.current));
        } else {
          setMinerMoodState(moodForCatch(hitItem, gameStateRef.current));
          h.caughtItem = hitItem;
          h.state = 'RETRACTING';
          itemsRef.current = itemsRef.current.filter((_, i) => i !== hitIdx);
          itemsChanged = true;
          setMumbleBubble(getCatchMumble(hitItem, tickRef.current));
        }
      } else if (hitBoundary) {
        setMinerMoodState('cry');
      }
    } else if (h.state === 'RETRACTING') {
      const pullSpeed = h.caughtItem 
        ? Math.max(0.8, (BASE_PULL_SPEED * gameStateRef.current.pullSpeedMultiplier) - (h.caughtItem.weight / gameStateRef.current.strength))
        : RETRACT_SPEED;
      
      h.length -= pullSpeed * currentStage.hookSpeedScale * dtFactor;
      
      if (h.length <= INITIAL_ROPE_LENGTH) {
        h.length = INITIAL_ROPE_LENGTH;
        h.state = 'SWINGING';
        
        if (h.caughtItem) {
          if (h.caughtItem.type === 'BAG') {
            const luck = gameStateRef.current.luck || 1;
            const r = Math.random;
            scoreChanged = Math.floor(r() * (320 + 140 * luck)) + (40 + 25 * luck);
            const pShred = Math.min(0.42, 0.1 * luck);
            const pStr = Math.min(0.42, 0.1 * luck);
            if (r() < pShred) bagShredBonus = 1;
            if (r() < pStr) bagStrengthBonus = 2;
          } else {
            let base = h.caughtItem.value;
            const t = h.caughtItem.type;
            const gs = gameStateRef.current;
            if (t === 'DIAMOND' || (t === 'INTERN' && h.caughtItem.carriedItem === 'DIAMOND')) {
              base += gs.diamondValueBonus || 0;
            }
            if (t === 'ROCK') base += gs.rockValueBonus || 0;
            if (t === 'DATA_POINT') base += gs.dataPointBonus || 0;
            if (t === 'DATASET') base += gs.datasetBonus || 0;
            if (t === 'CORPUS') base += gs.corpusBonus || 0;
            scoreChanged = Math.max(0, Math.floor(base));
          }

          floatingTextsRef.current.push(new FloatingText(currentStage.minerX, currentStage.minerY - 40, `+$${scoreChanged}`, '#4ade80'));
          if (bagShredBonus > 0) {
            floatingTextsRef.current.push(new FloatingText(currentStage.minerX - 28, currentStage.minerY - 58, '+稿件回收×1', '#f87171'));
          }
          if (bagStrengthBonus > 0) {
            floatingTextsRef.current.push(new FloatingText(currentStage.minerX + 28, currentStage.minerY - 58, '大力抓取↑', '#38bdf8'));
          }
          h.caughtItem = null;
          setMinerMoodState('normal');

          setGameState((prev) => ({
            ...prev,
            pauseTimer: 700,
            score: prev.score + scoreChanged,
            hasShredder: prev.hasShredder + bagShredBonus,
            strength: prev.strength + bagStrengthBonus,
          }));
        } else {
          setMinerMoodState('normal');
          h.angle += (Math.random() - 0.5) * 0.2;
          h.angle = Math.max(Math.PI * 0.1, Math.min(Math.PI * 0.9, h.angle));
        }
      }
    }
  }

    particlesRef.current.forEach(p => p.update(dtFactor));
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    floatingTextsRef.current.forEach(t => t.update(dtFactor));
    floatingTextsRef.current = floatingTextsRef.current.filter(t => t.life > 0);

    // Sync back to refs and state
    hookRef.current = h;
    setHook(h);
    if (itemsChanged) setItems([...itemsRef.current]);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [update]);

  useEffect(() => {
    if (gameState.status === 'PLAYING') {
      const timer = setInterval(() => {
        setGameState(prev => {
          if (prev.timeLeft <= 1) {
            clearInterval(timer);
            return { ...prev, timeLeft: 0, status: prev.score >= prev.targetScore ? 'LEVEL_COMPLETE' : 'GAME_OVER' };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [gameState.status]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    const currentStage = stage;
    const { width: stageW, height: stageH, minerX, minerY } = currentStage;
    ctx.clearRect(0, 0, stageW, stageH);
    const bgImage = getLoadedCanvasImage(`${ART_ASSET_BASE}/backgrounds/latent-space-portrait.webp`);
    if (bgImage) {
      drawImageCover(ctx, bgImage, 0, 0, stageW, stageH);
      ctx.fillStyle = currentStage.mode === 'portrait' ? 'rgba(2,6,23,0.18)' : 'rgba(2,6,23,0.34)';
      ctx.fillRect(0, 0, stageW, stageH);
    } else {
      const bg = ctx.createLinearGradient(0, 0, 0, stageH);
      bg.addColorStop(0, '#030712');
      bg.addColorStop(0.28, '#050a1d');
      bg.addColorStop(1, '#020617');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, stageW, stageH);
    }

    if (currentStage.mode === 'portrait') {
      const glow = ctx.createRadialGradient(stageW / 2, minerY + 180, 0, stageW / 2, minerY + 180, stageW * 0.85);
      glow.addColorStop(0, 'rgba(56,189,248,0.16)');
      glow.addColorStop(0.45, 'rgba(59,130,246,0.08)');
      glow.addColorStop(1, 'rgba(2,6,23,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, stageW, stageH);
    }
    
    // Background nodes (Latent Space effect)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)'; ctx.lineWidth = 1;
    const bgLines = currentStage.mode === 'portrait' ? 11 : 5;
    for (let i = 0; i < bgLines; i++) {
      const y1 = 100 + i * (currentStage.mode === 'portrait' ? 145 : 100);
      const y2 = 150 + i * (currentStage.mode === 'portrait' ? 128 : 80);
      ctx.beginPath(); ctx.moveTo(0, y1); ctx.lineTo(stageW, y2); ctx.stroke();
    }

    // Miner Area（高度随 MINER_Y 留出站台，避免小人贴紧与矿区交界线）
    const minerPlatformBottom = Math.max(currentStage.mode === 'portrait' ? 235 : 108, minerY + 20);
    const platform = ctx.createLinearGradient(0, 0, 0, minerPlatformBottom);
    platform.addColorStop(0, currentStage.mode === 'portrait' ? 'rgba(15,23,42,0.72)' : '#0f172a');
    platform.addColorStop(1, currentStage.mode === 'portrait' ? 'rgba(15,23,42,0.28)' : '#0f172a');
    ctx.fillStyle = platform; ctx.fillRect(0, 0, stageW, minerPlatformBottom);
    ctx.strokeStyle = currentStage.mode === 'portrait' ? 'rgba(56,189,248,0.22)' : '#1e293b';
    ctx.lineWidth = currentStage.mode === 'portrait' ? 3 : 2;
    ctx.beginPath(); ctx.moveTo(0, minerPlatformBottom); ctx.lineTo(stageW, minerPlatformBottom); ctx.stroke();

      // Items
      items.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        
        // Glow effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, item.radius * (currentStage.mode === 'portrait' ? 2.4 : 2));
        gradient.addColorStop(0, currentStage.mode === 'portrait' ? `${item.color}66` : `${item.color}44`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * (currentStage.mode === 'portrait' ? 2.4 : 2), 0, Math.PI * 2);
        ctx.fill();

        // 面向运动方向（默认贴图朝左时，向右走需水平翻转）
        if (item.vx && item.vx > 0) {
          ctx.scale(-1, 1);
        }
        const itemImg = getLoadedCanvasImage(ITEM_ART[item.type]);
        if (itemImg) {
          const size = item.radius * (item.type === 'INTERN'
            ? (currentStage.mode === 'portrait' ? 3.65 : 3.1)
            : (currentStage.mode === 'portrait' ? 3.25 : 2.8));
          const ratio = itemImg.naturalHeight / itemImg.naturalWidth;
          ctx.drawImage(itemImg, -size / 2, -(size * ratio) / 2, size, size * ratio);
        } else {
          const emojiMap: Record<string, string> = {
            'DATA_POINT': '📄',
            'DATASET': '📂',
            'CORPUS': '📚',
            'DIAMOND': '💎',
            'ROCK': '🪨',
            'BAG': '💰',
            'TNT': '🧨',
            'INTERN': '🏃'
          };
          ctx.font = `${item.radius * (currentStage.mode === 'portrait' ? 2.05 : 1.8)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(emojiMap[item.type] || '❓', 0, 0);
        }

        // Draw carried item
        if (item.carriedItem === 'DIAMOND') {
          const diamondImg = getLoadedCanvasImage(ITEM_ART.DIAMOND);
          if (diamondImg) {
            const size = item.radius * 1.15;
            ctx.drawImage(diamondImg, item.radius * 0.28, -item.radius * 0.95, size, size);
          } else {
            ctx.font = `${item.radius * 0.8}px sans-serif`;
            ctx.fillText('💎', 10, -10);
          }
        }

        // Label
        ctx.restore();
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.fillStyle = currentStage.mode === 'portrait' ? 'rgba(226,232,240,0.9)' : 'rgba(255,255,255,0.8)';
        ctx.font = `bold ${currentStage.mode === 'portrait' ? 16 : 10}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(item.label, 0, item.radius + (currentStage.mode === 'portrait' ? 24 : 15));
        
        ctx.restore();
      });

    // Rope & Hook
    const hX = minerX + Math.cos(hook.angle) * hook.length;
    const hY = minerY + Math.sin(hook.angle) * hook.length;
    
    const ropeImg = getLoadedCanvasImage(`${ART_ASSET_BASE}/sprites/hook/rope-segmented.webp`);
    if (ropeImg) {
      ctx.save();
      ctx.translate(minerX, minerY);
      ctx.rotate(hook.angle - Math.PI / 2);
      const ropeW = currentStage.mode === 'portrait' ? 18 : 10;
      ctx.drawImage(ropeImg, -ropeW / 2, 0, ropeW, Math.max(18, hook.length));
      ctx.restore();
    } else {
      // Draw Rope with a bit of texture
      ctx.strokeStyle = currentStage.mode === 'portrait' ? '#bae6fd' : '#94a3b8';
      ctx.lineWidth = currentStage.mode === 'portrait' ? 4 : 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(minerX, minerY);
      ctx.lineTo(hX, hY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Hook (Grapple)
    ctx.save();
    ctx.translate(hX, hY);
    ctx.rotate(hook.angle - Math.PI / 2);
    
    const hookVisualScale = currentStage.mode === 'portrait' ? 1.6 : 1;
    const hookImg = getLoadedCanvasImage(
      `${ART_ASSET_BASE}/sprites/hook/${hook.caughtItem ? 'hook-closed' : 'hook-open'}.webp`
    );
    if (hookImg) {
      const hookW = currentStage.mode === 'portrait' ? 54 : 34;
      const hookH = hookW * (hookImg.naturalHeight / hookImg.naturalWidth);
      ctx.drawImage(hookImg, -hookW / 2, -hookH * 0.18, hookW, hookH);
    } else {
      ctx.rotate(Math.PI);
      ctx.strokeStyle = '#f1f5f9';
      ctx.lineWidth = 3 * hookVisualScale;
      ctx.lineCap = 'round';
      
      // Hook shape
      ctx.beginPath();
      ctx.moveTo(-8 * hookVisualScale, -5 * hookVisualScale);
      ctx.quadraticCurveTo(0, 10 * hookVisualScale, 8 * hookVisualScale, -5 * hookVisualScale);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.moveTo(0, -5 * hookVisualScale);
      ctx.lineTo(0, 5 * hookVisualScale);
      ctx.stroke();
    }

    if (hook.caughtItem) {
      const caughtImg = getLoadedCanvasImage(ITEM_ART[hook.caughtItem.type]);
      if (caughtImg) {
        const size = hook.caughtItem.radius * (hook.caughtItem.type === 'INTERN' ? 3.1 : 2.65);
        const ratio = caughtImg.naturalHeight / caughtImg.naturalWidth;
        ctx.drawImage(caughtImg, -size / 2, 8 * hookVisualScale, size, size * ratio);
      } else {
        const emojiMap: Record<string, string> = {
          'DATA_POINT': '📄',
          'DATASET': '📂',
          'CORPUS': '📚',
          'DIAMOND': '💎',
          'ROCK': '🪨',
          'BAG': '💰',
          'TNT': '🧨',
          'INTERN': '🏃'
        };
        ctx.font = `${hook.caughtItem.radius * 1.5}px sans-serif`;
        ctx.fillText(emojiMap[hook.caughtItem.type] || '❓', 0, 15 * hookVisualScale);
      }
      if (hook.caughtItem.carriedItem === 'DIAMOND') {
        const diamondImg = getLoadedCanvasImage(ITEM_ART.DIAMOND);
        if (diamondImg) {
          const size = hook.caughtItem.radius * 0.9;
          ctx.drawImage(diamondImg, 4, 2, size, size);
        } else {
          ctx.font = `${hook.caughtItem.radius * 0.7}px sans-serif`;
          ctx.fillText('💎', 8, 5);
        }
      }
    }
    ctx.restore();

    // 碎碎念气泡：放在博士左侧，矩形与尾巴均不进入小人包围盒（与小人互不遮挡）
    if (mumbleBubble) {
      const isPortrait = currentStage.mode === 'portrait';
      const margin = isPortrait ? 20 : 8;
      const maxTextW = isPortrait ? 176 : 88;
      const padding = isPortrait ? 10 : 8;
      const lineH = isPortrait ? 21 : 16;
      const fontBubble = `bold ${isPortrait ? 15 : 12}px sans-serif`;
      /** 小人占用宽度的一半 + 留白，气泡右缘须在此线左侧 */
      const minerHalfW = isPortrait ? 60 : 44;
      const bubbleToMinerGap = 14;
      const leftHudReserve = isPortrait ? 0 : 216;

      ctx.save();
      ctx.font = fontBubble;
      const lines: string[] = [];
      let line = '';
      for (let k = 0; k < mumbleBubble.length; k++) {
        const ch = mumbleBubble[k];
        const test = line + ch;
        if (ctx.measureText(test).width > maxTextW && line) {
          lines.push(line);
          line = ch;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);

      const bw = maxTextW + padding * 2;
      const bh = Math.max(34, lines.length * lineH + padding * 2);
      const br = isPortrait ? 16 : 10;
      let bx: number;
      let by: number;
      let tailTipX: number;
      let tailTipY: number;
      let tailBaseA: [number, number];
      let tailBaseB: [number, number];

      if (isPortrait) {
        const centerGapLeft = stageW * 0.31 + 34;
        const centerGapRight = stageW * 0.69 - 34;
        bx = Math.max(centerGapLeft, Math.min(centerGapRight - bw, minerX - bw / 2));
        const bubbleZoneTop = minerY - 205;
        const bubbleZoneHeight = 58;
        const bubbleZoneBottom = bubbleZoneTop + bubbleZoneHeight;
        by = bubbleZoneTop + Math.max(0, (bubbleZoneHeight - bh) / 2);
        by = Math.max(112, Math.min(bubbleZoneBottom - bh, by));
        tailTipX = minerX - 16;
        tailTipY = minerY - 118;
        tailBaseA = [minerX - 24, by + bh];
        tailBaseB = [minerX + 12, by + bh];
      } else {
        const bubbleRightMax = minerX - minerHalfW - bubbleToMinerGap;
        bx = bubbleRightMax - bw;
        bx = Math.max(leftHudReserve, bx);
        bx = Math.max(margin, bx);
        if (bx + bw > bubbleRightMax) bx = bubbleRightMax - bw;
        bx = Math.max(leftHudReserve, bx);
        const anchorY = minerY - 26;
        by = anchorY - bh / 2;
        if (by < margin) by = margin;
        if (by + bh > minerY + 28) by = minerY + 28 - bh;
        const midY = by + bh / 2;
        const bubbleRight = bx + bw;
        tailTipX = minerX - 24;
        tailTipY = minerY - 22;
        tailBaseA = [bubbleRight, midY - 9];
        tailBaseB = [bubbleRight, midY + 9];
      }

      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = 'rgba(15,23,42,0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, br);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(tailBaseA[0], tailBaseA[1]);
      ctx.lineTo(tailTipX, tailTipY);
      ctx.lineTo(tailBaseB[0], tailBaseB[1]);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(15,23,42,0.92)';
      ctx.stroke();

      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      lines.forEach((ln, i) => {
        ctx.fillText(ln, bx + padding, by + padding + i * lineH);
      });
      ctx.restore();
    }

    // Miner Character（画在气泡之后，绳子已从锚点连出）
    ctx.save();
    const minerScale = currentStage.mode === 'portrait' ? 1.72 : 1;
    const minerImg = getLoadedCanvasImage(MINER_MOOD_ART[minerMood]);
    if (minerImg) {
      const drawW = currentStage.mode === 'portrait' ? 166 : 92;
      const drawH = drawW * (minerImg.naturalHeight / minerImg.naturalWidth);
      ctx.drawImage(minerImg, minerX - drawW / 2, minerY - drawH + 28 * minerScale, drawW, drawH);
    } else {
      ctx.translate(minerX, minerY - 20);
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(-15 * minerScale, 0, 30 * minerScale, 25 * minerScale, 5 * minerScale);
      ctx.fill();

      ctx.font = `${40 * minerScale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('👨‍🎓', 0, 5);
    }

    ctx.restore();

    particlesRef.current.forEach(p => p.draw(ctx));
    floatingTextsRef.current.forEach(t => t.draw(ctx));
  }, [items, hook, mumbleBubble, stage, assetVersion, minerMood]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'ArrowDown') && gameState.status === 'PLAYING' && hookRef.current.state === 'SWINGING') {
        const h = { ...hookRef.current, state: 'EXTENDING' as const };
        hookRef.current = h; setHook(h);
      }
      if (e.code === 'ArrowUp') tryUseShredder();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.status, tryUseShredder]);

  const buyItem = (type: ShopItemType) => {
    setGameState(prev => {
      const offer = prev.availableShopOffers.find((o) => o.type === type);
      if (!offer || prev.purchasedItems.includes(type) || prev.score < offer.price) return prev;
      const newState: GameState = {
        ...prev,
        score: prev.score - offer.price,
        purchasedItems: [...prev.purchasedItems, type],
      };
      if (type === 'SHREDDER') newState.hasShredder += 1;
      return newState;
    });
  };

  const showMinerHud = gameState.status === 'PLAYING' || gameState.status === 'TUTORIAL_OVERLAY';
  const shredderDim = gameState.status !== 'PLAYING' || gameState.hasShredder <= 0;
  const showPortraitControls = stage.mode === 'portrait' && gameState.status === 'PLAYING';
  const purchasedShopDefs = gameState.purchasedItems
    .map((type) => SHOP_ENTRY_DEFS.find((def) => def.type === type))
    .filter((def): def is (typeof SHOP_ENTRY_DEFS)[number] => Boolean(def));
  const buffSlotPositions = [
    { left: '14.29%', top: '29.7%', width: '11.76%', height: '53.1%' },
    { left: '27.83%', top: '29.7%', width: '11.76%', height: '53.1%' },
    { left: '41.52%', top: '29.7%', width: '11.76%', height: '53.1%' },
    { left: '54.91%', top: '29.7%', width: '11.76%', height: '53.1%' },
    { left: '68.90%', top: '29.7%', width: '11.76%', height: '53.1%' },
    { left: '82.89%', top: '29.7%', width: '11.76%', height: '53.1%' },
  ];
  const selectedBuffDef = selectedBuffType
    ? SHOP_ENTRY_DEFS.find((def) => def.type === selectedBuffType)
    : undefined;

  const admissionStatusLabel = (() => {
    if (admissionStatusLoading) return '同步中…';
    if (admissionStatusError) return '状态未获取';
    if (remoteCleared === true) return '本游戏已通关';
    if (remoteCleared === false) return '本游戏未通关';
    return '—';
  })();

  return (
    <div className="app-shell-fill box-border flex flex-col items-center justify-center gap-1 bg-slate-950 font-sans text-slate-100 app-safe-x app-safe-b app-safe-t px-2 sm:px-4 md:gap-2">
      <div
        className="portrait-hint-bar shrink-0 items-center justify-center gap-1.5 border-b border-slate-800/80 bg-slate-900/95 px-2 py-1 text-center text-[10px] font-bold leading-tight text-amber-200/90"
        role="status"
      >
        <span aria-hidden>↻</span>
        横屏可显示更大画面；竖屏已自动缩放至一屏内，无需拖动页面。
      </div>
      {linkUserId && (
        <div
          className="shrink-0 w-full max-w-[min(100%,52rem)] rounded-lg border border-sky-800/60 bg-slate-900/90 px-2 py-1.5 text-center text-[10px] leading-snug text-sky-100/95 sm:text-[11px]"
          role="status"
        >
          <span className="font-black text-sky-300/95">活动关联</span>
          <span className="text-slate-500"> · </span>
          <span className="tabular-nums text-slate-200">user_id {linkUserId}</span>
          <span className="text-slate-500"> · </span>
          <span>{admissionStatusLabel}</span>
          {remoteCleared === true && remoteClearedAt && (
            <>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400">通关时间 {formatApiTime(remoteClearedAt)}</span>
            </>
          )}
          {remoteRank != null && (
            <>
              <span className="text-slate-500"> · </span>
              <span className="text-slate-400">本游戏榜 #{remoteRank}</span>
            </>
          )}
          {admissionStatusError && (
            <span className="block truncate text-red-300/90" title={admissionStatusError}>
              {admissionStatusError}
            </span>
          )}
        </div>
      )}
      <div className="game-viewport relative">
        <div
          className="game-stage-outer group relative shrink-0 overflow-hidden rounded-2xl border-4 border-slate-800/80 bg-slate-950 shadow-[0_0_80px_rgba(0,0,0,0.6)] sm:rounded-[2rem] sm:border-[10px] lg:rounded-[3rem] lg:border-[12px] game-stage-shell"
          style={{
            '--stage-ratio': stage.width / stage.height,
            '--stage-max-width': stage.maxCssWidth,
            aspectRatio: `${stage.width} / ${stage.height}`,
          } as React.CSSProperties}
        >
        <canvas
          ref={canvasRef}
          width={stage.width}
          height={stage.height}
          className={`game-canvas relative z-0 ${gameState.status === 'TUTORIAL_OVERLAY' ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') e.preventDefault();
            tryFireHook();
          }}
        />

        {showMinerHud && (
          <div className={`pointer-events-none absolute inset-x-0 top-0 z-[11] flex ${
            stage.mode === 'portrait' ? 'h-[13%] px-[2.2cqi] py-[2cqi]' : 'h-[18%] max-h-[118px]'
          }`}>
            <div className={`pointer-events-auto flex h-full shrink-0 flex-col justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${
              stage.mode === 'portrait'
                ? 'w-[32%] rounded-[2.8cqi] border border-sky-300/45 bg-[linear-gradient(145deg,rgba(15,23,42,0.9),rgba(2,6,23,0.72))] px-[2.4cqi] py-[1.8cqi] shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_0_28px_rgba(14,165,233,0.22)] backdrop-blur-md'
                : 'w-[28%] max-w-[220px] border-b-[0.5cqi] border-amber-800 bg-gradient-to-b from-amber-300 to-amber-400 px-[1.5cqi] py-[0.8cqi]'
            }`}>
              <div className={`flex items-center justify-between font-black leading-tight ${stage.mode === 'portrait' ? 'text-[clamp(10px,2.7cqi,15px)] text-sky-100/90' : 'text-[clamp(6px,1.3cqi,10px)] text-amber-950/90'}`}>
                <span>培养积分</span>
                <Sparkles className={stage.mode === 'portrait' ? 'h-[3.2cqi] w-[3.2cqi] text-amber-200' : 'h-[1.6cqi] w-[1.6cqi]'} />
              </div>
              <div className={`font-black leading-none tabular-nums drop-shadow-[0_0_12px_rgba(74,222,128,0.34)] ${stage.mode === 'portrait' ? 'text-[clamp(20px,5.4cqi,32px)] text-green-300' : 'text-[clamp(10px,2.5cqi,18px)] text-green-700'}`}>${gameState.score}</div>
              <div className={`mt-[1.1cqi] h-[0.9cqi] overflow-hidden rounded-full bg-slate-800/80 ${stage.mode === 'portrait' ? 'block' : 'hidden'}`}>
                <div className="h-full rounded-full bg-gradient-to-r from-sky-400 to-violet-400" style={{ width: `${Math.min(100, (gameState.score / Math.max(1, gameState.targetScore)) * 100)}%` }} />
              </div>
              <div className={`font-black leading-tight ${stage.mode === 'portrait' ? 'mt-[0.9cqi] text-[clamp(10px,2.5cqi,13px)] text-sky-100/80' : 'mt-[0.3cqi] text-[clamp(6px,1.3cqi,10px)] text-amber-950/90'}`}>阶段达标线</div>
              <div className={`font-black leading-none tabular-nums ${stage.mode === 'portrait' ? 'text-[clamp(13px,3.4cqi,20px)] text-slate-100' : 'text-[clamp(8px,2cqi,14px)] text-amber-950'}`}>${gameState.targetScore}</div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 pointer-events-none" aria-hidden />
            <div className={`pointer-events-auto flex h-full shrink-0 flex-col items-end justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ${
              stage.mode === 'portrait'
                ? 'w-[32%] gap-[0.9cqi] rounded-[2.8cqi] border border-cyan-300/35 bg-[linear-gradient(145deg,rgba(2,6,23,0.72),rgba(15,23,42,0.9))] px-[2.2cqi] py-[1.5cqi] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_0_28px_rgba(14,165,233,0.18)] backdrop-blur-md'
                : 'w-[28%] max-w-[220px] gap-[0.4cqi] border-b-[0.5cqi] border-amber-800 bg-gradient-to-b from-amber-300 to-amber-400 px-[1.2cqi] py-[0.8cqi]'
            }`}>
              <button
                type="button"
                onClick={exitLevel}
                className={`pointer-events-auto shrink-0 rounded border-[0.25cqi] font-black shadow-sm active:scale-95 flex items-center gap-[0.3cqi] ${
                  stage.mode === 'portrait'
                    ? 'border-red-400/35 bg-red-950/70 px-[1.6cqi] py-[0.8cqi] text-[clamp(9px,2.5cqi,13px)] text-red-100'
                    : 'border-red-800 bg-amber-100 px-[1.2cqi] py-[0.4cqi] text-[clamp(6px,1.4cqi,10px)] text-red-700'
                }`}
              >
                <LogOut className={stage.mode === 'portrait' ? 'h-[2.8cqi] w-[2.8cqi] shrink-0' : 'h-[1.6cqi] w-[1.6cqi] shrink-0'} />
                退出本关
              </button>
              <div className="text-right leading-tight">
                <div className={`flex items-center justify-end gap-[1cqi] font-black ${stage.mode === 'portrait' ? 'text-[clamp(10px,2.6cqi,14px)] text-cyan-100/85' : 'text-[clamp(6px,1.3cqi,10px)] text-amber-950'}`}>
                  <Clock className={stage.mode === 'portrait' ? 'h-[3cqi] w-[3cqi] text-cyan-200' : 'h-[1.6cqi] w-[1.6cqi]'} />
                  时间
                </div>
                {gameState.status === 'TUTORIAL_OVERLAY' ? (
                  <div className={`font-black tabular-nums ${stage.mode === 'portrait' ? 'text-[clamp(18px,5cqi,30px)] text-amber-200/70' : 'text-[clamp(10px,3cqi,20px)] text-amber-900/70'}`}>—</div>
                ) : (
                  <div className={`font-black tabular-nums drop-shadow-[0_0_12px_rgba(34,211,238,0.24)] ${stage.mode === 'portrait' ? 'text-[clamp(20px,5.4cqi,32px)]' : 'text-[clamp(10px,3cqi,20px)]'} ${gameState.timeLeft < 10 ? 'text-red-500 animate-pulse' : stage.mode === 'portrait' ? 'text-cyan-200' : 'text-red-700'}`}>{gameState.timeLeft}</div>
                )}
                <div className={`font-black ${stage.mode === 'portrait' ? 'text-[clamp(10px,2.6cqi,14px)] text-cyan-100/80' : 'text-[clamp(6px,1.3cqi,10px)] text-amber-950'}`}>第 {gameState.level} 阶段</div>
              </div>
            </div>
          </div>
        )}

        {gameState.status === 'PLAYING' && stage.mode !== 'portrait' && (
          <button
            type="button"
            className={`pointer-events-auto absolute left-[calc(50%+5cqi)] top-[9%] z-[16] flex -translate-y-1/2 flex-col items-center justify-center gap-[0.4cqi] rounded-[1.2cqi] border-[0.25cqi] px-[1.5cqi] py-[1cqi] shadow-lg backdrop-blur-sm transition-transform active:scale-95 min-w-[8cqi] ${
              shredderDim
                ? 'border-slate-600/80 bg-slate-950/85 opacity-55 grayscale'
                : 'border-red-500/55 bg-red-950/90'
            }`}
            disabled={shredderDim}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              tryUseShredder();
            }}
            aria-label="稿件回收通道"
          >
            <Trash2 className={`h-[2cqi] w-[2cqi] shrink-0 ${shredderDim ? 'text-slate-500' : 'text-red-400'}`} />
            <span className={`text-[clamp(5px,1.1cqi,8px)] font-black leading-tight text-center ${shredderDim ? 'text-slate-500' : 'text-red-200'}`}>稿件回收</span>
            <span className={`text-[clamp(5px,1.2cqi,9px)] font-black tabular-nums ${shredderDim ? 'text-slate-600' : 'text-red-300/90'}`}>×{gameState.hasShredder}</span>
          </button>
        )}

        {showPortraitControls && (
          <div className="pointer-events-none absolute inset-x-[3.33cqi] bottom-[7.1cqi] z-[18] flex flex-col gap-[7.5cqi]">
            {selectedBuffDef && (
              <div className="pointer-events-auto rounded-[2.4cqi] border border-sky-300/25 bg-slate-950/92 px-[3cqi] py-[2.2cqi] text-left shadow-[0_0_32px_rgba(56,189,248,0.22)] backdrop-blur-md">
                <div className="flex items-center gap-[2cqi]">
                  <div className="flex h-[8cqi] w-[8cqi] shrink-0 items-center justify-center rounded-[2cqi] bg-sky-400/15 text-sky-200">
                    {shopRowIcon(selectedBuffDef.type, 'h-[4.4cqi] w-[4.4cqi]')}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[clamp(11px,3.2cqi,16px)] font-black text-white">{selectedBuffDef.title}</div>
                    <div className="line-clamp-2 text-[clamp(8px,2.4cqi,12px)] font-bold leading-snug text-slate-300">{selectedBuffDef.desc}</div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto shrink-0 rounded-full border border-slate-500/50 px-[2cqi] py-[0.8cqi] text-[clamp(8px,2.4cqi,12px)] font-black text-slate-200"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBuffType(null);
                    }}
                  >
                    收起
                  </button>
                </div>
              </div>
            )}

            <div
              className="pointer-events-auto relative h-[20.1cqi] rounded-[2.8cqi] shadow-[0_0_36px_rgba(14,165,233,0.16)] backdrop-blur-md"
              style={{
                backgroundImage: `linear-gradient(rgba(2,6,23,0.18), rgba(2,6,23,0.18)), url(${ART_ASSET_BASE}/ui/mobile/buff-action-bar-empty.webp)`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: '100% 100%',
                backgroundPosition: 'center',
              }}
            >
              {purchasedShopDefs.length > 0 ? (
                purchasedShopDefs.slice(0, 6).map((def, index) => {
                  const pos = buffSlotPositions[index];
                  return (
                    <button
                      key={def.type}
                      type="button"
                      className={`absolute flex items-center justify-center rounded-[1.4cqi] transition-transform active:scale-95 ${
                        selectedBuffType === def.type
                          ? 'bg-sky-400/20 ring-1 ring-sky-300'
                          : 'bg-transparent'
                      }`}
                      style={{ left: pos.left, top: pos.top, width: pos.width, height: pos.height }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBuffType((prev) => (prev === def.type ? null : def.type));
                      }}
                      title={def.title}
                    >
                      {shopRowIcon(def.type, 'h-full w-full')}
                    </button>
                  );
                })
              ) : (
                <div className="pointer-events-none absolute left-[14.29%] top-[29.7%] h-[53.1%] w-[80.36%]" aria-hidden />
              )}
            </div>

            <div className="pointer-events-auto flex justify-center gap-[5cqi]">
              <button
                type="button"
                disabled={shredderDim}
                className={`relative flex h-[14.2cqi] w-[40cqi] items-center justify-center rounded-[4.4cqi] px-[2cqi] font-black shadow-lg transition-transform active:scale-[0.98] ${
                  shredderDim
                    ? 'text-slate-200/70 grayscale'
                    : 'text-white shadow-red-950/40'
                }`}
                style={{
                  backgroundImage: `url(${ART_ASSET_BASE}/ui/mobile/${shredderDim ? 'shredder-disabled' : 'shredder-normal'}.webp)`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  tryUseShredder();
                }}
              >
                <span className="pointer-events-none absolute inset-0 rounded-[4.4cqi] bg-black/0" aria-hidden />
                <span className="relative flex translate-x-[5.2cqi] items-center leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]">
                  <span className="text-[clamp(16px,4.6cqi,26px)] font-black">×{gameState.hasShredder}</span>
                </span>
              </button>

              <button
                type="button"
                className="relative flex h-[14.2cqi] w-[40cqi] items-center justify-center gap-[2.2cqi] rounded-[4.8cqi] px-[2cqi] text-white shadow-[0_0_36px_rgba(56,189,248,0.35)] transition-transform active:scale-[0.98]"
                style={{
                  backgroundImage: `url(${ART_ASSET_BASE}/ui/mobile/fire-normal.webp)`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  tryFireHook();
                }}
              />
            </div>
          </div>
        )}
        </div>
        {/* ---- end game-stage-shell ---- */}

        <AnimatePresence>
          {gameState.status === 'TUTORIAL_OVERLAY' && (
            <motion.div
              key="tutorial-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-50 bg-slate-950/94 backdrop-blur-sm"
            >
              <ViewportScaleFit className="h-full px-4 py-4 sm:px-6 sm:py-6" innerClassName="flex flex-col items-center text-center">
                <h2 className="mb-5 text-3xl font-black tracking-tight text-white sm:mb-6 sm:text-4xl">操作说明</h2>
                <div className="w-full max-w-md rounded-2xl border border-slate-600/80 bg-slate-900/85 p-4 text-left shadow-xl sm:p-6">
                  <ul className="space-y-4 text-xs leading-relaxed text-slate-200 sm:text-sm">
                    <li>
                      <span className="font-black text-white">发射探索向量（下钩）</span>
                      <span className="text-slate-500"> — </span>
                      按<strong className="text-slate-100">↓</strong>或者点击游戏界面释放。
                    </li>
                    <li>
                      <span className="font-black text-white">稿件回收通道（炸弹）</span>
                      <span className="text-slate-500"> — </span>
                      按<strong className="text-slate-100">↑</strong>或者点击回收图案释放。
                    </li>
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={beginLevelAfterTutorial}
                  className="mt-6 w-full max-w-md rounded-xl bg-sky-500 py-3.5 font-black text-base text-slate-950 shadow-lg transition-transform hover:bg-sky-400 active:scale-[0.99] active:bg-sky-600 sm:rounded-2xl sm:py-4 sm:text-lg pb-[max(0.875rem,env(safe-area-inset-bottom))]"
                >
                  我知道了，开始本关
                </button>
              </ViewportScaleFit>
            </motion.div>
          )}
          {gameState.status === 'START' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-slate-950/95"
            >
              <ViewportScaleFit className="h-full p-4 sm:p-6 md:p-8" innerClassName="flex flex-col items-center text-center">
                <motion.div animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 3 }} className="mb-2 sm:mb-6">
                  <img src={`${ART_ASSET_BASE}/ui/start/ai-core.webp`} alt="" className="mx-auto h-20 w-20 object-contain sm:h-28 sm:w-28 md:h-32 md:w-32" draggable={false} />
                </motion.div>
                <p className="mb-1 px-1 text-[10px] font-bold uppercase tracking-wide text-sky-400/90 min-[380px]:text-xs sm:mb-2 sm:text-sm md:tracking-widest">
                  北京中关村学院 · AI 方向博士生培养
                </p>
                <h1 className="mb-2 px-1 text-2xl font-black tracking-tighter text-white min-[400px]:text-3xl sm:mb-4 sm:text-5xl md:text-6xl">
                  潜空间<span className="text-sky-400">矿工</span>
                  <span className="mt-1 block text-base font-black text-slate-500 min-[400px]:text-lg sm:mt-2 sm:text-2xl md:text-3xl">新生篇</span>
                </h1>
                <p className="mb-3 max-w-lg px-1 text-xs leading-relaxed text-slate-400 sm:mb-6 sm:text-base md:text-lg">
                  你是一名刚刚入学的<strong className="text-slate-300">北京中关村学院</strong>博士生新生，主攻<strong className="text-slate-300">人工智能</strong>。学院扎根中关村创新核心区，你将沿培养方案一路闯关——在「潜空间」里抓取数据、算力与成果，直至学位答辩。
                </p>
                <p className="mb-4 max-w-lg px-2 text-[11px] leading-relaxed text-slate-500 sm:mb-8 sm:text-sm">
                  仅在<strong className="text-slate-400">第一关</strong>进入培养任务时会弹出简短操作说明，之后各关直接进入倒计时。
                </p>

                <button
                  type="button"
                  onClick={startGame}
                  className="group relative mb-4 flex min-h-14 shrink-0 items-center justify-center gap-2 px-8 py-3 text-sm font-black text-white shadow-[0_0_30px_rgba(14,165,233,0.35)] transition-all hover:scale-105 active:scale-100 sm:gap-3 sm:px-12 sm:py-4 sm:text-lg md:px-14 md:py-5 md:text-xl"
                  style={{
                    backgroundImage: `url(${ART_ASSET_BASE}/ui/start/start-button-large.webp)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                  }}
                >
                  <Play className="fill-current w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> 新生报到，开始培养方案
                </button>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'LEVEL_COMPLETE' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-50 bg-slate-950/80">
              <DesignCanvasFit width={800} height={600} className="h-full" innerClassName="relative text-center">
                <img
                  src={`${ART_ASSET_BASE}/ui/modals/success-panel.webp`}
                  alt=""
                  className="absolute left-[80px] top-[72px] h-[425px] w-[640px] object-fill drop-shadow-2xl"
                  draggable={false}
                />
                <img
                  src={`${ART_ASSET_BASE}/ui/modals/trophy.webp`}
                  alt=""
                  className="absolute left-[340px] top-[47px] h-[110px] w-[140px] object-contain drop-shadow-[0_0_20px_rgba(250,204,21,0.45)]"
                  draggable={false}
                />
                <h2 className="absolute left-[225px] top-[149px] flex h-[54px] w-[380px] items-center justify-center text-[32px] font-black leading-tight text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.75)]">
                  {gameState.level === 8 ? '培养方案终极节点达成！' : '本阶段培养达标！'}
                </h2>
                <p className="absolute left-[170px] top-[195px] flex h-[70px] w-[460px] items-center justify-center px-6 text-[18px] font-bold leading-relaxed text-slate-200/90">
                  {gameState.level === 8
                    ? '你已走完学院规定的培养环节，准备好登上学位论文答辩席了吗？'
                    : '导师组对你的进展很满意。'}
                </p>
                {gameState.level === 8 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (linkUserId) setGraduationTick((t) => t + 1);
                      setGameState((prev) => ({ ...prev, status: 'GRADUATED' }));
                    }}
                    className="absolute left-[155px] top-[295px] flex h-[60px] w-[500px] items-center justify-center gap-2 rounded-xl bg-sky-500/90 text-[20px] font-black text-white shadow-[0_0_24px_rgba(14,165,233,0.32)] transition-transform hover:scale-105 hover:bg-sky-400/90 active:scale-100"
                  >
                    <Sparkles size={20} /> 参加学位授予典礼
                  </button>
                ) : (
                  <>
                    <button
                      onClick={nextLevel}
                      className="absolute left-[155px] top-[295px] flex h-[60px] w-[500px] items-center justify-center gap-2 rounded-xl bg-amber-500 text-[20px] font-black text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.28)] transition-transform hover:scale-105 hover:bg-amber-400 active:scale-100"
                    >
                      <ShoppingCart size={20} /> 前往学院补给站
                    </button>
                    <button
                      onClick={() => { nextLevel(); goToLevelIntro(); }}
                      className="absolute left-[155px] top-[370px] flex h-[50px] w-[500px] items-center justify-center rounded-xl bg-slate-800/95 text-[17px] font-bold text-white shadow-[0_0_18px_rgba(15,23,42,0.42)] transition-transform hover:scale-105 hover:bg-slate-700 active:scale-100"
                    >
                      不进补给站，直接进入下阶段
                    </button>
                  </>
                )}
              </DesignCanvasFit>
            </motion.div>
          )}

          {gameState.status === 'GRADUATED' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 overflow-hidden bg-slate-950">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_22%,rgba(250,204,21,0.16),transparent_22rem),radial-gradient(circle_at_50%_52%,rgba(14,165,233,0.16),transparent_30rem),linear-gradient(180deg,#020617_0%,#07111f_52%,#020617_100%)]" />
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />

              <ViewportScaleFit className="relative z-10 h-full p-4 sm:p-8" innerClassName="flex flex-col items-center text-center">
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
                  <div className="mb-4 flex flex-col items-center justify-center">
                    <img src={`${ART_ASSET_BASE}/ui/modals/graduation-cap-laurel.webp`} alt="" className="h-24 w-44 object-contain drop-shadow-[0_0_38px_rgba(251,191,36,0.5)] sm:h-36 sm:w-64" draggable={false} />
                    <img src={`${ART_ASSET_BASE}/sprites/characters/graduated-miner.webp`} alt="" className="-mt-5 h-36 w-36 object-contain drop-shadow-[0_0_36px_rgba(56,189,248,0.35)] sm:-mt-8 sm:h-52 sm:w-52" draggable={false} />
                  </div>
                  <h2 className="mb-4 px-1 text-2xl font-black leading-tight tracking-tighter text-white min-[400px]:text-4xl sm:text-5xl">恭喜，中关村学院准博士！</h2>
                  <p className="mx-auto mb-6 max-w-lg px-1 text-sm leading-relaxed text-slate-400 sm:mb-8 sm:text-lg">
                    历经八个培养阶段，你在潜空间中交出了扎实的 AI 成果。学位论文答辩顺利通过——<strong className="text-slate-300">北京中关村学院</strong>为你骄傲，愿你在人工智能前沿继续攀登。
                  </p>
                  {linkUserId && (
                    <p className="mx-auto mb-4 max-w-lg rounded-xl border border-slate-700/80 bg-slate-900/60 px-3 py-2 text-left text-xs leading-relaxed text-slate-300 sm:text-sm">
                      <span className="font-black text-sky-400">排行榜同步</span>
                      {registerSyncState === 'pending' && <span className="text-slate-400">：正在登记通关…</span>}
                      {registerSyncState === 'ok' && (
                        <span className="text-slate-300">：{registerSyncDetail ?? '已连接服务器'}</span>
                      )}
                      {registerSyncState === 'error' && (
                        <span className="text-red-300/95" title={registerSyncDetail ?? ''}>
                          ：登记失败{registerSyncDetail ? `（${registerSyncDetail}）` : ''}
                        </span>
                      )}
                      {registerSyncState === 'idle' && <span className="text-slate-500">：等待同步</span>}
                    </p>
                  )}
                  <div
                    className="mb-8 flex h-32 w-full max-w-lg items-center gap-5 px-8 text-left backdrop-blur-sm sm:h-40 sm:px-12"
                    style={{
                      backgroundImage: `url(${ART_ASSET_BASE}/ui/modals/累计培养积分-UI框.webp)`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '100% 100%',
                      backgroundPosition: 'center',
                    }}
                  >
                    <div className="hidden h-20 w-20 shrink-0 sm:block" />
                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <div className="mb-1 text-xs font-black tracking-[0.32em] text-amber-200/80 sm:text-sm">累计培养积分</div>
                      <div className="text-4xl font-black leading-none text-emerald-300 drop-shadow-[0_0_18px_rgba(16,185,129,0.5)] sm:text-5xl">{gameState.score}</div>
                    </div>
                  </div>
                  <br />
                  <button
                    onClick={startGame}
                    className="min-h-14 px-10 py-4 text-lg font-black text-white shadow-xl transition-all hover:scale-105"
                    style={{
                      backgroundImage: `url(${ART_ASSET_BASE}/ui/modals/restart-button-normal.webp)`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '100% 100%',
                      backgroundPosition: 'center',
                    }}
                  >
                    再来一届新生入学
                  </button>
                </motion.div>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'INTRO' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-slate-950/95">
              <ViewportScaleFit className="h-full p-4 sm:p-8 lg:p-12" innerClassName="flex flex-col items-center text-center">
                <img src={`${ART_ASSET_BASE}/ui/modals/robot-mentor.webp`} alt="" className="mb-3 h-20 w-24 object-contain sm:h-28 sm:w-32" draggable={false} />
                <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} className="mb-6 w-full max-w-lg sm:mb-8">
                  <div className="mb-3 inline-block max-w-full rounded-full border border-sky-500/30 bg-sky-500/20 px-3 py-1 text-left text-[11px] font-bold text-sky-400 sm:mb-4 sm:px-4 sm:py-1 sm:text-center sm:text-sm">
                    {LEVELS[gameState.level - 1].title}
                  </div>
                  <h2 className="mb-4 text-2xl font-black leading-tight tracking-tight text-white min-[400px]:text-3xl sm:mb-6 sm:text-5xl">
                    {LEVELS[gameState.level - 1].challenge}
                  </h2>
                  <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-sky-500 sm:mb-8 sm:w-20" />
                  <p className="mx-auto text-left text-sm italic leading-relaxed text-slate-300 sm:text-center sm:text-xl">
                    &ldquo;{LEVELS[gameState.level - 1].desc}&rdquo;
                  </p>
                </motion.div>

                <button
                  type="button"
                  onClick={startActualLevel}
                  className="flex min-h-14 shrink-0 items-center justify-center gap-2 px-8 py-3.5 text-base font-black text-white transition-all hover:scale-105 active:scale-100 sm:gap-3 sm:px-14 sm:py-5 sm:text-xl"
                  style={{
                    backgroundImage: `url(${ART_ASSET_BASE}/ui/modals/intro-button-normal.webp)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                  }}
                >
                  进入本阶段培养任务 <Play className="h-5 w-5 shrink-0 fill-current sm:h-6 sm:w-6" />
                </button>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'SHOP' && (
            <ShopScreen
              gameState={gameState}
              shopSelectedType={shopSelectedType}
              onSelectOffer={(type) => setShopSelectedType(type)}
              onBuy={buyItem}
              onNextLevel={goToLevelIntro}
            />
          )}

          {gameState.status === 'GAME_OVER' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-red-950/95">
              <DesignCanvasFit width={800} height={600} className="h-full" innerClassName="relative text-center">
                <img
                  src={`${ART_ASSET_BASE}/ui/modals/fail-panel.webp`}
                  alt=""
                  className="absolute left-[48px] top-[58px] h-[444px] w-[704px] object-fill drop-shadow-2xl"
                  draggable={false}
                />
                <img
                  src={`${ART_ASSET_BASE}/ui/modals/fail-warning-icon.webp`}
                  alt=""
                  className="absolute left-[354px] top-[126px] h-[86px] w-[100px] object-contain animate-[pulse_1.45s_ease-in-out_infinite]"
                  draggable={false}
                />
                <h2 className="absolute left-[265px] top-[225px] flex h-[40px] w-[280px] items-center justify-center text-[30px] font-black leading-tight tracking-tighter text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.75)]">
                  本阶段未达培养线
                </h2>
                <div className="absolute left-[265px] top-[277px] flex h-[40px] w-[280px] items-center justify-center">
                  <div className="text-[28px] font-black leading-none text-white drop-shadow-[0_3px_8px_rgba(0,0,0,0.85)]">
                    当前培养积分：{gameState.score}
                  </div>
                </div>
                <button
                  onClick={startGame}
                  className="group absolute left-[241px] top-[351px] flex h-[74px] w-[310px] items-center justify-center gap-3 text-[20px] font-black text-white transition-transform hover:scale-105 active:scale-100"
                  style={{
                    backgroundImage: `url(${ART_ASSET_BASE}/ui/modals/fail-button-normal.webp)`,
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'center',
                  }}
                >
                  <RotateCcw size={20} className="transition-transform group-hover:rotate-[-45deg]" /> 重新新生报到
                </button>
              </DesignCanvasFit>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="shrink-0 max-w-xl px-2 text-center text-[10px] leading-snug text-slate-600 sm:text-[11px] sm:leading-relaxed">
        北京中关村学院 · 人工智能方向拔尖创新人才培养 ·{' '}
        <a href="https://bza.edu.cn/" target="_blank" rel="noopener noreferrer" className="text-sky-500/90 hover:text-sky-400 underline underline-offset-2">学院官网 bza.edu.cn</a>
      </p>
    </div>
  );
}

/** 货架格：仅图标、名称、价签；点击为选中 */
function ShopShelfTileCompact({
  icon,
  title,
  price,
  selected,
  purchased,
  affordable,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  price: number;
  selected: boolean;
  purchased: boolean;
  affordable: boolean;
  onSelect: () => void;
}) {
  const cardFrame = purchased
    ? 'card-frame-3'
    : !affordable
      ? 'card-frame-4'
      : selected
        ? 'card-frame-2'
        : 'card-frame-1';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`pointer-events-auto relative mx-auto flex aspect-[0.56] h-full min-h-[150px] w-full max-w-[150px] flex-col items-center justify-between px-2 pb-3 pt-4 text-center transition-transform sm:min-h-[176px] sm:max-w-[162px] ${
        selected ? 'scale-[1.03]' : ''
      } ${purchased ? 'opacity-95' : 'hover:scale-[1.03] active:scale-100'}`}
      style={{
        backgroundImage: `url(${ART_ASSET_BASE}/ui/shop/${cardFrame}.webp)`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
      }}
    >
      <div className="flex h-[54%] w-full shrink-0 items-center justify-center pt-1 drop-shadow-[0_0_18px_rgba(56,189,248,0.34)]">
        {icon}
      </div>
      <div className="flex min-h-[2.7rem] w-full items-center justify-center px-1 text-[11px] font-black leading-tight text-sky-50 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] sm:text-[12px]">
        <span className="line-clamp-2">{title}</span>
      </div>
      <div className="mt-auto flex w-full flex-col items-center gap-1">
        <div
          className={`rounded-md px-2.5 py-1 text-[13px] font-black tabular-nums shadow sm:text-sm ${
            purchased
              ? 'bg-emerald-400/80 text-emerald-950 line-through'
              : affordable
                ? 'bg-sky-300 text-slate-950'
                : 'bg-slate-600/75 text-slate-300'
          }`}
        >
          ${price}
        </div>
        {purchased && <span className="text-[9px] font-black text-emerald-200 sm:text-[10px]">已购</span>}
      </div>
    </button>
  );
}

function ShopScreen({
  gameState,
  shopSelectedType,
  onSelectOffer,
  onBuy,
  onNextLevel,
}: {
  gameState: GameState;
  shopSelectedType: ShopItemType | null;
  onSelectOffer: (type: ShopItemType) => void;
  onBuy: (type: ShopItemType) => void;
  onNextLevel: () => void;
}) {
  const selectedOffer =
    shopSelectedType != null
      ? gameState.availableShopOffers.find((o) => o.type === shopSelectedType)
      : undefined;
  const selectedDef =
    shopSelectedType != null ? SHOP_ENTRY_DEFS.find((d) => d.type === shopSelectedType) : undefined;
  const purchased =
    shopSelectedType != null && gameState.purchasedItems.includes(shopSelectedType);
  const canBuy =
    Boolean(selectedOffer && selectedDef && !purchased && gameState.score >= (selectedOffer?.price ?? 0));
  const shopSlots = [
    ...gameState.availableShopOffers,
    ...Array.from({ length: Math.max(0, 6 - gameState.availableShopOffers.length) }, () => null),
  ].slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 overflow-hidden bg-slate-950 text-sky-50"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.26),transparent_42%),linear-gradient(180deg,#08203a_0%,#07111f_36%,#020617_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-sky-500/10 blur-3xl" />
      <ViewportScaleFit className="relative z-10 h-full" innerClassName="mx-auto flex w-full max-w-[560px] flex-col text-sky-50">
        <div className="relative z-10 mx-3 mt-3 flex shrink-0 items-center gap-2 rounded-2xl border border-sky-300/25 bg-slate-950/78 px-3 py-3 shadow-[0_0_36px_rgba(14,165,233,0.22)] backdrop-blur-md sm:mx-6 sm:mt-5 sm:gap-4 sm:px-5 sm:py-4">
          <h2 className="shrink-0 bg-gradient-to-r from-sky-100 via-cyan-300 to-violet-200 bg-clip-text text-xl font-black tracking-tight text-transparent drop-shadow-[0_0_18px_rgba(56,189,248,0.35)] sm:text-3xl lg:text-4xl">AI博士补给站</h2>
          <div className="min-w-0 flex-1 flex justify-center px-1">
            <div className="text-center leading-tight">
              <div className="text-[9px] font-black text-sky-200/80 sm:text-xs">当前培养积分</div>
              <div className="text-sm font-black tabular-nums text-lime-300 sm:text-lg lg:text-xl">${gameState.score}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onNextLevel}
            className="shrink-0 rounded-xl border border-amber-200/60 bg-amber-400 px-3 py-1.5 text-xs font-black text-slate-950 shadow-[0_0_22px_rgba(251,191,36,0.35)] transition-transform hover:bg-amber-300 active:scale-95 sm:px-5 sm:py-2.5 sm:text-base"
          >
            下一关
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:overflow-hidden">
            <p className="mb-3 shrink-0 rounded-xl border border-sky-300/15 bg-slate-950/45 px-3 py-2 text-center text-xs leading-relaxed text-sky-100/90 shadow-inner sm:text-left sm:text-sm">
              先点击货架<strong className="text-cyan-200">选中</strong>物资，在右侧说明区查看介绍后点<strong className="text-amber-200">「购买」</strong>。价签每轮随机，买完点右上角<strong className="text-amber-200">「下一关」</strong>继续。
            </p>

            <div className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-3xl border border-sky-300/20 bg-slate-950/62 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_36px_rgba(14,165,233,0.14)] backdrop-blur-md sm:mx-auto sm:w-full">
              <div className="grid grid-cols-3 grid-rows-2 gap-2 overflow-hidden px-2 py-3 sm:gap-3 sm:px-4 sm:py-4">
                {shopSlots.map((offer, index) => {
                  if (!offer) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="flex aspect-[0.56] min-h-[132px] items-center justify-center rounded-2xl border border-dashed border-sky-300/12 bg-slate-950/35 text-[10px] font-black text-sky-200/25 sm:min-h-[154px]"
                      >
                        待补给
                      </div>
                    );
                  }
                  const def = SHOP_ENTRY_DEFS.find((d) => d.type === offer.type);
                  if (!def) return null;
                  const itemPurchased = gameState.purchasedItems.includes(offer.type);
                  const itemAffordable = gameState.score >= offer.price;
                  return (
                    <div key={offer.type} className="flex min-h-0 min-w-0 h-full w-full">
                      <ShopShelfTileCompact
                        icon={shopRowIcon(offer.type, 'h-20 w-20 sm:h-24 sm:w-24')}
                        title={def.title}
                        price={offer.price}
                        selected={shopSelectedType === offer.type}
                        purchased={itemPurchased}
                        affordable={itemAffordable}
                        onSelect={() => onSelectOffer(offer.type)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex w-full min-h-0 min-w-0 shrink-0 flex-col gap-2">
            <div className="flex shrink-0 flex-row items-end justify-center gap-2">
              <img
                src={`${ART_ASSET_BASE}/ui/modals/robot-mentor.webp`}
                alt=""
                className="h-16 w-16 shrink-0 object-contain drop-shadow-[0_0_20px_rgba(56,189,248,0.35)] sm:h-24 sm:w-24"
                draggable={false}
              />
              <div
                className="relative min-w-0 flex-1 rounded-2xl px-4 py-3 text-left text-xs font-bold leading-snug text-sky-50 shadow-lg sm:text-base"
                style={{
                  backgroundImage: `linear-gradient(rgba(2,6,23,0.1), rgba(2,6,23,0.1)), url(${ART_ASSET_BASE}/ui/shop/advisor-bubble-wide.webp)`,
                  backgroundRepeat: 'no-repeat',
                  backgroundSize: '100% 100%',
                  backgroundPosition: 'center',
                }}
              >
                同学好！先看说明再点购买，合理选择补给，能让你的 AI 研究之旅更高效哦！
              </div>
            </div>

            <div className="flex min-h-0 shrink-0 flex-col overflow-hidden rounded-3xl border border-sky-300/25 bg-slate-950/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_28px_rgba(14,165,233,0.14)] backdrop-blur-md">
              <div className="min-h-0 px-3 py-3 sm:px-4 sm:py-4">
              {selectedDef && selectedOffer ? (
                <>
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-100">
                      {shopRowIcon(selectedDef.type, 'h-9 w-9')}
                    </div>
                    <h3 className="min-w-0 text-base font-black leading-snug text-sky-50 sm:text-lg lg:text-xl">{selectedDef.title}</h3>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-sky-100/90 sm:mt-2 sm:text-sm lg:text-base">{selectedDef.desc}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="rounded-xl border border-amber-200/20 bg-slate-900/70 px-3 py-2 text-sm font-black tabular-nums text-lime-300 sm:text-base lg:text-lg">
                      标价 <span className="text-lime-200">${selectedOffer.price}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBuy(shopSelectedType!)}
                      disabled={!canBuy}
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm font-black shadow-lg transition-transform sm:px-4 sm:py-3 sm:text-base lg:text-lg ${
                        purchased
                          ? 'cursor-not-allowed border-emerald-300/35 bg-emerald-500/20 text-emerald-100'
                          : canBuy
                            ? 'border-cyan-200/60 bg-cyan-400 text-slate-950 hover:bg-cyan-300 active:scale-[0.99]'
                            : 'cursor-not-allowed border-slate-500/40 bg-slate-800/70 text-slate-400'
                      }`}
                    >
                      {purchased ? '已购买' : gameState.score < selectedOffer.price ? '培养积分不足' : '购买'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-sky-200/80 sm:text-base">请先在左侧选择一件物资。</p>
              )}
              </div>
            </div>
          </div>
        </div>
      </ViewportScaleFit>
    </motion.div>
  );
}
