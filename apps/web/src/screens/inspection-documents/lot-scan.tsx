import { Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';

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
  /**
   * 바뀔 때마다 칸을 비우고 커서를 둔다 — 부품 IQC 가 제출한 뒤 다음 LOT 을 바로 스캔하게(사용자 지시 2026-10-30).
   * 처음 그릴 때(0)는 건드리지 않는다.
   */
  focusSignal?: number;
  /**
   * 입하 LOT 번호(`IL-…`)로도 검사를 연다(005 W-01-01 · T138) — 그 번호를 찾을 공장들. 주면 칸 문구가 「자재 관리 LOT
   * 바코드 스캔 또는 입하 LOT 번호」로 바뀐다. 입하 LOT 조회는 공장이 필수라 화면이 고른 공장(또는 범위 공장)을 넘긴다.
   */
  inboundLotPlantIds?: readonly number[];
}

/** 입하 LOT 번호 머리 — `IL-YYYYMMDD-NNNN`(이전 데이터 `IL-MIG-…` 포함). 자재 관리 LOT 번호는 품목 코드로 시작한다. */
const INBOUND_LOT_PREFIX = 'IL-';

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
  focusSignal = 0,
  inboundLotPlantIds,
}: LotScanProps) => {
  const inboundMode = inboundLotPlantIds !== undefined;
  const label = inboundMode ? t.inbound.label : t.label;
  const { client } = useApiClient();
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isFinding, setIsFinding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusSignal === 0) return;
    setValue('');
    setMessage(null);
    inputRef.current?.focus();
  }, [focusSignal]);

  /* 실패한 번호를 골라 둔다 — 다음 스캔이 그 자리를 덮어쓴다. */
  const fail = (text: string): void => {
    setMessage(text);
    inputRef.current?.focus();
    inputRef.current?.select();
  };

  /** 입하 LOT 번호 → id — 공장마다 번호로 찾고 정확히 같은 것만 받는다. */
  const findInboundLotId = async (inboundLotNo: string): Promise<number | null> => {
    for (const plantId of inboundLotPlantIds ?? []) {
      const page = await runRequest(() =>
        client.GET('/logistics/inbound-lots', {
          params: { query: { plantId, q: inboundLotNo, page: 1, size: 5 } },
        }),
      );
      const hit = page.items.find((item) => item.inboundLotNo === inboundLotNo);
      if (hit !== undefined) return hit.inboundLotId;
    }
    return null;
  };

  /** 입하 LOT 의 대기·진행 IQC 의뢰를 연다(계약 §8 `inboundLotId` 조건). */
  const openInboundLot = async (inboundLotNo: string): Promise<void> => {
    const inboundLotId = await findInboundLotId(inboundLotNo);
    if (inboundLotId === null) {
      fail(t.inbound.notFound);
      return;
    }
    const requests = await runRequest(() =>
      client.GET('/quality/inspection-requests', {
        params: {
          query: { inspectionTypeCode, pendingOnly: true, inboundLotId, page: 1, size: 5 },
        },
      }),
    );
    const found = requests.items[0];
    if (found === undefined) {
      fail(t.inbound.noRequest);
      return;
    }
    setValue('');
    onFound(found.inspectionRequestId);
  };

  const find = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const lotNo = value.trim();
    if (lotNo === '') return;
    setMessage(null);
    setIsFinding(true);
    try {
      if (inboundMode && lotNo.toUpperCase().startsWith(INBOUND_LOT_PREFIX)) {
        await openInboundLot(lotNo);
        return;
      }
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
    <form className="form-actions" aria-label={label} onSubmit={(event) => void find(event)}>
      <TextField
        ref={inputRef}
        label={label}
        placeholder={inboundMode ? t.inbound.placeholder : t.placeholder}
        {...(inboundMode ? { helperText: t.inbound.hint } : {})}
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
