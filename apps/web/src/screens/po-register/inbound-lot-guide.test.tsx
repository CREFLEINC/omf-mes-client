import { messages } from '@omf-mes/i18n';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { toWebAccess } from '../../patterns/web-access';
import { createdPoView } from './fixtures';
import { INBOUND_WORK_RECORD_PATH, ResultPane } from './result-pane';
import { ScopeBanner } from './scope-banner';

const t = messages.poRegister;

const renderPane = (canOpenWorkRecord: boolean) =>
  render(
    <MemoryRouter>
      <ResultPane
        created={createdPoView()}
        phase="idle"
        reason=""
        blockReason={null}
        banner={null}
        onChangeReason={() => undefined}
        onRequestSubmit={() => undefined}
        canOpenWorkRecord={canOpenWorkRecord}
      />
    </MemoryRouter>,
  );

const pane = (): HTMLElement => screen.getByRole('region', { name: t.result.label });

describe('W-01-11 등록 결과 — 새 흐름 입하 안내(005)', () => {
  it('R7-2 W-01-16 을 볼 수 있으면 「P/O 없음은 W-01-16 에서 배정」 안내와 입하/입고 작업 기록 링크가 선다', () => {
    renderPane(true);

    expect(within(pane()).getByText(t.result.inboundLotGuide)).toBeVisible();
    expect(
      within(pane()).getByRole('link', { name: t.result.inboundLotGuideLink }),
    ).toHaveAttribute('href', '/logistics/inbound-work-record');
  });

  it('R7-2 W-01-16 을 볼 수 없으면 안내 문구만 서고 링크는 없다', () => {
    renderPane(false);

    expect(within(pane()).getByText(t.result.inboundLotGuide)).toBeVisible();
    expect(within(pane()).queryByRole('link')).toBeNull();
  });

  it('R7-2 링크 판정은 세션 권한 W-01-16 이다 — W-01-11 만 있으면 링크 없음', () => {
    expect(INBOUND_WORK_RECORD_PATH).toBe('/logistics/inbound-work-record');
    expect(toWebAccess(['W-01-11']).allows(INBOUND_WORK_RECORD_PATH)).toBe(false);
    expect(toWebAccess(['W-01-11', 'W-01-16']).allows(INBOUND_WORK_RECORD_PATH)).toBe(true);
  });

  it('R7-2 초과분 원천이 있는 등록 결과(이전 데이터)는 그대로 — 전표 · 승인 요청이 안내와 함께 남는다', () => {
    renderPane(true);

    expect(screen.getByText(t.result.createdTitle('SAMPLE-PO-9001'))).toBeVisible();
    expect(within(pane()).getByRole('button', { name: t.actions.requestApproval })).toBeEnabled();
  });

  it('R7-2 범위 안내 띠가 초과분 원천은 이 기능 전 입하만이라고 말한다', () => {
    render(<ScopeBanner />);

    expect(screen.getByText(t.scope.description)).toBeVisible();
    expect(screen.getByText(t.scope.legacyOnly)).toBeVisible();
  });
});
