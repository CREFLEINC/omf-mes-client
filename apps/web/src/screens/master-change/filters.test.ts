import { describe, expect, it } from 'vitest';

import {
  EMPTY_FILTERS,
  hasAnyFilter,
  readFilters,
  readPage,
  toFilterChips,
  toFilterQuery,
  toSearchParams,
  type EventFilters,
} from './filters';

const filters = (overrides: Partial<EventFilters> = {}): EventFilters => ({
  ...EMPTY_FILTERS,
  ...overrides,
});

const params = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readFilters — 주소가 조건의 정본이다', () => {
  it('주소 키를 조건으로 옮긴다', () => {
    expect(
      readFilters(params('type=ITEM&target=9101&event=SAMPLE_EVENT_A&by=9201&corr=C-1')),
    ).toEqual({
      targetType: 'ITEM',
      targetId: '9101',
      eventType: 'SAMPLE_EVENT_A',
      performedBy: '9201',
      correlationId: 'C-1',
    });
  });

  it('키가 없으면 조건이 비어 있다', () => {
    expect(readFilters(params(''))).toEqual(EMPTY_FILTERS);
  });

  /*
   * 주소는 사람이 손으로 고치는 자리다. 정수가 아닌 값을 그대로 실어 보내면
   * 조회 전체가 400으로 실패해 「조회가 늘 안 된다」로만 보인다.
   */
  it('정수가 아닌 대상 번호는 조건에서 뺀다', () => {
    expect(readFilters(params('target=abc')).targetId).toBe('');
    expect(readFilters(params('target=-1')).targetId).toBe('');
    expect(readFilters(params('target=1.5')).targetId).toBe('');
    expect(readFilters(params('target=')).targetId).toBe('');
  });

  it('정수가 아닌 수행자 번호도 조건에서 뺀다', () => {
    expect(readFilters(params('by=abc')).performedBy).toBe('');
    expect(readFilters(params('by=-1')).performedBy).toBe('');
    expect(readFilters(params('by=1.5')).performedBy).toBe('');
  });

  it('0은 정수라 조건으로 받는다 — 값을 지어내 거르지 않는다', () => {
    expect(readFilters(params('target=0')).targetId).toBe('0');
  });
});

describe('readPage', () => {
  it('키가 없으면 첫 쪽이다', () => {
    expect(readPage(params(''))).toBe(1);
  });

  it('주소의 쪽 번호를 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it('이상한 값은 첫 쪽으로 본다 — 주소는 손으로 고쳐지는 자리다', () => {
    expect(readPage(params('page=0'))).toBe(1);
    expect(readPage(params('page=-2'))).toBe(1);
    expect(readPage(params('page=abc'))).toBe(1);
  });
});

describe('toSearchParams — 빈 조건은 키 자체를 두지 않는다', () => {
  it('기간과 걸린 조건만 적는다', () => {
    const next = toSearchParams(
      { from: '2026-08-01', to: '2026-08-07' },
      filters({ targetType: 'ITEM' }),
      1,
    );

    expect(next.toString()).toBe('from=2026-08-01&to=2026-08-07&type=ITEM');
  });

  it('첫 쪽이면 page를 적지 않는다 — 같은 화면의 주소가 두 가지가 되면 공유가 갈린다', () => {
    const next = toSearchParams({ from: '2026-08-01', to: '2026-08-07' }, EMPTY_FILTERS, 1);

    expect(next.has('page')).toBe(false);
  });

  it('둘째 쪽부터 page를 적는다', () => {
    const next = toSearchParams({ from: '2026-08-01', to: '2026-08-07' }, EMPTY_FILTERS, 2);

    expect(next.get('page')).toBe('2');
  });

  it('정수가 아닌 번호는 주소에도 남기지 않는다', () => {
    const next = toSearchParams(
      { from: '2026-08-01', to: '2026-08-07' },
      filters({ targetId: 'abc', performedBy: '1.5' }),
      1,
    );

    expect(next.has('target')).toBe(false);
    expect(next.has('by')).toBe(false);
  });

  /** 창을 여는 것은 조건이 아니다 — `sel`은 이 함수가 만들지 않고 여는 쪽이 붙인다. */
  it('sel을 만들지 않는다 — 조건을 바꾸면 열린 창이 함께 닫힌다', () => {
    const next = toSearchParams({ from: '2026-08-01', to: '2026-08-07' }, EMPTY_FILTERS, 1);

    expect(next.has('sel')).toBe(false);
  });
});

describe('toFilterQuery — 계약 쿼리 이름으로 옮긴다', () => {
  it('걸린 조건만 쿼리에 담고 번호는 숫자로 보낸다', () => {
    expect(
      toFilterQuery(
        filters({
          targetType: 'ITEM',
          targetId: '9101',
          eventType: 'SAMPLE_EVENT_A',
          performedBy: '9201',
          correlationId: 'SAMPLE-CORR-0001',
        }),
      ),
    ).toEqual({
      targetTypeCode: 'ITEM',
      targetId: 9101,
      eventTypeCode: 'SAMPLE_EVENT_A',
      performedBy: 9201,
      correlationId: 'SAMPLE-CORR-0001',
    });
  });

  it('빈 조건은 키 자체가 없다', () => {
    expect(toFilterQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('정수가 아닌 번호는 요청에 실리지 않는다 — 그대로 보내면 조회 전체가 400이 된다', () => {
    expect(toFilterQuery(filters({ targetId: 'abc', performedBy: '-1' }))).toEqual({});
  });
});

describe('toFilterChips', () => {
  it('적용된 조건마다 하나씩 나오고 순서는 조건 줄과 같다', () => {
    const chips = toFilterChips(
      filters({ targetType: 'ITEM', performedBy: '9201', correlationId: 'C-1' }),
    );

    expect(chips.map((chip) => chip.key)).toEqual(['targetType', 'performedBy', 'correlationId']);
    expect(chips[0]?.label).toBe('대상 종류: ITEM');
  });

  it('제거 이름이 조건마다 다르다 — 「제거」가 다섯이면 어느 것을 푸는지 알 수 없다', () => {
    const chips = toFilterChips(
      filters({
        targetType: 'ITEM',
        targetId: '9101',
        eventType: 'SAMPLE_EVENT_A',
        performedBy: '9201',
        correlationId: 'C-1',
      }),
    );
    const removeLabels = chips.map((chip) => chip.removeLabel);

    expect(new Set(removeLabels).size).toBe(5);
  });

  it('걸린 조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(EMPTY_FILTERS)).toEqual([]);
  });
});

describe('hasAnyFilter', () => {
  it('하나라도 걸려 있으면 참이다', () => {
    expect(hasAnyFilter(filters({ correlationId: 'C-1' }))).toBe(true);
  });

  it('전부 비어 있으면 거짓이다', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
  });
});
