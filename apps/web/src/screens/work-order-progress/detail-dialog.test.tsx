import { messages } from '@omf-mes/i18n';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { DetailDialog, type DetailDialogProps } from './detail-dialog';
import type { WorkOrder } from './types';

const t = messages.workOrderProgress.detail;
const blank = messages.workOrderProgress.list.blank;

const workOrder = (overrides: Partial<WorkOrder> = {}): WorkOrder => ({
  workOrderId: 7001,
  workOrderNo: 'SYN-WO-0007',
  productionPlanId: 31,
  routingOperationId: 901,
  itemId: 5001,
  orderQty: 3000,
  uomId: 11,
  workOrderTypeCode: 'SYN_NORMAL',
  statusCode: 'SYN_RUN',
  priorityNo: 1,
  ...overrides,
});

/* 4M 변경 자재 투입 구획(omf-all-around#63)이 부르는 조회 — 이 시험들은 투입이 없는 W/O 를 본다. */
const EMPTY_PAGE = { items: [], page: { page: 1, size: 200, total: 0 } };
const stubFetch = createStubFetch([
  {
    match: (request) =>
      request.url.includes('/production/material-consumptions') ||
      request.url.includes('/mdm/code-values'),
    respond: () => jsonResponse(EMPTY_PAGE),
  },
]);

const renderDialog = (overrides: Partial<DetailDialogProps> = {}) => {
  const onClose = vi.fn();
  const onPrev = vi.fn();
  const onNext = vi.fn();

  renderWithProviders(
    <DetailDialog
      workOrder={workOrder()}
      isLoading={false}
      isError={false}
      isOpen
      itemLabel={(id) => `품목 ${id}`}
      statusLabel={(code) => `상태 ${code}`}
      lineLabel={(id) => `SYN-LINE-${id} · 라인 ${id}`}
      onPrev={onPrev}
      onNext={onNext}
      crew={{
        data: {
          sessions: [],
          workerResults: [],
          defectTypes: [],
          sessionsTruncated: false,
          resultsTruncated: false,
        },
        isLoading: false,
        isError: false,
      }}
      onClose={onClose}
      {...overrides}
    />,
    { fetch: stubFetch, session: null },
  );

  return { onClose, onPrev, onNext, user: userEvent.setup() };
};

const dialog = (): HTMLElement => screen.getByRole('dialog');

describe('DetailDialog', () => {
  it('고른 W/O 의 번호를 제목에 담는다 — 어느 것을 보고 있는지가 사실이다', () => {
    renderDialog();

    expect(dialog()).toHaveAccessibleName(expect.stringContaining('SYN-WO-0007'));
  });

  /* 「선택한」 같은 군말 없이 창의 종류와 번호만 적는다 — 번호가 굵은 글씨다. */
  it('제목은 「W/O 상세」 뒤에 번호를 굵게 적는다', () => {
    renderDialog();

    expect(dialog()).toHaveAccessibleName(`${t.title} SYN-WO-0007`);
    expect(within(dialog()).getByText('SYN-WO-0007').tagName).toBe('STRONG');
  });

  it('받는 중에는 창의 종류만 적는다', () => {
    renderDialog({ isOpen: true, workOrder: null, isLoading: true });

    expect(dialog()).toHaveAccessibleName(t.title);
  });

  /* 제목에 이미 있다 — 첫 칸에 한 번 더 적지 않는다. */
  it('W/O 번호는 제목에만 적는다', () => {
    renderDialog();

    expect(within(dialog()).getAllByText(/SYN-WO-0007/)).toHaveLength(1);
  });

  it('받은 값을 보인다', () => {
    renderDialog();
    const panel = dialog();

    expect(within(panel).getByText('상태 SYN_RUN')).toBeInTheDocument();
    expect(within(panel).getByText('품목 5001')).toBeInTheDocument();
    expect(within(panel).getByText('3,000')).toBeInTheDocument();
  });

  it('⛔ 식별자를 그대로 보이지 않고 이름으로 바꾼다', () => {
    renderDialog();

    expect(within(dialog()).queryByText('5001')).not.toBeInTheDocument();
  });

  describe('실적', () => {
    const progress = {
      goodQty: 1950,
      defectQty: 6,
      holdQty: 4,
      scrapQty: 0,
      achievementRate: 0.65,
      completionJudgmentCode: 'UNDER' as const,
      delayStatusCode: 'DELAYED' as const,
    };

    /* 목록의 그 줄과 같은 값이다 — 창을 열고도 양품 · 불량 · 달성률을 볼 수 있어야 한다. */
    it('양품 · 불량 · 달성률을 보인다', () => {
      renderDialog({ workOrder: workOrder({ progress }) });
      const panel = dialog();

      expect(within(panel).getByText('1,950')).toBeInTheDocument();
      expect(within(panel).getByText('6')).toBeInTheDocument();
      expect(within(panel).getByText('65%')).toBeInTheDocument();
      expect(within(panel).getByRole('progressbar', { name: t.achievementRate })).toHaveAttribute(
        'aria-valuenow',
        '65',
      );
    });

    it('보류 · 스크랩 · 재작업은 값이 있을 때만 연다', () => {
      renderDialog({ workOrder: workOrder({ progress }) });
      const panel = dialog();

      expect(within(panel).getByText(t.holdQty)).toBeInTheDocument();
      expect(within(panel).queryByText(t.scrapQty)).not.toBeInTheDocument();
      expect(within(panel).queryByText(t.reworkQty)).not.toBeInTheDocument();
    });

    it('지연이면 상태 칩 옆에 지연 칩을 둔다', () => {
      renderDialog({ workOrder: workOrder({ progress }) });

      expect(within(dialog()).getByText(messages.workOrderProgress.list.delayed)).toBeVisible();
    });

    it('정상이면 지연 칩을 두지 않는다', () => {
      renderDialog({
        workOrder: workOrder({ progress: { ...progress, delayStatusCode: 'ON_TIME' } }),
      });

      expect(
        within(dialog()).queryByText(messages.workOrderProgress.list.delayed),
      ).not.toBeInTheDocument();
    });

    /* ⛔ 실적 누계를 못 받은 것을 「0개 만듦」으로 그리지 않는다. */
    it('⛔ 실적 누계를 받지 못했으면 실적 줄을 그리지 않는다', () => {
      renderDialog();
      const panel = dialog();

      expect(within(panel).queryByText(t.achievementRate)).not.toBeInTheDocument();
      expect(within(panel).queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('공정 · 라인 · 설비 · P/O 를 보인다', () => {
    renderDialog({
      workOrder: workOrder({
        processName: '합성 공정',
        productionLineId: 7,
        plannedEquipmentName: '합성 설비',
        productionOrderNo: 'SYN-PO-0031',
      }),
    });
    const panel = dialog();

    expect(within(panel).getByText('합성 공정')).toBeInTheDocument();
    /* 표의 라인 열과 같이 이름만 적는다. */
    expect(within(panel).getByText('라인 7')).toBeInTheDocument();
    expect(within(panel).getByText('합성 설비')).toBeInTheDocument();
    expect(within(panel).getByText('SYN-PO-0031')).toBeInTheDocument();
  });

  /* 두 단 줄 목록이다 — 값이 없다고 줄을 빼면 두 단의 높이가 어긋난다. */
  it.each([
    ['공정', t.process],
    ['라인', t.productionLine],
    ['설비', t.equipment],
    ['P/O', t.productionOrder],
    ['계획 기간', t.plannedPeriod],
  ])('%s 값이 없어도 줄은 두고 「—」로 적는다', (_name, label) => {
    renderDialog();

    expect(within(dialog()).getByText(label).nextElementSibling).toHaveTextContent(
      new RegExp(`^${blank}$`),
    );
  });

  /* 맨 위 진행 상자와 같은 회색 상자를 하나 더 세우지 않는다 — 이름 · 값 줄 목록이다. */
  it('기본 정보는 상자가 아니라 이름 · 값 줄 목록이다', () => {
    renderDialog();
    const row = within(dialog()).getByText(t.process).closest('.work-order-progress-spec-item');

    expect(row?.closest('dl')).toHaveClass('work-order-progress-spec');
    expect(row?.closest('.info-facts')).toBeNull();
  });

  it('계획 기간은 시작 ~ 종료 한 줄이다', () => {
    renderDialog({
      workOrder: workOrder({
        plannedStartAt: '2026-08-04T10:00:00+09:00',
        plannedEndAt: '2026-08-04T18:00:00+09:00',
      }),
    });

    expect(within(dialog()).getByText(t.plannedPeriod).nextElementSibling).toHaveTextContent(
      t.period('2026-08-04 08:00', '2026-08-04 16:00'),
    );
  });

  it('지연이면 계획 기간의 종료만 빨갛게 적는다 — 표의 계획 종료 칸과 같다', () => {
    renderDialog({
      workOrder: workOrder({
        plannedEndAt: '2026-08-04T18:00:00+09:00',
        progress: {
          goodQty: 0,
          achievementRate: 0,
          completionJudgmentCode: 'UNDER',
          delayStatusCode: 'DELAYED',
        },
      }),
    });

    expect(within(dialog()).getByText('2026-08-04 16:00')).toHaveClass('work-order-progress-late');
  });

  describe('진행 단계', () => {
    const steps = () => within(within(dialog()).getByRole('list', { name: t.steps }));

    /* 이름은 마스터의 표시명이다 — 표의 상태 칩과 같은 말을 쓴다. */
    it('편성부터 마감까지 여섯 단계를 마스터의 이름으로 놓는다', () => {
      renderDialog();

      expect(
        steps()
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual([
        '상태 PLANNED',
        '상태 CONFIRMED',
        '상태 RELEASED',
        '상태 IN_PROGRESS',
        '상태 COMPLETED',
        '상태 CLOSED',
      ]);
    });

    it('지금 단계를 가리키고, 배포 시각을 그 단계 아래에 적는다', () => {
      renderDialog({
        workOrder: workOrder({
          statusCode: 'IN_PROGRESS',
          releasedAt: '2026-08-04T09:40:00+09:00',
        }),
      });

      const current = steps()
        .getAllByRole('listitem')
        .filter((item) => item.getAttribute('aria-current') === 'step');
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent('상태 IN_PROGRESS');
      expect(steps().getByText('2026-08-04 07:40').closest('li')).toHaveTextContent(
        '상태 RELEASED',
      );
    });

    /* 취소처럼 길에서 벗어난 상태는 「지금」 자리가 없다 — 상태 칩이 말한다. */
    it('길 밖의 상태면 지금 단계를 가리키지 않는다', () => {
      renderDialog({ workOrder: workOrder({ statusCode: 'CANCELLED' }) });

      expect(
        steps()
          .getAllByRole('listitem')
          .some((item) => item.hasAttribute('aria-current')),
      ).toBe(false);
    });
  });

  describe('기록 구역', () => {
    /* 구역마다 제목과 「없습니다」를 되풀이하면 기록 없는 W/O 가 창 절반을 안내문으로 채운다. */
    it('기록이 하나도 없으면 한 줄만 적는다', async () => {
      renderDialog();

      expect(await within(dialog()).findByText(t.noRecords)).toBeInTheDocument();
      expect(
        within(dialog()).queryByRole('heading', { name: t.sessions.heading }),
      ).not.toBeInTheDocument();
      expect(within(dialog()).queryByText(messages.fourMInputs.none)).not.toBeInTheDocument();
    });

    it('하나라도 있으면 구역을 그대로 둔다', async () => {
      renderDialog({
        crew: {
          data: {
            sessions: [],
            workerResults: [],
            defectTypes: [{ defectCodeId: 11, label: '외관 › 긁힘', qty: 4 }],
            sessionsTruncated: false,
            resultsTruncated: false,
          },
          isLoading: false,
          isError: false,
        },
      });

      expect(await within(dialog()).findByText(messages.fourMInputs.none)).toBeInTheDocument();
      expect(within(dialog()).getByText(t.sessions.empty)).toBeInTheDocument();
      expect(within(dialog()).queryByText(t.noRecords)).not.toBeInTheDocument();
    });

    /* ⛔ 「모른다」를 「없다」로 적지 않는다. */
    it('⛔ 받지 못했으면 「없습니다」로 적지 않는다', async () => {
      renderDialog({ crew: { data: undefined, isLoading: false, isError: true } });

      expect(await within(dialog()).findByText(t.crewLoadError)).toBeInTheDocument();
      expect(within(dialog()).queryByText(t.noRecords)).not.toBeInTheDocument();
    });
  });

  describe('앞뒤 W/O 로 넘기기', () => {
    /* 초점이 앞에 놓인 [이전 W/O]에 먼저 잡히면 주 동작처럼 보인다 — 브라우저가 찾는 것은 속성이다. */
    it('창이 열리면 [닫기]에 초점이 가게 표시해 둔다', () => {
      renderDialog();

      expect(within(dialog()).getByRole('button', { name: t.close })).toHaveAttribute('autofocus');
      expect(within(dialog()).getByRole('button', { name: t.prev })).not.toHaveAttribute(
        'autofocus',
      );
    });

    it('이전 · 다음을 누르면 알린다 — 창은 닫지 않는다', async () => {
      const { onPrev, onNext, onClose, user } = renderDialog();

      await user.click(within(dialog()).getByRole('button', { name: t.prev }));
      await user.click(within(dialog()).getByRole('button', { name: t.next }));

      expect(onPrev).toHaveBeenCalledTimes(1);
      expect(onNext).toHaveBeenCalledTimes(1);
      expect(onClose).not.toHaveBeenCalled();
    });

    it('앞 · 뒤가 없으면 그 단추를 끈다', () => {
      renderDialog({ onPrev: null, onNext: null });

      expect(within(dialog()).getByRole('button', { name: t.prev })).toBeDisabled();
      expect(within(dialog()).getByRole('button', { name: t.next })).toBeDisabled();
    });
  });

  describe('없는 값', () => {
    /* 비고가 비었거나 공백뿐이면 라벨 · 「—」까지 숨긴다(#360). */
    it.each([
      ['없음', undefined],
      ['빈 글', ''],
      ['공백뿐', '  \n '],
    ])('비고가 %s 이면 줄째 숨긴다', (_name, remarks) => {
      renderDialog({ workOrder: workOrder({ remarks }) });

      expect(within(dialog()).queryByText(t.remarks)).not.toBeInTheDocument();
    });

    it('비고가 있으면 목록 마지막 줄에 줄 전체 폭으로, 줄바꿈 그대로 보인다', () => {
      renderDialog({ workOrder: workOrder({ remarks: '첫 줄\n둘째 줄' }) });
      const fact = within(dialog()).getByText(t.remarks).closest('.work-order-progress-spec-item');

      expect(fact).toHaveClass('is-wide');
      expect(fact?.querySelector('.work-order-progress-remarks')?.textContent).toBe(
        '첫 줄\n둘째 줄',
      );
    });

    /* 공장 시각(베트남, UTC+7)으로 옮겨 보인다(omf-all-around#20). */
    it('있으면 공장 시각의 날짜와 시각만 보인다', () => {
      renderDialog({ workOrder: workOrder({ plannedEndAt: '2026-08-04T18:00:00+09:00' }) });

      expect(within(dialog()).getByText(t.plannedPeriod).nextElementSibling).toHaveTextContent(
        t.period(blank, '2026-08-04 16:00'),
      );
    });
  });

  describe('열고 닫기', () => {
    it('고른 것이 없으면 창이 열리지 않는다', () => {
      renderDialog({ isOpen: false, workOrder: null });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    /* ⛔ 눌렀는데 아무 일도 없다가 나중에 열리면 두 번 누르게 된다. */
    it('⛔ 받는 중에도 창은 열려 있다', () => {
      renderDialog({ isOpen: true, workOrder: null, isLoading: true });

      expect(dialog()).toBeInTheDocument();
      expect(within(dialog()).getByRole('status')).toHaveTextContent(t.loading);
    });

    it('닫기를 누르면 알린다', async () => {
      const { onClose, user } = renderDialog();

      await user.click(within(dialog()).getByRole('button', { name: t.close }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    /* ⛔ 같은 이름의 컨트롤이 둘이면 화면 읽기 도구에서 어느 것을 부르는지 갈린다. */
    it('⛔ 닫는 버튼이 하나뿐이다', () => {
      renderDialog();

      expect(within(dialog()).getAllByRole('button', { name: t.close })).toHaveLength(1);
    });
  });

  describe('상세를 받지 못했을 때', () => {
    it('⛔ 빈 창으로 두지 않고 실패를 알린다', () => {
      renderDialog({ isError: true, workOrder: null });

      expect(within(dialog()).getByText(t.loadError)).toBeInTheDocument();
    });

    it('실패했으면 값 자리를 그리지 않는다 — 옛 값이 남지 않게', () => {
      renderDialog({ isError: true, workOrder: null });

      expect(within(dialog()).queryByText(t.orderQty)).not.toBeInTheDocument();
    });
  });

  /* 이 화면에는 저장 액션이 없다 — 상세도 읽는 자리다. */
  it('⛔ 고치는 컨트롤을 두지 않는다', () => {
    renderDialog();
    const panel = dialog();

    for (const role of ['textbox', 'checkbox', 'combobox', 'switch'] as const) {
      expect(within(panel).queryAllByRole(role)).toHaveLength(0);
    }
  });
});
