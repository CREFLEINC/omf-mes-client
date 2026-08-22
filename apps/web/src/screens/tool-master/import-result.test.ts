import { messages } from '@omf-mes/i18n';
import { describe, expect, it } from 'vitest';

import {
  dataRowNumber,
  failureKey,
  failureReason,
  resultSummary,
  type BatchFailure,
} from './import-result';

const t = messages.toolMaster.import;

const failure = (overrides: Partial<BatchFailure> = {}): BatchFailure => ({
  index: 0,
  errors: [{ scope: 'field', field: 'moldCode', code: 'DUP', message: '이미 쓰는 코드입니다.' }],
  ...overrides,
});

describe('dataRowNumber', () => {
  /*
   * ⭐ 계약은 「머리글 제외 **0부터**」이고 사람이 세는 것은 1부터다.
   * 옮기지 않으면 첫 줄이 「0번째 줄」이 되어 사용자가 어느 줄인지 못 찾는다.
   */
  it('0부터 세는 순번을 1부터 세는 줄 번호로 옮긴다', () => {
    expect(dataRowNumber(0)).toBe(1);
    expect(dataRowNumber(4)).toBe(5);
  });

  /*
   * ⛔ **엑셀 행 번호로 옮기지 않는다.** 머리글이 몇 줄인지 화면이 알 수 없어
   * `index + 2` 로 적으면 머리글이 두 줄인 파일에서 거짓이 된다.
   */
  it('머리글을 가정해 두 칸 밀지 않는다', () => {
    expect(dataRowNumber(0)).not.toBe(2);
  });
});

describe('failureReason', () => {
  it('사유 여럿을 한 줄로 잇는다', () => {
    const reason = failureReason(
      failure({
        errors: [
          { scope: 'field', field: 'moldCode', code: 'A', message: '코드가 비었습니다.' },
          { scope: 'field', field: 'moldName', code: 'B', message: '이름이 비었습니다.' },
        ],
      }),
    );

    expect(reason).toBe('코드가 비었습니다. 이름이 비었습니다.');
  });

  /*
   * ⛔ **잇기 전에 거른다.** 빈 문구를 이어 붙이면 이음쇠 한 칸만 남은 사유가 생긴다 —
   * 사용자는 무엇이 잘못됐는지 아무것도 얻지 못한다(client#192 와 같은 갈래).
   */
  it('빈 문구를 이어 붙이지 않는다', () => {
    const reason = failureReason(
      failure({
        errors: [
          { scope: 'field', field: 'moldCode', code: 'A', message: '   ' },
          { scope: 'field', field: 'moldName', code: 'B', message: '이름이 비었습니다.' },
        ],
      }),
    );

    expect(reason).toBe('이름이 비었습니다.');
  });

  it('쓸 수 있는 문구가 하나도 없으면 빈 글자다', () => {
    expect(
      failureReason(
        failure({ errors: [{ scope: 'field', field: 'moldCode', code: 'A', message: '' }] }),
      ),
    ).toBe('');
  });
});

describe('failureKey', () => {
  it('식별값이 오면 그대로 보인다', () => {
    expect(failureKey(failure({ key: 'TL-90' }))).toBe('TL-90');
  });

  /* ⛔ 없는 것을 지어내지 않는다 — 「없다」는 사실을 말한다(G-9). */
  it.each([undefined, '', '   '])('식별값이 %s 면 없다고 말한다', (key) => {
    expect(failureKey(failure({ key }))).toBe(t.keyUnknown);
  });
});

describe('resultSummary', () => {
  /*
   * ⭐ **성공과 실패를 둘 다 말한다.** 성공만 말하면 실패한 행이 없는 것처럼 읽히고,
   * 실패만 말하면 이미 들어간 행을 모르고 파일을 통째로 다시 올린다 —
   * 되돌리지 않는 경로라 그 오해가 곧 중복 등록이다.
   */
  it('성공과 실패를 함께 말한다', () => {
    expect(resultSummary({ succeeded: 3, failed: [failure()] })).toEqual([
      t.succeeded(3),
      t.failed(1),
    ]);
  });

  it('실패가 없으면 그 사실을 말한다', () => {
    expect(resultSummary({ succeeded: 3, failed: [] })).toEqual([t.succeeded(3), t.allSucceeded]);
  });

  /* 「0건을 등록했습니다」는 읽기 어렵다 — 아무것도 안 들어갔다는 사실을 곧바로 말한다. */
  it('아무것도 안 들어갔으면 그 사실을 말한다', () => {
    expect(resultSummary({ succeeded: 0, failed: [failure()] })).toEqual([
      t.noneSucceeded,
      t.failed(1),
    ]);
  });

  it('두 줄이 언제나 선다', () => {
    expect(resultSummary({ succeeded: 0, failed: [] })).toHaveLength(2);
  });
});
