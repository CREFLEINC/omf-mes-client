import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { runRequest } from '../../patterns/request';

const t = messages.inspectionDocuments.scan;

export interface LotScanProps {
  /** 어느 검사의 대기 의뢰를 찾는가 — IQC 판정 화면은 `IQC`. */
  inspectionTypeCode: string;
  /** 찾은 의뢰를 고른다 — 화면의 기존 선택 함수를 그대로 넘긴다. */
  onFound: (inspectionRequestId: number) => void;
}

/**
 * LOT 바코드로 검사 대상을 바로 연다(omf-all-around#58).
 *
 * ⭐ 스캐너는 번호를 치고 Enter 를 보낸다 — 폼 제출 하나로 받는다. 찾으면 화면의 목록 조건은 그대로 두고
 *    그 의뢰를 «선택»만 한다(조건을 바꾸면 사용자가 걸어 둔 조건이 말없이 사라진다).
 * ⚠ 대기·진행 중인 의뢰만 찾는다 — 끝난 검사는 검사실적 조회(W-03-05)에서 판정으로 거른다.
 */
export const LotScan = ({ inspectionTypeCode, onFound }: LotScanProps) => {
  const { client } = useApiClient();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isFinding, setIsFinding] = useState(false);

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
        setMessage(t.notFound);
        return;
      }
      const requests = await runRequest(() =>
        client.GET('/quality/inspection-requests', {
          params: {
            query: { inspectionTypeCode, pendingOnly: true, lotId: lot.lotId, page: 1, size: 5 },
          },
        }),
      );
      const found = requests.items[0];
      if (found === undefined) {
        setMessage(t.noRequest);
        return;
      }
      setValue('');
      onFound(found.inspectionRequestId);
    } catch {
      setMessage(t.failed);
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <form className="form-actions" aria-label={t.label} onSubmit={(event) => void find(event)}>
      <TextField
        label={t.label}
        placeholder={t.placeholder}
        value={value}
        disabled={isFinding}
        onChange={(event) => setValue(event.target.value)}
      />
      <Button
        type="submit"
        variant="outlined"
        size="sm"
        disabled={isFinding || value.trim() === ''}
      >
        {t.find}
      </Button>
      {message !== null && <p className="field-note">{message}</p>}
    </form>
  );
};
