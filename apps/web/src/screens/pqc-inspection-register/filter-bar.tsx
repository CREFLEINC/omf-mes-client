import { Button, Checkbox, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { useApiClient } from '../../patterns/api-context';
import { hasChangedFilters } from '../../patterns/filter-more';
import { ItemSelect } from '../../patterns/item-select';
import { runRequest } from '../../patterns/request';

const t = messages.pqcInspectionRegister.filters;

/** 조건 줄의 「전체」 — 빈 값이라 좁히지 않는다. */
const ALL_ITEMS = [{ value: '', label: t.all }];

/** 걸어 둔 조건 — 품목(번호) · 작업지시(번호와 입력한 W/O 번호) · 의뢰번호 검색어. 비면 좁히지 않는다. */
export interface PqcFilters {
  itemId: number | null;
  workOrderId: number | null;
  workOrderNo: string;
  keyword: string;
}

export const EMPTY_PQC_FILTERS: PqcFilters = {
  itemId: null,
  workOrderId: null,
  workOrderNo: '',
  keyword: '',
};

export interface PqcFilterBarProps {
  applied: PqcFilters;
  /** 「대기·진행만 보기」 — 조회 단추를 거치지 않고 바로 반영된다. */
  pendingOnly: boolean;
  onTogglePendingOnly: (pendingOnly: boolean) => void;
  onSearch: (filters: PqcFilters) => void;
  onReset: () => void;
  /** 「대기·진행만 보기」를 이 줄에 둔다(기본). 검사 조회·판정 탭은 스캔 줄에 따로 둔다(#225). */
  showPendingOnly?: boolean;
  /** 탭 줄 상태 칩 — 초기화가 함께 푸므로 걸려 있으면 「초기화」가 보인다. */
  statusCode?: string | null;
}

/**
 * W-03-11 목록 조건 줄(omf-all-around#135) — IQC 판정 화면(#133)의 조건 줄과 같은 모양이다.
 * 품목 검색(칸에서 바로 검색해 고른다 · omf-all-around#226) · 작업지시 검색(W/O 번호) · 의뢰번호 검색 · [조회][초기화]. 서버 목록 질의 `itemId`·`q` 를 그대로 쓴다.
 * PQC 는 대상이 작업지시라 공급사·LOT 스캔 조건이 없다.
 */
export const PqcFilterBar = ({
  applied,
  pendingOnly,
  onTogglePendingOnly,
  onSearch,
  onReset,
  showPendingOnly = true,
  statusCode = null,
}: PqcFilterBarProps) => {
  const [itemId, setItemId] = useState<number | null>(applied.itemId);
  const [keyword, setKeyword] = useState(applied.keyword);
  const [workOrderNo, setWorkOrderNo] = useState(applied.workOrderNo);
  const [workOrderError, setWorkOrderError] = useState<string | null>(null);

  /*
   * 걸린 조건이 밖에서 바뀌면(접힌 칸의 칩 × · 초기화) 편집 중인 값도 그 값으로 되돌린다 — 값으로 판정한다.
   * 칩으로 푼 조건이 칸에 남아 있다가 다음 [조회]에 다시 실리지 않게.
   */
  const {
    itemId: appliedItemId,
    workOrderNo: appliedWorkOrderNo,
    keyword: appliedKeyword,
  } = applied;
  useEffect(() => {
    setItemId(appliedItemId);
    setWorkOrderNo(appliedWorkOrderNo);
    setKeyword(appliedKeyword);
    setWorkOrderError(null);
  }, [appliedItemId, appliedWorkOrderNo, appliedKeyword]);

  /*
   * 「초기화」는 바뀐 것이 있을 때만 보인다(C-6) — 치던 값이나 조회에 쓰인 값(「대기·진행만 보기」 · 탭 줄 상태 칩 포함)이
   * 처음 값과 다를 때. 초기화가 그 모두를 처음으로 되돌리기 때문이다.
   */
  const isChanged =
    hasChangedFilters(EMPTY_PQC_FILTERS, applied, {
      ...applied,
      itemId,
      workOrderNo: workOrderNo.trim(),
      keyword: keyword.trim(),
    }) ||
    !pendingOnly ||
    statusCode !== null;
  const [isFinding, setIsFinding] = useState(false);
  const { client } = useApiClient();
  const itemFieldId = useId();

  /*
   * 작업지시 번호 → 작업지시 하나. 목록 질의는 번호(`workOrderId`)로 거르므로 조회 때 W/O 번호 검색으로 하나를 찾는다.
   * 번호가 똑같은 것이 있으면 그것, 아니면 결과가 하나일 때만 그것이다 — 여럿이면 고르지 않고 정확히 입력하라고 한다.
   */
  const findWorkOrder = async (no: string): Promise<number | null> => {
    const found = await runRequest(() =>
      client.GET('/production/work-orders', { params: { query: { q: no, page: 1, size: 20 } } }),
    );
    const exact = found.items.find((row) => row.workOrderNo.toUpperCase() === no.toUpperCase());
    if (exact !== undefined) return exact.workOrderId;
    const [only, ...rest] = found.items;
    if (only !== undefined && rest.length === 0) return only.workOrderId;
    setWorkOrderError(only === undefined ? t.workOrderNotFound : t.workOrderAmbiguous);
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const no = workOrderNo.trim();
    setWorkOrderError(null);
    if (no === '') {
      onSearch({ itemId, workOrderId: null, workOrderNo: '', keyword: keyword.trim() });
      return;
    }
    setIsFinding(true);
    try {
      const workOrderId = await findWorkOrder(no);
      if (workOrderId !== null)
        onSearch({ itemId, workOrderId, workOrderNo: no, keyword: keyword.trim() });
    } catch {
      setWorkOrderError(t.workOrderFailed);
    } finally {
      setIsFinding(false);
    }
  };

  return (
    <form className="filter-bar pqc-web-filter-bar" onSubmit={(event) => void submit(event)}>
      {/* 품목은 칸에서 바로 검색해 고른다 — 지난 의뢰를 찾으니 사용 중지 품목까지(종전 품목 선택 창과 같은 범위). */}
      <div className="field-cell search-select-cell">
        <label className="field-label" htmlFor={itemFieldId}>
          {t.item}
        </label>
        <ItemSelect
          id={itemFieldId}
          includeInactive
          leadingOptions={ALL_ITEMS}
          value={itemId === null ? '' : String(itemId)}
          placeholder={t.all}
          onChange={(value) => {
            if (value !== '') {
              setItemId(Number(value));
              return;
            }
            setItemId(null);
            /*
             * 「전체」는 종전 × 자리다 — 품목 조건을 풀고 바로 다시 조회한다(#135 · 담당자 지시).
             * 다른 조건은 걸어 둔 그대로 — 품목 하나만 푼다.
             */
            onSearch({ ...applied, itemId: null });
          }}
        />
      </div>
      <TextField
        label={t.workOrder}
        placeholder={t.workOrderPlaceholder}
        value={workOrderNo}
        error={workOrderError ?? undefined}
        onChange={(event) => {
          setWorkOrderNo(event.target.value);
          setWorkOrderError(null);
        }}
      />
      <TextField
        label={t.keyword}
        placeholder={t.keywordPlaceholder}
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
      />
      {showPendingOnly && (
        <div className="field-cell-unlabeled pqc-web-filter-check">
          <div className="check-group">
            <Checkbox
              checked={pendingOnly}
              onChange={(event) => onTogglePendingOnly(event.target.checked)}
            >
              {messages.pqcInspectionRegister.queue.pendingOnly}
            </Checkbox>
          </div>
        </div>
      )}
      <div className="filter-actions field-cell-unlabeled pqc-web-filter-actions">
        <Button type="submit" variant="filled" disabled={isFinding}>
          {t.apply}
        </Button>
        {isChanged && (
          <Button
            type="button"
            variant="outlined"
            onClick={() => {
              setItemId(null);
              setWorkOrderNo('');
              setWorkOrderError(null);
              setKeyword('');
              onReset();
            }}
          >
            {t.reset}
          </Button>
        )}
      </div>
    </form>
  );
};
