import { describe, expect, it } from 'vitest';

import { routingOperationFixtures } from './fixtures';
import { toOperationDrafts } from './operation-order';

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
