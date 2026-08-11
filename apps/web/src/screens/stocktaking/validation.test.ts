import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import { EMPTY_OPEN_DRAFT, type OpenDraft } from './open-request';
import { CODE_MAX, openBlockReason, OPEN_FIELD_NAMES, validateOpenDraft } from './validation';

const t = messages.stocktaking;

const ready = (overrides: Partial<OpenDraft> = {}): OpenDraft => ({
  countType: 'SAMPLE_COUNT_TYPE_A',
  warehouse: '9101',
  plannedDate: '2026-08-06',
  blindCount: false,
  ...overrides,
});

describe('openBlockReason — 「실사 개시」를 열지 말지', () => {
  /*
   * **M23 · C19** — 값 목록이 확정되지 않는 동안 개시가 **통째로** 막힌다(계획 결정 10 · 승인 G1).
   * `countTypeCode`가 요청 필수라 고를 값이 없으면 사용자가 아무리 애써도 요청을 만들 수 없다.
   */
  it('실사 유형의 값 목록이 없으면 그 사정이 가장 앞이다', () => {
    expect(openBlockReason({ isCountTypeListPending: true, draft: ready() })).toBe(
      t.actionReasons.openCodeListPending,
    );
  });

  /*
   * **차례가 뜻을 정한다.** 고를 것이 없는 상태에서 「실사 유형을 고르세요」를 내면 사용자는
   * 자기가 놓친 것을 찾다가 화면을 고장으로 읽는다 — 다 채운 초안에도 그 사정이 먼저 온다.
   */
  it('다 채운 초안이어도 값 목록이 없으면 그 사정을 낸다', () => {
    expect(openBlockReason({ isCountTypeListPending: true, draft: EMPTY_OPEN_DRAFT })).toBe(
      t.actionReasons.openCodeListPending,
    );
  });

  /* **M19 · C19의 짝 방향** — 목록이 차고 값이 다 있으면 열린다. */
  it('값 목록이 차고 세 칸이 다 있으면 열린다', () => {
    expect(openBlockReason({ isCountTypeListPending: false, draft: ready() })).toBeNull();
  });

  /* **C20** — 사유가 칸마다 다르다. 「무엇이 막혔는지」가 갈리지 않으면 고칠 곳을 알 수 없다. */
  it.each<[string, Partial<OpenDraft>, string]>([
    ['실사 유형', { countType: '' }, t.actionReasons.openNeedsCountType],
    ['창고', { warehouse: '' }, t.actionReasons.openNeedsWarehouse],
    ['계획일', { plannedDate: '' }, t.actionReasons.openNeedsPlannedDate],
  ])('%s가 비면 그 칸의 사유를 낸다', (_label, overrides, reason) => {
    expect(openBlockReason({ isCountTypeListPending: false, draft: ready(overrides) })).toBe(reason);
  });

  /*
   * **M22 · C22** — 공백만 친 유형 코드를 보내지 않는다. 계약에 `minLength`가 없어
   * **목 서버가 빈 문자열도 201로 통과시킨다**(실측) — 막는 곳이 화면뿐이다.
   * 되돌릴 수 없는 전표에 뜻 없는 코드가 실리면 고칠 방법이 없다.
   */
  it('공백만 친 실사 유형은 고르지 않은 것으로 본다', () => {
    expect(openBlockReason({ isCountTypeListPending: false, draft: ready({ countType: ' \t ' }) })).toBe(
      t.actionReasons.openNeedsCountType,
    );
  });

  /* 블라인드는 필수가 아니다 — 끈 채로도 열린다(끄는 것도 고른 것이다). */
  it('블라인드를 끄고도 열린다', () => {
    expect(
      openBlockReason({ isCountTypeListPending: false, draft: ready({ blindCount: false }) }),
    ).toBeNull();
  });
});

describe('validateOpenDraft — 인라인 오류', () => {
  it('제대로 채운 초안에는 오류가 없다', () => {
    expect(validateOpenDraft(ready())).toEqual({});
  });

  /*
   * **C21 · M25** — 계획일 형식을 화면이 막는다. 자릿수만 보면 `2026-02-31`처럼 **달력에 없는
   * 날**이 통과해 서버가 400으로 되돌리는데, 개시 요청은 그때 이미 나간 뒤다.
   */
  it.each(['2026-8-6', '20260806', '2026-02-31', '2026-13-01', '어제'])(
    '달력에 없는 계획일 %s를 인라인 오류로 낸다',
    (raw) => {
      expect(validateOpenDraft(ready({ plannedDate: raw }))).toEqual({
        [OPEN_FIELD_NAMES.plannedDate]: t.errors.plannedDateInvalid,
      });
    },
  );

  /* 윤년은 실제로 있는 날이다 — 없는 날만 막아야 한다. */
  it('윤년 2월 29일은 오류가 아니다', () => {
    expect(validateOpenDraft(ready({ plannedDate: '2028-02-29' }))).toEqual({});
  });

  /*
   * **비어 있는 것은 형식 오류가 아니다.** 아직 넣지 않은 칸에 붉은 글씨를 띄우면 사용자가
   * 잘못 넣은 줄 안다 — 비어 있음은 버튼의 사유가 맡는다(`openBlockReason`).
   */
  it('빈 계획일은 형식 오류로 내지 않는다', () => {
    expect(validateOpenDraft(ready({ plannedDate: '' }))).toEqual({});
  });

  /* 계약의 코드 길이 상한. 고른 값이 상한을 넘으면 나가기 전에 막는다. */
  it(`실사 유형이 ${String(CODE_MAX)}자를 넘으면 인라인 오류다`, () => {
    expect(validateOpenDraft(ready({ countType: 'A'.repeat(CODE_MAX + 1) }))).toEqual({
      [OPEN_FIELD_NAMES.countType]: t.errors.codeTooLong(CODE_MAX),
    });
  });

  it(`실사 유형이 딱 ${String(CODE_MAX)}자면 오류가 아니다`, () => {
    expect(validateOpenDraft(ready({ countType: 'A'.repeat(CODE_MAX) }))).toEqual({});
  });

  /* **다듬은 값의 길이를 잰다** — 요청 조립이 공백을 떼고 보내므로 재는 값도 같아야 한다. */
  it('앞뒤 공백을 뗀 뒤의 길이로 잰다', () => {
    expect(validateOpenDraft(ready({ countType: `  ${'A'.repeat(CODE_MAX)}  ` }))).toEqual({});
  });

  /* 두 오류가 함께 있으면 둘 다 낸다 — 하나씩 고치게 하면 왕복이 늘어난다. */
  it('길이와 형식이 함께 틀리면 둘 다 낸다', () => {
    expect(
      validateOpenDraft(ready({ countType: 'A'.repeat(CODE_MAX + 1), plannedDate: '2026-02-31' })),
    ).toEqual({
      [OPEN_FIELD_NAMES.countType]: t.errors.codeTooLong(CODE_MAX),
      [OPEN_FIELD_NAMES.plannedDate]: t.errors.plannedDateInvalid,
    });
  });
});
