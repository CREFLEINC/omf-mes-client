import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { LabelMedia } from './label-media';
import {
  type LabelSettings,
  needsDriverSize,
  parseLabelSettings,
  readLabelSettings,
  resolveLabelMedia,
  writeLabelSettings,
} from './label-settings';

const ENV_MEDIA: LabelMedia = {
  widthMm: 100,
  heightMm: 60,
  kind: 'gap',
  gapMm: 2,
  offsetMm: 0,
  speed: 4,
  density: 8,
  linerWidthMm: null,
};

const SAVED: LabelSettings = {
  size: { widthMm: 80, heightMm: 40 },
  kind: 'bline',
  gapMm: 3,
  offsetMm: 1,
  speed: 3,
  density: 10,
  linerWidthMm: 82.6,
};

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

const tempPath = (): string => {
  const dir = mkdtempSync(join(tmpdir(), 'label-settings-'));
  dirs.push(dir);
  return join(dir, 'label-settings.json');
};

describe('라벨지 설정 값 검사', () => {
  it('맞는 값은 그대로 받는다 — 크기 없음(null)은 프린터 설정 따르기', () => {
    expect(parseLabelSettings(SAVED)).toEqual(SAVED);
    expect(parseLabelSettings({ ...SAVED, size: null })).toEqual({
      ...SAVED,
      size: null,
      linerWidthMm: null,
    });
  });

  it('⛔ 하나라도 범위를 벗어나거나 모르는 값이면 통째로 받지 않는다', () => {
    expect(parseLabelSettings({ ...SAVED, size: { widthMm: 200, heightMm: 30 } })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, speed: 0 })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, density: 16 })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, kind: 'paper' })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, gapMm: Number.NaN })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, size: undefined })).toBeNull();
    expect(parseLabelSettings('{}')).toBeNull();
    expect(parseLabelSettings({ ...SAVED, linerWidthMm: 130 })).toBeNull();
    expect(parseLabelSettings({ ...SAVED, linerWidthMm: 79 })).toBeNull();
  });

  it('이형지 폭이 없던 때 저장한 파일은 「라벨 가로와 같음」으로, 13:37 설치본의 위치 보정은 이형지 폭으로 읽는다', () => {
    const { linerWidthMm: _dropped, ...older } = SAVED;

    expect(parseLabelSettings(older)).toEqual({ ...SAVED, linerWidthMm: null });
    expect(parseLabelSettings({ ...older, shiftXMm: 2.6 })).toEqual(SAVED);
    expect(parseLabelSettings({ ...older, shiftXMm: 0 })).toEqual({ ...SAVED, linerWidthMm: null });
  });

  it('프린터 설정을 따르면 이형지 폭은 쓰지 않는다 — 드라이버 크기가 이미 이형지 폭이다', () => {
    expect(parseLabelSettings({ ...SAVED, size: null })?.linerWidthMm).toBeNull();
  });
});

describe('라벨지 설정 파일', () => {
  it('저장한 값을 다시 읽는다 — 다음 인쇄부터 따른다', () => {
    const path = tempPath();

    expect(readLabelSettings(path)).toBeNull();

    writeLabelSettings(path, SAVED);
    expect(readLabelSettings(path)).toEqual(SAVED);

    writeLabelSettings(path, {
      ...SAVED,
      size: { widthMm: 100, heightMm: 50 },
      linerWidthMm: null,
    });
    expect(readLabelSettings(path)?.size).toEqual({ widthMm: 100, heightMm: 50 });
  });

  it('지우면(null) 저장한 값이 없는 것으로 돌아간다', () => {
    const path = tempPath();

    writeLabelSettings(path, SAVED);
    writeLabelSettings(path, null);

    expect(readLabelSettings(path)).toBeNull();
    expect(readFileSync(path, 'utf8')).toBe('null');
  });

  it('깨진 파일 · 범위 밖 값은 없는 것으로 본다 — 그 값으로 프린터를 설정하지 않는다', () => {
    const path = tempPath();

    writeFileSync(path, '{ broken', 'utf8');
    expect(readLabelSettings(path)).toBeNull();

    writeFileSync(path, JSON.stringify({ ...SAVED, speed: 99 }), 'utf8');
    expect(readLabelSettings(path)).toBeNull();
  });
});

describe('이번 인쇄에 쓸 용지 설정', () => {
  const resolve = (overrides: Partial<Parameters<typeof resolveLabelMedia>[0]>) =>
    resolveLabelMedia({
      saved: null,
      envMedia: ENV_MEDIA,
      envPinned: false,
      driver: { widthMm: 100, heightMm: 50 },
      declared: { widthMm: 80, heightMm: 30 },
      ...overrides,
    });

  it('⭐ 이 창에서 정한 크기가 무엇보다 먼저다 — 환경값 · 드라이버 · 라벨 크기를 덮는다', () => {
    expect(resolve({ saved: SAVED, envPinned: true })).toEqual({
      media: {
        widthMm: 80,
        heightMm: 40,
        kind: 'bline',
        gapMm: 3,
        offsetMm: 1,
        speed: 3,
        density: 10,
        linerWidthMm: 82.6,
      },
      sizeSource: 'saved',
    });
  });

  it('프린터 설정 따르기(size null)면 환경값 → 드라이버 → 라벨 크기 → 기본 차례다', () => {
    const follow = { ...SAVED, size: null };

    expect(resolve({ saved: follow, envPinned: true }).sizeSource).toBe('env');
    expect(resolve({ saved: follow })).toMatchObject({
      media: { widthMm: 100, heightMm: 50, kind: 'bline', speed: 3 },
      sizeSource: 'driver',
    });
    expect(resolve({ saved: follow, driver: null })).toMatchObject({
      media: { widthMm: 80, heightMm: 30 },
      sizeSource: 'label',
    });
    expect(resolve({ saved: follow, driver: null, declared: null })).toMatchObject({
      media: { widthMm: 100, heightMm: 60 },
      sizeSource: 'default',
    });
  });

  it('⛔ 라벨이 적은 크기를 드라이버보다 앞세우지 않는다(현장 위치 틀어짐 2026-11-24)', () => {
    expect(resolve({}).media).toMatchObject({ widthMm: 100, heightMm: 50 });
  });

  it('저장한 값이 없으면 장 구분 · 속도 · 농도는 환경값 · 기본이다', () => {
    expect(resolve({}).media).toMatchObject({
      kind: 'gap',
      gapMm: 2,
      speed: 4,
      density: 8,
      linerWidthMm: null,
    });
  });

  it('프린터 설정을 따르면 이형지 폭을 얹지 않는다', () => {
    expect(resolve({ saved: { ...SAVED, size: null, linerWidthMm: null } }).media).toMatchObject({
      widthMm: 100,
      linerWidthMm: null,
    });
  });

  it('크기를 이 창 · 환경값이 정했으면 드라이버에 묻지 않는다(묻는 데 1초 남짓)', () => {
    expect(needsDriverSize(SAVED, false)).toBe(false);
    expect(needsDriverSize(null, true)).toBe(false);
    expect(needsDriverSize({ ...SAVED, size: null }, false)).toBe(true);
    expect(needsDriverSize(null, false)).toBe(true);
  });
});
