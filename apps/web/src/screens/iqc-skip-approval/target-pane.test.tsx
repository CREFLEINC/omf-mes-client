import { messages } from '@omf-mes/i18n';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MAPPED_SCREEN_PATH, targetFixtures } from './fixtures';
import { TargetPane } from './target-pane';
import {
  describeTargetName,
  isInboundLotReceiving,
  skipExecuteTargetOf,
  targetInboundLotOf,
} from './target';

const t = messages.iqcSkipApproval;

const renderPane = (
  props: Partial<Parameters<typeof TargetPane>[0]> = {},
): { onOpen: ReturnType<typeof vi.fn> } => {
  const onOpen = vi.fn();

  render(
    <TargetPane
      name={describeTargetName(targetFixtures.mapped)}
      openState={{ kind: 'open', path: MAPPED_SCREEN_PATH }}
      onOpen={onOpen}
      {...props}
    />,
  );

  return { onOpen };
};

describe('TargetPane — 표시명', () => {
  /** **서버가 만든 이름 그대로다.** 화면이 유형을 보고 이름을 지어내면 그것이 금지된 매핑표다. */
  it('표시명이 그대로 선다', () => {
    renderPane();

    expect(screen.getByText('합성 대상 문서 가')).toBeVisible();
  });

  it('표시명이 비어 오면 그 사실이 서고 번호도 유형 코드도 서지 않는다', () => {
    renderPane({ name: describeTargetName(targetFixtures.nameless) });

    /* 짝 방향 — 대체 문구가 실제로 보인다. */
    expect(screen.getByText(t.values.unknownTarget)).toBeVisible();
    expect(screen.queryByText(String(targetFixtures.nameless.targetId))).not.toBeInTheDocument();
    expect(screen.queryByText(targetFixtures.nameless.targetTypeCode)).not.toBeInTheDocument();
  });

  /**
   * **유형 코드를 받지 않는다.** 이 부품은 이름 하나와 판정 하나만 받으므로 유형으로 갈릴
   * 수단 자체가 없다 — 소품에 유형이 생기는 순간 그것으로 갈리는 코드를 쓸 수 있게 된다.
   */
  it('대상 유형 코드가 화면 어디에도 없다', () => {
    const { container } = render(
      <TargetPane
        name={describeTargetName(targetFixtures.mapped)}
        openState={{ kind: 'noScreenId' }}
        onOpen={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain(targetFixtures.mapped.targetTypeCode);
    expect(container.textContent).not.toContain(String(targetFixtures.mapped.targetId));
  });

  /** 이 구획이 **무엇을 하지 않는지** 밝힌다 — 여기서 문서를 읽을 수 있다고 오해하지 않게. */
  it('내용은 원 화면에서 본다는 사실이 서 있다', () => {
    renderPane();

    expect(screen.getByText(t.target.note)).toBeVisible();
  });
});

describe('TargetPane — 열기', () => {
  it('열 수 있으면 버튼이 살아 있고 누르면 그 경로를 넘긴다', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPane();

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeEnabled();

    await user.click(open);

    expect(onOpen).toHaveBeenCalledWith(MAPPED_SCREEN_PATH);
  });

  it.each([
    ['notOpenable' as const, t.target.blockedNotOpenable],
    ['noScreenId' as const, t.target.blockedNoScreenId],
    ['unmapped' as const, t.target.blockedUnmapped],
  ])('%s이면 버튼이 잠기고 그 사유가 보인다', (kind, reason) => {
    renderPane({ openState: { kind } });

    const open = screen.getByRole('button', { name: t.target.open });

    expect(open).toBeDisabled();
    expect(screen.getByText(reason)).toBeVisible();
    expect(open.getAttribute('aria-describedby')).toBe(screen.getByText(reason).id);
  });

  /** 세 갈래가 **서로 다른 글자**여야 사용자가 할 조치가 갈린다. */
  it('세 잠금 사유가 서로 다르다', () => {
    const reasons = [
      t.target.blockedNotOpenable,
      t.target.blockedNoScreenId,
      t.target.blockedUnmapped,
    ];

    expect(new Set(reasons).size).toBe(3);
  });

  it('잠겨 있으면 눌러도 아무것도 넘기지 않는다', async () => {
    const user = userEvent.setup();
    const { onOpen } = renderPane({ openState: { kind: 'unmapped' } });

    await user.click(screen.getByRole('button', { name: t.target.open }));

    expect(onOpen).not.toHaveBeenCalled();
  });
});

describe('TargetPane — 입하 LOT(005 FR-032)', () => {
  it('R16-1 대상 LOT 의 입하 LOT 번호를 보인다 — 실행 전에는 LOT 수를 짓지 않는다', () => {
    renderPane({ inboundLot: { inboundLotNo: 'IL-261112-0009', lotCount: null } });

    expect(screen.getByText(t.fields.inboundLot)).toBeVisible();
    expect(screen.getByText('IL-261112-0009')).toBeVisible();
    expect(screen.queryByText(t.fields.lotCount)).not.toBeInTheDocument();
  });

  it('R16-1 실행 응답의 LOT 수를 보인다', () => {
    renderPane({ inboundLot: { inboundLotNo: 'IL-261112-0009', lotCount: 4 } });

    expect(screen.getByText(t.fields.lotCount)).toBeVisible();
    expect(screen.getByText(t.skipExecute.lotCountValue('4'))).toBeVisible();
  });

  it('R16-1 입하 LOT 을 모르면 칸을 세우지 않는다', () => {
    renderPane({ inboundLot: null });

    expect(screen.queryByText(t.fields.inboundLot)).not.toBeInTheDocument();
  });
});

describe('입하 LOT 판정(005 FR-032)', () => {
  it('R16-1 실행 응답이 대상 LOT 조회의 번호를 이긴다', () => {
    expect(
      targetInboundLotOf('IL-OLD-0001', { inboundLotNo: 'IL-261112-0009', lotCount: 4 }),
    ).toEqual({ inboundLotNo: 'IL-261112-0009', lotCount: 4 });
    expect(targetInboundLotOf('IL-261112-0009', null)).toEqual({
      inboundLotNo: 'IL-261112-0009',
      lotCount: null,
    });
    expect(targetInboundLotOf(null, null)).toBeNull();
  });

  it('R16-1 입하 중 409 는 안내 갈래로, 원인만 있는 충돌 409 · 다른 오류는 아니다', () => {
    expect(
      isInboundLotReceiving({
        kind: 'stateLocked',
        status: 409,
        errors: [{ scope: 'screen', code: 'STATE_LOCKED', message: '입하 중' }],
      }),
    ).toBe(true);
    expect(
      isInboundLotReceiving({ kind: 'conflict', status: 409, cause: 'user', message: '' }),
    ).toBe(false);
    expect(isInboundLotReceiving({ kind: 'validation', status: 400, errors: [] })).toBe(false);
    expect(isInboundLotReceiving({ kind: 'network' })).toBe(false);
    expect(isInboundLotReceiving(null)).toBe(false);
  });
});

describe('생략 실행 대상(005 FR-032 · targetLotId)', () => {
  const approved = (targetLotId?: number | null) => ({
    approvalTypeCode: 'IQC_SKIP',
    statusCode: 'APPROVED',
    target: { targetId: 7301, targetLotId },
  });

  it('R16-1 targetLotId 로 실행한다 — targetId(입하 LOT id)는 쓰지 않는다', () => {
    expect(skipExecuteTargetOf(approved(9411), 'IQC_SKIP')).toEqual({ kind: 'lot', lotId: 9411 });
  });

  it('R16-1 targetLotId 가 없으면 잠김', () => {
    expect(skipExecuteTargetOf(approved(null), 'IQC_SKIP')).toEqual({ kind: 'noLot' });
    expect(skipExecuteTargetOf(approved(), 'IQC_SKIP')).toEqual({ kind: 'noLot' });
  });

  it('R16-1 승인된 IQC 생략이 아니면 실행 구획이 없다', () => {
    expect(
      skipExecuteTargetOf({ ...approved(9411), statusCode: 'PENDING' }, 'IQC_SKIP'),
    ).toBeNull();
    expect(skipExecuteTargetOf(approved(9411), null)).toBeNull();
  });
});
