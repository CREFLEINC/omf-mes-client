import { Button } from '@crefle/web-ui';
import type { OqcSerialScan } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useSerialLookup } from './queries';
import { SerialScanField } from './serial-scan-field';

const t = messages.oqcInspection.serials;

/**
 * 「시리얼로 의뢰 열기」 — 왼쪽 목록 위(omf-all-around#68). 그 시리얼의 LOT 을 피킹한 열린 OQC 의뢰를 연다.
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

  const scan = async (serialNo: string): Promise<void> => {
    setChoices(null);
    const found = await lookup(serialNo);
    if (found.kind === 'notFound') return setError(t.notFound(serialNo));
    if (found.kind === 'failed') return setError(t.lookupFailed);
    const requests = found.scan.openRequests;
    if (requests.length === 0) return setError(t.noOpenRequest(found.scan.serialNo));
    setError(null);
    const [only] = requests;
    if (requests.length === 1 && only !== undefined)
      return onOpen(only.inspectionRequestId, found.scan);
    setChoices(found.scan);
  };

  return (
    <div>
      <SerialScanField
        label={t.openByScan}
        helperText={t.openByScanHelp}
        error={error}
        onScan={scan}
      />
      {choices !== null && (
        <div className="form-actions">
          <p className="field-note form-actions-secondary">{t.pickRequest}</p>
          {choices.openRequests.map((request) => (
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
              {request.inspectionRequestNo}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
};
