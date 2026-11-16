import { Button, TextField } from '@crefle/web-ui';
import type { components } from '@omf-mes/api-client';
import { messages } from '@omf-mes/i18n';
import { useRef, useState, type FormEvent } from 'react';

import { useLotLookup, useSerialLookup } from './queries';
import { requestsToOpen } from './serials';

type OqcSerialScan = components['schemas']['OqcSerialScan'];

const t = messages.oqcInspection.serials;
/** 칸 모양 · 이름은 IQC · PQC 의 LOT 스캔과 같다(사용자 지시 2026-10-26 · #185) — 찾는 값은 시리얼 번호 또는 제품 LOT 번호다. */
const scanText = messages.inspectionDocuments.scan;

type PickedRequest = OqcSerialScan['pickedRequests'][number];

/** 의뢰가 여럿일 때 고를 것들 — 시리얼로 찾았는지 LOT 으로 찾았는지에 따라 여는 방법이 다르다. */
interface Choices {
  note: string;
  requests: PickedRequest[];
  open: (inspectionRequestId: number) => void;
}

/**
 * 「LOT 스캔」 — 왼쪽 목록 위(omf-all-around#68). 시리얼 번호면 그 시리얼의 LOT 을, 제품 LOT 번호면 그 LOT 을 피킹한
 * OQC 의뢰를 연다 — 대기·진행이 없으면 완료된 의뢰를 연다(재검사 회차를 더하러).
 * 시리얼을 먼저 찾고, 없는 시리얼일 때만 LOT 으로 찾는다. 여럿이면 고르게 한다 — 화면이 하나를 짐작하지 않는다.
 */
export const SerialOpenByScan = ({
  onOpen,
  onOpenByLot,
  onFound,
}: {
  onOpen: (inspectionRequestId: number, scan: OqcSerialScan) => void;
  /** LOT 번호로 찾은 의뢰를 연다 — 시리얼이 없으므로 「검사한 시리얼」에 줄을 넣지 않는다. */
  onOpenByLot: (inspectionRequestId: number) => void;
  /** 찾은 시리얼과 열 수 있는 의뢰들 — 고르기 전에도 목록의 시리얼 번호 칸이 그 줄을 가리킨다(#136). */
  onFound?: (scan: OqcSerialScan) => void;
}) => {
  const lookup = useSerialLookup();
  const lookupLot = useLotLookup();
  const [error, setError] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choices | null>(null);
  const [value, setValue] = useState('');
  const [isFinding, setIsFinding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /** 시리얼이 아닌 번호 — 제품 LOT 번호로 찾는다. `false` 면 LOT 도 없다. */
  const scanLot = async (lotNo: string): Promise<boolean> => {
    const found = await lookupLot(lotNo);
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
      setError(t.noPickedLotRequest(found.scan.lotNo));
      return true;
    }
    setError(null);
    const [only] = requests;
    if (requests.length === 1 && only !== undefined) onOpenByLot(only.inspectionRequestId);
    else setChoices({ note: t.pickLotRequest, requests, open: onOpenByLot });
    return true;
  };

  /** `false` 면 찾지 못했다 — 칸이 친 번호를 남긴다. */
  const scan = async (serialNo: string): Promise<boolean> => {
    setChoices(null);
    const found = await lookup(serialNo);
    if (found.kind === 'notFound') return scanLot(serialNo);
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
    const picked = { ...found.scan, pickedRequests: requests };
    onFound?.(picked);
    const [only] = requests;
    if (requests.length === 1 && only !== undefined) {
      onOpen(only.inspectionRequestId, found.scan);
      return true;
    }
    setChoices({
      note: t.pickRequest,
      requests,
      open: (inspectionRequestId) => onOpen(inspectionRequestId, picked),
    });
    return true;
  };

  /**
   * 스캐너는 번호를 치고 Enter 를 보낸다 — 폼 제출 하나로 받는다(LOT 스캔과 같다). 찾으면 칸을 비우고,
   * 못 찾으면 친 번호를 골라 둔다 — 다음 스캔이 덮어쓴다(뒤에 이어 붙지 않는다). 찾는 동안에도 칸은 잠그지 않는다.
   */
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const serialNo = value.trim();
    if (serialNo === '' || isFinding) return;
    setIsFinding(true);
    try {
      if (await scan(serialNo)) setValue('');
      else {
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    } catch {
      setError(t.lookupFailed);
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <div className="oqc-inspection-scan">
      <form
        className="form-actions"
        aria-label={scanText.label}
        onSubmit={(event) => void submit(event)}
      >
        <TextField
          ref={inputRef}
          label={scanText.label}
          placeholder={scanText.placeholder}
          value={value}
          readOnly={isFinding}
          onChange={(event) => setValue(event.target.value)}
        />
        <Button
          type="submit"
          variant="outlined"
          size="md"
          disabled={isFinding || value.trim() === ''}
        >
          {scanText.find}
        </Button>
        {error !== null && <p className="field-note">{error}</p>}
      </form>
      {choices !== null && (
        <div className="form-actions">
          <p className="field-note form-actions-secondary">{choices.note}</p>
          {choices.requests.map((request) => (
            <Button
              key={request.inspectionRequestId}
              type="button"
              size="sm"
              variant="outlined"
              onClick={() => {
                setChoices(null);
                choices.open(request.inspectionRequestId);
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
