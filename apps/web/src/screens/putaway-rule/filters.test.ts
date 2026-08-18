import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FILTERS,
  clearFilter,
  isCreating,
  readFilters,
  readPage,
  readSelectedRuleId,
  toCreateSearchParams,
  toFilterChips,
  toRuleListQuery,
  toSearchParams,
  toSelectionSearchParams,
  toUncoveredQuery,
  withoutSelection,
} from './filters';
import type { RuleFilters } from './types';

const t = messages.putawayRule;

const params = (query: string): URLSearchParams => new URLSearchParams(query);

const filtersOf = (overrides: Partial<RuleFilters> = {}): RuleFilters => ({
  ...DEFAULT_FILTERS,
  ...overrides,
});

describe('DEFAULT_FILTERS', () => {
  /**
   * 기본이 「사용 중만 꺼짐」인 것이 이 마스터의 운용이다 — 끈 규칙이 목록에 보이고
   * 다시 켜는 것이 정상 흐름이다(이슈 §6). 기본을 켜면 꺼진 규칙을 찾을 길이 첫 화면에 없다.
   */
  it('사용 중만이 꺼져 있다 — 꺼진 규칙이 처음부터 보인다', () => {
    expect(DEFAULT_FILTERS.activeOnly).toBe(false);
  });

  it('창고와 품목이 비어 있다', () => {
    expect(DEFAULT_FILTERS.warehouseId).toBe('');
    expect(DEFAULT_FILTERS.itemId).toBe('');
  });
});

describe('readFilters', () => {
  it('주소의 조건을 그대로 읽는다', () => {
    expect(readFilters(params('wh=9201&item=9101&active=1'))).toEqual({
      warehouseId: '9201',
      itemId: '9101',
      activeOnly: true,
    });
  });

  it('조건이 없으면 기본값이다', () => {
    expect(readFilters(params(''))).toEqual(DEFAULT_FILTERS);
  });

  /**
   * 이 값들은 그대로 `Number()`를 거쳐 계약 쿼리로 나간다. 걸러 내지 않으면
   * `?wh=abc` 같은 주소가 **`warehouseId=NaN`을 서버로 보낸다.**
   */
  it.each(['abc', '0', '-3', '1.5', ''])('식별자가 아닌 창고 값(%s)은 비운다', (raw) => {
    expect(readFilters(params(`wh=${raw}`)).warehouseId).toBe('');
  });

  it.each(['abc', '0', '-3', '1.5'])('식별자가 아닌 품목 값(%s)은 비운다', (raw) => {
    expect(readFilters(params(`item=${raw}`)).itemId).toBe('');
  });

  /** 켜짐 표시는 하나뿐이다 — 주소를 손으로 고쳐도 뜻이 흔들리지 않는다. */
  it.each(['true', 'yes', '0', ''])('켜짐 표시가 아닌 값(%s)은 꺼진 것으로 본다', (raw) => {
    expect(readFilters(params(`active=${raw}`)).activeOnly).toBe(false);
  });
});

describe('readPage', () => {
  it('주소의 쪽을 읽는다', () => {
    expect(readPage(params('page=3'))).toBe(3);
  });

  it.each(['abc', '0', '-1', ''])('이상한 값(%s)은 첫 쪽으로 본다', (raw) => {
    expect(readPage(params(`page=${raw}`))).toBe(1);
  });
});

describe('readSelectedRuleId', () => {
  it('주소가 가리키는 규칙을 읽는다', () => {
    expect(readSelectedRuleId(params('rule=9001'))).toBe(9001);
  });

  it.each(['abc', '0', '-1', ''])('식별자가 아닌 값(%s)은 고르지 않은 것이다', (raw) => {
    expect(readSelectedRuleId(params(`rule=${raw}`))).toBeNull();
  });
});

describe('toSearchParams', () => {
  it('빈 조건은 키 자체를 두지 않는다', () => {
    expect(toSearchParams(DEFAULT_FILTERS, 1).toString()).toBe('');
  });

  it('적용된 조건과 첫 쪽 아닌 쪽만 담는다', () => {
    const search = toSearchParams(filtersOf({ warehouseId: '9201', activeOnly: true }), 2);

    expect(search.get('wh')).toBe('9201');
    expect(search.get('active')).toBe('1');
    expect(search.get('page')).toBe('2');
  });

  /**
   * **선택(`rule`)을 담지 않는다.** 조건·쪽이 바뀌면 보이는 행이 달라지므로 이 함수의 결과로
   * 주소를 통째로 갈아 끼우면 선택이 자연히 사라진다 — 목록에 없는 규칙이 골라진 채로
   * 남으면 그것이 어디서 왔는지 알 수 없다.
   */
  it('고른 규칙을 담지 않는다', () => {
    expect(toSearchParams(filtersOf({ warehouseId: '9201' }), 1).has('rule')).toBe(false);
  });
});

describe('toSelectionSearchParams', () => {
  it('조건과 쪽은 그대로 두고 선택만 얹는다', () => {
    const search = toSelectionSearchParams(filtersOf({ warehouseId: '9201' }), 3, 9001);

    expect(search.get('wh')).toBe('9201');
    expect(search.get('page')).toBe('3');
    expect(search.get('rule')).toBe('9001');
  });

  it('선택을 풀면 그 자리가 사라진다', () => {
    expect(toSelectionSearchParams(filtersOf({ warehouseId: '9201' }), 1, null).has('rule')).toBe(
      false,
    );
  });
});

describe('toRuleListQuery', () => {
  /**
   * 계약에 기본값은 있으나(사용 중인 것만) 생략하면 서버가 무엇을 내리는지 화면이 단언할 수
   * 없다 — 「보내지 않음」이라는 상태를 만들지 않는다.
   */
  it('사용 중만을 껐을 때 includeInactive=true를 싣는다', () => {
    expect(toRuleListQuery(filtersOf({ warehouseId: '9201', activeOnly: false }), 1)).toEqual({
      warehouseId: 9201,
      includeInactive: true,
    });
  });

  it('사용 중만을 켰을 때 includeInactive=false를 싣는다 — 늘 명시한다', () => {
    expect(toRuleListQuery(filtersOf({ warehouseId: '9201', activeOnly: true }), 1)).toEqual({
      warehouseId: 9201,
      includeInactive: false,
    });
  });

  it('품목 조건과 쪽을 숫자로 옮긴다', () => {
    expect(toRuleListQuery(filtersOf({ warehouseId: '9201', itemId: '9101' }), 2)).toEqual({
      warehouseId: 9201,
      itemId: 9101,
      includeInactive: true,
      page: 2,
    });
  });

  it('빈 조건과 첫 쪽은 싣지 않는다', () => {
    const query = toRuleListQuery(filtersOf({ warehouseId: '9201' }), 1);

    expect('itemId' in query).toBe(false);
    expect('page' in query).toBe(false);
  });
});

describe('toUncoveredQuery', () => {
  /**
   * **목록 조건을 싣지 않는다.** 규칙 없는 품목은 창고 전체의 사실이며, 품목 조건으로 좁히면
   * 「이 창고에 규칙 없는 품목이 몇 건인가」가 조건에 따라 달라져 그 수를 근거로 쓸 수 없다.
   */
  it('창고만 싣는다', () => {
    expect(toUncoveredQuery(9201)).toEqual({ warehouseId: 9201 });
  });

  /**
   * 이 화면은 첫 쪽만 부르고 나머지는 잘림 문구가 말한다 — **쪽 인자를 두지 않는 것이
   * 그 사실을 타입으로 만든다**(사본 체크리스트 7번).
   */
  it('쪽을 실을 자리가 없다', () => {
    expect(Object.keys(toUncoveredQuery(9201))).toEqual(['warehouseId']);
  });
});

describe('toFilterChips', () => {
  const warehouseLabel = (): string => 'SYN-WH-01 · 합성창고 가';
  const itemLabel = (): string => 'SYN-ITEM-01 · 합성품목 가';

  it('적용된 조건마다 칩 하나가 선다', () => {
    const chips = toFilterChips(
      filtersOf({ warehouseId: '9201', itemId: '9101', activeOnly: true }),
      warehouseLabel,
      itemLabel,
    );

    expect(chips.map((chip) => chip.key)).toEqual(['warehouseId', 'itemId', 'activeOnly']);
    expect(chips[0]?.label).toBe(t.filters.chipWarehouse('SYN-WH-01 · 합성창고 가'));
    expect(chips[2]?.label).toBe(t.filters.activeOnly);
  });

  it('조건이 없으면 칩도 없다', () => {
    expect(toFilterChips(DEFAULT_FILTERS, warehouseLabel, itemLabel)).toEqual([]);
  });

  /** 제거 버튼의 접근 이름이 같으면 어느 조건을 푸는 것인지 알 수 없다. */
  it('제거 버튼의 접근 이름이 조건마다 다르다', () => {
    const chips = toFilterChips(
      filtersOf({ warehouseId: '9201', itemId: '9101', activeOnly: true }),
      warehouseLabel,
      itemLabel,
    );
    const labels = chips.map((chip) => chip.removeLabel);

    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('clearFilter', () => {
  it('문자열 조건은 비운다', () => {
    const next = clearFilter(filtersOf({ warehouseId: '9201', itemId: '9101' }), 'itemId');

    expect(next.itemId).toBe('');
    expect(next.warehouseId).toBe('9201');
  });

  it('사용 중만은 끈다', () => {
    expect(clearFilter(filtersOf({ activeOnly: true }), 'activeOnly').activeOnly).toBe(false);
  });

  /**
   * 창고를 풀면 품목도 함께 풀린다 — **뜻을 잃기 때문이다.** 품목 조건은 「이 창고 안에서
   * 이 품목의 규칙」이라는 뜻이라, 창고가 없어지면 남은 품목 조건이 무엇을 가리키는지
   * 정해지지 않는다. 품목 **선택지**가 창고로 좁혀져서가 아니다 — 좁히지 않는다(체크리스트 10번).
   */
  it('창고를 풀면 품목 조건도 함께 풀린다', () => {
    const next = clearFilter(filtersOf({ warehouseId: '9201', itemId: '9101' }), 'warehouseId');

    expect(next.warehouseId).toBe('');
    expect(next.itemId).toBe('');
  });
});

describe('isCreating', () => {
  it('키가 있으면 등록 폼이 열린 것이다', () => {
    expect(isCreating(new URLSearchParams('new=1'))).toBe(true);
  });

  /** 주소는 손으로 고쳐지는 자리라 값을 따지지 않는다 — 키가 있으면 열린 것으로 본다. */
  it('값이 무엇이든 키가 있으면 열린 것으로 본다', () => {
    expect(isCreating(new URLSearchParams('new=abc'))).toBe(true);
  });

  it('키가 없으면 닫힌 것이다', () => {
    expect(isCreating(new URLSearchParams('wh=9201'))).toBe(false);
  });
});

describe('toCreateSearchParams', () => {
  /** 고른 규칙과 등록 폼은 **하나의 자리**다 — 남겨 두면 어느 쪽을 저장하는지 설명할 수 없다. */
  it('조건과 쪽은 두고 고른 규칙을 비운다', () => {
    const params = toCreateSearchParams({ ...DEFAULT_FILTERS, warehouseId: '9201' }, 3);

    expect(params.get('wh')).toBe('9201');
    expect(params.get('page')).toBe('3');
    expect(params.get('new')).toBe('1');
    expect(params.get('rule')).toBeNull();
  });
});

describe('withoutSelection', () => {
  /** 지우지 않으면 조건을 바꿔도 없는 규칙을 계속 부른다. */
  it('고른 규칙과 등록 표시를 함께 걷어 낸다', () => {
    const params = withoutSelection(new URLSearchParams('wh=9201&page=2&rule=9001&new=1'));

    expect(params.get('rule')).toBeNull();
    expect(params.get('new')).toBeNull();
  });

  it('조건과 쪽은 그대로 둔다', () => {
    const params = withoutSelection(
      new URLSearchParams('wh=9201&item=9101&active=1&page=2&rule=9001'),
    );

    expect(params.get('wh')).toBe('9201');
    expect(params.get('item')).toBe('9101');
    expect(params.get('active')).toBe('1');
    expect(params.get('page')).toBe('2');
  });

  /** 받은 것을 고치지 않는다 — 주소 객체를 제자리에서 바꾸면 부르는 쪽이 지난 값을 잃는다. */
  it('넘겨받은 주소를 건드리지 않는다', () => {
    const original = new URLSearchParams('wh=9201&rule=9001');

    withoutSelection(original);

    expect(original.get('rule')).toBe('9001');
  });
});
