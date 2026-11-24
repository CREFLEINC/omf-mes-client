/**
 * 라벨지 설정 통로(셸 `labelMedia`) — 톱니 설정 → [라벨지 설정] 창이 쓴다(사용자 지시 2026-11-24).
 *
 * ⚠ **정본은 셸이다** — `apps/pop/src/main/label-settings.ts`(값 · 범위 · 무엇이 이기는가)와
 *   `apps/pop/src/preload/index.ts`(통로 모양). 여기를 고치면 그쪽을 함께 본다. 범위는 화면이 먼저 막고
 *   셸이 경계에서 한 번 더 본다.
 *
 * ⛔ **서버를 부르지 않는다.** 단말에 걸린 라벨지의 일이라 서버가 알 수 없고, 서버가 죽어 있어도 맞출 수
 *    있어야 한다. 브라우저(관리웹 · 개발 확인)에는 통로가 없다 — 그때는 메뉴에 세우지 않는다.
 */

export type LabelMediaKind = 'gap' | 'bline' | 'continuous';

export interface LabelSize {
  widthMm: number;
  heightMm: number;
}

export interface LabelSettings {
  /** `null` 이면 프린터 설정(드라이버)을 따른다. */
  size: LabelSize | null;
  kind: LabelMediaKind;
  gapMm: number;
  offsetMm: number;
  speed: number;
  density: number;
  /**
   * 이형지(밑종이) 가로폭(mm) — 크기를 직접 정했을 때만. 셸이 `SIZE` 가로로 이것을 보낸다. `null` 이면 라벨 가로.
   * ⭐ 프린터는 이형지 폭으로 자리를 잡는다 — 현장 라벨 80 × 40 · 이형지 82.6(2026-11-24 사용자 확인).
   */
  linerWidthMm: number | null;
}

export type LabelSizeSource = 'saved' | 'env' | 'driver' | 'label' | 'default';

export interface LabelMediaState {
  /** 보낼 프린터 이름 · 「(OS 기본)」 · 없으면 `null`. */
  printer: string | null;
  hasPrinter: boolean;
  /** 지금 쓰는 값. */
  media: LabelSize & Omit<LabelSettings, 'size'>;
  sizeSource: LabelSizeSource;
  /** 드라이버가 알려 준 크기(못 물어봤으면 `null`). */
  driver: LabelSize | null;
  saved: LabelSettings | null;
  /** 단말 환경값이 크기를 정했는가. */
  envPinned: boolean;
}

export interface LabelMediaShell {
  read: (printerName?: string) => Promise<LabelMediaState>;
  save: (settings: LabelSettings | null, printerName?: string) => Promise<LabelMediaState>;
  calibrate: (printerName?: string) => Promise<void>;
}

/** 받는 범위 — 셸 `LABEL_SETTING_LIMITS` 와 같다. */
export const LABEL_MEDIA_LIMITS = {
  widthMm: { min: 10, max: 120 },
  heightMm: { min: 5, max: 300 },
  gapMm: { min: 0, max: 20 },
  offsetMm: { min: 0, max: 20 },
  speed: { min: 1, max: 6 },
  density: { min: 0, max: 15 },
  linerWidthMm: { min: 10, max: 120 },
} as const;

export type LabelMediaField = keyof typeof LABEL_MEDIA_LIMITS;

/** 자주 쓰는 크기 — 현장 라벨지(80 × 40 · 2026-11-24 사용자 확인) · 100 × 60 · 100 × 50. */
export const LABEL_SIZE_PRESETS: readonly LabelSize[] = [
  { widthMm: 80, heightMm: 40 },
  { widthMm: 100, heightMm: 60 },
  { widthMm: 100, heightMm: 50 },
];

interface ShellCarrier {
  pop?: { labelMedia?: Partial<LabelMediaShell> };
}

/** 셸 통로를 집는다. 없거나(브라우저 · 옛 설치본) 반쯤 열렸으면 `null`. */
export const labelMediaShell = (): LabelMediaShell | null => {
  const shell = (globalThis as unknown as ShellCarrier).pop?.labelMedia;

  return typeof shell?.read === 'function' &&
    typeof shell.save === 'function' &&
    typeof shell.calibrate === 'function'
    ? (shell as LabelMediaShell)
    : null;
};

export const isInLabelMediaRange = (field: LabelMediaField, value: number): boolean =>
  Number.isFinite(value) &&
  value >= LABEL_MEDIA_LIMITS[field].min &&
  value <= LABEL_MEDIA_LIMITS[field].max;
