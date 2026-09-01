import { messages } from '@omf-mes/i18n';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../test/api-harness';
import { requestWithoutPlanVersion, waitingRequest } from './fixtures';
import { RequestDetailPane } from './request-detail-pane';
import { toInspectionRequestDetail } from './types';

const t = messages.oqcInspection.detail;
const emptyValue = messages.oqcInspection.queue.emptyValue;

describe('RequestDetailPane', () => {
  it('대상 정보를 항목마다 라벨과 함께 그린다', () => {
    renderWithProviders(<RequestDetailPane detail={toInspectionRequestDetail(waitingRequest)} />);

    for (const label of Object.values(t.fields)) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getByText(waitingRequest.inspectionRequestNo)).toBeInTheDocument();
    /* ⚠ 대상 유형은 코드 그대로다 — 대응표가 아직 없어 표시명을 지어내지 않는다. */
    expect(screen.getByText(waitingRequest.targetTypeCode)).toBeInTheDocument();
  });

  it('기준이 비면 전용 문구로 그린다 — 일반 빈 값 표시와 다른 글자여야 한다', () => {
    renderWithProviders(
      <RequestDetailPane detail={toInspectionRequestDetail(requestWithoutPlanVersion)} />,
    );

    expect(screen.getByText(t.noPlanVersion)).toBeInTheDocument();
    expect(t.noPlanVersion).not.toBe(emptyValue);
    /* 같은 픽스처에서 LOT 이 비어 있다 — 없는 값은 일반 표시로 그린다. */
    expect(screen.getByText(emptyValue)).toBeInTheDocument();
  });

  it('단위를 이름으로 그리지 않는 사실을 밝힌다', () => {
    renderWithProviders(<RequestDetailPane detail={toInspectionRequestDetail(waitingRequest)} />);

    expect(screen.getByText(t.uomNote)).toBeInTheDocument();
  });
});
