import type { GameItem, ItemType } from './types';

function pick<T>(arr: readonly T[], salt: number): T {
  return arr[salt % arr.length];
}

/** 勾中瞬间（钩子挂上物品）的碎碎念，按类型至少 3 条 */
const CATCH_BY_TYPE: Record<ItemType, readonly string[]> = {
  DATA_POINT: [
    '小样，先导数据也是数据！',
    '先捞点样本暖暖手～',
    '这点数不够发论文，但够交作业。',
  ],
  DATASET: [
    '整文件夹端走，导师看了都沉默。',
    '标注人的泪，我的分。',
    '这袋够组会吹一周。',
  ],
  CORPUS: [
    '语料山！今晚算力条要哭。',
    '大的来了——硬盘在尖叫。',
    '这一钩，配得上「大工程」三个字。',
  ],
  ROCK: [
    '……盲审意见也算分？行吧。',
    '绊脚石也是培养方案的一环。',
    '至少比空钩体面一点点。',
  ],
  DIAMOND: [
    ' Oral 在向我招手！',
    '这亮度，像不像 accept？',
    '导师：可以，这很中关村。',
  ],
  BAG: [
    '神秘袋？薛定谔的经费。',
    '赌一把，万一里面全是算力券呢。',
    '开箱前：我是冷静的博士。',
  ],
  TNT: [
    '我是不是手滑了……',
    '维护窗口！全体趴下！',
    '这钩下去，潜空间要重启了。',
  ],
  INTERN: [
    '师兄别跑！把你手里的样本留下！',
    '同届互助，借点成果不过分吧？',
    '抓到一只会移动的参考文献。',
  ],
};

export function getCatchMumble(item: GameItem, tickSalt: number): string {
  const base = CATCH_BY_TYPE[item.type];
  const salt = tickSalt + item.id.length * 7;
  if (item.type === 'INTERN' && item.carriedItem === 'DIAMOND') {
    const lines = [
      '手捧钻石的师兄！这钩值了！',
      '人形 Oral 载体，得罪了。',
      '师兄对不起，这分我先替你保管。',
    ];
    return pick(lines, salt);
  }
  return pick(base, salt);
}

/** 估算若拉回可得的培养积分（用于稿件回收通道分级） */
export function estimateItemPullValue(item: GameItem, gs: {
  diamondValueBonus: number;
  rockValueBonus: number;
  dataPointBonus: number;
  datasetBonus: number;
  corpusBonus: number;
  luck: number;
}): number {
  if (item.type === 'BAG') {
    const luck = gs.luck || 1;
    return Math.floor(100 + 230 * luck);
  }
  let base = item.value;
  if (item.type === 'DIAMOND' || (item.type === 'INTERN' && item.carriedItem === 'DIAMOND')) {
    base += gs.diamondValueBonus || 0;
  }
  if (item.type === 'ROCK') base += gs.rockValueBonus || 0;
  if (item.type === 'DATA_POINT') base += gs.dataPointBonus || 0;
  if (item.type === 'DATASET') base += gs.datasetBonus || 0;
  if (item.type === 'CORPUS') base += gs.corpusBonus || 0;
  return Math.max(0, base);
}

const SHRED_LOW: readonly string[] = [
  '扔得好，这垃圾不配上车。',
  '审稿意见？回收了，眼不见为净。',
  '止损成功，情绪价值拉满。',
  '导师没看见的，就当没发生过。',
  '低价值清零，这波我在大气层。',
  '回收通道：专治各种不甘心的小石头。',
];

const SHRED_HIGH: readonly string[] = [
  '老哥你在做 what？？',
  '那是钻石/大语料啊！！你清醒一点！',
  '回收通道不是回收智商的啊喂！',
  '这一扔，培养积分在滴血……',
  '我怀疑你是对面学院派来的。',
  '？？？这钩你是闭着眼睛按的吗',
  '行，你开心就好（心在滴血）',
  '高情商：战略性放弃。低情商：亏麻了。',
];

const SHRED_MID: readonly string[] = [
  '数据集也扔？……行，你论文里别写我名字。',
  '神秘袋没开就扔，薛定谔听了都摇头。',
  '可回收，但我会记在小本本上。',
];

export function getShredderMumble(item: GameItem, gs: Parameters<typeof estimateItemPullValue>[1], salt: number): string {
  const est = estimateItemPullValue(item, gs);
  if (est >= 380) return pick(SHRED_HIGH, salt);
  if (est >= 140) return pick(SHRED_MID, salt);
  return pick(SHRED_LOW, salt);
}
