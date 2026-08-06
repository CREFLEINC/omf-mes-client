import { describe, expect, it } from 'vitest';

import { routingOperationFixtures } from './fixtures';
import {
  createOperationDraft,
  isSameDrafts,
  moveDraft,
  removeDraft,
  toOperationDrafts,
  toOperationsPayload,
  upsertDraft,
} from './operation-order';

describe('toOperationDrafts', () => {
  it('받은 순서를 그대로 유지한다 — 순서는 배열의 위치다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(drafts.map((draft) => draft.operationName)).toEqual(['1차 사출', '2차 조립']);
  });

  /*
   * 전체 치환은 「행 교체」가 아니다. 식별자를 버리면 서버가 행을 새로 만들 수밖에 없고
   * 진행 중 작업지시가 참조하던 행이 사라진다.
   */
  it('기존 행의 식별자를 보존한다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(drafts.map((draft) => draft.routingOperationId)).toEqual([8001, 8002]);
  });

  it('행마다 안정된 초안 키를 갖는다 — 표의 행 식별자로 쓴다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const keys = drafts.map((draft) => draft.draftId);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((key) => key !== '')).toBe(true);
  });

  /*
   * 순서 값은 초안에 담지 않는다. 들고 다니면 화면이 그것을 표시하거나 되돌려 보낼 여지가 생긴다.
   */
  it('서버가 준 순서 값을 초안에 담지 않는다', () => {
    const [first] = toOperationDrafts(routingOperationFixtures);

    expect(first).toBeDefined();
    expect(Object.keys(first ?? {})).not.toContain('operationSeq');
  });

  it('관리 플래그를 그대로 옮긴다', () => {
    const [first, second] = toOperationDrafts(routingOperationFixtures);

    expect(first?.mesManaged).toBe(true);
    expect(first?.inspectionManaged).toBe(true);
    expect(first?.materialInputManaged).toBe(false);
    expect(second?.mesManaged).toBe(false);
  });

  it('숫자 항목을 폼 문자열로 옮기고 널은 빈 문자열이 된다', () => {
    const [first, second] = toOperationDrafts(routingOperationFixtures);

    expect(first?.processId).toBe('9001');
    expect(first?.standardCycleTimeSec).toBe('45');
    // 비율 그대로 옮긴다 — 퍼센트로 바꾸면 100배 오입력이 조용히 통과한다.
    expect(first?.standardYieldRate).toBe('0.98');
    expect(second?.standardCycleTimeSec).toBe('');
    expect(second?.standardYieldRate).toBe('');
  });

  it('라인이 0건이면 빈 초안 목록이 된다', () => {
    expect(toOperationDrafts([])).toEqual([]);
  });
});

const names = (drafts: { operationName: string }[]): string[] =>
  drafts.map((draft) => draft.operationName);

describe('moveDraft', () => {
  it('아래로 한 칸 옮긴다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(names(moveDraft(drafts, 0, 1))).toEqual(['2차 조립', '1차 사출']);
  });

  it('위로 한 칸 옮긴다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(names(moveDraft(drafts, 1, 0))).toEqual(['2차 조립', '1차 사출']);
  });

  /*
   * 디자인 시스템이 첫 행의 위로·마지막 행의 아래로를 비활성으로 만들지만,
   * 순서는 이 파일이 소유하므로 경계를 여기서도 막는다.
   */
  it('첫 행을 위로 옮기려 하면 순서가 그대로다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(moveDraft(drafts, 0, -1)).toBe(drafts);
  });

  it('마지막 행을 아래로 옮기려 하면 순서가 그대로다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(moveDraft(drafts, 1, 2)).toBe(drafts);
  });

  it('원본 배열을 바꾸지 않는다 — 초안은 불변으로 다룬다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    moveDraft(drafts, 0, 1);

    expect(names(drafts)).toEqual(['1차 사출', '2차 조립']);
  });
});

describe('removeDraft · upsertDraft', () => {
  it('초안 키로 한 행을 지운다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(names(removeDraft(drafts, 'saved:8001'))).toEqual(['2차 조립']);
  });

  it('없는 키를 지우면 목록이 그대로다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(removeDraft(drafts, 'saved:9999')).toHaveLength(2);
  });

  it('새 초안은 목록 끝에 붙는다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const added = { ...createOperationDraft(), operationName: '3차 검사' };

    expect(names(upsertDraft(drafts, added))).toEqual(['1차 사출', '2차 조립', '3차 검사']);
  });

  it('같은 초안 키는 자리를 지킨 채 값만 바뀐다 — 수정이 순서를 흔들지 않는다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const first = drafts[0];
    expect(first).toBeDefined();

    const edited = upsertDraft(drafts, { ...(first as (typeof drafts)[number]), operationName: '1차 사출(개정)' });

    expect(names(edited)).toEqual(['1차 사출(개정)', '2차 조립']);
  });

  it('새 초안의 키는 저장된 행과 겹치지 않는다', () => {
    const created = createOperationDraft();

    expect(created.draftId.startsWith('saved:')).toBe(false);
    expect(created.routingOperationId).toBeNull();
    expect(createOperationDraft().draftId).not.toBe(created.draftId);
  });
});

describe('toOperationsPayload', () => {
  /*
   * 순서 컬럼에 유일 제약이 있어 화면이 최종 순서 전체를 한 번에 보낸다.
   * 그때 순서 값은 화면이 1부터 연속으로 다시 매긴다 — 서버 채번 값을 되돌려 보내지 않는다.
   */
  it('순서 값을 1부터 연속으로 다시 매긴다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const payload = toOperationsPayload(7003, moveDraft(drafts, 0, 1));

    expect(payload.map((item) => item.operationSeq)).toEqual([1, 2]);
    expect(payload.map((item) => item.operationName)).toEqual(['2차 조립', '1차 사출']);
  });

  /*
   * 전체 치환은 「행 교체」가 아니다. 식별자를 버리면 서버가 행을 새로 만들 수밖에 없고
   * 진행 중 작업지시가 참조하던 행이 사라진다.
   */
  it('기존 행의 식별자를 보존하고 새 행은 식별자를 넣지 않는다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const added = { ...createOperationDraft(), processId: '9003', operationName: '3차 검사' };
    const payload = toOperationsPayload(7003, upsertDraft(drafts, added));

    expect(payload[0]?.routingOperationId).toBe(8001);
    expect(payload[1]?.routingOperationId).toBe(8002);
    expect(payload[2]).toBeDefined();
    expect('routingOperationId' in (payload[2] ?? {})).toBe(false);
  });

  it('폼 문자열을 계약 표현으로 옮긴다 — 빈 값은 널이고 공정명 앞뒤 공백은 지운다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const payload = toOperationsPayload(7003, [
      { ...(drafts[0] as (typeof drafts)[number]), operationName: '  1차 사출  ' },
      drafts[1] as (typeof drafts)[number],
    ]);

    expect(payload[0]?.routingId).toBe(7003);
    expect(payload[0]?.processId).toBe(9001);
    expect(payload[0]?.operationName).toBe('1차 사출');
    expect(payload[0]?.standardCycleTimeSec).toBe(45);
    expect(payload[0]?.standardYieldRate).toBe(0.98);
    expect(payload[1]?.standardCycleTimeSec).toBeNull();
    expect(payload[1]?.standardYieldRate).toBeNull();
  });

  /** 계약에 자리가 없는 항목을 지어내 보내지 않는다(외주 공정). */
  it('계약에 없는 항목을 본문에 싣지 않는다', () => {
    const payload = toOperationsPayload(7003, toOperationDrafts(routingOperationFixtures));

    for (const item of payload) {
      expect('isOutsourced' in item).toBe(false);
      expect('outsourced' in item).toBe(false);
      expect('draftId' in item).toBe(false);
    }
  });
});

describe('isSameDrafts', () => {
  it('순서만 달라도 다른 것으로 본다 — 순서가 곧 자료다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);

    expect(isSameDrafts(drafts, moveDraft(drafts, 0, 1))).toBe(false);
  });

  it('같은 값이면 같다고 본다', () => {
    expect(
      isSameDrafts(
        toOperationDrafts(routingOperationFixtures),
        toOperationDrafts(routingOperationFixtures),
      ),
    ).toBe(true);
  });

  it('건수가 다르거나 한 칸만 달라도 다르다', () => {
    const drafts = toOperationDrafts(routingOperationFixtures);
    const edited = upsertDraft(drafts, {
      ...(drafts[0] as (typeof drafts)[number]),
      standardYieldRate: '0.5',
    });

    expect(isSameDrafts(drafts, removeDraft(drafts, 'saved:8001'))).toBe(false);
    expect(isSameDrafts(drafts, edited)).toBe(false);
  });
});
