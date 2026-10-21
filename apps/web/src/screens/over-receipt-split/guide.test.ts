import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { GUIDE_STEPS, guideHint, guideStatuses, guideStep } from './guide';

const t = messages.overReceiptSplit;

const counts = (lines: number, excessLines: number) => ({ lines, excessLines });

describe('guideStep — 화면 상태에서 지금 할 일을 정한다', () => {
  const base = { hasOrder: true, counts: counts(1, 1), hasLineError: false, headerErrorCount: 0 };

  it('발주를 고르지 않았으면 발주 선택이다', () => {
    expect(guideStep({ ...base, hasOrder: false })).toBe('select');
  });

  it('실릴 줄이 없거나 수량·LOT 에 고칠 것이 있으면 수량·LOT 단계다', () => {
    expect(guideStep({ ...base, counts: counts(0, 0) })).toBe('lines');
    expect(guideStep({ ...base, counts: counts(1, 0) })).toBe('register');
    expect(guideStep({ ...base, hasLineError: true })).toBe('lines');
  });

  it('머리 입력이 모자라면 입하 정보 단계다', () => {
    expect(guideStep({ ...base, headerErrorCount: 1 })).toBe('info');
  });

  it('다 찼으면 등록 단계다', () => {
    expect(guideStep(base)).toBe('register');
  });
});

describe('guideStatuses — 지금 단계 앞은 완료, 뒤는 대기', () => {
  it('셋째 단계면 앞 둘은 완료, 넷째는 대기다', () => {
    expect(guideStatuses('info')).toEqual({
      select: 'complete',
      lines: 'complete',
      info: 'current',
      register: 'pending',
    });
  });

  it('첫 단계면 나머지가 전부 대기다', () => {
    expect(guideStatuses('select')).toEqual({
      select: 'current',
      lines: 'pending',
      info: 'pending',
      register: 'pending',
    });
  });
});

describe('guideHint', () => {
  it('단계마다 할 일 한 줄이 있고 서로 다르다', () => {
    const hints = GUIDE_STEPS.map(guideHint);

    expect(hints).toEqual([
      t.guide.hints.select,
      t.guide.hints.lines,
      t.guide.hints.info,
      t.guide.hints.register,
    ]);
    expect(new Set(hints).size).toBe(4);
  });
});
