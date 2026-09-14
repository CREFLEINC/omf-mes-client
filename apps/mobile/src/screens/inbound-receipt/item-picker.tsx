import { AlertBanner, Button, Card, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useState } from 'react';

import { ITEM_SEARCH_LIMIT, useItemSearch, type ItemOption } from '../../patterns/masters';

const t = messages.inboundReceipt.itemPicker;

/** 글자 사이를 이만큼 쉬면 다 적은 것으로 본다. 손가락으로 치는 속도보다 넉넉하다. */
const SETTLE_MS = 250;

interface ItemPickerProps {
  onPick: (item: ItemOption) => void;
  onCancel: () => void;
}

/**
 * 적기를 멈춘 뒤의 값.
 *
 * 글자마다 물으면 한 번 찾는 데 요청이 글자 수만큼 나간다. 9,000건 마스터를 현장 무선으로
 * 부르는 자리라 그 값이 그대로 기다림이 되고, 글자마다 결과가 비었다 찼다 해 목록이 깜빡인다.
 */
const useSettled = (term: string): string => {
  const [settled, setSettled] = useState(term);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSettled(term);
    }, SETTLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [term]);

  return settled;
};

/**
 * 품목을 찾아서 고르는 자리.
 *
 * 폼 안의 목록으로 두지 않는다 - 마스터가 커서 늘어놓을 수 없고, 앞에서 잘린 목록은 있는
 * 품목을 없는 것으로 보인다. 찾는 일에 화면을 통째로 내주고 고르면 폼으로 돌아간다.
 *
 * 라우터를 쓰지 않는다. 다른 주소로 나갔다 오면 스캔한 번호와 고른 자재 P/O 가 사라진다.
 */
export const ItemPicker = ({ onPick, onCancel }: ItemPickerProps) => {
  const [term, setTerm] = useState('');
  const search = useItemSearch(useSettled(term));
  const found = search.data ?? [];
  /* 한 쪽에서 잘렸다. 말하지 않으면 뒤에 있는 품목이 없는 것으로 읽힌다. */
  const capped = found.length >= ITEM_SEARCH_LIMIT;

  return (
    <div className="receipt-picker">
      <h2>{t.title}</h2>

      <SearchInput
        label={t.searchLabel}
        placeholder={t.searchPlaceholder}
        size="xl"
        fullWidth
        autoFocus
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
        }}
      />

      {search.isError ? <AlertBanner variant="error" title={t.failed} /> : null}
      {search.isFetching ? (
        <p className="receipt-picker__note" role="status">
          {t.loading}
        </p>
      ) : null}
      {search.isSuccess && found.length === 0 ? (
        <p className="receipt-picker__note">{t.empty}</p>
      ) : null}
      {capped ? (
        <p className="receipt-picker__note">{t.capped(String(ITEM_SEARCH_LIMIT))}</p>
      ) : null}

      <ul className="receipt-picker__list">
        {found.map((each) => (
          <li key={each.itemId}>
            <Card
              bordered
              interactive
              onClick={() => {
                onPick(each);
              }}
            >
              <Card.Body className="card-body receipt-picker__item">
                <strong>{each.itemCode}</strong>
                <p>{each.itemName}</p>
              </Card.Body>
            </Card>
          </li>
        ))}
      </ul>

      <Button variant="outlined" size="xl" className="receipt-picker__back" onClick={onCancel}>
        {t.cancel}
      </Button>
    </div>
  );
};
