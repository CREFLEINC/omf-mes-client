import { messages } from '@omf-mes/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  POST_FORM_FIELDS,
  isBusinessDateApart,
  seedPostDraft,
  toPostRequest,
  validatePostDraft,
  type PostDraft,
} from './post-request';

const t = messages.stockAdjust;

/** 고정 시각 — **파생을 시각으로 재려면 지금이 아니라 정해진 순간이어야 한다.** */
const NOW = new Date('2026-08-18T14:05:09+09:00');

const draft = (overrides: Partial<PostDraft> = {}): PostDraft => ({
  businessDate: '2026-08-18',
  occurredAtLocal: '2026-08-18T14:05',
  ...overrides,
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * ⚠ **아래 세 감지기는 실행 환경 시간대(+09:00)에 매여 있다** — 고정 시각을 만들어 놓고
 * **로컬로 읽은 결과**를 KST 기준 리터럴과 대조하기 때문이다(리뷰 R-5). 저장소 전역의 기존
 * 형태이고(다른 슬라이스 6건이 같은 조건에서 함께 넘어진다) `vitest.config.ts` 한 줄로 닫히는
 * 자리라 **별건**으로 남긴다. offset 축은 시간대를 갈아 끼워 재므로(아래 `toPostRequest`)
 * 그 매임이 없다.
 */
describe('seedPostDraft', () => {
  it('영업일과 발생 일시를 제출 순간으로 채운다', () => {
    expect(seedPostDraft(NOW)).toEqual({
      businessDate: '2026-08-18',
      occurredAtLocal: '2026-08-18T14:05',
    });
  });

  /**
   * ⭐ **실행 환경 시간대로 읽는다.** UTC로 읽으면 한국 시간 오전 9시 이전이 **어제**가 되고,
   * 그 값이 그대로 원장의 영업일이 된다.
   */
  it('자정 직후에도 그날의 날짜다', () => {
    expect(seedPostDraft(new Date('2026-08-19T00:30:00+09:00'))).toEqual({
      businessDate: '2026-08-19',
      occurredAtLocal: '2026-08-19T00:30',
    });
  });

  /** 한 자리 수 달·날·시·분에 0을 채운다 — 계약 형식이 두 자리다. */
  it('한 자리 수에 0을 채운다', () => {
    expect(seedPostDraft(new Date('2026-09-05T07:08:00+09:00'))).toEqual({
      businessDate: '2026-09-05',
      occurredAtLocal: '2026-09-05T07:08',
    });
  });
});

describe('validatePostDraft', () => {
  it('둘 다 갖추면 오류가 없다', () => {
    expect(validatePostDraft(draft())).toEqual({});
  });

  it('영업일이 비면 그 칸에 오류가 붙는다', () => {
    expect(validatePostDraft(draft({ businessDate: '' }))).toEqual({
      businessDate: t.errors.businessDateRequired,
    });
  });

  it('발생 일시가 비면 그 칸에 오류가 붙는다', () => {
    expect(validatePostDraft(draft({ occurredAtLocal: '' }))).toEqual({
      occurredAt: t.errors.occurredAtRequired,
    });
  });

  it('둘 다 비면 오류도 둘이다 — 하나만 말하면 고친 뒤에 또 막힌다', () => {
    expect(validatePostDraft({ businessDate: '', occurredAtLocal: '' })).toEqual({
      businessDate: t.errors.businessDateRequired,
      occurredAt: t.errors.occurredAtRequired,
    });
  });

  /**
   * ⭐ **둘째 층이다.** 첫째 층은 네이티브 `type="date"`·`type="datetime-local"`인데, 그것은
   * 브라우저마다 다르고 시험 환경(jsdom)에서는 아무것도 막지 않는다 — 붙여넣기로 들어온 글자가
   * 그대로 **되돌릴 수 없는 전기 본문**에 실리는 길이 실재한다.
   */
  it.each(['2026-8-18', '18/08/2026', '2026-08-18T00:00', '어제'])(
    '영업일이 날짜 형식(%o)이 아니면 오류가 붙는다',
    (raw) => {
      expect(validatePostDraft(draft({ businessDate: raw }))).toEqual({
        businessDate: t.errors.businessDateFormat,
      });
    },
  );

  it.each(['2026-08-18', '2026-08-18 14:05', '14:05', '2026-08-18T14'])(
    '발생 일시가 일시 형식(%o)이 아니면 오류가 붙는다',
    (raw) => {
      expect(validatePostDraft(draft({ occurredAtLocal: raw }))).toEqual({
        occurredAt: t.errors.occurredAtFormat,
      });
    },
  );

  /** 초까지 오는 갈래가 실재한다(브라우저가 초 단위 칸을 내주는 설정) — 형식으로 막지 않는다. */
  it('초까지 온 발생 일시는 정상이다', () => {
    expect(validatePostDraft(draft({ occurredAtLocal: '2026-08-18T14:05:09' }))).toEqual({});
  });
});

describe('toPostRequest', () => {
  /**
   * ⭐ **본문의 키 집합이 정확히 둘이다**(C32 · 뮤테이션 M-3b가 겨누는 자리).
   *
   * 계약의 `PostRequest`가 두 값뿐이다 — 전표의 내용은 이미 서버에 있고 이 조작은 그것을
   * 원장에 반영할 뿐이다. 하나라도 빠지면 **재고가 잘못된 영업일로 잡힌다**(공유계약 C-8).
   */
  it('본문 키가 영업일과 발생 시각 둘뿐이다', () => {
    const body = toPostRequest(draft(), NOW);

    expect(body).not.toBeNull();
    expect(Object.keys(body ?? {}).sort()).toEqual(['businessDate', 'occurredAt']);
  });

  /** 영업일은 **사용자가 고른 글자 그대로** 실린다 — 화면이 다시 계산하지 않는다. */
  it('영업일이 친 값 그대로 실린다', () => {
    expect(toPostRequest(draft({ businessDate: '2026-08-17' }), NOW)?.businessDate).toBe(
      '2026-08-17',
    );
  });

  /**
   * ⭐ **발생 시각에 초와 offset을 붙인다.**
   *
   * 칸이 분까지만 주는데 계약은 offset이 있는 형식을 요구한다 — offset이 없는 글자를 그대로
   * 보내면 **같은 글자가 지역마다 다른 순간**을 가리킨다(공유계약 C-1).
   */
  it('발생 시각에 초와 offset이 붙는다', () => {
    const occurredAt = toPostRequest(
      draft({ occurredAtLocal: '2026-08-18T14:05' }),
      NOW,
    )?.occurredAt;

    expect(occurredAt).toMatch(/^2026-08-18T14:05:00[+-]\d{2}:\d{2}$/);
  });

  /*
   * ⭐ **실행 환경이 UTC 동쪽일 때와 서쪽일 때 부호가 갈린다**(전례 `supplier-return`의 감지기
   * 사본 · 리뷰 R-2). 고정 시각만으로는 이 갈래를 잴 수 없어 **시간대 자체를 갈아 끼운다** —
   * 부호를 뒤집는 결함은 한국에서만 돌려 보면 드러나지 않고, 그때 같은 글자가 **18시간 어긋난
   * 순간**을 가리킨 채 되돌릴 수 없는 전기 본문에 실린다.
   */
  it('UTC 동쪽이면 `+`, 서쪽이면 `-`가 붙는다', () => {
    const offset = vi.spyOn(Date.prototype, 'getTimezoneOffset');

    offset.mockReturnValue(-540);
    expect(toPostRequest(draft(), NOW)?.occurredAt.endsWith('+09:00')).toBe(true);

    offset.mockReturnValue(300);
    expect(toPostRequest(draft(), NOW)?.occurredAt.endsWith('-05:00')).toBe(true);
  });

  /* 30분 단위 시간대(예: UTC+05:30)에서도 분이 살아 있어야 한다 — 시간만 쓰면 30분이 사라진다. */
  it('30분 단위 시간대의 분을 버리지 않는다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);

    expect(toPostRequest(draft(), NOW)?.occurredAt.endsWith('+05:30')).toBe(true);
  });

  /* UTC 자체에서도 형식이 무너지지 않는다 — 0은 부호가 없는 값이 아니다. */
  it('UTC에서는 +00:00이 붙는다', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);

    expect(toPostRequest(draft(), NOW)?.occurredAt.endsWith('+00:00')).toBe(true);
  });

  it('초까지 친 발생 시각은 그 초를 그대로 둔다', () => {
    expect(
      toPostRequest(draft({ occurredAtLocal: '2026-08-18T14:05:09' }), NOW)?.occurredAt,
    ).toMatch(/^2026-08-18T14:05:09[+-]\d{2}:\d{2}$/);
  });

  /**
   * ⭐ **영업일과 발생 시각은 갈린 값이다**(C-8). 어제 어긋난 것을 오늘 전기하면 두 값이 실제로
   * 갈리고, 영업일을 발생 시각에서 다시 뽑으면 그 사실이 사라진다.
   */
  it('영업일이 발생 시각의 날짜와 달라도 그대로 싣는다', () => {
    const body = toPostRequest(
      draft({ businessDate: '2026-08-17', occurredAtLocal: '2026-08-18T00:30' }),
      NOW,
    );

    expect(body?.businessDate).toBe('2026-08-17');
    expect(body?.occurredAt.startsWith('2026-08-18T00:30')).toBe(true);
  });

  /**
   * **마지막 겹이다.** 버튼 잠금과 보내는 자리의 재판정이 이미 닫은 길이지만, 그 둘이 뚫려도
   * 형식이 아닌 글자가 되돌릴 수 없는 전기 본문에 실리지 않아야 한다.
   */
  it.each([
    draft({ businessDate: '' }),
    draft({ occurredAtLocal: '' }),
    draft({ businessDate: '어제' }),
    draft({ occurredAtLocal: '14:05' }),
  ])('갖춰지지 않은 초안(%o)으로는 본문을 만들지 않는다', (invalid) => {
    expect(toPostRequest(invalid, NOW)).toBeNull();
  });
});

/**
 * ⭐ **두 날짜가 갈리는 것은 정상이고, 그 사실은 밝힌다**(C-8의 야간조 경계).
 *
 * 막지 않는다 — 막으면 자정을 넘겨 일한 사람이 어제 자 조정을 전기할 길이 사라진다.
 */
describe('isBusinessDateApart', () => {
  it('같은 날이면 거짓이다', () => {
    expect(isBusinessDateApart(draft())).toBe(false);
  });

  it('다른 날이면 참이다', () => {
    expect(
      isBusinessDateApart(
        draft({ businessDate: '2026-08-17', occurredAtLocal: '2026-08-18T00:30' }),
      ),
    ).toBe(true);
  });

  /** 아직 갖춰지지 않은 초안으로는 **갈렸다고 말하지 않는다** — 빈 칸은 다른 날이 아니다. */
  it.each([draft({ businessDate: '' }), draft({ occurredAtLocal: '' })])(
    '빈 칸이 있으면 거짓이다(%o)',
    (partial) => {
      expect(isBusinessDateApart(partial)).toBe(false);
    },
  );
});

/**
 * 서버가 준 필드 오류를 **인라인으로 그릴 자리가 있는 칸**(전례 `SUBMIT_FORM_FIELDS`와 같은 규율).
 *
 * 본문의 키 이름과 같은 것은 계약이 그 이름으로 오류를 내려주기 때문이고, 판정 기준은
 * **「그릴 자리가 있는가」**다 — 두 칸 모두 화면에 있다.
 */
describe('POST_FORM_FIELDS', () => {
  it('두 칸의 이름이 본문 키와 같다', () => {
    expect([...POST_FORM_FIELDS].sort()).toEqual(['businessDate', 'occurredAt']);
  });
});
