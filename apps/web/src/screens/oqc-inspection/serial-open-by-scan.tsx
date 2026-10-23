import { Button } from '@crefle/web-ui';
import type { OqcSerialScan } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useSerialLookup } from './queries';
import { SerialScanField } from './serial-scan-field';
import { requestsToOpen } from './serials';

const t = messages.oqcInspection.serials;

/**
 * 「시리얼로 의뢰 열기」 — 왼쪽 목록 위(omf-all-around#68). 그 시리얼의 LOT 을 피킹한 OQC 의뢰를 연다 — 대기·진행이
 * 없으면 완료된 의뢰를 연다(재검사 회차를 더하러).
 * 여럿이면 고르게 한다 — 화면이 하나를 짐작하지 않는다.
 */
export const SerialOpenByScan = ({
  onOpen,
}: {
  onOpen: (inspectionRequestId: number, scan: OqcSerialScan) => void;
}) => {
  const lookup = useSerialLookup();
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<OqcSerialScan | null>(null);

  /** `false` 면 찾지 못했다 — 칸이 친 번호를 남긴다. */
  const scan = async (serialNo: string): Promise<boolean> => {
    setChoices(null);
    const found = await lookup(serialNo);
    if (found.kind === 'notFound') {
      setError(t.openByScanNotFound);
      return false;
    }
    if (found.kind === 'failed') {
      setError(t.lookupFailed);
      return true;
    }
    const requests = requestsToOpen(found.scan.pickedRequests);
    if (requests.length === 0) {
      setError(t.noPickedRequest(found.scan.serialNo));
      return true;
    }
    setError(null);
    const [only] = requests;
    if (requests.length === 1 && only !== undefined) {
      onOpen(only.inspectionRequestId, found.scan);
      return true;
    }
    setChoices({ ...found.scan, pickedRequests: requests });
    return true;
  };

  return (
    <div>
      <SerialScanField
        label={t.openByScan}
        labelHint={t.openByScanHelp}
        placeholder={t.openByScanPlaceholder}
        error={error}
        onScan={scan}
      />
      {choices !== null && (
        <div className="form-actions">
          <p className="field-note form-actions-secondary">{t.pickRequest}</p>
          {choices.pickedRequests.map((request) => (
            <Button
              key={request.inspectionRequestId}
              type="button"
              size="sm"
              variant="outlined"
              onClick={() => {
                setChoices(null);
                onOpen(request.inspectionRequestId, choices);
              }}
            >
              {request.statusCode === 'COMPLETED'
                ? t.completedRequest(request.inspectionRequestNo)
                : request.inspectionRequestNo}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
