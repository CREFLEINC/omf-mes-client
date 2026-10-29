import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HANDOVER_ALERT_ORDER } from '../../patterns/handover-alert-types';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ZaloConnectionScreen } from './screen';
import type { Connection, HandoverTemplate } from './types';

const t = messages.zaloConnection;

const CODES = [
  'WORK_SESSION_STARTED',
  'WORK_SESSION_STOPPED',
  'WORK_SESSION_ENDED',
  'WORK_ORDER_CLOSED',
  'EQUIPMENT_BREAKDOWN_OCCURRED',
  'APPROVAL_ACTION_REQUIRED',
];
const NAMES = ['생산 실행', '생산 중단', '작업 종료', '생산 마감', '설비 고장 발생', '승인 요청'];
const HANDOVER_NAMES: Record<string, string> = {
  IQC_INSPECTION_REQUESTED: 'IQC 수입검사',
  PUTAWAY_REQUESTED: '적치',
  MATERIAL_PICKING_REQUESTED: '자재 출고 피킹',
  STOCK_TRANSFER_ARRIVAL_PENDING: '창고 이동 도착',
  WORK_ORDER_RELEASED: '작업 시작',
  EMERGENCY_WORK_ORDER_RELEASED: '긴급 W/O',
  REWORK_WORK_ORDER_CREATED: '재작업 실적',
  OQC_INSPECTION_REQUESTED: 'OQC 출하검사',
  SHIPMENT_PICKING_REQUESTED: '제품 출하 피킹',
  SHIPMENT_PACKING_REQUESTED: '출하 포장',
};

const connection = (handoverTemplates?: HandoverTemplate[]): Connection => ({
  appId: '1234567890',
  secretKeySet: true,
  refreshTokenSet: true,
  status: 'ACTIVE',
  accessTokenExpiresAt: null,
  lastRefreshedAt: null,
  lastErrorCode: null,
  lastErrorMessage: null,
  paramMaxLength: 100,
  templates: CODES.map((eventCode, index) => ({
    eventCode,
    templateId: index === 0 ? 'TPL01' : null,
  })),
  deliveryEnabled: true,
  ...(handoverTemplates === undefined ? {} : { handoverTemplates }),
});

const setup = (data: Connection) => {
  const writes: Request[] = [];
  renderWithProviders(<ZaloConnectionScreen />, {
    fetch: createStubFetch([
      {
        match: (request) => new URL(request.url).pathname === '/app/notification-events',
        respond: () =>
          jsonResponse({
            items: CODES.map((eventCode, index) => ({ eventCode, eventName: NAMES[index] })),
          }),
      },
      {
        match: (request) => new URL(request.url).pathname === '/app/handover-alert-types',
        respond: () =>
          jsonResponse({
            /* 서버 차례가 흔들려도 화면은 업무 흐름 순서다. */
            items: [...HANDOVER_ALERT_ORDER].reverse().map((alertTypeCode) => ({
              alertTypeCode,
              name: HANDOVER_NAMES[alertTypeCode],
              nameVi: alertTypeCode,
              targetTypeCode: 'WORK_ORDER',
            })),
          }),
      },
      {
        match: (request) =>
          request.method === 'GET' && new URL(request.url).pathname === '/app/zalo-connection',
        respond: () => jsonResponse(data, { headers: { ETag: '"5"' } }),
      },
      {
        match: (request) =>
          request.method === 'PUT' && new URL(request.url).pathname === '/app/zalo-connection',
        respond: (request) => {
          writes.push(request.clone());
          return jsonResponse(data, { headers: { ETag: '"6"' } });
        },
      },
    ]),
    route: '/notification/zalo-connection',
  });
  return { writes };
};

const handoverCard = () => within(screen.getByRole('region', { name: t.handover.title }));

describe('ZaloConnectionScreen — 인계 작업 템플릿(피처 002)', () => {
  it('FR-022 기존 6종 칸은 그대로이고 그 아래 별도 카드에 인계 10칸이 업무 흐름 순서로 선다', async () => {
    setup(connection([{ alertTypeCode: 'MATERIAL_PICKING_REQUESTED', templateId: '200002' }]));

    expect(
      await screen.findByRole('textbox', { name: t.fields.templateId('생산 실행') }),
    ).toHaveValue('TPL01');
    expect(screen.getAllByRole('button', { name: /파라미터 복사$/ })).toHaveLength(6);

    const card = await waitFor(() => handoverCard());
    expect(card.getByText(t.handover.notice)).toBeInTheDocument();
    const boxes = await card.findAllByRole('textbox');
    expect(boxes).toHaveLength(10);
    await waitFor(() => {
      expect(boxes.map((box) => box.getAttribute('aria-label'))).toEqual(
        HANDOVER_ALERT_ORDER.map((code) => t.fields.templateId(HANDOVER_NAMES[code] ?? code)),
      );
    });
    expect(card.getByRole('textbox', { name: t.fields.templateId('자재 출고 피킹') })).toHaveValue(
      '200002',
    );
    expect(
      card.getByText(`${t.fields.params}: receipt_no, lot_count, supplier, event_time`),
    ).toBeInTheDocument();
    expect(card.getAllByRole('button', { name: /템플릿 파라미터 이름 복사$/ })).toHaveLength(10);
  });

  it('FR-022 저장하면 기존 templates 6종과 handoverTemplates 10종을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup(connection([]));

    const card = await waitFor(() => handoverCard());
    const putaway = await card.findByRole('textbox', { name: t.fields.templateId('적치') });
    await user.type(putaway, 'H0001');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await (writes[0] as Request).json()) as {
      templates: { eventCode: string; templateId: string | null }[];
      handoverTemplates: HandoverTemplate[];
    };
    expect(body.templates).toHaveLength(6);
    expect(body.templates[0]).toEqual({ eventCode: 'WORK_SESSION_STARTED', templateId: 'TPL01' });
    expect(body.handoverTemplates).toHaveLength(10);
    expect(body.handoverTemplates).toContainEqual({
      alertTypeCode: 'PUTAWAY_REQUESTED',
      templateId: 'H0001',
    });
    expect(body.handoverTemplates).toContainEqual({
      alertTypeCode: 'IQC_INSPECTION_REQUESTED',
      templateId: null,
    });
  });

  it('인계 템플릿 ID 형식이 틀리면 그 칸에 오류를 보이고 보내지 않는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup(connection([]));

    const card = await waitFor(() => handoverCard());
    await user.type(await card.findByRole('textbox', { name: t.fields.templateId('적치') }), 'H-1');
    await user.click(screen.getByRole('button', { name: t.actions.save }));

    expect(await card.findByText(t.errors.templateId)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('응답에 인계 칸이 없어도 빈 칸 10개로 보인다', async () => {
    setup(connection());

    const card = await waitFor(() => handoverCard());
    const boxes = await card.findAllByRole('textbox');
    expect(boxes).toHaveLength(10);
    for (const box of boxes) expect(box).toHaveValue('');
  });
});
