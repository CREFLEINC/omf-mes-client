import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { makeRatio, ratioItems } from './fixtures';
import {
  axisValue,
  formulaText,
  isEnded,
  narrowestAxis,
  periodText,
  scopeText,
  specifiedAxes,
  type ScopeLookups,
} from './scope';

const t = messages.shotConversion;

const lookups: ScopeLookups = {
  itemId: [{ value: '21', label: 'ITM-201 · 가상 하우징' }],
  processId: [{ value: '31', label: 'PRC-301 · 가상 프레스' }],
  plantId: [{ value: '11', label: '가상 1공장' }],
  businessUnitId: [{ value: '1', label: '가상 사업부' }],
};

describe('범위 축 읽기', () => {
  it('지정한 축의 값을 준다', () => {
    expect(axisValue(makeRatio(1, 1, { itemId: 21 }), 'itemId')).toBe(21);
  });

  it('지정하지 않은 축은 없음이다', () => {
    expect(axisValue(makeRatio(1, 1), 'itemId')).toBeNull();
  });

  /** ⭐ 차례가 곧 우선순위다 — 품목 · 공정 · 공장 · 사업부. */
  it('지정한 축을 우선순위 차례로 준다', () => {
    const policy = makeRatio(1, 1, { businessUnitId: 1, plantId: 11, itemId: 21 });

    expect(specifiedAxes(policy)).toEqual(['itemId', 'plantId', 'businessUnitId']);
  });

  it('아무 축도 없으면 빈 목록이다', () => {
    expect(specifiedAxes(makeRatio(1, 1))).toEqual([]);
  });

  it('가장 좁은 축은 우선순위가 앞선 것이다', () => {
    expect(narrowestAxis(makeRatio(1, 1, { plantId: 11, itemId: 21 }))).toBe('itemId');
  });

  it('아무 축도 없으면 가장 좁은 축도 없다', () => {
    expect(narrowestAxis(makeRatio(1, 1))).toBeNull();
  });
});

describe('범위를 한 줄로', () => {
  /** ⛔ 빈 범위를 빈 칸으로 두지 않는다 — 「전체」는 값이 없는 것이 아니라 전체를 뜻하는 값이다. */
  it('아무 축도 없으면 전체다', () => {
    expect(scopeText(makeRatio(1, 1), lookups)).toBe(t.scope.all);
  });

  it('한 축이면 축 이름과 값 이름을 함께 낸다', () => {
    expect(scopeText(makeRatio(1, 1, { itemId: 21 }), lookups)).toBe(
      t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징'),
    );
  });

  it('두 축이면 우선순위 차례로 잇는다', () => {
    expect(scopeText(makeRatio(1, 1, { plantId: 11, itemId: 21 }), lookups)).toBe(
      [
        t.scope.entry(t.scope.itemId, 'ITM-201 · 가상 하우징'),
        t.scope.entry(t.scope.plantId, '가상 1공장'),
      ].join(t.scope.join),
    );
  });

  /**
   * ⛔ **축 이음쇠가 값 이름 «안»의 이음쇠와 달라야 한다.** 값 이름이 이미
   * 「ABC-123 · 하우징 커버 A」 꼴이라 같은 쇠로 이으면 **축 경계가 사라진다** —
   * 브라우저 확인에서 실제 계약 응답으로 그렇게 보였다.
   */
  it('축 이음쇠가 값 이름 안의 이음쇠와 다르다', () => {
    const valueSeparator = ' · ';

    expect(t.scope.join).not.toBe(valueSeparator);

    const text = scopeText(
      makeRatio(1, 1, { itemId: 21, processId: 31, plantId: 11, businessUnitId: 1 }),
      lookups,
    );

    /* 축이 넷이면 이음쇠도 셋이다 — 값 이름 안의 점에 섞이지 않는다. */
    expect(text.split(t.scope.join)).toHaveLength(4);
  });

  /** ⛔ 모르는 값에 이름을 지어내지 않는다 — 없는 것이 있는 것처럼 보인다(G-9). */
  it('이름을 못 찾으면 값을 그대로 둔다', () => {
    expect(scopeText(makeRatio(1, 1, { itemId: 99 }), lookups)).toBe(
      t.scope.entry(t.scope.itemId, '99'),
    );
  });
});

describe('유효기간을 한 줄로', () => {
  it('끝이 없으면 그렇게 보인다', () => {
    expect(periodText(makeRatio(1, 1))).toBe(t.period.open('2026-01-01'));
  });

  it('끝이 있으면 두 날을 함께 낸다', () => {
    expect(periodText(makeRatio(1, 1, { effectiveTo: '2026-12-31' }))).toBe(
      t.period.closed('2026-01-01', '2026-12-31'),
    );
  });

  it('빈 문자열도 끝이 없는 것으로 본다', () => {
    expect(periodText(makeRatio(1, 1, { effectiveTo: '' }))).toBe(t.period.open('2026-01-01'));
  });
});

/** **오늘을 밖에서 받는다** — 안에서 읽으면 같은 표가 시각에 따라 다르게 그려진다. */
describe('끝났는가', () => {
  it('종료일이 오늘보다 앞이면 끝났다', () => {
    expect(isEnded(makeRatio(1, 1, { effectiveTo: '2026-08-19' }), '2026-08-23')).toBe(true);
  });

  /** ⭐ 종료일 «당일»은 아직 유효하다 — 계약이 「종료 ≥ 시작」이고 그날까지 쓰는 것이 상식이다. */
  it('종료일이 오늘이면 아직 끝나지 않았다', () => {
    expect(isEnded(makeRatio(1, 1, { effectiveTo: '2026-08-23' }), '2026-08-23')).toBe(false);
  });

  it('종료일이 뒤면 끝나지 않았다', () => {
    expect(isEnded(makeRatio(1, 1, { effectiveTo: '2026-12-31' }), '2026-08-23')).toBe(false);
  });

  it('끝이 없으면 끝나지 않았다', () => {
    expect(isEnded(makeRatio(1, 1), '2026-08-23')).toBe(false);
    expect(isEnded(makeRatio(1, 1, { effectiveTo: '' }), '2026-08-23')).toBe(false);
  });
});

describe('계산식', () => {
  /** ⭐ 수가 아니라 무엇을 뜻하는지를 보인다 — 「0.25」만으로는 무엇의 0.25인지 모른다. */
  it('비율을 식으로 보인다', () => {
    expect(formulaText(makeRatio(1, 0.25))).toBe(t.formula(0.25));
  });

  /** ⛔ 값이 없으면 식을 지어내지 않는다 — 「1.0」으로 채우면 없는 정책이 있는 것이 된다. */
  it('값이 없으면 식도 없다', () => {
    expect(formulaText(makeRatio(1, 0, { valueNumeric: null }))).toBeNull();
    expect(formulaText(makeRatio(1, 0, { valueNumeric: undefined }))).toBeNull();
  });

  /** ⭐ 0은 값이다 — 거짓 같은 값을 「없음」으로 읽으면 잘못된 정책이 숨는다. */
  it('0 이어도 값이 있는 것이다', () => {
    expect(formulaText(makeRatio(1, 0))).toBe(t.formula(0));
  });
});

describe('표본이 서로 다른 넓이를 갖는다', () => {
  it('네 줄이 전체·공장·품목·공정으로 갈린다', () => {
    expect(ratioItems.map((row) => narrowestAxis(row))).toEqual([
      null,
      'plantId',
      'itemId',
      'processId',
    ]);
  });
});
