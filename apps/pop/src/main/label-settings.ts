/**
 * 라벨지 설정 — **화면(톱니 설정 → 라벨지 설정)에서 정해 단말에 남기는 값.**
 *
 * ⭐ **왜 따로 두는가.** 환경 변수(`label-media`)는 앱을 켜기 전에만 바꿀 수 있다. 현장에서 크기가 다른
 *    라벨지로 갈아 끼우면 앱을 끄지 않고 바로 맞춰야 한다(사용자 지시 2026-11-24). 그래서 셸이 파일 하나를
 *    갖고, 인쇄할 때마다 그 파일을 읽는다 — 저장하면 다음 장부터 바로 따른다.
 *
 * ⛔ **서버와 무관하다**(사용자 지시 2026-11-24). 단말에 걸린 라벨지의 문제라 서버가 알 수 없고, 서버가
 *    죽어 있어도 맞출 수 있어야 한다. 이 값은 단말 밖으로 나가지 않는다.
 *
 * ## 무엇이 이기는가
 * - 크기: 이 화면에서 정한 크기 → 단말 환경값 → 프린터 드라이버 → 라벨이 적은 `SIZE` → 기본(100 × 60).
 *   화면에서 「프린터 설정 따르기」를 고르면(`size: null`) 환경값부터 본다.
 * - 장 구분 · 간격 · 경계 보정 · 속도 · 농도: 이 화면에서 정한 값 → 단말 환경값 → 기본.
 * - 이형지 폭: 이 화면에서 크기를 정했을 때만. `SIZE` 가로로 이것을 보낸다(없으면 라벨 가로).
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import type { LabelMedia, MediaKind } from './label-media';

export interface LabelSize {
  widthMm: number;
  heightMm: number;
}

export interface LabelSettings {
  /** `null` 이면 프린터 설정(드라이버)을 따른다. */
  size: LabelSize | null;
  kind: MediaKind;
  gapMm: number;
  offsetMm: number;
  speed: number;
  density: number;
  /**
   * 이형지 가로폭(mm) — 크기를 직접 정했을 때만 쓴다(`label-media` `linerWidthMm`). `null` 이면 라벨 가로와 같다.
   * 프린터 설정을 따르면 늘 `null` 이다 — 드라이버 크기가 이미 이형지 폭이다.
   */
  linerWidthMm: number | null;
}

/** 크기를 어디서 가져왔는가 — 화면이 「지금 쓰는 값」 옆에 적는다. */
export type LabelSizeSource = 'saved' | 'env' | 'driver' | 'label' | 'default';

/**
 * 받는 범위. 벗어난 값은 저장하지 않는다 — 그 값으로 프린터를 설정하면 그 자리가 곧 「멈춤」이 된다.
 * ⚠ 폭 상한은 4인치 헤드(104 mm)에 여유를 둔 값이다.
 */
export const LABEL_SETTING_LIMITS = {
  widthMm: { min: 10, max: 120 },
  heightMm: { min: 5, max: 300 },
  gapMm: { min: 0, max: 20 },
  offsetMm: { min: 0, max: 20 },
  speed: { min: 1, max: 6 },
  density: { min: 0, max: 15 },
  linerWidthMm: { min: 10, max: 120 },
} as const;

type LimitKey = keyof typeof LABEL_SETTING_LIMITS;

const inRange = (key: LimitKey, value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= LABEL_SETTING_LIMITS[key].min &&
  value <= LABEL_SETTING_LIMITS[key].max;

const isKind = (value: unknown): value is MediaKind =>
  value === 'gap' || value === 'bline' || value === 'continuous';

/** 화면이 보낸 값 · 파일에서 읽은 값을 검사한다. 하나라도 틀리면 `null` — 반쯤 맞는 값을 쓰지 않는다. */
export const parseLabelSettings = (value: unknown): LabelSettings | null => {
  if (typeof value !== 'object' || value === null) return null;

  const raw = value as Record<string, unknown>;
  const size = raw.size;
  let parsedSize: LabelSize | null = null;

  if (size !== null) {
    if (typeof size !== 'object' || size === undefined) return null;
    const { widthMm, heightMm } = size as Record<string, unknown>;
    if (!inRange('widthMm', widthMm) || !inRange('heightMm', heightMm)) return null;
    parsedSize = { widthMm, heightMm };
  }

  if (
    !isKind(raw.kind) ||
    !inRange('gapMm', raw.gapMm) ||
    !inRange('offsetMm', raw.offsetMm) ||
    !inRange('speed', raw.speed) ||
    !inRange('density', raw.density)
  ) {
    return null;
  }

  const linerWidthMm = parseLinerWidth(raw, parsedSize);
  if (linerWidthMm === undefined) return null;

  return {
    size: parsedSize,
    kind: raw.kind,
    gapMm: raw.gapMm,
    offsetMm: raw.offsetMm,
    speed: raw.speed,
    density: raw.density,
    linerWidthMm,
  };
};

/**
 * 이형지 폭 — 없으면(`null`) 라벨 가로와 같다. 틀렸으면 `undefined`(설정 통째로 받지 않는다).
 *
 * ⚠ 라벨 가로보다 좁을 수 없다. 크기를 프린터 설정에 맡기면(`size: null`) 쓰지 않는다.
 * ⚠ 13:37 설치본(2026-11-24)은 같은 값을 「가로 위치 보정」(`shiftXMm`, 라벨 가로에 더함)으로 남겼다 — 그 파일은
 *   이형지 폭(가로 + 보정)으로 읽는다. 그래야 갈아 끼운 설치본에서 찍히는 자리가 그대로다.
 */
const parseLinerWidth = (
  raw: Record<string, unknown>,
  size: LabelSize | null,
): number | null | undefined => {
  if (size === null) return null;

  const legacyShift = raw.shiftXMm;
  const liner =
    raw.linerWidthMm === undefined
      ? typeof legacyShift === 'number' && Number.isFinite(legacyShift) && legacyShift > 0
        ? Math.round((size.widthMm + legacyShift) * 10) / 10
        : null
      : raw.linerWidthMm;

  if (liner === null) return null;

  return inRange('linerWidthMm', liner) && liner >= size.widthMm ? liner : undefined;
};

/** 저장한 값. 없거나 못 읽으면 `null` — 그때는 환경값 · 드라이버 · 기본으로 간다. */
export const readLabelSettings = (path: string): LabelSettings | null => {
  if (!existsSync(path)) return null;

  try {
    return parseLabelSettings(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return null;
  }
};

/**
 * 저장한다. `null` 이면 지운 것으로(환경값 · 드라이버 · 기본으로 돌아간다).
 * ⚠ 임시 파일에 쓰고 바꿔 끼운다 — 쓰다가 꺼져도 반쯤 쓴 파일이 남지 않는다.
 */
export const writeLabelSettings = (path: string, settings: LabelSettings | null): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp`;
  writeFileSync(temp, JSON.stringify(settings), 'utf8');
  renameSync(temp, path);
};

/**
 * 이번 인쇄에 쓸 용지 설정.
 * - `envMedia` 는 환경값 · 기본을 담은 값(`readLabelMedia()`), `envPinned` 는 환경값이 크기를 정했는가.
 * - `driver` 는 드라이버가 알려 준 크기(못 물어봤으면 `null`), `declared` 는 라벨이 적은 `SIZE`.
 */
export const resolveLabelMedia = ({
  saved,
  envMedia,
  envPinned,
  driver,
  declared,
}: {
  saved: LabelSettings | null;
  envMedia: LabelMedia;
  envPinned: boolean;
  driver: LabelSize | null;
  declared: LabelSize | null;
}): { media: LabelMedia; sizeSource: LabelSizeSource } => {
  const base: LabelMedia =
    saved === null
      ? envMedia
      : {
          ...envMedia,
          kind: saved.kind,
          gapMm: saved.gapMm,
          offsetMm: saved.offsetMm,
          speed: saved.speed,
          density: saved.density,
        };

  if (saved !== null && saved.size !== null) {
    return {
      media: { ...base, ...saved.size, linerWidthMm: saved.linerWidthMm },
      sizeSource: 'saved',
    };
  }
  if (envPinned) return { media: base, sizeSource: 'env' };
  if (driver !== null) return { media: { ...base, ...driver }, sizeSource: 'driver' };
  if (declared !== null) return { media: { ...base, ...declared }, sizeSource: 'label' };

  return { media: base, sizeSource: 'default' };
};

/** 크기를 드라이버에 물어볼 필요가 있는가 — 화면이 정했거나 환경값이 정했으면 묻지 않는다(묻는 데 1초 남짓). */
export const needsDriverSize = (saved: LabelSettings | null, envPinned: boolean): boolean =>
  (saved === null || saved.size === null) && !envPinned;
