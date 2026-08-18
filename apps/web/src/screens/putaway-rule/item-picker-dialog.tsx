import {
  AlertBanner,
  Button,
  type Column,
  Dialog,
  EmptyState,
  SkeletonText,
  Table,
  TextField,
} from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useId, useState } from 'react';

import { useItemSearch, type ItemSearchRow } from './lookups';

const t = messages.putawayRule;

export interface ItemPickerDialogProps {
  onPick: (row: ItemSearchRow) => void;
  onClose: () => void;
}

/**
 * 품목을 **찾아서 고르는** 창.
 *
 * ## 왜 선택칸이 아닌가
 *
 * 품목은 수천 건일 수 있어 펼침 목록에 담을 수 없다. 그렇다고 번호를 입력받으면 **내부
 * 식별자를 사용자에게 내는 것**이라 이 저장소 관례에 어긋난다(`omf-mes#44`) — 사용자는 그
 * 번호를 알 수도 확인할 수도 없다.
 *
 * ## 창 안에 펼침 선택칸을 두지 않는다
 *
 * 창 본문이 펼침 목록을 잘라 무엇을 고르는지 읽을 수 없다(`design-system-v2-webui#68`).
 * 그래서 결과를 **표**로 그리고 행을 눌러 고른다 — 창이 스크롤되면 표가 함께 스크롤된다.
 *
 * ## 검색어를 창이 소유한다
 *
 * 창은 열 때 새로 서고 닫으면 사라진다 — 검색어도 그 수명을 따른다. 바깥에 두면 창을 닫았다
 * 다시 열었을 때 지난 검색 결과가 그대로 서 있고, 사용자는 그것을 지금 조건의 결과로 읽는다.
 *
 * **검색어가 비면 조회하지 않는다** — 빈 검색어로 받은 앞 N건은 고를 만한 후보가 아니다.
 * 그 상태를 「결과 없음」이 아니라 「아직 찾지 않았다」로 말한다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const ItemPickerDialog = ({ onPick, onClose }: ItemPickerDialogProps) => {
  const keywordId = useId();
  /** 치고 있는 말. 조회는 「찾기」를 눌러야 나간다 — 글자마다 요청을 보내지 않는다. */
  const [keyword, setKeyword] = useState('');
  const [submitted, setSubmitted] = useState('');

  const search = useItemSearch(submitted);

  const submit = (): void => {
    setSubmitted(keyword.trim());
  };

  const columns: Column<ItemSearchRow>[] = [
    {
      key: 'itemCode',
      header: t.fields.itemCode,
      width: '160px',
      render: (row) => row.itemCode,
    },
    {
      key: 'itemName',
      header: t.fields.itemName,
      render: (row) => (
        <button
          type="button"
          className="link-cell"
          /* 보이는 글자가 품목명뿐이라 코드를 함께 담는다 — 같은 이름이 여럿일 수 있다. */
          aria-label={t.actions.chooseItem(`${row.itemCode} · ${row.itemName}`)}
          onClick={() => {
            onPick(row);
          }}
        >
          {row.itemName}
        </button>
      ),
    },
  ];

  /**
   * **아직 찾지 않음 → 실패 → 불러오는 중 → 표** 순서로 하나만 낸다.
   *
   * 실패를 로딩보다 앞에서 판정한다 — 먼저 로딩을 보면 실패한 조회가 영원히 「찾는 중」으로
   * 보이고, 사용자는 기다리면 될 일이라고 읽는다(사본 대조 추가 ①).
   */
  const resultSlot = () => {
    if (submitted === '') {
      return <EmptyState size="sm" title={t.itemPicker.beforeSearch} />;
    }

    if (search.isError) {
      return <AlertBanner variant="warning">{t.itemPicker.searchFailed}</AlertBanner>;
    }

    if (search.isLoading) {
      return (
        <div role="status" aria-label={t.loading.itemSearch}>
          <SkeletonText lines={3} />
        </div>
      );
    }

    return (
      <Table
        density="compact"
        columns={columns}
        rows={[...search.rows]}
        getRowId={(row) => String(row.itemId)}
        empty={<EmptyState size="sm" live title={t.itemPicker.noResult} />}
      />
    );
  };

  return (
    <Dialog
      open
      onClose={onClose}
      size="md"
      title={t.itemPicker.title}
      footer={
        <Button variant="outlined" onClick={onClose}>
          {messages.common.cancel}
        </Button>
      }
    >
      <div className="filter-bar">
        <div className="field-cell">
          <label className="field-label" htmlFor={keywordId}>
            {t.itemPicker.keywordLabel}
          </label>
          <TextField
            id={keywordId}
            value={keyword}
            placeholder={t.itemPicker.keywordPlaceholder}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
            /* 검색칸에서 엔터를 치면 창이 통째로 확인되는 것을 막고 검색만 한다. */
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;

              event.preventDefault();
              submit();
            }}
          />
        </div>
        <div className="field-cell">
          <Button variant="outlined" onClick={submit}>
            {t.actions.searchItems}
          </Button>
        </div>
      </div>

      {resultSlot()}

      {/* 잘렸다는 사실을 감추면 사용자가 「그런 품목은 없다」로 읽고 검색을 그만둔다. */}
      {search.truncated && <p className="field-note">{t.itemPicker.truncated}</p>}
    </Dialog>
  );
};
