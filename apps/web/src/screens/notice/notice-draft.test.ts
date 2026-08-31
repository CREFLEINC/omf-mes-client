import { describe, expect, it } from 'vitest';

import { isClosable, isEditable, isPublishable, isSupportedScope } from './codes';
import { EMPTY_DRAFT, toCreateBody, validateDraft, type NoticeDraft } from './notice-draft';
import { toAckState, formatPeriod } from './types';

/**
 * 「틀려도 조용한 것」만 시험한다 — 화면은 정상으로 보이면서 값만 틀리는 계산.
 *
 * ⭐ **게시는 되돌릴 수 없다.** 게시하면 본문이 잠기고 확인한 사람이 생긴다 — 어떤 상태에서
 * 무엇을 열어 주는가가 틀리면 고칠 수 없는 글이 나간다.
 */

const draftOf = (patch: Partial<NoticeDraft> = {}): NoticeDraft => ({
  ...EMPTY_DRAFT,
  title: '8월 정기 보전 안내',
  body: '보전 일정 안내입니다.',
  startDate: '2026-08-20',
  scopeCode: 'COMPANY',
  ...patch,
});

describe('validateDraft — 범위와 작업지시의 짝', () => {
  it('작업지시 범위면 작업지시가 있어야 한다', () => {
    expect(validateDraft(draftOf({ scopeCode: 'WORK_ORDER' })).workOrder).toBeDefined();
  });

  it('작업지시 범위가 아니면 작업지시를 비워야 한다', () => {
    expect(
      validateDraft(draftOf({ scopeCode: 'COMPANY', workOrder: '9' })).workOrder,
    ).toBeDefined();
  });

  it('짝이 맞으면 통과한다', () => {
    expect(validateDraft(draftOf({ scopeCode: 'WORK_ORDER', workOrder: '9' }))).toEqual({});
  });
});

describe('validateDraft — 1차에 쓸 수 없는 범위', () => {
  it('⚠ 보내면 서버가 거부하는 범위를 저장 전에 막는다', () => {
    for (const code of ['BUSINESS_UNIT', 'EQUIPMENT_GROUP', 'WORK_SHIFT']) {
      expect(validateDraft(draftOf({ scopeCode: code })).scopeCode).toBeDefined();
    }
  });

  it('쓸 수 있는 둘은 막지 않는다', () => {
    expect(validateDraft(draftOf({ scopeCode: 'COMPANY' })).scopeCode).toBeUndefined();
    expect(isSupportedScope('COMPANY')).toBe(true);
    expect(isSupportedScope('WORK_SHIFT')).toBe(false);
  });
});

describe('validateDraft — 기간과 필수 칸', () => {
  it('종료일이 시작일보다 앞서면 막는다', () => {
    expect(
      validateDraft(draftOf({ startDate: '2026-08-20', endDate: '2026-08-19' })).endDate,
    ).toBeDefined();
  });

  it('같은 날은 허용한다 — 하루짜리 공지가 흔하다', () => {
    expect(
      validateDraft(draftOf({ startDate: '2026-08-20', endDate: '2026-08-20' })).endDate,
    ).toBeUndefined();
  });

  it('달력에 없는 날은 막는다', () => {
    expect(validateDraft(draftOf({ startDate: '2026-02-30' })).startDate).toBeDefined();
  });

  it('제목과 본문이 공백뿐이면 비운 것으로 본다', () => {
    const errors = validateDraft(draftOf({ title: '  ', body: '\n ' }));

    expect(errors.title).toBeDefined();
    expect(errors.body).toBeDefined();
  });
});

describe('toCreateBody', () => {
  it('⛔ 상태를 싣지 않는다 — 서버가 파생한다', () => {
    const body = toCreateBody(draftOf({}));

    expect('statusCode' in body).toBe(false);
  });

  it('⛔ 범위가 작업지시가 아니면 작업지시를 싣지 않는다', () => {
    expect('targetWorkOrderId' in toCreateBody(draftOf({ scopeCode: 'COMPANY' }))).toBe(false);
  });

  it('작업지시 범위면 숫자로 싣는다', () => {
    expect(
      toCreateBody(draftOf({ scopeCode: 'WORK_ORDER', workOrder: '9' })).targetWorkOrderId,
    ).toBe(9);
  });

  it('⛔ 종료일이 비면 싣지 않는다 — 「종료일 없이 계속」과 빈 날짜는 다른 뜻이다', () => {
    expect('endDate' in toCreateBody(draftOf({ endDate: '' }))).toBe(false);
  });

  it('앞뒤 공백을 다듬어 보낸다', () => {
    const body = toCreateBody(draftOf({ title: ' 제목 ', body: ' 본문 ' }));

    expect(body.title).toBe('제목');
    expect(body.body).toBe('본문');
  });
});

describe('상태별로 무엇을 열어 주는가', () => {
  it('⛔ 게시한 뒤에는 고칠 수 없다 — 확인 이력이 무엇에 대한 확인인지 알 수 없어진다', () => {
    expect(isEditable('DRAFT')).toBe(true);
    for (const code of ['SCHEDULED', 'PUBLISHED', 'CLOSED']) {
      expect(isEditable(code)).toBe(false);
    }
  });

  it('아직 게시하지 않은 것만 게시한다', () => {
    expect(isPublishable('DRAFT')).toBe(true);
    expect(isPublishable('PUBLISHED')).toBe(false);
  });

  it('이미 끝난 것을 다시 내리지 않는다', () => {
    expect(isClosable('SCHEDULED')).toBe(true);
    expect(isClosable('PUBLISHED')).toBe(true);
    expect(isClosable('CLOSED')).toBe(false);
    expect(isClosable('DRAFT')).toBe(false);
  });
});

describe('toAckState — 셋을 가른다', () => {
  const row = (acknowledged: boolean, at: string | null) => ({
    userId: 1,
    userName: '표시명',
    acknowledged,
    ...(at === null ? {} : { acknowledgedAt: at }),
  });

  it('확인을 눌렀으면 확인이다', () => {
    expect(toAckState(row(true, '2026-08-20T09:00:00+09:00'))).toBe('done');
  });

  it('⭐ 닫기로 남은 행에도 시각이 찍힌다 — 그것은 열람(미확인)이다', () => {
    expect(toAckState(row(false, '2026-08-20T09:00:00+09:00'))).toBe('opened');
  });

  it('시각이 없으면 아직 보지도 않았다', () => {
    expect(toAckState(row(false, null))).toBe('pending');
  });
});

describe('formatPeriod', () => {
  it('종료일이 없으면 그 사실을 적는다 — 빈칸으로 두지 않는다', () => {
    expect(formatPeriod('2026-08-20', null, '종료일 없음')).toBe('2026-08-20 ~ 종료일 없음');
  });

  it('종료일이 있으면 그대로 잇는다', () => {
    expect(formatPeriod('2026-08-20', '2026-08-31', '종료일 없음')).toBe('2026-08-20 ~ 2026-08-31');
  });
});
