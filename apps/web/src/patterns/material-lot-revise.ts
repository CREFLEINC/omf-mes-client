import type {
  ApiClient,
  ApiError,
  MaterialLotRevise,
  MaterialLotTabRow,
  MaterialPackage,
} from '@omf-mes/api-client';

import { checkBatch, type BatchCheck, type BatchDraft } from './material-lot-batch';
import { runRequest } from './request';

/**
 * 출력 전 자재 관리 LOT 수정(피처 014 FR-016 · FR-017 · 계약 §3 `POST /logistics/material-lots/{lotId}:revise`).
 *
 * POP P-01-01 [수정] 창과 관리웹 W-01-14 [수정] 창이 **같은 칸 · 같은 규칙**이다 — 그림만 다르다. 칸 · 곱 검사는
 * 발행 창(`material-lot-batch`)과 같은 규칙을 그대로 쓴다(개수 · 공급사 LOT 번호 칸만 없다).
 *
 * ⭐ 수량이 바뀌면 LOT 번호의 수량 자리가 바뀌므로 서버가 새 일련을 준다 — 창은 「저장 뒤 번호」를 일련 없이(`NNNN`)
 *    미리 보인다. 수량이 같고 패키징만 바뀌면 번호는 그대로다.
 * ⛔ 한 번이라도 출력한 LOT 은 고치지 않는다 — 화면은 미출력 줄에만 [수정]을 두고, 서버는 409 `ALREADY_PRINTED`.
 */

type Client = ApiClient['client'];

/** 고칠 LOT 의 지금 값 — 탭 줄 · 화면 줄 어느 것이든. */
export interface RevisableLot {
  lotQty: number;
  package: MaterialPackage | null;
}

const text = (value: number): string => String(value);

/** 지금 값으로 창을 채운다 — 패키징이 있으면 넣기, 재고량은 곱을 따라간다. */
export const reviseDraftOf = (
  lot: RevisableLot,
  fallbackPackageUomId: number | null,
): BatchDraft => ({
  packageOn: lot.package !== null,
  packageUomId: lot.package?.uomId ?? fallbackPackageUomId,
  packageCount: lot.package === null ? '' : text(lot.package.count),
  qtyPerPackage: lot.package === null ? '' : text(lot.package.qtyPerPackage),
  lotQty: text(lot.lotQty),
  /* 패키징이 없으면 재고량이 곧 값이다. 있으면 곱을 따라가다가 사람이 고치면 그 값을 둔다. */
  lotQtyEdited: lot.package === null,
  supplierLotNo: '',
  /* 수정은 개수가 없다 — 발행 창 검사의 개수 칸은 늘 맞게 둔다. */
  lotCount: '1',
});

/** 발행 창과 같은 규칙으로 본다(곱 · 정수 · 0 초과). 개수 오류는 생기지 않는다. */
export const checkRevise = (draft: BatchDraft, integerOnly: boolean): BatchCheck =>
  checkBatch({ ...draft, lotCount: '1' }, integerOnly);

/** 계약 §3 본문 — 검사를 통과한 값만. `package: null` 은 패키징 없음. */
export const toReviseBody = (check: BatchCheck): MaterialLotRevise | null => {
  if (!check.ok || check.lotQty === null) return null;

  return {
    qty: check.lotQty,
    package:
      check.package === null
        ? null
        : {
            uomId: check.package.uomId,
            count: check.package.count,
            qtyPerPackage: check.package.qtyPerPackage,
          },
  };
};

/**
 * 저장 뒤 번호 미리 보기 — 수량 자리를 새 수량으로, 일련은 서버가 매기므로 `NNNN`. 수량이 같으면 지금 번호 그대로.
 * 번호가 `품목|수량|YYMMDD|공급사|NNNN` 꼴이 아니면 `null`(미리 보이지 않는다).
 */
export const lotNoAfterRevise = (lotNo: string, qty: number | null): string | null => {
  const parts = lotNo.split('|');

  if (parts.length !== 5 || qty === null) return null;
  if (parts[1] === String(qty)) return lotNo;

  return [parts[0], String(qty), parts[2], parts[3], 'NNNN'].join('|');
};

export const reviseMaterialLot = async (
  client: Client,
  lotId: number,
  body: MaterialLotRevise,
  headers: { idempotencyKey: string; workerNo?: string | null },
): Promise<MaterialLotTabRow> =>
  runRequest(() =>
    client.POST('/logistics/material-lots/{lotId}:revise', {
      params: {
        path: { lotId },
        header: {
          'Idempotency-Key': headers.idempotencyKey,
          ...(headers.workerNo === undefined || headers.workerNo === null
            ? {}
            : { 'X-Worker-No': headers.workerNo }),
        },
      },
      body,
    }),
  );

/** 수정 거절의 갈래 — 창이 자기 문구로 옮긴다. */
export type ReviseRejection = 'alreadyPrinted' | 'stateLocked' | 'conflict' | 'other';

const codesOf = (error: ApiError): string[] => {
  if (error.kind === 'validation' || error.kind === 'stateLocked') {
    return error.errors.map((item) => item.code);
  }
  if (error.kind === 'http' && error.code !== undefined) return [error.code];

  return [];
};

/** 409 `ALREADY_PRINTED` · `STATE_LOCKED` · `LOT_NO_CONFLICT` 를 가른다. 그 밖(400 등)은 `other`. */
export const reviseRejectionOf = (error: ApiError): ReviseRejection => {
  const codes = codesOf(error);

  if (codes.includes('ALREADY_PRINTED')) return 'alreadyPrinted';
  if (codes.includes('LOT_NO_CONFLICT')) return 'conflict';
  if (codes.includes('STATE_LOCKED') || error.kind === 'stateLocked') return 'stateLocked';

  return 'other';
};
