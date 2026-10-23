import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useRef, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

const t = messages.inspectionDocuments.scan;

export interface LotScanProps {
  /** 어느 검사의 대기 의뢰를 찾는가 — IQC 판정 화면은 `IQC`. */
  inspectionTypeCode: string;
  /** 찾은 의뢰를 고른다 — 화면의 기존 선택 함수를 그대로 넘긴다. */
  onFound: (inspectionRequestId: number) => void;
  /**
   * 의뢰를 무엇으로 잇는가. 기본은 LOT 그 자체(IQC). PQC 의뢰는 작업지시 단위라 LOT 칸이 비어 있다 —
   * `workOrder` 면 생산 LOT 의 원천 작업지시로 의뢰를 찾는다(omf-all-around#135).
   */
  matchBy?: 'lot' | 'workOrder';
  /** 대기 의뢰가 없을 때의 말. 기본은 수입검사 문구다. */
  noRequestMessage?: string;
}

/** 생산 LOT 의 원천 유형 — 서버 `WORK_ORDER_LOT_SOURCE` 와 같은 값이다. */
const WORK_ORDER_SOURCE = 'WORK_ORDER';

/**
 * LOT 바코드로 검사 대상을 바로 연다(omf-all-around#58).
 *
 * ⭐ 스캐너는 번호를 치고 Enter 를 보낸다 — 폼 제출 하나로 받는다. 찾으면 화면의 목록 조건은 그대로 두고
 *    그 의뢰를 «선택»만 한다(조건을 바꾸면 사용자가 걸어 둔 조건이 말없이 사라진다).
 * ⚠ 대기·진행 중인 의뢰만 찾는다 — 끝난 검사는 검사실적 조회(W-03-05)에서 판정으로 거른다.
 * ⭐ 못 찾으면 칸에 남은 번호를 골라 둔다 — 다음 스캔이 덮어쓴다(뒤에 이어 붙지 않는다 · #133). 찾는 동안에도
 *    칸을 잠그지 않아(읽기 전용) 커서가 칸을 떠나지 않는다 — 잠그면 다음 스캔이 갈 곳을 잃는다.
 */
export const LotScan = ({
  inspectionTypeCode,
  onFound,
  matchBy = 'lot',
  noRequestMessage = t.noRequest,
}: LotScanProps) => {
  const { client } = useApiClient();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  /* 실패한 번호를 골라 둔다 — 다음 스캔이 그 자리를 덮어쓴다. */
  const fail = (text: string): void => {
    setMessage(text);
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  const find = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const lotNo = value.trim();
    if (lotNo === '') return;
    setMessage(null);
    setIsFinding(true);
    try {
      const lots = await runRequest(() =>
        client.GET('/trace/lots', { params: { query: { lotNo, size: 5 } } }),
      );
      const lot = lots.items.find((item) => item.lotNo === lotNo);
      if (lot === undefined) {
        fail(t.notFound);
        return;
      }
      if (matchBy === 'workOrder' && lot.sourceTypeCode !== WORK_ORDER_SOURCE) {
        fail(noRequestMessage);
        return;
      }
      const target = matchBy === 'workOrder' ? { workOrderId: lot.sourceId } : { lotId: lot.lotId };
      const requests = await runRequest(() =>
        client.GET('/quality/inspection-requests', {
          params: {
            query: { inspectionTypeCode, pendingOnly: true, ...target, page: 1, size: 5 },
          },
        }),
      );
      const found = requests.items[0];
      if (found === undefined) {
        fail(noRequestMessage);
        return;
      }
      setValue('');
      onFound(found.inspectionRequestId);
    } catch {
      fail(t.failed);
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <form className="form-actions" aria-label={t.label} onSubmit={(event) => void find(event)}>
      <TextField
        ref={inputRef}
        label={t.label}
        placeholder={t.placeholder}
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
        {t.find}
      </Button>
      {message !== null && <p className="field-note">{message}</p>}
    </form>
  );
};
