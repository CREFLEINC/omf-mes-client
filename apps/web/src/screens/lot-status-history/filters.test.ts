import { describe, expect, it } from 'vitest';

import {
  EMPTY_HISTORY_FILTERS,
  EMPTY_LOT_FILTERS,
  readHistoryFilters,
  readHistoryPage,
  readLotFilters,
  readLotPage,
  readMode,
  readSelectedLotId,
  toAppliedHistorySearchParams,
  toAppliedLotSearchParams,
  toModeSearchParams,
  withSelectedLot,
} from './filters';

const paramsOf = (search: string): URLSearchParams => new URLSearchParams(search);

describe('readMode', () => {
  it.each([
    ['mode=history', 'history'],
    ['', 'lot'],
    ['mode=lot', 'lot'],
    ['mode=unknown', 'lot'],
  ] as const)('%s를 $expected 모드로 정규화한다', (search, expected) => {
    expect(readMode(paramsOf(search))).toBe(expected);
  });
});

describe('readLotFilters', () => {
  it.each([
    [
      'lotType=SAMPLE_TYPE&q=SAMPLE-LOT-001&item=101&status=SAMPLE_STATUS&warehouse=202&location=303',
      {
        lotType: 'SAMPLE_TYPE',
        q: 'SAMPLE-LOT-001',
        item: '101',
        status: 'SAMPLE_STATUS',
        warehouse: '202',
        location: '303',
      },
    ],
    ['', EMPTY_LOT_FILTERS],
  ])('LOT 모드의 적용 조건을 주소에서 읽는다', (search, expected) => {
    expect(readLotFilters(paramsOf(search))).toEqual(expected);
  });
  it.each(['0', '-1', '1.5', 'abc'])(
    '식별자가 아닌 값(%s)은 품목·창고·Location 조건으로 받지 않는다',
    (raw) => {
      expect(
        readLotFilters(paramsOf(`item=${raw}&warehouse=${raw}&location=${raw}`)),
      ).toMatchObject({ item: '', warehouse: '', location: '' });
    },
  );
  it('미확정 코드와 검색 문자열은 형태를 지어내지 않고 원문을 보존한다', () => {
    expect(
      readLotFilters(paramsOf('lotType=%EA%B0%80%2F%EB%82%98&status=NEW.VALUE&q=%20LOT%20')),
    ).toMatchObject({ lotType: '가/나', status: 'NEW.VALUE', q: ' LOT ' });
  });
});

describe('page readers', () => {
  it.each([
    ['3', '7', 3, 7],
    ['0', '0', 1, 1],
    ['-1', '-1', 1, 1],
    ['1.5', '1.5', 1, 1],
    ['abc', 'abc', 1, 1],
    ['9007199254740992', '9007199254740992', 1, 1],
  ])('LOT %s, 이력 %s 페이지를 각각 %i, %i로 읽는다', (lot, history, lotPage, historyPage) => {
    const params = paramsOf(`page=${lot}&historyPage=${history}`);
    expect(readLotPage(params)).toBe(lotPage);
    expect(readHistoryPage(params)).toBe(historyPage);
  });
});

describe('readSelectedLotId', () => {
  it.each([
    ['404', 404],
    ['0', null],
    ['-1', null],
    ['1.5', null],
    ['abc', null],
    ['9007199254740992', null],
  ])('LOT 식별자 %s를 %s로 읽는다', (raw, expected) => {
    expect(readSelectedLotId(paramsOf(`lot=${raw}`))).toBe(expected);
  });
});

describe('readHistoryFilters', () => {
  it.each([
    [
      'from=2026-08-01&to=2026-08-07&actor=505&historyLot=606',
      { from: '2026-08-01', to: '2026-08-07', actor: '505', lot: '606' },
    ],
    ['', EMPTY_HISTORY_FILTERS],
  ])('기간·행위자·LOT 조건을 주소에서 읽는다', (search, expected) => {
    expect(readHistoryFilters(paramsOf(search))).toEqual(expected);
  });
  it.each(['0', '-1', '1.5', 'abc'])(
    '식별자가 아닌 값(%s)은 행위자·LOT 조건으로 받지 않는다',
    (raw) => {
      expect(readHistoryFilters(paramsOf(`actor=${raw}&historyLot=${raw}`))).toMatchObject({
        actor: '',
        lot: '',
      });
    },
  );
});

describe('toModeSearchParams', () => {
  it('모드를 바꿔도 두 모드의 적용 조건과 페이지를 보존하고 선택 LOT만 제거한다', () => {
    const current = paramsOf(
      'lotType=TYPE_A&page=2&from=2026-08-01&to=2026-08-07&historyPage=3&lot=404',
    );
    const next = toModeSearchParams(current, 'history');
    expect(Object.fromEntries(next)).toEqual({
      lotType: 'TYPE_A',
      page: '2',
      from: '2026-08-01',
      to: '2026-08-07',
      historyPage: '3',
      mode: 'history',
    });
  });
  it('기본 LOT 모드는 mode 키를 남기지 않는다', () => {
    expect(toModeSearchParams(paramsOf('mode=history'), 'lot').has('mode')).toBe(false);
  });
});

describe('toAppliedLotSearchParams', () => {
  it('LOT 조건과 페이지만 교체하고 이력 상태를 보존한다', () => {
    const current = paramsOf(
      'mode=history&lotType=OLD&page=8&from=2026-08-01&to=2026-08-07&actor=505&historyLot=606&historyPage=4&extra=keep',
    );
    const filters = {
      lotType: 'TYPE_B',
      q: 'SAMPLE-LOT',
      item: '101',
      status: 'STATUS_B',
      warehouse: '202',
      location: '303',
    };
    const next = toAppliedLotSearchParams(current, filters, 5);
    expect(Object.fromEntries(next)).toEqual({
      mode: 'history',
      lotType: 'TYPE_B',
      page: '5',
      from: '2026-08-01',
      to: '2026-08-07',
      actor: '505',
      historyLot: '606',
      historyPage: '4',
      extra: 'keep',
      q: 'SAMPLE-LOT',
      item: '101',
      status: 'STATUS_B',
      warehouse: '202',
      location: '303',
    });
  });
  it('LOT 적용값을 바꾸면 이전 선택 LOT을 제거한다', () => {
    const next = toAppliedLotSearchParams(
      paramsOf('lot=404'),
      { ...EMPTY_LOT_FILTERS, q: 'NEW' },
      1,
    );
    expect(next.has('lot')).toBe(false);
  });
  it('빈 조건과 첫 페이지는 해당 URL 키를 만들지 않는다', () => {
    const next = toAppliedLotSearchParams(
      paramsOf(
        'lotType=OLD&q=OLD&item=101&status=OLD&warehouse=202&location=303&page=9&historyPage=4',
      ),
      EMPTY_LOT_FILTERS,
      1,
    );
    for (const key of ['lotType', 'q', 'item', 'status', 'warehouse', 'location', 'page']) {
      expect(next.has(key)).toBe(false);
    }
    expect(next.get('historyPage')).toBe('4');
  });
});

describe('toAppliedHistorySearchParams', () => {
  it('이력 조건과 페이지만 교체하고 LOT 상태를 보존한다', () => {
    const current = paramsOf(
      'lotType=TYPE_A&q=SAMPLE&page=3&lot=404&from=OLD&to=OLD&actor=1&historyLot=2&historyPage=9&extra=keep',
    );
    const next = toAppliedHistorySearchParams(
      current,
      { from: '2026-08-01', to: '2026-08-07', actor: '505', lot: '606' },
      4,
    );
    expect(Object.fromEntries(next)).toEqual({
      lotType: 'TYPE_A',
      q: 'SAMPLE',
      page: '3',
      lot: '404',
      from: '2026-08-01',
      to: '2026-08-07',
      actor: '505',
      historyLot: '606',
      historyPage: '4',
      extra: 'keep',
    });
  });
  it('빈 조건과 첫 페이지는 해당 URL 키를 만들지 않는다', () => {
    const next = toAppliedHistorySearchParams(
      paramsOf('from=OLD&to=OLD&actor=1&historyLot=2&historyPage=9&page=3'),
      EMPTY_HISTORY_FILTERS,
      1,
    );
    for (const key of ['from', 'to', 'actor', 'historyLot', 'historyPage']) {
      expect(next.has(key)).toBe(false);
    }
    expect(next.get('page')).toBe('3');
  });
});

describe('withSelectedLot', () => {
  it('다른 주소 상태를 보존하고 선택 LOT만 추가한다', () => {
    const next = withSelectedLot(paramsOf('mode=history&q=SAMPLE&historyPage=2'), 404);
    expect(Object.fromEntries(next)).toEqual({
      mode: 'history',
      q: 'SAMPLE',
      historyPage: '2',
      lot: '404',
    });
  });
  it.each([null, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    '유효한 선택이 아닌 값(%s)은 선택 키를 제거한다',
    (lotId) => {
      expect(withSelectedLot(paramsOf('lot=404&q=SAMPLE'), lotId).has('lot')).toBe(false);
    },
  );

  it('입력 URLSearchParams를 직접 변경하지 않는다', () => {
    const current = paramsOf('mode=history&lot=404');
    toModeSearchParams(current, 'lot');
    toAppliedLotSearchParams(current, EMPTY_LOT_FILTERS, 1);
    toAppliedHistorySearchParams(current, EMPTY_HISTORY_FILTERS, 1);
    withSelectedLot(current, null);
    expect(current.toString()).toBe('mode=history&lot=404');
  });
});
