import { afterEach, describe, expect, it, vi } from 'vitest';

import { EMPTY_OPEN_DRAFT, hasAnyOpenDraftValue, toCountCreate, type OpenDraft } from './open-request';

const draft = (overrides: Partial<OpenDraft> = {}): OpenDraft => ({
  countType: 'SAMPLE_COUNT_TYPE_A',
  warehouse: '9101',
  plannedDate: '2026-08-06',
  blindCount: false,
  ...overrides,
});

afterEach(() => {
  vi.useRealTimers();
});

describe('toCountCreate — 개시 요청 본문', () => {
  it('계약이 요구하는 넷을 싣고 그 밖의 키를 만들지 않는다', () => {
    expect(toCountCreate(draft())).toEqual({
      countTypeCode: 'SAMPLE_COUNT_TYPE_A',
      warehouseId: 9101,
      plannedDate: '2026-08-06',
      blindCount: false,
    });
  });

  /*
   * **`blindCount`를 늘 명시한다**(계획 결정 11). 계약의 `required`에는 없고 `default: false`인데,
   * 기본값에 기대면 서버 기본이 바뀔 때 **화면은 그대로인데 만들어지는 실사가 달라진다** —
   * 게다가 블라인드는 개시한 뒤에 고칠 오퍼레이션이 없어 그 어긋남을 되돌릴 수 없다.
   */
  it('블라인드를 끄고 보내도 키가 빠지지 않는다', () => {
    const body = toCountCreate(draft({ blindCount: false }));

    expect(Object.keys(body)).toContain('blindCount');
    expect(body.blindCount).toBe(false);
  });

  it('블라인드를 켜면 참으로 싣는다', () => {
    expect(toCountCreate(draft({ blindCount: true })).blindCount).toBe(true);
  });

  /**
   * 선택칸의 값은 문자열이고 계약은 정수를 요구한다. 옮기는 자리를 여기 하나로 둔다 —
   * 화면 여러 곳에서 `Number()`를 부르면 어디는 옮기고 어디는 안 옮기는 상태가 생긴다.
   */
  it('창고를 정수로 옮긴다', () => {
    expect(toCountCreate(draft({ warehouse: '9102' })).warehouseId).toBe(9102);
  });

  /*
   * **코드를 다듬어 싣는다.** 화면이 재는 길이(`validation.ts`)와 보내는 값이 갈리면
   * 「50자로 보내는데 화면은 51자라고 막는」 어긋남이 생긴다.
   */
  it('실사 유형의 앞뒤 공백을 떼고 싣는다', () => {
    expect(toCountCreate(draft({ countType: '  SAMPLE_COUNT_TYPE_A  ' })).countTypeCode).toBe(
      'SAMPLE_COUNT_TYPE_A',
    );
  });

  /**
   * **계획일을 실행 시각에서 파생하지 않는다.** 사용자가 넣은 날짜가 그대로 실려야 한다 —
   * 이 함수 안에서 `new Date()`를 부르면 자정을 넘기는 순간 같은 입력이 다른 날짜로 나간다.
   * 개시는 되돌릴 수 없으므로 그 하루 차이를 고칠 방법이 화면에 없다.
   */
  it('자정 직전과 직후에 같은 본문을 만든다', () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-08-06T23:59:59+09:00'));
    const before = toCountCreate(draft({ plannedDate: '2026-08-10' }));

    vi.setSystemTime(new Date('2026-08-07T00:00:01+09:00'));
    const after = toCountCreate(draft({ plannedDate: '2026-08-10' }));

    expect(before).toEqual(after);
    expect(before.plannedDate).toBe('2026-08-10');
  });
});

describe('hasAnyOpenDraftValue — 버릴 것이 있는가', () => {
  /* 아무것도 잃지 않는 조작에까지 확인을 받으면 확인 창이 의미를 잃고 읽지 않고 누르게 된다. */
  it('빈 초안에는 버릴 것이 없다', () => {
    expect(hasAnyOpenDraftValue(EMPTY_OPEN_DRAFT)).toBe(false);
  });

  /** **모든 칸을 함께 본다** — 한쪽만 보면 나머지가 확인 없이 사라진다. */
  it.each<[string, Partial<OpenDraft>]>([
    ['실사 유형', { countType: 'SAMPLE_COUNT_TYPE_A' }],
    ['창고', { warehouse: '9101' }],
    ['계획일', { plannedDate: '2026-08-06' }],
    ['블라인드', { blindCount: true }],
  ])('%s만 넣어도 버릴 것이 있다', (_label, overrides) => {
    expect(hasAnyOpenDraftValue({ ...EMPTY_OPEN_DRAFT, ...overrides })).toBe(true);
  });

  /* 공백만 친 값은 버릴 것이 아니다 — 그 하나 때문에 확인 창이 뜨면 확인이 형식이 된다. */
  it('공백만 친 실사 유형은 버릴 것이 아니다', () => {
    expect(hasAnyOpenDraftValue({ ...EMPTY_OPEN_DRAFT, countType: '   ' })).toBe(false);
  });
});
