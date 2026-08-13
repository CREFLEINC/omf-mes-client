import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PostResultPane, type PostedIssueSummary } from './post-result-pane';

const t = messages.disposalIssue;

const POSTED: PostedIssueSummary = {
  goodsIssueNo: 'GI-2026-950001',
  statusCode: 'SAMPLE_GI_STATUS_A',
  erpMessageQueued: true,
};

const renderPane = (overrides: Partial<PostedIssueSummary> = {}): HTMLElement => {
  render(<PostResultPane issue={{ ...POSTED, ...overrides }} />);

  return screen.getByRole('region', { name: t.result.postLabel });
};

describe('PostResultPane — 서버가 되돌려 준 것만 말한다', () => {
  /** 무엇이 처리됐는지는 **업무 번호**로 말한다(`omf-mes#44`). */
  it('전표 번호와 함께 처리했다고 말한다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.postedTitle('GI-2026-950001'))).toBeVisible();
  });

  /**
   * **상태 코드를 그대로 낸다**(공유계약 G-2 · 계획 결정 15). 값 목록이 확정되지 않아 뜻을
   * 옮길 근거가 없고, 목은 전기 뒤에도 초안 상태를 그대로 준다(실측) — 값으로 완료를 말하면
   * **그 자리에서 거짓말**이 된다.
   */
  it('상태 코드를 서버 값 그대로 낸다', () => {
    const pane = renderPane({ statusCode: 'SAMPLE_GI_STATUS_Z' });

    expect(within(pane).getByText('SAMPLE_GI_STATUS_Z')).toBeVisible();
  });

  /**
   * **「대기열에 적재됨」이지 「전송됨」이 아니다**(계약이 못 박은 구분 · 완료 조건 C74).
   * 대기열에 들어간 것과 상대 시스템이 받은 것은 다른 사실이고, 뒤엣것은 이 화면이 알 수 없다.
   */
  it('ERP는 적재로 적고 전송으로 적지 않는다', () => {
    const pane = renderPane({ erpMessageQueued: true });

    expect(within(pane).getByText(t.values.erpQueued)).toBeVisible();
    expect(pane.textContent ?? '').not.toContain('전송');
  });

  it('적재되지 않았으면 그대로 적는다', () => {
    const pane = renderPane({ erpMessageQueued: false });

    expect(within(pane).getByText(t.values.erpNotQueued)).toBeVisible();
  });

  /** 값이 **오지 않는 갈래**를 따로 둔다 — 「적재되지 않음」으로 적으면 확인하지 않은 것을 말한다. */
  it('값이 오지 않았으면 모른다고 적는다', () => {
    const pane = renderPane({ erpMessageQueued: null });

    expect(within(pane).getByText(t.values.erpUnknown)).toBeVisible();
    expect(within(pane).queryByText(t.values.erpNotQueued)).not.toBeInTheDocument();
  });

  /**
   * **화면이 센 줄 수를 적지 않는다**(계획 결정 15). 전기 응답에 라인이 없어(계약 실측) 셀
   * 근거가 없고, 세어 적으면 서버가 무엇을 반영했는지가 아니라 화면이 무엇을 보고 있었는지를
   * 말하는 것이 된다.
   */
  it('줄 수를 세지 않고 어디서 확인하는지 적는다', () => {
    const pane = renderPane();

    expect(within(pane).getByText(t.result.postedNoLines)).toBeVisible();
    expect(within(pane).queryByText(t.result.lineCount(2))).not.toBeInTheDocument();
  });

  /** 내부 번호가 새지 않는다. 짝으로 업무 번호는 실제로 보인다. */
  it('내부 번호를 내지 않는다', () => {
    const pane = renderPane();

    expect(pane.textContent ?? '').toContain('GI-2026-950001');
    expect(pane.textContent ?? '').not.toContain('9501');
  });
});
