import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { requestWithoutPlanVersion, waitingRequest } from './fixtures';
import type { ItemNameLookup, NameLookup } from './reference-lookup';
import { RequestDetailPane } from './request-detail-pane';
import { toInspectionRequestDetail, type InspectionRequestDetail } from './types';

const t = messages.oqcInspection.detail;
const queueT = messages.oqcInspection.queue;
const emptyValue = queueT.emptyValue;

/** 품목은 이름·코드로, LOT 은 번호로 푼 상태 — 풀이 자체는 `reference-lookup.ts` 의 몫이다. */
const itemNames: ItemNameLookup = {
  labelOf: () => '품목 이름',
  partsOf: () => ({ code: 'ITEM-2101', name: '출하 제품 A' }),
};
const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? emptyValue : `LOT-${String(id)}`),
};

const renderPane = (detail: InspectionRequestDetail, uomCode: string | null = null) =>
  renderWithProviders(
    <RequestDetailPane
      detail={detail}
      uomCode={uomCode}
      itemNames={itemNames}
      lotNumbers={lotNumbers}
    />,
  );

describe('RequestDetailPane', () => {
  it('대상 정보를 항목마다 라벨과 함께 그린다 — 품목은 이름·코드, 대상은 유형 이름과 번호(#136)', () => {
    renderPane(toInspectionRequestDetail(waitingRequest));

    for (const label of Object.values(t.fields)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    expect(screen.getByText('출하 제품 A')).toBeInTheDocument();
    expect(screen.getByText('ITEM-2101')).toBeInTheDocument();
    expect(
      screen.getByText(
        queueT.target(queueT.targetTypes.SHIPMENT_REQUEST ?? '', waitingRequest.targetId),
      ),
    ).toBeInTheDocument();
    expect(screen.getByText(`OQC (${t.inspectionTypeNames.OQC ?? ''})`)).toBeInTheDocument();
  });

  it('셋째 칸 — OA 계정은 시리얼 번호, 그 밖은 피킹한 대상 LOT 을 보인다(#136)', () => {
    const detail = toInspectionRequestDetail(waitingRequest);
    const { unmount } = renderWithProviders(
      <RequestDetailPane
        detail={detail}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
        unitFact={{ kind: 'serial', value: 'SN-0001' }}
      />,
    );

    expect(screen.getByText(t.serialNo)).toBeInTheDocument();
    expect(screen.queryByText(t.fields.lotId)).not.toBeInTheDocument();
    expect(screen.getByText('SN-0001')).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <RequestDetailPane
        detail={detail}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
        unitFact={{ kind: 'lot', value: t.unregistered }}
      />,
    );

    expect(screen.getByText(t.fields.lotId)).toBeInTheDocument();
    expect(screen.getByText(t.unregistered)).toBeInTheDocument();
  });

  it('모르는 대상 유형은 코드 그대로 보인다 — 이름을 지어내지 않는다', () => {
    renderPane({ ...toInspectionRequestDetail(waitingRequest), targetTypeCode: 'UNKNOWN_TYPE' });

    expect(
      screen.getByText(queueT.target('UNKNOWN_TYPE', waitingRequest.targetId)),
    ).toBeInTheDocument();
  });

  it('기준이 비면 전용 문구로 그린다 — 일반 빈 값 표시와 다른 글자여야 한다', () => {
    renderPane(toInspectionRequestDetail(requestWithoutPlanVersion));

    expect(screen.getByText(t.noPlanVersion)).toBeInTheDocument();
    expect(t.noPlanVersion).not.toBe(emptyValue);
    /* 같은 픽스처에서 LOT 이 비어 있다 — 없는 값은 일반 표시로 그린다. */
    expect(screen.getByText(emptyValue)).toBeInTheDocument();
  });

  it('단위 코드를 알면 검사수량 옆에 붙이고, 모르면 숫자만 둔다(#136)', () => {
    const detail = toInspectionRequestDetail(waitingRequest);
    const { unmount } = renderPane(detail, 'EA');

    expect(screen.getByText(`${String(detail.targetQty)} EA`)).toBeInTheDocument();
    unmount();

    renderPane(detail, null);
    expect(screen.getByText(String(detail.targetQty))).toBeInTheDocument();
  });
});
