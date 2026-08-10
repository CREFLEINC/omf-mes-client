import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultPane, type LotStatusState } from './result-pane';
import type { GoodsReceiptResultView } from './types';

const t = messages.goodsReceipt;

const RESULT: GoodsReceiptResultView = {
  goodsReceiptNo: 'GR-2026-800001',
  statusCode: 'SAMPLE_GR_STATUS_A',
  sourceDocumentTypeCode: 'SAMPLE_SOURCE_TYPE_A',
  erpMessageQueued: true,
  lineCount: 1,
  ledgerLineCount: 1,
};

/** 결과 구획 어디에도 나와서는 안 되는 내부 번호. 픽스처의 대역을 그대로 쓴다. */
const INTERNAL_IDS = ['9901', '9902', '9903', '9601', '9701', '9802', '9001', '9401'];

const renderPane = (
  overrides: Partial<GoodsReceiptResultView> = {},
  lotStatus: LotStatusState = { kind: 'known', statusCode: 'SAMPLE_LOT_STATUS_A' },
) =>
  render(
    <ResultPane
      result={{ ...RESULT, ...overrides }}
      sourceInboundReceiptNo="IR-2026-900001"
      lotStatus={lotStatus}
    />,
  );

const paneText = (): string =>
  screen.getByRole('status', { name: t.result.label }).textContent ?? '';

describe('ResultPane — 만들어진 전표', () => {
  it('입고번호와 상태 코드를 그대로 낸다', () => {
    renderPane();

    expect(screen.getByText('GR-2026-800001')).toBeInTheDocument();
    expect(screen.getByText('SAMPLE_GR_STATUS_A')).toBeInTheDocument();
  });

  /*
   * **M41** — 내부 번호를 낼 자리가 타입에 없다. 이 단언은 그 사실이 부품에서도
   * 지켜지는지를 본다(짝 방향으로 업무 번호는 실제로 보인다).
   */
  it('결과 어디에도 내부 번호가 없다', () => {
    renderPane();

    expect(screen.getByText('GR-2026-800001')).toBeInTheDocument();
    for (const id of INTERNAL_IDS) {
      expect(paneText()).not.toContain(id);
    }
  });
});

describe('ResultPane — 자재 LOT 상태', () => {
  /*
   * 입고 응답에는 LOT 상태가 없다 — 다시 조회한 값이라는 사실을 밝히지 않으면 사용자가
   * 응답이 알려 준 값으로 읽는다.
   */
  it('다시 조회한 값이라는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.result.lotStatusNote)).toBeInTheDocument();
  });

  /* **M39** — 값으로 분기하면 값 집합이 정해질 때 조용히 틀린다(공유계약 G-2). */
  it('받은 상태 코드를 해석하지 않고 그대로 낸다', () => {
    renderPane({}, { kind: 'known', statusCode: 'SAMPLE_LOT_STATUS_B' });

    expect(screen.getByText('SAMPLE_LOT_STATUS_B')).toBeInTheDocument();
  });

  it('다시 조회하는 동안과 실패했을 때가 서로 다른 문구다', () => {
    const { unmount } = renderPane({}, { kind: 'loading' });

    expect(screen.getByText(t.result.lotStatusLoading)).toBeInTheDocument();
    unmount();

    renderPane({}, { kind: 'failed' });

    expect(screen.getByText(t.result.lotStatusFailed)).toBeInTheDocument();
    expect(screen.queryByText(t.result.lotStatusLoading)).not.toBeInTheDocument();
  });
});

describe('ResultPane — 수불 원장', () => {
  /* **M40** — 번호를 렌더하면 낼 것이 없는데 낼 수 있게 된다(#44). */
  it('전 줄에 원장이 생기면 그 사실만 낸다', () => {
    renderPane();

    expect(screen.getByText(t.result.ledgerAll)).toBeInTheDocument();
    expect(paneText()).not.toContain('9903');
  });

  it('원장 라인이 오지 않으면 그 사실을 따로 말한다', () => {
    renderPane({ ledgerLineCount: 0 });

    expect(screen.getByText(t.result.ledgerNone)).toBeInTheDocument();
    expect(screen.queryByText(t.result.ledgerAll)).not.toBeInTheDocument();
  });

  it('일부 줄에만 있으면 또 다른 문구를 낸다', () => {
    renderPane({ lineCount: 2, ledgerLineCount: 1 });

    expect(screen.getByText(t.result.ledgerSome)).toBeInTheDocument();
  });

  /* 라인이 0줄이면 「전 줄에 생겼다」가 아니라 「오지 않았다」다. */
  it('라인이 없으면 전 줄에 생겼다고 말하지 않는다', () => {
    renderPane({ lineCount: 0, ledgerLineCount: 0 });

    expect(screen.getByText(t.result.ledgerNone)).toBeInTheDocument();
  });
});

describe('ResultPane — 확인하지 않은 것', () => {
  /* 말하지 않으면 사용자가 「다 확인됐다」로 읽는다. */
  it('잔액을 이 화면이 확인하지 않는다는 사실을 밝힌다', () => {
    renderPane();

    expect(screen.getByText(t.result.balanceNote)).toBeInTheDocument();
  });
});

describe('ResultPane — ERP 송신 적재', () => {
  /* **M36** — 참·거짓·없음이 서로 다른 문구여야 한다. */
  it('적재됨·적재되지 않음·알 수 없음이 서로 다른 문구다', () => {
    const { unmount } = renderPane({ erpMessageQueued: true });

    expect(screen.getByText(t.result.erpQueued)).toBeInTheDocument();
    unmount();

    const second = renderPane({ erpMessageQueued: false });

    expect(screen.getByText(t.result.erpNotQueued)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpQueued)).not.toBeInTheDocument();
    second.unmount();

    renderPane({ erpMessageQueued: undefined });

    expect(screen.getByText(t.result.erpUnknown)).toBeInTheDocument();
    expect(screen.queryByText(t.result.erpQueued)).not.toBeInTheDocument();
  });

  /* **M37** — 이슈 §6의 ⭐. 세 갈래 어디에도 그 낱말이 없어야 한다. */
  it('어느 갈래에도 「전송 완료」가 없다', () => {
    for (const queued of [true, false, undefined]) {
      const { unmount } = renderPane({ erpMessageQueued: queued });

      expect(paneText()).not.toContain('전송 완료');
      unmount();
    }
  });
});

describe('ResultPane — 원천 문서', () => {
  /* 원천 식별자는 내부 번호다 — 대신 이 화면이 고른 입하번호를 낸다. */
  it('유형 코드와 입하번호만 보인다', () => {
    renderPane();

    expect(
      screen.getByText(t.result.sourceDocumentPair('SAMPLE_SOURCE_TYPE_A', 'IR-2026-900001')),
    ).toBeInTheDocument();
  });

  /*
   * **M53** — 링크로 두면 없는 화면으로 가는 경로가 생기고, 감추면 왜 못 가는지 읽을 수 없다.
   */
  it('원천 문서 보기가 비활성이고 사유가 이어진다', () => {
    renderPane();

    const button = screen.getByRole('button', { name: t.actions.viewSourceDocument });

    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(t.actionReasons.sourceDocumentUnavailable);
  });

  it('결과 구획에 이동할 링크가 하나도 없다', () => {
    renderPane();

    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});
