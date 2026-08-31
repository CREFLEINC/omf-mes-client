import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { requestWithoutLot, requestWithoutPlanVersion, waitingRequest } from './fixtures';
import { RequestDetailPane } from './request-detail-pane';
import { toInspectionRequestDetail } from './types';

const t = messages.iqcInspection.detail;

describe('RequestDetailPane', () => {
  it('스펙이 정한 여섯 항목을 보인다', () => {
    renderWithProviders(<RequestDetailPane detail={toInspectionRequestDetail(waitingRequest)} />);

    for (const label of Object.values(t.fields)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('검사기준 버전을 감추지 않는다 — 검사 시점에 고정되는 값이다', () => {
    renderWithProviders(<RequestDetailPane detail={toInspectionRequestDetail(waitingRequest)} />);

    expect(screen.getByText(t.fields.inspectionPlanVersionId)).toBeInTheDocument();
    expect(screen.getByText(String(waitingRequest.inspectionPlanVersionId))).toBeInTheDocument();
  });

  it('버전이 고정된다는 사실을 함께 말한다 — 숫자만 보이면 왜 중요한지 알 수 없다', () => {
    renderWithProviders(<RequestDetailPane detail={toInspectionRequestDetail(waitingRequest)} />);

    expect(screen.getByText(t.planVersionNote)).toBeInTheDocument();
  });

  it('자재 LOT 이 없으면 빈 칸이 아니라 없음 표시를 낸다', () => {
    renderWithProviders(
      <RequestDetailPane detail={toInspectionRequestDetail(requestWithoutLot)} />,
    );

    expect(screen.getByText(messages.iqcInspection.queue.emptyValue)).toBeInTheDocument();
  });

  /*
   * client#589 — 검사기준이 등록되지 않은 채 만들어진 의뢰는 이 칸이 빈다. 없는 값과
   * 모르는 값은 다른 모양이어야 하므로(공유계약 G-9) 일반 빈 값 표시와 다른 문구를 낸다.
   */
  it('검사기준 버전이 없으면 일반 빈 값과 다른 「기준 없음」을 낸다', () => {
    renderWithProviders(
      <RequestDetailPane detail={toInspectionRequestDetail(requestWithoutPlanVersion)} />,
    );

    expect(screen.getByText(t.noPlanVersion)).toBeInTheDocument();
    expect(screen.queryByText(messages.iqcInspection.queue.emptyValue)).not.toBeInTheDocument();
  });
});
