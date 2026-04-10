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
  Trophy,
  Cpu,
  BrainCircuit,
  AlertTriangle,
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
import { GameItem, GameState, ShopItemType } from './types';
import { getCatchMumble, getShredderMumble } from './phdMumbles';

function shopRowIcon(type: ShopItemType, iconClass = 'w-7 h-7'): React.ReactNode {
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
  update() { this.x += this.vx; this.y += this.vy; this.life -= 0.02; }
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
  update() { this.y -= 1; this.life -= 0.015; }
  draw(ctx: CanvasRenderingContext2D) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1.0;
  }
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

  const [items, setItems] = useState<GameItem[]>([]);
  const [mumbleBubble, setMumbleBubble] = useState<string | null>(null);
  const [hook, setHook] = useState({
    angle: Math.PI / 2, length: INITIAL_ROPE_LENGTH,
    state: 'SWINGING' as 'SWINGING' | 'EXTENDING' | 'RETRACTING',
    swingDirection: 1, caughtItem: null as GameItem | null,
  });

  const [shopSelectedType, setShopSelectedType] = useState<ShopItemType | null>(null);
  const shopVisitActiveRef = useRef(false);

  // Refs for game loop to avoid stale closures and React update issues
  const itemsRef = useRef<GameItem[]>([]);
  const gameStateRef = useRef<GameState>(gameState);
  const hookRef = useRef(hook);
  const particlesRef = useRef<Particle[]>([]);
  const floatingTextsRef = useRef<FloatingText[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(null);
  const tickRef = useRef(0);

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

  // Sync refs with state
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);
  useEffect(() => { hookRef.current = hook; }, [hook]);

  const tryFireHook = useCallback(() => {
    if (gameStateRef.current.status !== 'PLAYING') return;
    if (hookRef.current.state !== 'SWINGING') return;
    const h = { ...hookRef.current, state: 'EXTENDING' as const };
    hookRef.current = h;
    setHook(h);
  }, []);

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
      hookRef.current = newHook;
      setHook(newHook);
      for (let i = 0; i < 10; i++) {
        particlesRef.current.push(
          new Particle(
            MINER_X + Math.cos(h.angle) * h.length,
            MINER_Y + Math.sin(h.angle) * h.length,
            '#ef4444'
          )
        );
      }
      return;
    }

    if (h.state === 'EXTENDING') {
      setGameState((prev) => ({ ...prev, hasShredder: prev.hasShredder - 1 }));
      const newHook = { ...h, state: 'RETRACTING' as const };
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
      hookRef.current = newHook;
      setHook(newHook);
    }
  }, []);

  const initLevel = useCallback((level: number) => {
    const newItems = buildLevelItems(level);
    setItems(newItems);
    itemsRef.current = newItems;
  }, []);

  const startGame = () => {
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
    const newHook = { angle: Math.PI / 2, length: INITIAL_ROPE_LENGTH, state: 'SWINGING' as const, swingDirection: 1, caughtItem: null };
    setHook(newHook);
    hookRef.current = newHook;
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
    const newHook = { angle: Math.PI / 2, length: INITIAL_ROPE_LENGTH, state: 'SWINGING' as const, swingDirection: 1, caughtItem: null };
    setHook(newHook);
    hookRef.current = newHook;
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
  }, []);

  const update = useCallback(() => {
    // Always request next frame to keep loop alive, or handle restart in useEffect
    requestRef.current = requestAnimationFrame(update);

    if (gameStateRef.current.status !== 'PLAYING') return;

    tickRef.current += 1;
    const h = { ...hookRef.current };
    let itemsChanged = false;
    let scoreChanged = 0;
    let bagShredBonus = 0;
    let bagStrengthBonus = 0;

    // Update moving items (Interns)
    itemsRef.current.forEach(item => {
      if (item.vx !== undefined) {
        if (item.movePauseTimer && item.movePauseTimer > 0) {
          item.movePauseTimer -= 16.67;
        } else {
          item.x += item.vx;
          if (item.x < (item.rangeMin || item.radius) || item.x > (item.rangeMax || CANVAS_WIDTH - item.radius)) {
            item.vx *= -1;
            item.movePauseTimer = 1000; // 1s pause on direction change
          }
        }
      }
    });
    itemsChanged = true;

    // Handle hook pause timer - only affects hook logic
    let isHookPaused = false;
    if (gameStateRef.current.pauseTimer > 0) {
      const newTimer = Math.max(0, gameStateRef.current.pauseTimer - 16.67);
      
      // If timer just finished, apply the large deflection
      if (newTimer === 0 && gameStateRef.current.pauseTimer > 0) {
        // Large random deflection after pause
        h.angle = Math.PI * 0.1 + Math.random() * (Math.PI * 0.8);
        hookRef.current = h;
        setHook(h);
      }
      
      setGameState(prev => ({ ...prev, pauseTimer: newTimer }));
      isHookPaused = true;
    }

    if (!isHookPaused) {
      if (h.state === 'SWINGING') {
        h.angle += SWING_SPEED * h.swingDirection;
        if (h.angle > Math.PI * 0.9 || h.angle < Math.PI * 0.1) h.swingDirection *= -1;
      } else if (h.state === 'EXTENDING') {
      h.length += EXTEND_SPEED;
      const hX = MINER_X + Math.cos(h.angle) * h.length;
      const hY = MINER_Y + Math.sin(h.angle) * h.length;
      
      // Check bounds
      if (hX < 0 || hX > CANVAS_WIDTH || hY > CANVAS_HEIGHT) {
        h.state = 'RETRACTING';
      }

      const hookHitR = HOOK_RADIUS + (gameStateRef.current.hookRadiusBonus || 0);
      const hitIdx = itemsRef.current.findIndex(item => {
        const dx = item.x - hX;
        const dy = item.y - hY;
        return Math.sqrt(dx * dx + dy * dy) < item.radius + hookHitR;
      });

      if (hitIdx !== -1) {
        const hitItem = itemsRef.current[hitIdx];
        if (hitItem.type === 'TNT') {
          // Explosion
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
          h.caughtItem = hitItem;
          h.state = 'RETRACTING';
          itemsRef.current = itemsRef.current.filter((_, i) => i !== hitIdx);
          itemsChanged = true;
          setMumbleBubble(getCatchMumble(hitItem, tickRef.current));
        }
      }
    } else if (h.state === 'RETRACTING') {
      const pullSpeed = h.caughtItem 
        ? Math.max(0.8, (BASE_PULL_SPEED * gameStateRef.current.pullSpeedMultiplier) - (h.caughtItem.weight / gameStateRef.current.strength))
        : RETRACT_SPEED;
      
      h.length -= pullSpeed;
      
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

          floatingTextsRef.current.push(new FloatingText(MINER_X, MINER_Y - 40, `+$${scoreChanged}`, '#4ade80'));
          if (bagShredBonus > 0) {
            floatingTextsRef.current.push(new FloatingText(MINER_X - 28, MINER_Y - 58, '+稿件回收×1', '#f87171'));
          }
          if (bagStrengthBonus > 0) {
            floatingTextsRef.current.push(new FloatingText(MINER_X + 28, MINER_Y - 58, '大力抓取↑', '#38bdf8'));
          }
          h.caughtItem = null;

          setGameState((prev) => ({
            ...prev,
            pauseTimer: 700,
            score: prev.score + scoreChanged,
            hasShredder: prev.hasShredder + bagShredBonus,
            strength: prev.strength + bagStrengthBonus,
          }));
        } else {
          // Normal return without item - small adjustment
          h.angle += (Math.random() - 0.5) * 0.2;
          h.angle = Math.max(Math.PI * 0.1, Math.min(Math.PI * 0.9, h.angle));
        }
      }
    }
  }

    // Update particles and floating texts
    particlesRef.current.forEach(p => p.update());
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    floatingTextsRef.current.forEach(t => t.update());
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
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Background nodes (Latent Space effect)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.1)'; ctx.lineWidth = 1;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(0, 100 + i * 100); ctx.lineTo(CANVAS_WIDTH, 150 + i * 80); ctx.stroke();
    }

    // Miner Area（高度随 MINER_Y 留出站台，避免小人贴紧与矿区交界线）
    const minerPlatformBottom = Math.max(108, MINER_Y + 20);
    ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, CANVAS_WIDTH, minerPlatformBottom);
    ctx.strokeStyle = '#1e293b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, minerPlatformBottom); ctx.lineTo(CANVAS_WIDTH, minerPlatformBottom); ctx.stroke();

      // Items
      items.forEach(item => {
        ctx.save();
        ctx.translate(item.x, item.y);
        
        // Glow effect
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, item.radius * 2);
        gradient.addColorStop(0, `${item.color}44`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, item.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Emoji representation
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
        
        ctx.font = `${item.radius * 1.8}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 面向运动方向（默认贴图朝左时，向右走需水平翻转）
        if (item.vx && item.vx > 0) {
          ctx.scale(-1, 1);
        }
        ctx.fillText(emojiMap[item.type] || '❓', 0, 0);

        // Draw carried item
        if (item.carriedItem === 'DIAMOND') {
          ctx.font = `${item.radius * 0.8}px sans-serif`;
          ctx.fillText('💎', 10, -10);
        }

        // Label
        ctx.restore();
        ctx.save();
        ctx.translate(item.x, item.y);
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(item.label, 0, item.radius + 15);
        
        ctx.restore();
      });

    // Rope & Hook
    const hX = MINER_X + Math.cos(hook.angle) * hook.length;
    const hY = MINER_Y + Math.sin(hook.angle) * hook.length;
    
    // Draw Rope with a bit of texture
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(MINER_X, MINER_Y);
    ctx.lineTo(hX, hY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Hook (Grapple)
    ctx.save();
    ctx.translate(hX, hY);
    ctx.rotate(hook.angle + Math.PI / 2);
    
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    
    // Hook shape
    ctx.beginPath();
    ctx.moveTo(-8, -5);
    ctx.quadraticCurveTo(0, 10, 8, -5);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(0, 5);
    ctx.stroke();

    if (hook.caughtItem) {
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
      ctx.fillText(emojiMap[hook.caughtItem.type] || '❓', 0, 15);
      if (hook.caughtItem.carriedItem === 'DIAMOND') {
        ctx.font = `${hook.caughtItem.radius * 0.7}px sans-serif`;
        ctx.fillText('💎', 8, 5);
      }
    }
    ctx.restore();

    // 碎碎念气泡：放在博士左侧，矩形与尾巴均不进入小人包围盒（与小人互不遮挡）
    if (mumbleBubble) {
      const margin = 8;
      /** 收窄宽度多换行，避免伸进左侧黄色 HUD 下被挡（画布坐标下约 1/4 宽为 HUD） */
      const maxTextW = 88;
      const padding = 8;
      const lineH = 16;
      const fontBubble = 'bold 12px sans-serif';
      /** 小人占用宽度的一半 + 留白，气泡右缘须在此线左侧 */
      const minerHalfW = 44;
      const bubbleToMinerGap = 14;
      const leftHudReserve = 216;

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
      const br = 10;
      const bubbleRightMax = MINER_X - minerHalfW - bubbleToMinerGap;
      let bx = bubbleRightMax - bw;
      bx = Math.max(leftHudReserve, bx);
      bx = Math.max(margin, bx);
      if (bx + bw > bubbleRightMax) bx = bubbleRightMax - bw;
      bx = Math.max(leftHudReserve, bx);
      const anchorY = MINER_Y - 26;
      let by = anchorY - bh / 2;
      if (by < margin) by = margin;
      if (by + bh > MINER_Y + 28) by = MINER_Y + 28 - bh;

      ctx.fillStyle = 'rgba(255,255,255,0.96)';
      ctx.strokeStyle = 'rgba(15,23,42,0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, bw, bh, br);
      ctx.fill();
      ctx.stroke();

      const midY = by + bh / 2;
      const bubbleRight = bx + bw;
      const tailTipX = MINER_X - 24;
      const tailTipY = MINER_Y - 22;
      ctx.beginPath();
      ctx.moveTo(bubbleRight, midY - 9);
      ctx.lineTo(tailTipX, tailTipY);
      ctx.lineTo(bubbleRight, midY + 9);
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
    ctx.translate(MINER_X, MINER_Y - 20);
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.roundRect(-15, 0, 30, 25, 5);
    ctx.fill();

    ctx.font = '40px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('👨‍🎓', 0, 5);

    ctx.restore();

    particlesRef.current.forEach(p => p.draw(ctx));
    floatingTextsRef.current.forEach(t => t.draw(ctx));
  }, [items, hook, mumbleBubble]);

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

  return (
    <div className="app-shell-fill box-border flex flex-col items-center justify-center gap-1 bg-slate-950 font-sans text-slate-100 app-safe-x app-safe-b app-safe-t px-2 sm:px-4 md:gap-2">
      <div
        className="portrait-hint-bar shrink-0 items-center justify-center gap-1.5 border-b border-slate-800/80 bg-slate-900/95 px-2 py-1 text-center text-[10px] font-bold leading-tight text-amber-200/90"
        role="status"
      >
        <span aria-hidden>↻</span>
        横屏可显示更大画面；竖屏已自动缩放至一屏内，无需拖动页面。
      </div>
      <div className="game-viewport relative">
        <div className="game-stage-outer group relative shrink-0 overflow-hidden rounded-2xl border-4 border-slate-800/80 bg-slate-950 shadow-[0_0_80px_rgba(0,0,0,0.6)] sm:rounded-[2rem] sm:border-[10px] lg:rounded-[3rem] lg:border-[12px] game-stage-shell">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className={`game-canvas relative z-0 ${gameState.status === 'TUTORIAL_OVERLAY' ? 'cursor-default' : 'cursor-crosshair'}`}
          onPointerDown={(e) => {
            if (e.pointerType === 'touch') e.preventDefault();
            tryFireHook();
          }}
        />

        {showMinerHud && (
          <div className="pointer-events-none absolute inset-x-0 top-0 z-[11] flex h-[18%] max-h-[118px]">
            <div className="pointer-events-auto flex h-full w-[28%] max-w-[220px] shrink-0 flex-col justify-center border-b-[0.5cqi] border-amber-800 bg-gradient-to-b from-amber-300 to-amber-400 px-[1.5cqi] py-[0.8cqi] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <div className="text-[clamp(6px,1.3cqi,10px)] font-black leading-tight text-amber-950/90">培养积分</div>
              <div className="text-[clamp(10px,2.5cqi,18px)] font-black leading-none text-green-700 tabular-nums drop-shadow-sm">${gameState.score}</div>
              <div className="mt-[0.3cqi] text-[clamp(6px,1.3cqi,10px)] font-black leading-tight text-amber-950/90">阶段达标线</div>
              <div className="text-[clamp(8px,2cqi,14px)] font-black leading-none text-amber-950 tabular-nums">${gameState.targetScore}</div>
            </div>
            <div className="min-h-0 min-w-0 flex-1 pointer-events-none" aria-hidden />
            <div className="pointer-events-auto flex h-full w-[28%] max-w-[220px] shrink-0 flex-col items-end justify-center gap-[0.4cqi] border-b-[0.5cqi] border-amber-800 bg-gradient-to-b from-amber-300 to-amber-400 px-[1.2cqi] py-[0.8cqi] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
              <button
                type="button"
                onClick={exitLevel}
                className="pointer-events-auto shrink-0 rounded border-[0.25cqi] border-red-800 bg-amber-100 px-[1.2cqi] py-[0.4cqi] text-[clamp(6px,1.4cqi,10px)] font-black text-red-700 shadow-sm active:scale-95 flex items-center gap-[0.3cqi]"
              >
                <LogOut className="h-[1.6cqi] w-[1.6cqi] shrink-0" />
                退出本关
              </button>
              <div className="text-right leading-tight">
                <div className="text-[clamp(6px,1.3cqi,10px)] font-black text-amber-950">时间</div>
                {gameState.status === 'TUTORIAL_OVERLAY' ? (
                  <div className="text-[clamp(10px,3cqi,20px)] font-black text-amber-900/70 tabular-nums">—</div>
                ) : (
                  <div className={`text-[clamp(10px,3cqi,20px)] font-black tabular-nums ${gameState.timeLeft < 10 ? 'text-red-600 animate-pulse' : 'text-red-700'}`}>{gameState.timeLeft}</div>
                )}
                <div className="text-[clamp(6px,1.3cqi,10px)] font-black text-amber-950">第 {gameState.level} 阶段</div>
              </div>
            </div>
          </div>
        )}

        {gameState.status === 'PLAYING' && (
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
                  <BrainCircuit className="mx-auto h-12 w-12 text-sky-400 sm:h-24 sm:w-24 md:h-28 md:w-28" />
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
                  className="group relative mb-4 flex shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-black text-slate-950 shadow-[0_0_30px_rgba(14,165,233,0.4)] transition-all hover:scale-105 hover:bg-sky-400 active:scale-100 active:bg-sky-600 sm:gap-3 sm:rounded-2xl sm:px-10 sm:py-4 sm:text-lg md:px-12 md:py-5 md:text-xl"
                >
                  <Play className="fill-current w-5 h-5 sm:w-6 sm:h-6 shrink-0" /> 新生报到，开始培养方案
                </button>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'LEVEL_COMPLETE' && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="absolute inset-0 z-50 bg-slate-950/80">
              <ViewportScaleFit className="h-full p-3 sm:p-4" innerClassName="flex flex-col items-center text-center">
                <div className="w-full max-w-sm rounded-2xl border-2 border-green-500 bg-slate-900 p-4 text-center shadow-2xl sm:rounded-3xl sm:border-4 sm:p-6">
                  <Trophy className="mx-auto mb-4 h-12 w-12 text-green-400" />
                  <h2 className="mb-2 text-2xl font-black text-white">
                    {gameState.level === 8 ? '培养方案终极节点达成！' : '本阶段培养达标！'}
                  </h2>
                  <p className="mb-6 text-sm leading-relaxed text-slate-400">
                    {gameState.level === 8 
                      ? '你已走完学院规定的培养环节，准备好登上学位论文答辩席了吗？' 
                      : '导师组对你的进展很满意。去学院补给站补充算力与物资，再迎接下一培养阶段吧。'}
                  </p>
                  <div className="flex flex-col gap-3">
                    {gameState.level === 8 ? (
                      <button onClick={() => setGameState(prev => ({ ...prev, status: 'GRADUATED' }))} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-500 py-3 text-base font-black text-slate-950 hover:bg-sky-400">
                        <Sparkles size={18} /> 参加学位授予典礼
                      </button>
                    ) : (
                      <>
                        <button onClick={nextLevel} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 text-base font-black text-slate-950 hover:bg-amber-400"><ShoppingCart size={18} /> 前往学院补给站</button>
                        <button onClick={() => { nextLevel(); goToLevelIntro(); }} className="w-full rounded-xl bg-slate-800 py-3 text-sm font-bold text-white hover:bg-slate-700">不进补给站，直接进入下阶段</button>
                      </>
                    )}
                  </div>
                </div>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'GRADUATED' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 overflow-hidden bg-slate-950">
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 5 }} className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
              <motion.div animate={{ scale: [1, 1.3, 1], rotate: [0, -5, 5, 0] }} transition={{ repeat: Infinity, duration: 6 }} className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />

              <ViewportScaleFit className="relative z-10 h-full p-4 sm:p-8" innerClassName="flex flex-col items-center text-center">
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.8 }}>
                  <Trophy className="mx-auto mb-6 h-20 w-20 text-amber-400 drop-shadow-[0_0_30px_rgba(251,191,36,0.5)]" />
                  <h2 className="mb-4 px-1 text-2xl font-black leading-tight tracking-tighter text-white min-[400px]:text-4xl sm:text-5xl">恭喜，中关村学院准博士！</h2>
                  <p className="mx-auto mb-6 max-w-lg px-1 text-sm leading-relaxed text-slate-400 sm:mb-8 sm:text-lg">
                    历经八个培养阶段，你在潜空间中交出了扎实的 AI 成果。学位论文答辩顺利通过——<strong className="text-slate-300">北京中关村学院</strong>为你骄傲，愿你在人工智能前沿继续攀登。
                  </p>
                  <div className="mb-8 inline-block rounded-2xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
                    <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">累计培养积分</div>
                    <div className="text-4xl font-black text-green-400">{gameState.score}</div>
                  </div>
                  <br />
                  <button onClick={startGame} className="rounded-xl bg-sky-500 px-10 py-4 text-lg font-black text-slate-950 shadow-xl transition-all hover:scale-105 hover:bg-sky-400">
                    再来一届新生入学
                  </button>
                </motion.div>
              </ViewportScaleFit>
            </motion.div>
          )}

          {gameState.status === 'INTRO' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-50 bg-slate-950/95">
              <ViewportScaleFit className="h-full p-4 sm:p-8 lg:p-12" innerClassName="flex flex-col items-center text-center">
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

                <button type="button" onClick={startActualLevel} className="flex shrink-0 items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-black text-slate-950 transition-all hover:scale-105 active:scale-100 sm:gap-3 sm:rounded-2xl sm:px-12 sm:py-5 sm:text-xl">
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
              <ViewportScaleFit className="h-full p-3 sm:p-4" innerClassName="flex flex-col items-center text-center">
                <div className="relative mb-4">
                  <AlertTriangle className="h-16 w-16 animate-bounce text-red-500" />
                  <div className="absolute inset-0 animate-pulse bg-red-500 opacity-20 blur-3xl" />
                </div>
                <h2 className="mb-3 px-2 text-2xl font-black leading-tight tracking-tighter text-white sm:mb-4 sm:text-4xl">本阶段未达培养线</h2>
                <p className="mb-6 max-w-md px-2 text-sm leading-relaxed text-red-200/80 sm:mb-8 sm:text-base">
                  本关培养积分未达学院阶段要求，培养进程暂停——这在高强度的 AI 博士训练中并不罕见。整理心情，调整策略，你仍可以重新从新生报到开始挑战。
                </p>
                <div className="mb-8 w-full max-w-xs rounded-2xl border-2 border-red-500/30 bg-slate-900/80 p-6 shadow-2xl">
                  <div className="mb-1 text-xs uppercase tracking-widest text-slate-500">本局培养积分</div>
                  <div className="text-4xl font-black text-white">{gameState.score}</div>
                </div>
                <button onClick={startGame} className="group relative flex items-center gap-3 rounded-xl bg-white px-10 py-4 text-lg font-black text-red-950 shadow-xl transition-all hover:scale-105 hover:bg-red-50">
                  <RotateCcw size={20} className="transition-transform group-hover:rotate-[-45deg]" /> 重新新生报到
                </button>
              </ViewportScaleFit>
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

const SHOP_TILE_COLOR_MAP: Record<string, string> = {
  amber: 'border-amber-700/80 bg-amber-100/95 text-amber-900',
  sky: 'border-sky-700/80 bg-sky-100/95 text-sky-900',
  red: 'border-red-700/80 bg-red-100/95 text-red-900',
  purple: 'border-purple-700/80 bg-purple-100/95 text-purple-900',
  green: 'border-emerald-700/80 bg-emerald-100/95 text-emerald-900',
  orange: 'border-orange-700/80 bg-orange-100/95 text-orange-900',
  pink: 'border-pink-700/80 bg-pink-100/95 text-pink-900',
  slate: 'border-stone-600/80 bg-stone-100/95 text-stone-900',
};

/** 货架格：仅图标、名称、价签；点击为选中 */
function ShopShelfTileCompact({
  icon,
  title,
  price,
  selected,
  purchased,
  onSelect,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  price: number;
  selected: boolean;
  purchased: boolean;
  onSelect: () => void;
  color: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`pointer-events-auto mx-auto flex h-full min-h-[108px] w-full max-w-[120px] flex-col items-stretch justify-between rounded-lg p-1 transition-transform sm:min-h-[118px] sm:max-w-[132px] ${
        selected ? 'ring-2 ring-amber-200 ring-offset-2 ring-offset-amber-950/80 scale-[1.02]' : ''
      } ${purchased ? 'opacity-90' : 'hover:scale-[1.02] active:scale-100'}`}
    >
      <div
        className={`flex h-12 w-full shrink-0 items-center justify-center rounded-lg border-2 shadow-md sm:h-14 ${SHOP_TILE_COLOR_MAP[color] || SHOP_TILE_COLOR_MAP.slate}`}
      >
        {icon}
      </div>
      <div className="mt-1.5 flex min-h-[2.25rem] w-full items-start justify-center px-0.5 text-center text-[10px] font-black leading-tight text-amber-50 sm:min-h-[2.5rem] sm:text-xs">
        <span className="line-clamp-2">{title}</span>
      </div>
      <div className="mt-auto flex w-full flex-col items-center gap-1 pt-1">
        <div
          className={`rounded-md border-2 border-lime-900 px-2 py-1 text-sm font-black tabular-nums shadow sm:text-base ${purchased ? 'bg-stone-500 text-stone-200 line-through' : 'bg-lime-500 text-lime-950'}`}
        >
          ${price}
        </div>
        {purchased && <span className="text-[10px] font-black text-lime-300 sm:text-xs">已购</span>}
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 shop-wood-bg overflow-hidden text-amber-50"
    >
      <ViewportScaleFit className="h-full" innerClassName="flex flex-col text-amber-50">
        <div className="relative z-10 flex shrink-0 items-center gap-2 border-b-2 border-amber-950/50 px-3 pb-3 pt-3 sm:gap-4 sm:px-6 sm:pb-3 sm:pt-5">
          <h2 className="shop-title-gold shrink-0 text-xl font-black tracking-tight sm:text-3xl lg:text-4xl">学院补给站</h2>
          <div className="min-w-0 flex-1 flex justify-center px-1">
            <div className="text-center leading-tight">
              <div className="text-[9px] font-black text-amber-200/90 sm:text-xs">当前培养积分</div>
              <div className="text-sm font-black tabular-nums text-lime-300 sm:text-lg lg:text-xl">${gameState.score}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onNextLevel}
            className="shrink-0 rounded-xl border-2 border-lime-800 bg-lime-500 px-3 py-1.5 text-xs font-black text-lime-950 shadow-md transition-transform hover:bg-lime-400 active:scale-95 sm:px-5 sm:py-2.5 sm:text-base"
          >
            下一关
          </button>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 py-3 sm:flex-row sm:items-stretch sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col sm:overflow-hidden">
            <p className="mb-3 shrink-0 text-center text-sm leading-relaxed text-amber-100/95 sm:text-left sm:text-base">
              先点击货架<strong className="text-amber-200">选中</strong>物资，在<strong className="text-amber-200">右侧说明区</strong>查看介绍后点<strong className="text-amber-200">「购买」</strong>。价签每轮随机。买完点右上角<strong className="text-amber-200">「下一关」</strong>继续。
            </p>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-4 border-amber-900/80 bg-gradient-to-b from-amber-800/35 to-amber-950/50 sm:mx-auto sm:max-w-3xl sm:w-full">
              <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto overscroll-contain px-2 py-3 [grid-auto-rows:min-content] content-start sm:grid-cols-3 md:grid-cols-4 sm:gap-3 sm:px-3 sm:py-4">
                {gameState.availableShopOffers.map((offer) => {
                  const def = SHOP_ENTRY_DEFS.find((d) => d.type === offer.type);
                  if (!def) return null;
                  const itemPurchased = gameState.purchasedItems.includes(offer.type);
                  return (
                    <div key={offer.type} className="flex min-h-0 min-w-0 h-full w-full">
                      <ShopShelfTileCompact
                        icon={shopRowIcon(offer.type, 'w-6 h-6 sm:w-7 sm:h-7')}
                        title={def.title}
                        price={offer.price}
                        selected={shopSelectedType === offer.type}
                        purchased={itemPurchased}
                        onSelect={() => onSelectOffer(offer.type)}
                        color={def.color}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex w-full min-h-0 min-w-0 shrink-0 flex-col gap-2 sm:w-[13.5rem] lg:w-[15rem]">
            <div className="flex shrink-0 flex-row items-start justify-center gap-2 sm:flex-col sm:items-center">
              <span className="text-4xl drop-shadow-lg sm:text-5xl lg:text-6xl" role="img" aria-hidden>
                👨‍🏫
              </span>
              <div className="relative min-w-0 flex-1 rounded-2xl border-2 border-amber-200/40 bg-amber-50 px-2.5 py-2 text-left text-xs font-bold leading-snug text-amber-950 shadow-lg sm:mt-1 sm:w-full sm:px-3 sm:py-2.5 sm:text-sm lg:text-base">
                <div className="absolute -left-1.5 top-3 hidden h-3 w-3 rotate-45 border-b-2 border-l-2 border-amber-200/40 bg-amber-50 sm:block" />
                同学好！先看说明再点购买，别手滑～
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-4 border-amber-900/85 bg-gradient-to-b from-amber-950/55 to-amber-950/90 shadow-inner">
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4 sm:py-4">
              {selectedDef && selectedOffer ? (
                <>
                  <h3 className="text-base font-black leading-snug text-amber-50 sm:text-lg lg:text-xl">{selectedDef.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-amber-100/95 sm:mt-2 sm:text-sm lg:text-base">{selectedDef.desc}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    <div className="text-sm font-black tabular-nums text-lime-300 sm:text-base lg:text-lg">
                      标价 <span className="text-lime-200">${selectedOffer.price}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onBuy(shopSelectedType!)}
                      disabled={!canBuy}
                      className={`w-full rounded-xl border-2 px-3 py-2.5 text-sm font-black shadow-lg transition-transform sm:px-4 sm:py-3 sm:text-base lg:text-lg ${
                        purchased
                          ? 'cursor-not-allowed border-stone-600 bg-stone-700/80 text-stone-300'
                          : canBuy
                            ? 'border-amber-800 bg-amber-400 text-amber-950 hover:bg-amber-300 active:scale-[0.99]'
                            : 'cursor-not-allowed border-amber-900/60 bg-amber-950/50 text-amber-200/50'
                      }`}
                    >
                      {purchased ? '已购买' : gameState.score < selectedOffer.price ? '培养积分不足' : '购买'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center text-sm text-amber-200/80 sm:text-base">请先在左侧选择一件物资。</p>
              )}
              </div>
            </div>
          </div>
        </div>
      </ViewportScaleFit>
    </motion.div>
  );
}
