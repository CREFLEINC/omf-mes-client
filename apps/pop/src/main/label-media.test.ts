import { afterEach, describe, expect, it } from 'vitest';

import {
  applyLabelMedia,
  buildMediaProbeScript,
  calibrationCommands,
  parseMediaProbe,
  readLabelMedia,
  withProbedSize,
} from './label-media';

const SERVER_LABEL = [
  'SIZE 80 mm,30 mm',
  'GAP 2 mm,0 mm',
  'DIRECTION 1',
  'CLS',
  'BOX 0,0,638,239,2',
  'TEXT 28,20,"0",0,12,12,"WIP  OK"',
  'DMATRIX 527,24,96,96,"L1|WIP"',
  'PRINT 1',
].join('\r\n');

const KEYS = [
  'POP_LABEL_WIDTH_MM',
  'POP_LABEL_HEIGHT_MM',
  'POP_LABEL_MEDIA',
  'POP_LABEL_GAP_MM',
  'POP_LABEL_OFFSET_MM',
  'POP_LABEL_SPEED',
  'POP_LABEL_DENSITY',
] as const;

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe('라벨지 설정', () => {
  it('주지 않으면 100 × 60 라벨지로 본다', () => {
    expect(readLabelMedia()).toMatchObject({ widthMm: 100, heightMm: 60, kind: 'gap', gapMm: 2 });
  });

  it('환경 변수로 단말마다 바꾼다', () => {
    process.env.POP_LABEL_WIDTH_MM = '80';
    process.env.POP_LABEL_HEIGHT_MM = '30';
    process.env.POP_LABEL_MEDIA = 'bline';
    process.env.POP_LABEL_GAP_MM = '3';

    expect(readLabelMedia()).toMatchObject({ widthMm: 80, heightMm: 30, kind: 'bline', gapMm: 3 });
  });

  /* ⛔ 못 읽은 값으로 프린터를 설정하지 않는다 — 그 자리가 곧 「멈춤」이 된다. */
  it.each(['', '   ', '0', '-5', '숫자아님'])('쓸 수 없는 값(%s)은 기본으로 물러선다', (raw) => {
    process.env.POP_LABEL_WIDTH_MM = raw;

    expect(readLabelMedia().widthMm).toBe(100);
  });
});

describe('용지 줄 갈아 끼우기', () => {
  const applied = (): string => applyLabelMedia(SERVER_LABEL, readLabelMedia());

  it('대지를 이 단말의 라벨지로 바꾼다', () => {
    expect(applied()).toContain('SIZE 100 mm,60 mm');
    expect(applied()).not.toContain('SIZE 80 mm,30 mm');
  });

  /* ⛔ 글자·바코드는 손대지 않는다 — 바꾸는 것은 용지 줄뿐이다. */
  it.each([
    'CLS',
    'BOX 0,0,638,239,2',
    'TEXT 28,20,"0",0,12,12,"WIP  OK"',
    'DMATRIX 527,24,96,96,"L1|WIP"',
    'PRINT 1',
  ])('%s 는 그대로 남는다', (line) => {
    expect(applied()).toContain(line);
  });

  it('속도·농도·기준점을 못 박는다', () => {
    const label = applied();

    expect(label).toContain('SPEED 4');
    expect(label).toContain('DENSITY 8');
    expect(label).toContain('REFERENCE 0,0');
  });

  /* ⭐ 설정은 `CLS` «앞»에 서야 그 장에 적용된다. */
  it('용지 줄이 CLS 앞에 선다', () => {
    const label = applied();

    expect(label.indexOf('SIZE ')).toBeLessThan(label.indexOf('CLS'));
    expect(label.indexOf('REFERENCE 0,0')).toBeLessThan(label.indexOf('CLS'));
  });

  it('검은 표시 라벨지는 BLINE 으로 적는다', () => {
    process.env.POP_LABEL_MEDIA = 'bline';

    const label = applied();

    expect(label).toContain('BLINE 2 mm,0 mm');
    expect(label).not.toMatch(/^GAP /m);
  });

  it('연속지는 가를 것이 없다', () => {
    process.env.POP_LABEL_MEDIA = 'continuous';

    expect(applied()).toContain('GAP 0 mm,0 mm');
  });

  /* ⚠ 두 번 태워도 용지 줄이 겹쳐 쌓이지 않아야 한다 — 재인쇄가 그 길을 다시 탄다. */
  it('두 번 태워도 용지 줄이 하나다', () => {
    const once = applied();
    const twice = applyLabelMedia(once, readLabelMedia());

    expect(twice.match(/^SIZE /gm)).toHaveLength(1);
    expect(twice.match(/^GAP /gm)).toHaveLength(1);
  });
});

describe('라벨지 보정', () => {
  it('프린터가 스스로 재게 한다', () => {
    const commands = calibrationCommands(readLabelMedia());

    expect(commands).toContain('SIZE 100 mm,60 mm');
    expect(commands).toContain('GAPDETECT');
  });
});

describe('드라이버에 설정된 용지 읽기', () => {
  /* ⚠ `.NET` 이 1/100 인치로 준다 — 100 × 60 mm 는 394 × 236 쯤이다. */
  it('1/100 인치를 mm 로 옮긴다', () => {
    expect(parseMediaProbe('394 236')).toEqual({ widthMm: 100.1, heightMm: 59.9 });
  });

  it.each(['', '  ', '알 수 없음', '0 0', '-1 -1'])(
    '읽을 수 없는 답(%s)은 «모른다»로 둔다',
    (raw) => {
      expect(parseMediaProbe(raw)).toBeNull();
    },
  );

  it('프린터 이름을 주면 그 프린터의 설정을 본다', () => {
    expect(buildMediaProbeScript('TSC TH240 Series')).toContain('"TSC TH240 Series"');
  });

  it('모르면 설정값을 그대로 쓴다', () => {
    const media = readLabelMedia();

    expect(withProbedSize(media, null)).toEqual(media);
  });

  it('읽었으면 그 크기로 선다', () => {
    expect(withProbedSize(readLabelMedia(), { widthMm: 80, heightMm: 40 })).toMatchObject({
      widthMm: 80,
      heightMm: 40,
    });
  });

  /* ⛔ 사람이 못 박은 값을 드라이버가 덮지 않는다. */
  it('환경 변수로 못 박았으면 드라이버가 이기지 못한다', () => {
    process.env.POP_LABEL_WIDTH_MM = '80';

    expect(withProbedSize(readLabelMedia(), { widthMm: 100, heightMm: 60 }).widthMm).toBe(80);
  });
});
