import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BlockedExecutionPane } from './blocked-execution-pane';
import { documentSuccessor, documentSuccessorFixtures } from './fixtures';

const t = messages.documentProgress;

const renderPane = (successors = documentSuccessorFixtures) =>
  render(<BlockedExecutionPane successors={successors} />);

describe('BlockedExecutionPane — 승인은 유효하다 · C4-13', () => {
  /**
   * ⭐ **승인이 무산된 것이 아니다**(계약 · 공유계약 J-8). 막힌 것은 실행이고 요청은 살아 있다 —
   * 이 문장이 없으면 사용자는 요청이 사라진 줄 알고 처음부터 다시 올린다.
   */
  it('승인은 유효하지만 지금은 실행할 수 없다고 말한다', () => {
    renderPane();

    expect(screen.getByText(t.blockedExecution.title)).toBeInTheDocument();
    expect(screen.getByText(t.blockedExecution.description)).toBeInTheDocument();
  });

  /** 무엇을 하면 풀리는지 말한다 — 할 일은 하나뿐이다: 후속을 먼저 취소한다. */
  it('후속을 먼저 취소해야 한다고 말한다', () => {
    renderPane();

    expect(screen.getByText(t.blockedExecution.description).textContent ?? '').toContain(
      '후속을 먼저 취소',
    );
  });

  /**
   * ⛔ **「다시 요청하세요」류 권유가 없다**(계획 §3 ⓔ). 화면이 새 요청을 권하면 사용자가 **같은
   * 승인을 두 번** 받게 되고, 그 사이 원본 요청은 진행 중인 채 남는다.
   *
   * **구획 전체 글자를 훑는다** — 문면 하나만 견주면 다른 줄에 권유가 붙어도 통과한다.
   */
  it('새 요청을 다시 올리라고 권하지 않는다', () => {
    const { container } = renderPane();

    const text = container.textContent ?? '';

    for (const forbidden of ['다시 요청', '다시 올리', '재요청', '새로 요청']) {
      expect(text).not.toContain(forbidden);
    }
  });

  /**
   * ⭐ **「승인」이라는 낱말이 이 자리에서만 참이다.** 취소 **요청**이 막힌 400에는 승인이 아직
   * 없어 같은 문면을 쓰면 거짓이 된다(C3-11) — 두 문면이 실제로 다른 문자열인지 잰다.
   */
  it('취소 요청 쪽 후속 문면과 다른 문자열이다', () => {
    expect(t.blockedExecution.title).not.toBe(t.cancelRequest.successorBlocked);
    expect(t.cancelRequest.successorBlocked).not.toContain('승인');
    expect(t.blockedExecution.title).toContain('승인');
  });
});

describe('BlockedExecutionPane — 걸린 후속을 보인다', () => {
  /**
   * 위 후속 목록 표는 화면 위쪽이라, 실패한 자리에서 「무엇이 걸렸는지」를 보려면 되돌아가
   * 찾아야 한다. 걸린 문서번호를 이 자리에 한 줄씩 적는다.
   */
  it('다시 부른 후속의 문서번호가 보인다', () => {
    renderPane();

    for (const successor of documentSuccessorFixtures) {
      expect(
        screen.getByText(
          t.blockedExecution.successorLine(successor.successorNo, successor.successorTypeCode),
        ),
      ).toBeInTheDocument();
    }
  });

  /** 넘겨받은 배열 그대로다 — 화면이 세거나 걸러내지 않는다(유형↔후속 관계표 금지). */
  it('넘겨받은 배열만 보인다', () => {
    renderPane([documentSuccessor({ successorId: 9109, successorNo: 'SYN-GI-2026-0109' })]);

    expect(screen.getByText(/SYN-GI-2026-0109/)).toBeInTheDocument();
    expect(screen.queryByText(/SYN-GI-2026-0101/)).not.toBeInTheDocument();
  });

  /** 내부 번호가 화면에 나오지 않는다(omf-mes#44) — React key로만 쓰인다. */
  it('후속의 내부 번호가 화면에 나오지 않는다', () => {
    const { container } = renderPane();

    expect(container.textContent ?? '').not.toContain('9101');
  });

  /**
   * ⚠ **두 조회의 시점이 달라 어긋나는 갈래가 실재한다.** 서버는 후속 때문이라 했는데 다시 부른
   * 목록에는 아직 없을 수 있다 — 목록을 지어내지 않고 **어긋났다는 사실 자체를** 적는다.
   */
  it('다시 부른 목록이 비면 그 사실을 말한다', () => {
    renderPane([]);

    expect(screen.getByText(t.blockedExecution.successorsEmpty)).toBeInTheDocument();
    expect(screen.queryByText(t.blockedExecution.successorsLabel)).not.toBeInTheDocument();
  });

  /** 짝 방향 — 값이 있으면 목록 이름이 서고 어긋남 문면은 서지 않는다. */
  it('값이 있으면 어긋남 문면이 서지 않는다', () => {
    renderPane();

    expect(screen.getByText(t.blockedExecution.successorsLabel)).toBeInTheDocument();
    expect(screen.queryByText(t.blockedExecution.successorsEmpty)).not.toBeInTheDocument();
  });
});
