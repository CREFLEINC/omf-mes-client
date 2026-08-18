import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultPane } from './result-pane';
import type { CreatedAdjustmentView } from './types';

const t = messages.stockAdjust;

const CREATED: CreatedAdjustmentView = {
  inventoryAdjustmentNo: 'SAMPLE-IA-9301',
  statusCode: 'SAMPLE_IA_STATUS_A',
  erpMessageQueued: true,
  lineCount: 2,
};

const renderPane = (overrides: Partial<CreatedAdjustmentView> = {}) => {
  render(<ResultPane created={{ ...CREATED, ...overrides }} />);

  return screen.getByRole('region', { name: t.result.label });
};

describe('ResultPane — 화면이 확인한 것만 말한다', () => {
  /** 전표번호는 **적어 두거나 옮겨 적는 값**이라 사라지는 알림으로 내지 않는다. */
  it('전표번호가 제목과 값 자리에 남는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.createdTitle('SAMPLE-IA-9301'))).toBeVisible();
    expect(within(pane).getByText(t.result.inventoryAdjustmentNo)).toBeVisible();
  });

  /**
   * ⭐ **상태는 서버가 준 글자 그대로다**(C24 · 공유계약 G-2).
   *
   * 「등록됨」·「승인 대기」로 옮겨 적으면 화면이 값 목록을 아는 척하게 되는데, 그 목록은 아직
   * 확정되지 않았다.
   */
  it('상태 코드를 서버가 준 그대로 낸다', () => {
    const pane = renderPane({ statusCode: 'SAMPLE_IA_STATUS_B' });

    expect(within(pane).getByText('SAMPLE_IA_STATUS_B')).toBeVisible();
  });

  /** 지금 상태의 정본이 이 화면이 아니라는 사실을 함께 적는다. */
  it('등록 시점의 값이라는 사실을 적는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.statusNote)).toBeVisible();
  });

  /** **서버가 저장한 줄 수**를 말한다 — 화면이 보낸 줄 수가 아니다. */
  it('서버가 저장한 줄 수를 낸다', () => {
    const pane = renderPane({ lineCount: 3 });

    expect(within(pane).getByText(t.result.lineCount(3))).toBeVisible();
  });

  /** 등록은 전기가 아니다 — 재고가 아직 움직이지 않았다는 사실을 결과 구획도 말한다. */
  it('재고가 아직 움직이지 않았다는 사실을 적는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.createdDescription)).toBeVisible();
  });

  /** **내부 번호를 내지 않는다**(`omf-mes#44`). 짝으로 업무 번호는 실제로 보인다. */
  it('내부 번호가 구획에 없다', () => {
    const pane = renderPane();

    expect(within(pane).getByText('SAMPLE-IA-9301')).toBeVisible();
    expect(pane.textContent ?? '').not.toContain('9301,');
    expect(pane.textContent ?? '').not.toMatch(/(^|[^-])\b9301\b/);
  });
});

/**
 * ⭐ **ERP 적재 여부는 세 갈래다**(C23 · D-11).
 *
 * 계약이 이 필드를 **선택**으로 두어 오지 않는 갈래가 실재한다 — 없음을 거짓으로 접으면
 * 아무 근거 없이 「대기열에 오르지 않았다」로 읽힌다.
 */
describe('ResultPane — ERP 송신 세 갈래', () => {
  it('참이면 대기열에 올랐다고 말한다', () => {
    const pane = renderPane({ erpMessageQueued: true });

    expect(within(pane).getByText(t.result.erpQueued)).toBeVisible();
  });

  it('거짓이면 대기열에 오르지 않았다고 말한다', () => {
    const pane = renderPane({ erpMessageQueued: false });

    expect(within(pane).getByText(t.result.erpNotQueued)).toBeVisible();
  });

  it('값이 오지 않으면 알 수 없다고 말한다 — 거짓으로 접지 않는다', () => {
    const pane = renderPane({ erpMessageQueued: null });

    expect(within(pane).getByText(t.result.erpUnknown)).toBeVisible();
    expect(within(pane).queryByText(t.result.erpNotQueued)).not.toBeInTheDocument();
  });

  /** **적재는 전송이 아니다**(계약 문면). 어느 갈래에도 「전송 완료」라는 낱말을 쓰지 않는다. */
  it('적재가 전송 완료가 아니라는 사실을 적는다', () => {
    const pane = renderPane({ erpMessageQueued: true });

    expect(within(pane).getByText(t.result.erpNote)).toBeVisible();
  });
});

/**
 * **여기 없는 것** — 이 회차의 결과 구획은 상신·전기를 그리지 않는다.
 *
 * 목이 등록 응답에 승인 요청 번호와 전기 시각을 채워 주지만(계약 예시값), 그것은 **화면이
 * 확인한 사실이 아니다** — 이 화면은 등록 요청 하나를 보냈을 뿐이다.
 */
describe('ResultPane — 여기 없는 것', () => {
  it('버튼이 하나도 없다', () => {
    const pane = renderPane();

    /* 짝 양성 — 구획은 실제로 그려졌다. */
    expect(within(pane).getByText(t.result.inventoryAdjustmentNo)).toBeVisible();
    expect(within(pane).queryAllByRole('button')).toHaveLength(0);
  });

  it('입력칸이 하나도 없다', () => {
    const pane = renderPane();

    expect(within(pane).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(pane).queryAllByRole('combobox')).toHaveLength(0);
  });
});
