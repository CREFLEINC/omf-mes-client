import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

import { readLocal, writeLocal } from '../../patterns/local-store';
import { businessDateOf, type CardState } from './receipt';

/**
 * 오늘(공장 날짜) 이 기기의 입하 등록 표에 오른 입하 LOT — 화면을 떠났다 돌아오거나 앱을 다시 켜도 그날 표가 그대로
 * 다시 나타난다(사용자 지시 2026-11-23). 기기에 남기는 것은 입하 LOT 번호와 차례뿐이고, 개수 · 수량 · 상태는 열 때마다
 * 서버에서 다시 읽는다. 날짜가 바뀌면 버린다 — 표 제목의 날짜와 같은 공장 날짜다.
 *
 * 서버의 「오늘 공장 전체 입하」가 아니라 이 기기에서 찍은 것만이다 — 다른 기기가 찍은 공급사 · 품목까지 섞이면
 * 표가 길어지고 행 번호가 흔들린다.
 */
export const TODAY_CARDS_KEY = 'inbound-receipt-today';

interface StoredLot {
  inboundLotId: number;
  inboundLotNo: string;
}

interface Stored {
  businessDate: string;
  lots: StoredLot[];
}

const isStoredLot = (value: unknown): value is StoredLot =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as StoredLot).inboundLotId === 'number' &&
  typeof (value as StoredLot).inboundLotNo === 'string';

/** 기기에 남긴 표 — 날짜가 다르거나 읽을 수 없으면 빈 표. */
export const parseTodayCards = (raw: string | null, businessDate: string): CardState[] => {
  if (raw === null) return [];

  try {
    const stored = JSON.parse(raw) as Partial<Stored> | null;

    if (stored?.businessDate !== businessDate || !Array.isArray(stored.lots)) return [];

    return stored.lots.filter(isStoredLot).map((lot) => ({
      inboundLotId: lot.inboundLotId,
      inboundLotNo: lot.inboundLotNo,
      created: false,
      registered: new Map(),
    }));
  } catch {
    return [];
  }
};

export const serializeTodayCards = (cards: readonly CardState[], businessDate: string): string =>
  JSON.stringify({
    businessDate,
    lots: cards.map(({ inboundLotId, inboundLotNo }) => ({ inboundLotId, inboundLotNo })),
  } satisfies Stored);

/**
 * 표의 입하 LOT 목록 — 화면이 열릴 때 오늘 것을 불러오고, 바뀔 때마다 남긴다. 불러오는 사이에 찍은 것은 남긴
 * 차례 뒤에 붙는다(행 번호는 처음 찍은 차례다).
 */
export const useTodayCards = (): [CardState[], Dispatch<SetStateAction<CardState[]>>] => {
  /* 화면을 연 날 — 열어 둔 채 자정을 넘기면 다음에 열 때 새 표가 된다. */
  const [businessDate] = useState(() => businessDateOf(new Date()));
  const [cards, setCards] = useState<CardState[]>([]);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void readLocal(TODAY_CARDS_KEY)
      .catch(() => null)
      .then((raw) => {
        if (cancelled) return;

        const saved = parseTodayCards(raw, businessDate);
        setCards((current) => [
          ...saved.map(
            (card) => current.find((each) => each.inboundLotId === card.inboundLotId) ?? card,
          ),
          ...current.filter(
            (each) => !saved.some((card) => card.inboundLotId === each.inboundLotId),
          ),
        ]);
        setRestored(true);
      });

    return () => {
      cancelled = true;
    };
  }, [businessDate]);

  /* 불러오기 전에 쓰면 남긴 표를 빈 표로 덮는다. */
  useEffect(() => {
    if (!restored) return;

    void writeLocal(TODAY_CARDS_KEY, serializeTodayCards(cards, businessDate)).catch(
      () => undefined,
    );
  }, [cards, restored, businessDate]);

  return [cards, setCards];
};
