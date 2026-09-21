import {
  AlertBanner,
  Button,
  Checkbox,
  Dialog,
  Select,
  Table,
  TextField,
  type Column,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import {
  ITEM_PAGE_SIZE,
  useItemAvailability,
  useItemSearch,
  useItemTypeOptions,
  type AvailabilityState,
  type ItemRow,
} from './queries';

const t = messages.itemPicker;

/**
 * 품목을 **검색해서 고르는 대화상자.**
 *
 * ⛔ **선택칸에 담을 수 없다.** 품목 마스터가 수천 건이라 한 쪽만 실으면 그 너머는 고를 방법이
 *    아예 없다 — 잘림 안내는 그 사실을 말할 뿐 길을 주지 않는다. 같은 문제를 만난 `W-06-05`
 *    (품목 확장속성)도 대화상자 안 검색으로 풀었다.
 *
 * 그 화면의 인라인 픽커와 **규칙 하나를 나눠 쓴다** — **「찾기」로만 조회한다.** 글자마다 요청을
 * 보내지 않고, 검색칸의 엔터는 창을 확인하지 않고 검색만 한다.
 *
 * ⭐ **검색어가 비면 고른 유형의 전체를 보인다**(사용자 지시 2026-09-18). 그쪽이 쓰는 「검색어가
 * 비면 조회하지 않는다」는 **이 창에는 맞지 않는다** — 자세한 까닭은 `queries.ts` 의
 * `useItemSearch` 머리말에 적었다.
 *
 * ⚠ **형태는 다르다.** 그쪽은 폼 «안»의 인라인 필드 묶음이고 이것은 대화상자 + 체크박스 표다.
 *   그래서 그 컴포넌트를 옮겨 오지 않고 여기에 새로 세웠다 — 옮기면 그 화면의 조작까지 바뀐다.
 *   언젠가 그 화면도 이 창으로 옮길 수 있고, 그때 이 자리가 이미 공용이다.
 *
 * ⛔ **중지된 품목은 내지 않는다**(`includeInactive` 를 주지 않는다 — `queries.ts`).
 * ⛔ **이미 담긴 품목을 막지 않는다** — 표식만 단다. 편성은 같은 품목 두 라인을 허용한다.
 */
export interface ItemPickerDialogProps {
  /**
   * 여러 품목을 한 번에 고를 수 있는가.
   *
   * - `true` — 「라인 추가」에서 열었다. 고른 품목마다 라인이 붙는다.
   * - `false` — 라인의 품목 셀에서 열었다. 그 라인의 품목 하나를 바꾼다.
   */
  multiple: boolean;
  /**
   * 처음 세울 유형 코드. 비우면 「전체」다.
   *
   * ⭐ 부르는 쪽이 정한다 — **업무마다 좁히는 범위가 다르다.** 이 부품은 어느 유형이 맞는지
   *    알지 않는다.
   */
  defaultItemTypeCode?: string;
  /** 이미 라인에 담긴 품목 번호. 표식을 다는 데만 쓴다 — 고르는 것을 막지 않는다. */
  addedItemIds?: readonly number[];
  onClose: () => void;
  /** 고른 품목들. 단일 선택이어도 배열로 준다 — 부르는 쪽의 분기를 하나로 둔다. */
  onConfirm: (items: ItemRow[]) => void;
  /**
   * 사용 중지된 품목도 찾는다. 조회 필터처럼 지난 자료를 찾는 쪽이 켠다. 기본 false —
   * 편성·등록 화면은 중지 품목을 새로 고르지 않는다.
   */
  includeInactive?: boolean;
  /** 가용 재고 열. 조회 필터처럼 재고와 상관없는 쪽은 끈다 — 끄면 품목마다 가는 재고 요청도 없다. 기본 true. */
  showAvailability?: boolean;
  /** 확인 단추 이름. 비우면 종전대로 「추가」/「교체」. */
  confirmLabel?: string;
  /**
   * Routing 이 있는 품목만 낸다. 만들 수 없는 품목을 고르면 그 뒤에 막히는 화면이 켠다
   * (omf-all-around#43 · 긴급 W/O 발행). 기본 false — 다른 창의 후보는 좁히지 않는다.
   */
  hasRouting?: boolean;
  /**
   * 표를 가운데로 세우고, 오른쪽 위 × 와 꼬리말 건수를 뺀 «정돈된» 모양으로 연다.
   *
   * ⭐ **부르는 쪽이 켠다**(사용자 결정 2026-09-21 · 긴급 W/O 발행에서만). 이 창은 네 화면이
   * 나눠 쓰므로(IQC 수입검사 · Lot Status 이력 · 출하 요청 생성 · 긴급 W/O 발행), 한 화면의
   * 보기 규칙을 전 화면에 밀면 감지기 없는 자리에서 조용히 바뀐다. 기본은 꺼짐 — 나머지
   * 화면은 종전 모양 그대로다.
   */
  compact?: boolean;
  /**
   * 결과가 0건일 때의 문구. 비우면 공용 문구(`t.noResult`)다.
   *
   * ⭐ **후보를 좁힌 창은 그 사실을 여기서 말해야 한다.** 좁혀 놓고 「코드나 이름의 일부로 다시
   * 찾아보세요」라고만 하면, 있는 품목을 없다고 읽고 검색어만 바꾸게 된다(omf-all-around#43).
   */
  emptyText?: string;
}

const describeAvailability = (state: AvailabilityState): string => {
  switch (state.kind) {
    case 'loading':
      return t.availability.loading;
    case 'failed':
      return t.availability.failed;
    case 'qty':
      return state.value.toLocaleString('ko-KR');
  }
};

export const ItemPickerDialog = ({
  multiple,
  defaultItemTypeCode = '',
  addedItemIds = [],
  onClose,
  onConfirm,
  includeInactive = false,
  showAvailability = true,
  confirmLabel,
  hasRouting = false,
  compact = false,
  emptyText,
}: ItemPickerDialogProps) => {
  const keywordId = useId();
  const typeId = useId();

  const [keyword, setKeyword] = useState('');
  /** 실제로 조회에 나간 검색어. 「찾기」를 눌러야 바뀐다. */
  const [submitted, setSubmitted] = useState('');
  const [itemTypeCode, setItemTypeCode] = useState(defaultItemTypeCode);
  const [page, setPage] = useState(1);
  /** 고른 품목을 **줄 그대로** 들고 있는다 — 쪽을 넘겨도 고름이 남고, 확인할 때 다시 찾지 않는다. */
  const [picked, setPicked] = useState<ItemRow[]>([]);

  const types = useItemTypeOptions(true);
  const search = useItemSearch(submitted, itemTypeCode, page, includeInactive, hasRouting);
  const rows = search.data?.rows ?? [];
  const total = search.data?.total ?? 0;
  const availabilityOf = useItemAvailability(showAvailability ? rows.map((row) => row.itemId) : []);

  const submit = (): void => {
    setPage(1);
    setSubmitted(keyword.trim());
  };

  const toggle = (row: ItemRow): void => {
    setPicked((prev) => {
      const without = prev.filter((each) => each.itemId !== row.itemId);

      if (without.length !== prev.length) return without;

      /* 단일 선택이면 앞의 고름을 밀어낸다 — 두 개가 고른 상태로 남으면 무엇이 나갈지 갈린다. */
      return multiple ? [...prev, row] : [row];
    });
  };

  const typeOptions = [
    { value: '', label: t.typeAll },
    ...(types.data ?? []).map((option) => ({ value: option.code, label: option.codeName })),
  ];

  const columns: Column<ItemRow>[] = [
    {
      key: 'select',
      header: t.columns.select,
      align: 'center',
      width: '64px',
      render: (row) => (
        <Checkbox
          aria-label={row.itemCode}
          checked={picked.some((each) => each.itemId === row.itemId)}
          onChange={() => {
            toggle(row);
          }}
        />
      ),
    },
    /* ⭐ `compact` 인 창만 가운데 정렬이다 — 코드·유형이 짧아 왼쪽에 붙으면 열이 흩어져 보인다. */
    {
      key: 'itemCode',
      header: t.columns.itemCode,
      ...(compact ? { align: 'center' as const } : {}),
      width: '160px',
      render: (row) => row.itemCode,
    },
    {
      key: 'itemName',
      header: t.columns.itemName,
      ...(compact ? { align: 'center' as const } : {}),
      render: (row) => (
        <span>
          {row.itemName}
          {row.isActive ? '' : ` · ${t.inactive}`}
          {/* 막지 않는다 — 같은 품목 두 라인이 허용된다. 담겼다는 «사실»만 알린다. */}
          {addedItemIds.includes(row.itemId) ? ` · ${t.alreadyAdded}` : ''}
        </span>
      ),
    },
    {
      key: 'itemTypeCode',
      header: t.columns.itemType,
      ...(compact ? { align: 'center' as const } : {}),
      width: '128px',
      /* 서버가 준 코드 그대로다 — 이름은 유형 목록이 갖고, 없으면 지어내지 않는다. */
      render: (row) =>
        types.data?.find((option) => option.code === row.itemTypeCode)?.codeName ??
        row.itemTypeCode,
    },
    ...(showAvailability
      ? [
          {
            key: 'availableQty',
            header: t.columns.availableQty,
            /* 숫자 열은 오른쪽이다 — 자릿수가 맞아야 크기를 눈으로 견준다. */
            align: 'end' as const,
            width: '112px',
            render: (row: ItemRow) => describeAvailability(availabilityOf(row.itemId)),
          },
        ]
      : []),
  ];

  const from = (page - 1) * ITEM_PAGE_SIZE + 1;
  const to = Math.min(page * ITEM_PAGE_SIZE, total);
  const hasNext = page * ITEM_PAGE_SIZE < total;

  return (
    <Dialog
      open
      /*
       * ⭐ **넓은 프리셋으로 연다.** 결과 표가 다섯 열(선택·코드·이름·유형·가용)이라 기본 폭에서는
       *    오른쪽이 잘려 나갔다(실측 2026-09-18). 폭을 손으로 적지 않고 DS 프리셋을 쓴다 —
       *    손으로 적으면 DS 가 폭 규격을 바꿀 때 이 창만 어긋난다.
       */
      size="lg"
      closeOnBackdropClick={false}
      /* `compact` 창은 닫는 길이 꼬리말의 「취소」 하나다 — 같은 일을 하는 단추를 위아래에 두지 않는다. */
      showCloseButton={!compact}
      title={t.title}
      onClose={onClose}
      footer={
        <>
          {/*
           * ⭐ **꼬리말은 `compact` 창에서만 걷는다**(사용자 결정 2026-09-21). 그 창에서는
           * 「1개 선택」도 「고르면 누를 수 있습니다」도 표의 체크와 잠긴 단추가 이미 말한다.
           * ⛔ 나머지 창은 **종전 그대로** — 0건이면 안내를, 고른 뒤에는 건수를 낸다.
           */}
          {!compact && (
            <span className="field-note">
              {picked.length === 0 ? t.needsSelection : t.selectedCount(picked.length)}
            </span>
          )}
          {compact && multiple && picked.length > 0 && (
            <span className="field-note">{t.selectedCount(picked.length)}</span>
          )}
          <Button variant="outlined" onClick={onClose}>
            {t.cancel}
          </Button>
          <Button
            variant="filled"
            disabled={picked.length === 0}
            onClick={() => {
              onConfirm(picked);
            }}
          >
            {confirmLabel ?? (multiple ? t.add : t.replace)}
          </Button>
        </>
      }
    >
      <div className="item-picker-body">
        <div className="item-picker-controls">
          <div className="field-cell">
            <label className="field-label" htmlFor={typeId}>
              {t.typeLabel}
            </label>
            <Select
              id={typeId}
              options={typeOptions}
              value={itemTypeCode === '' ? null : itemTypeCode}
              placeholder={t.typeAll}
              onChange={(value) => {
                setItemTypeCode(value);
                /* 조건이 바뀌면 쪽 번호는 뜻을 잃는다 — 2쪽에 머물면 빈 쪽을 본다. */
                setPage(1);
              }}
            />
          </div>

          <div className="field-cell">
            <label className="field-label" htmlFor={keywordId}>
              {t.keywordLabel}
            </label>
            <TextField
              id={keywordId}
              fullWidth
              value={keyword}
              placeholder={t.keywordPlaceholder}
              onChange={(event) => {
                setKeyword(event.target.value);
              }}
              /* 검색칸의 엔터가 창을 통째로 확인하는 것을 막고 검색만 한다. */
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;

                event.preventDefault();
                submit();
              }}
            />
          </div>

          <Button variant="outlined" onClick={submit}>
            {t.search}
          </Button>
        </div>

        {/* 유형을 못 받아도 길을 막지 않는다 — 「전체」로는 찾을 수 있다(공유계약 G-9). */}
        {types.isError && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.typeFailed}</AlertBanner>
          </div>
        )}

        {search.isError && (
          <div className="banner-slot">
            <AlertBanner variant="warning">{t.searchFailed}</AlertBanner>
          </div>
        )}

        <div className="item-picker-results">
          <Table
            columns={columns}
            rows={rows}
            getRowId={(row) => String(row.itemId)}
            empty={search.isPending ? t.searching : search.isError ? '' : (emptyText ?? t.noResult)}
          />
        </div>

        {/*
         * ⛔ **쪽 이동 줄은 늘 선다.** 결과가 있을 때만 그리면 검색할 때마다 표의 아래 경계가
         *    움직인다 — 창 크기를 고정한 뜻이 반감된다. 건수 글만 있을 때 없고, 단추는 못 쓸 때
         *    잠긴다.
         */}
        <div className="item-picker-pager">
          {total > 0 && <span className="field-note">{t.page.range(from, to, total)}</span>}
          <Button
            variant="outlined"
            disabled={page <= 1}
            onClick={() => {
              setPage((prev) => Math.max(1, prev - 1));
            }}
          >
            {t.page.previous}
          </Button>
          <Button
            variant="outlined"
            disabled={!hasNext}
            onClick={() => {
              setPage((prev) => prev + 1);
            }}
          >
            {t.page.next}
          </Button>
        </div>
      </div>
    </Dialog>
  );
};
