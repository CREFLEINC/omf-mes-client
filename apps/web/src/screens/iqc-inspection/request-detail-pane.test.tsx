import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { requestWithoutLot, requestWithoutPlanVersion, waitingRequest } from './fixtures';
import type { NameLookup } from './reference-lookup';
import { RequestDetailPane } from './request-detail-pane';
import { toInspectionRequestDetail } from './types';

const t = messages.iqcInspection.detail;

/** 이름 풀이 둘. **번호가 아니라 사람이 읽는 말**을 낸다(omf-all-around#40). */
const ITEM_LABEL = 'SAMPLE-ITEM-01 · 합성 품목 가';
/* 번호가 라벨에 섞이지 않게 둔다 — 「번호가 남지 않는다」를 재는 단언이 제 꼬리를 물면 안 된다. */
const LOT_NO = 'SAMPLE-LOT|AAA|BBB|CCC';

const itemNames: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : ITEM_LABEL),
};
const lotNumbers: NameLookup = {
  labelOf: (id) => (id === null || id === undefined ? '—' : LOT_NO),
};

describe('RequestDetailPane', () => {
  it('스펙이 정한 여섯 항목을 보인다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    for (const label of Object.values(t.fields)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('검사기준 버전을 감추지 않는다 — 검사 시점에 고정되는 값이다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(t.fields.inspectionPlanVersionId)).toBeInTheDocument();
    expect(screen.getByText(String(waitingRequest.inspectionPlanVersionId))).toBeInTheDocument();
  });

  it('버전이 고정된다는 사실을 함께 말한다 — 숫자만 보이면 왜 중요한지 알 수 없다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(t.planVersionNote)).toBeInTheDocument();
  });

  it('자재 LOT 이 없으면 빈 칸이 아니라 없음 표시를 낸다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(requestWithoutLot)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(messages.iqcInspection.queue.emptyValue)).toBeInTheDocument();
  });

  /*
   * client#589 — 검사기준이 등록되지 않은 채 만들어진 의뢰는 이 칸이 빈다. 없는 값과
   * 모르는 값은 다른 모양이어야 하므로(공유계약 G-9) 일반 빈 값 표시와 다른 문구를 낸다.
   */
  it('검사기준 버전이 없으면 일반 빈 값과 다른 「기준 없음」을 낸다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(requestWithoutPlanVersion)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(t.noPlanVersion)).toBeInTheDocument();
    expect(screen.queryByText(messages.iqcInspection.queue.emptyValue)).not.toBeInTheDocument();
  });

  it('검사수량 옆에 단위 코드를 붙이고, 모르면 숫자만 둔다', () => {
    const { unmount } = renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode="EA"
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(`${String(waitingRequest.targetQty)} EA`)).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );
    expect(screen.getByText(String(waitingRequest.targetQty))).toBeInTheDocument();
  });

  /**
   * ⛔ **내부 번호를 화면에 내지 않는다**(`omf-mes#44`). 이 두 칸은 종전에 `itemId`·`lotId` 를
   * 그대로 찍어 「품목 12588」·「대상 LOT 45」가 나왔다 — 검사자가 **무엇을 검사하는지**
   * 화면에서 알 수 없었다(omf-all-around#40).
   */
  it('품목과 대상 LOT 을 사람이 읽는 말로 내고 내부 번호는 어디에도 없다', () => {
    const { container } = renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(waitingRequest)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText(ITEM_LABEL)).toBeInTheDocument();
    expect(screen.getByText(LOT_NO)).toBeInTheDocument();

    /* 짝 방향 — 번호가 글자로도 남지 않는다. */
    const text = container.textContent ?? '';

    expect(text).not.toContain(String(waitingRequest.itemId));
    expect(text).not.toContain(String(waitingRequest.lotId));
  });

  /** 없는 것이 정상이다 — 풀이가 그 갈래의 글자를 정한다(못 받은 것과 다른 모양이다). */
  it('LOT 이 없는 의뢰는 풀이가 정한 빈 값 표기를 낸다', () => {
    renderWithProviders(
      <RequestDetailPane
        detail={toInspectionRequestDetail(requestWithoutLot)}
        uomCode={null}
        itemNames={itemNames}
        lotNumbers={lotNumbers}
      />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
