import { AlertBanner, Button, Card, SearchInput } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { useItemSearch, type ItemOption } from '../../patterns/masters';

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
  const settled = useSettled(term);
  const search = useItemSearch(settled);
  const found = search.data?.items ?? [];
  /* 뒤에 얼마나 더 있는지. 남은 수를 보여야 더 볼지 좁힐지 사람이 정할 수 있다. */
  const remaining = Math.max((search.data?.total ?? 0) - found.length, 0);
  /*
   * 구르는 것은 셸의 본문 영역이라 이 부품이 들고 있지 않다. 맨 위 요소를 화면 안으로
   * 들이면 무엇이 구르든 브라우저가 알아서 그것을 굴린다.
   */
  const top = useRef<HTMLHeadingElement | null>(null);
  const field = useRef<HTMLInputElement | null>(null);

  return (
    <div className="receipt-picker">
      <h2 ref={top}>{t.title}</h2>

      <SearchInput
        ref={field}
        label={t.searchLabel}
        placeholder={t.searchPlaceholder}
        size="xl"
        fullWidth
        autoFocus
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
        }}
        onClear={() => {
          /*
           * 지우기는 다 적었다는 뜻이다. 그대로 두면 자판이 목록을 절반 덮은 채로 남는다 -
           * DS 의 지우기가 칸에 포커스를 되돌리므로 여기서 거둔다.
           */
          field.current?.blur();
        }}
      />

      {search.isError ? <AlertBanner variant="error" title={t.failed} /> : null}
      {/* 첫 쪽을 받는 중에만 말한다. 더 부르는 중은 단추가 스스로 말한다. */}
      {search.isFetching && !search.isFetchingNextPage ? (
        <p className="receipt-picker__note" role="status">
          {t.loading}
        </p>
      ) : null}
      {search.isSuccess && found.length === 0 ? (
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

      {/* 뒤에 더 있으면 그 수를 달고 선다. 없으면 서지 않아 끝이라는 것이 보인다. */}
      {search.hasNextPage ? (
        <Button
          variant="outlined"
          size="xl"
          className="receipt-picker__more"
          disabled={search.isFetchingNextPage}
          onClick={() => {
            void search.fetchNextPage();
          }}
        >
          {search.isFetchingNextPage ? t.loading : t.more(String(remaining))}
        </Button>
      ) : null}

      <Button variant="outlined" size="xl" className="receipt-picker__back" onClick={onCancel}>
        {t.cancel}
      </Button>

      {/* 목록이 길어 맨 끝까지 내려간 손이 처음으로 돌아올 길이 없다. 늘 같은 자리에 둔다. */}
      <button
        type="button"
        className="receipt-picker__to-top"
        aria-label={t.toTop}
        onClick={() => {
          top.current?.scrollIntoView({ block: 'start' });
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path
            d="M12 5.5 19 12.5 17.6 13.9 13 9.3V19h-2V9.3L6.4 13.9 5 12.5z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
};
