import { describe, expect, it } from 'vitest';

import { toBatchResultView, type RequestedMessage } from './batch-result';
import type { BatchResult } from './types';

const REQUESTED: RequestedMessage[] = [
  { id: 9001, messageKey: 'SAMPLE-KEY-0001' },
  { id: 9002, messageKey: 'SAMPLE-KEY-0002' },
  { id: 9003, messageKey: 'SAMPLE-KEY-0003' },
];

const failure = (index: number, messages: string[] = ['보내지 못했습니다']) => ({
  index,
  errors: messages.map((message) => ({
    scope: 'field' as const,
    field: '문자열',
    code: 'STANDARD',
    message,
  })),
});

const result = (succeeded: number, failed: BatchResult['failed']): BatchResult => ({
  succeeded,
  failed,
});

describe('toBatchResultView — 전건 성공', () => {
  it('실패가 없으면 전건 성공이고 성공 안내가 나온다', () => {
    const view = toBatchResultView(result(3, []), REQUESTED);

    expect(view.isAllSucceeded).toBe(true);
    expect(view.summary).toBe('3건을 다시 보냈습니다.');
    expect(view.failed).toEqual([]);
  });
});

describe('toBatchResultView — 부분 실패', () => {
  it('성공 건수와 실패 건수를 함께 알린다', () => {
    const view = toBatchResultView(result(2, [failure(1)]), REQUESTED);

    expect(view.isAllSucceeded).toBe(false);
    expect(view.summary).toBe('2건을 다시 보냈습니다. 1건은 보내지 못했습니다.');
  });

  it('위치 번호로 어느 건인지 되짚는다 — 배열 순서로 매기면 엉뚱한 건에 사유가 붙는다', () => {
    const view = toBatchResultView(result(2, [failure(2)]), REQUESTED);

    expect(view.failed[0]?.label).toBe('SAMPLE-KEY-0003');
  });

  it('실패가 여럿이면 각각 되짚는다', () => {
    const view = toBatchResultView(result(1, [failure(0), failure(2)]), REQUESTED);

    expect(view.failed.map((item) => item.label)).toEqual(['SAMPLE-KEY-0001', 'SAMPLE-KEY-0003']);
  });
});

describe('toBatchResultView — 전건 실패', () => {
  it('성공이 하나도 없으면 성공 안내를 내지 않는다', () => {
    const view = toBatchResultView(result(0, [failure(0), failure(1), failure(2)]), REQUESTED);

    expect(view.summary).toBeNull();
    expect(view.failed).toHaveLength(3);
  });
});

describe('toBatchResultView — 되짚을 수 없는 위치 번호', () => {
  it('보낸 건수보다 큰 번호가 와도 그 항목을 버리지 않는다', () => {
    // 목 서버가 실제로 범위 밖 번호를 내려준다. 삼키면 실패한 건이 사용자에게 보이지 않는다.
    const view = toBatchResultView(result(1, [failure(1)]), [REQUESTED[0]!]);

    expect(view.failed).toHaveLength(1);
    expect(view.failed[0]?.label).toBe('어느 건인지 알 수 없습니다.');
  });

  it('음수 번호도 같게 다룬다', () => {
    const view = toBatchResultView(result(0, [failure(-1)]), REQUESTED);

    expect(view.failed[0]?.label).toBe('어느 건인지 알 수 없습니다.');
  });

  it('되짚지 못해도 사유는 그대로 낸다', () => {
    const view = toBatchResultView(result(0, [failure(9, ['상태가 맞지 않습니다'])]), REQUESTED);

    expect(view.failed[0]?.reasons).toEqual(['상태가 맞지 않습니다']);
  });
});

describe('toBatchResultView — 사유', () => {
  it('서버 사유를 그대로 나열한다', () => {
    const view = toBatchResultView(result(0, [failure(0, ['사유 하나', '사유 둘'])]), REQUESTED);

    expect(view.failed[0]?.reasons).toEqual(['사유 하나', '사유 둘']);
  });

  it('사유가 비어 있으면 받지 못했다고 밝힌다 — 빈 줄을 남기지 않는다', () => {
    const view = toBatchResultView(result(0, [{ index: 0, errors: [] }]), REQUESTED);

    expect(view.failed[0]?.reasons).toEqual(['사유를 받지 못했습니다.']);
  });

  it('사유 문구가 빈 문자열뿐이어도 같게 다룬다', () => {
    const view = toBatchResultView(result(0, [failure(0, ['', ''])]), REQUESTED);

    expect(view.failed[0]?.reasons).toEqual(['사유를 받지 못했습니다.']);
  });
});
