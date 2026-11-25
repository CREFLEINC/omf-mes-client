import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { HANDOVER_ALERT_ORDER } from '../../patterns/handover-alert-types';
import { createStubFetch, jsonResponse, renderWithProviders } from '../../test/api-harness';
import { ZaloConnectionScreen } from './screen';
import type { Connection } from './types';

type HandoverTemplate = components['schemas']['ZaloConnection']['handoverTemplates'][number];

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
  IQC_INSPECTION_REJECTED: '검사 불합격(IQC)',
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

/*
 * 인계 칸(`handoverTemplates`)은 서버 전달본 2026-10-29부터 필수다. 칸을 싣지 않던 병합 전 서버의 응답도
 * 그대로 그려야 하므로, 칸을 빼고 만든 응답은 타입을 단언해 넘긴다.
 */
const connection = (handoverTemplates?: HandoverTemplate[]): Connection =>
  ({
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
  }) as Connection;

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

/* 조회 조건 · 목록 · 상세 통일 배치(#358) — 템플릿은 목록에서 골라 상세에서 고친다. 이름 검색으로 찾아 고른다. */
const openTemplate = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  const search = await screen.findByRole('searchbox', { name: t.workspace.search });
  await user.clear(search);
  await user.type(search, name);
  await user.click(screen.getByRole('button', { name: t.workspace.apply }));
  await user.click(await screen.findByRole('button', { name }));
  return screen.findByRole('textbox', { name: t.fields.templateId });
};

describe('ZaloConnectionScreen — 인계 작업 템플릿(피처 002)', () => {
  it('FR-022 이벤트 6종 뒤에 인계 11종이 업무 흐름 순서로 한 목록에 서고, 고르면 ID · 파라미터 · 안내가 상세에 선다', async () => {
    const user = userEvent.setup();
    setup(connection([{ alertTypeCode: 'MATERIAL_PICKING_REQUESTED', templateId: '200002' }]));

    const list = within(await screen.findByRole('region', { name: t.workspace.list }));
    const names = async (): Promise<string[]> =>
      (await list.findAllByRole('row')).slice(1).map((row) => {
        const cells = within(row).getAllByRole('cell');
        return `${cells[0]?.textContent ?? ''}|${cells[1]?.textContent ?? ''}`;
      });
    /* 한 쪽 10건 — 둘째 쪽까지 이어 본다. */
    const firstPage = await waitFor(async () => {
      const found = await names();
      expect(found).toHaveLength(10);
      expect(found[6]).toBe(
        `${t.workspace.kinds.handover}|${HANDOVER_NAMES[HANDOVER_ALERT_ORDER[0] ?? ''] ?? ''}`,
      );
      return found;
    });
    await user.click(list.getByRole('button', { name: messages.screenPatterns.pageNav.next }));
    const secondPage = await waitFor(async () => {
      const found = await names();
      expect(found).toHaveLength(7);
      return found;
    });
    expect([...firstPage, ...secondPage]).toEqual([
      ...NAMES.map((name) => `${t.workspace.kinds.event}|${name}`),
      ...HANDOVER_ALERT_ORDER.map(
        (code) => `${t.workspace.kinds.handover}|${HANDOVER_NAMES[code] ?? code}`,
      ),
    ]);

    expect(await openTemplate(user, '자재 출고 피킹')).toHaveValue('200002');
    expect(screen.getByText(t.handover.notice)).toBeInTheDocument();
    await openTemplate(user, 'IQC 수입검사');
    expect(screen.getByText('receipt_no, lot_count, supplier, event_time')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: t.handover.copyFor('IQC 수입검사') }),
    ).toBeInTheDocument();
  });

  it('FR-022 저장하면 기존 templates 6종과 handoverTemplates 11종을 함께 싣는다', async () => {
    const user = userEvent.setup();
    const { writes } = setup(connection([]));

    const putaway = await openTemplate(user, '적치');
    await user.type(putaway, 'H0001');
    /* 저장은 그 템플릿 상세 아래 오른쪽(#358). */
    await user.click(
      within(screen.getByRole('region', { name: '적치' })).getByRole('button', {
        name: t.actions.save,
      }),
    );

    await waitFor(() => expect(writes).toHaveLength(1));
    const body = (await (writes[0] as Request).json()) as {
      templates: { eventCode: string; templateId: string | null }[];
      handoverTemplates: HandoverTemplate[];
    };
    expect(body.templates).toHaveLength(6);
    expect(body.templates[0]).toEqual({ eventCode: 'WORK_SESSION_STARTED', templateId: 'TPL01' });
    expect(body.handoverTemplates).toHaveLength(11);
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

    await user.type(await openTemplate(user, '적치'), 'H-1');
    /* 저장은 그 템플릿 상세 아래 오른쪽(#358). */
    await user.click(
      within(screen.getByRole('region', { name: '적치' })).getByRole('button', {
        name: t.actions.save,
      }),
    );

    expect(await screen.findByText(t.errors.templateId)).toBeInTheDocument();
    /* 목록의 그 줄에도 「확인 필요」가 선다 — 다른 템플릿을 보고 있어도 오류 자리를 찾는다. */
    expect(screen.getByText(t.workspace.hasError)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it('서버가 인계 칸을 아직 싣지 않아도(병합 전) 인계 11종이 빈 칸으로 선다', async () => {
    const user = userEvent.setup();
    setup(connection());

    const list = within(await screen.findByRole('region', { name: t.workspace.list }));
    expect((await list.findAllByText(t.values.none)).length).toBeGreaterThan(0);
    expect(
      await screen.findByText(`${String(6 + HANDOVER_ALERT_ORDER.length)}건`),
    ).toBeInTheDocument();
    expect(await openTemplate(user, '적치')).toHaveValue('');
  });
});
