import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CancelResultPane } from './cancel-result-pane';
import type { CancelExecutionView } from './types';

const t = messages.documentProgress;

const REVERSED: CancelExecutionView = {
  statusCode: 'SYN_STATUS_CANCELLED',
  reversed: true,
  reversalTransactionNo: 'SYN-TX-9501',
  reversalBusinessDate: '2026-08-07',
};

const renderPane = (overrides: Partial<CancelExecutionView> = {}) =>
  render(<CancelResultPane result={{ ...REVERSED, ...overrides }} />);

describe('CancelResultPane — reversed가 두 문면을 가른다 · C4-12', () => {
  it('참이면 원장에 역트랜잭션이 생겼다고 말한다', () => {
    renderPane();

    expect(screen.getByText(t.executionResult.reversedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.executionResult.notReversedTitle)).not.toBeInTheDocument();
  });

  it('거짓이면 원장에 아무것도 생기지 않았다고 말한다', () => {
    renderPane({ reversed: false, reversalTransactionNo: null, reversalBusinessDate: null });

    expect(screen.getByText(t.executionResult.notReversedTitle)).toBeInTheDocument();
    expect(screen.queryByText(t.executionResult.reversedTitle)).not.toBeInTheDocument();
  });

  /**
   * ⭐ **번호와 영업일이 함께 선다.** 원장 조회는 영업일이 키의 일부라(계약 경로) 번호만 내면
   * 사용자가 그 번호로 원장을 **찾을 수 없는데 찾을 수 있는 것처럼** 보인다.
   */
  it('참이면 역트랜잭션 번호와 영업일이 함께 보인다', () => {
    renderPane();

    expect(screen.getByText(t.ledger.pair('SYN-TX-9501', '2026-08-07'))).toBeInTheDocument();
  });

  /**
   * 계약이 두 필드를 **둘 다 선택**으로 두어 반쪽으로 오는 갈래가 실재한다. 짝 판정은 처리
   * 경과의 원장 칸과 **같은 한 곳**(`ledger-ref.ts`)이 하며, 없는 쪽을 말한다.
   */
  it('영업일만 빠지면 원장을 찾을 수 없다고 말한다', () => {
    renderPane({ reversalBusinessDate: null });

    expect(screen.getByText(t.ledger.noBusinessDate('SYN-TX-9501'))).toBeInTheDocument();
  });

  it('번호만 빠지면 그 사실을 말한다', () => {
    renderPane({ reversalTransactionNo: null });

    expect(screen.getByText(t.ledger.noTransactionNo('2026-08-07'))).toBeInTheDocument();
  });

  /**
   * ⚠ **역트랜잭션이 생겼다는데 두 값이 다 비어 온 갈래.** 계약이 둘 다 선택으로 두었으므로
   * 실재하며, 값 없음 표식이 서고 **번호를 지어내지 않는다.**
   */
  it('둘 다 없으면 값 없음 표식이 선다', () => {
    renderPane({ reversalTransactionNo: null, reversalBusinessDate: null });

    expect(screen.getByText(t.values.empty)).toBeInTheDocument();
  });

  /**
   * ⛔ **거짓일 때 원장 칸 자체를 두지 않는다.** 전기 전 취소라 원장에 생긴 것이 없는데 빈 칸을
   * 두면 「받지 못했다」로 읽힌다 — 없는 것과 못 받은 것은 다른 사실이다.
   */
  it('거짓이면 원장 칸이 서지 않는다', () => {
    renderPane({ reversed: false, reversalTransactionNo: null, reversalBusinessDate: null });

    expect(screen.queryByText(t.executionResult.ledger)).not.toBeInTheDocument();
    expect(screen.getByText(t.executionResult.notReversedDescription)).toBeInTheDocument();
  });

  /** 상태 코드를 **그대로** 낸다 — 값 목록이 공통코드 소관이라 화면이 뜻을 붙이면 조용히 틀린다. */
  it('문서 상태 코드를 그대로 낸다', () => {
    renderPane({ statusCode: 'SYN_STATUS_OTHER' });

    expect(screen.getByText('SYN_STATUS_OTHER')).toBeInTheDocument();
  });

  /** 구획에 이름이 있어야 보조기술이 「이것이 실행 결과」임을 읽는다. */
  it('구획에 이름이 있다', () => {
    renderPane();

    expect(screen.getByRole('group', { name: t.executionResult.label })).toBeInTheDocument();
  });
});
