import { AlertBanner, Button, Card, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useState } from 'react';

import { useItemSearch, type ItemOption } from '../../patterns/masters';

const t = messages.inboundReceipt.itemPicker;

interface ItemPickerProps {
  onPick: (item: ItemOption) => void;
  onCancel: () => void;
}

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
  const search = useItemSearch(term);
  const asked = term.trim() !== '';
  const found = search.data ?? [];

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
      {!asked ? <p className="receipt-picker__note">{t.prompt}</p> : null}
      {asked && search.isFetching ? (
        <p className="receipt-picker__note" role="status">
          {t.loading}
        </p>
      ) : null}
      {asked && search.isSuccess && found.length === 0 ? (
        <p className="receipt-picker__note">{t.empty}</p>
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
