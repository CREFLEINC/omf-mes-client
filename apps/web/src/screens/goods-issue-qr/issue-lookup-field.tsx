import { AlertBanner, Button, TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useEffect, useRef, useState } from 'react';

import { useScannerSubmit } from '../../patterns/pop-scanner-submit';

import { useGoodsIssueByNo } from './issue-lookup';

const t = messages.goodsIssueQr.entry.lookup;

export interface IssueLookupFieldProps {
  /** 번호가 똑같은 전표를 찾았다. 부르는 쪽이 주소에 싣는다. */
  onFound: (goodsIssueId: number) => void;
}

/**
 * 출고번호로 전표를 불러오는 칸 — **셸 메뉴로 들어온 작업자의 시작점**(ISSUE-QR-01 U3).
 *
 * ⭐ **스캐너와 손입력을 같은 칸으로 받는다**(공유계약 D-3). 스캐너는 값 끝에 Enter 를 보내므로
 *    폼 제출이 곧 스캔 처리다 — 칸을 둘로 나누면 작업자가 어디에 쏠지 고르게 된다.
 *
 * ⛔ **찾는 동안 단추를 잠근다.** 현장 단말은 반응이 늦으면 한 번 더 누르는데, 두 번째 조회가
 *    먼저 돌아오면 **먼저 친 번호의 전표로 들어간다.**
 *
 * ⭐ **스캔 한 번에 조회한다**(omf-all-around#35). 스캐너가 Enter 를 안 붙이거나 Tab 을 붙이거나
 *    입력기가 Enter 를 삼켜도 받는다 — 판정은 `patterns/pop-scanner-submit` 한 곳이다. 입력기
 *    조합이 Enter 뒤에 끝나며 같은 값을 한 번 더 알리므로, 같은 값의 변경은 조회를 지우지 않는다.
 *
 * ⚠ **번호가 똑같은 한 건만 받는다**(`issue-lookup.ts`). 「못 찾았다」와 「조회가 실패했다」는
 *   작업자가 할 일이 달라 따로 말한다(공유계약 G-3).
 */
export const IssueLookupField = ({ onFound }: IssueLookupFieldProps) => {
  const [draft, setDraft] = useState('');
  const [asked, setAsked] = useState<string | null>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  const lookup = useGoodsIssueByNo(asked);

  useEffect(() => {
    if (lookup.data?.kind !== 'found') return;

    onFound(lookup.data.issue.goodsIssueId);
    /* eslint-disable-next-line react-hooks/exhaustive-deps -- 찾은 순간 한 번만 옮겨 간다. */
  }, [lookup.data]);

  /* 스캐너가 다음 값을 곧바로 쏘므로 칸에 포커스를 남겨 둔다. */
  useEffect(() => {
    fieldRef.current?.focus();
  }, []);

  const ask = (value: string): void => {
    const trimmed = value.trim();

    /* ⛔ 빈 값으로 묻지 않는다 — 부분 검색이라 전체 목록을 받아 온다. */
    if (trimmed === '' || lookup.isFetching) return;

    setAsked(trimmed);
  };

  const scanner = useScannerSubmit(ask, () => fieldRef.current?.value ?? '');

  return (
    <form
      className="issue-lookup"
      onSubmit={(event) => {
        event.preventDefault();
        scanner.submit(draft);
      }}
    >
      <TextField
        ref={fieldRef}
        label={t.label}
        placeholder={t.placeholder}
        value={draft}
        autoComplete="off"
        onKeyDown={scanner.onKeyDown}
        onChange={(event) => {
          const next = event.target.value;

          setDraft(next);
          scanner.noteInput(next);
          /*
           * 값을 고치면 앞 결과는 이 값의 사실이 아니다. 단 **같은 값**이면 지우지 않는다 —
           * 입력기 조합이 Enter 뒤에 끝나며 같은 값을 한 번 더 알린다.
           */
          setAsked((previous) => (previous === next.trim() ? previous : null));
        }}
      />

      <Button type="submit" variant="filled" size="lg" className="pop-touch-target">
        {lookup.isFetching ? t.searching : t.action}
      </Button>

      {lookup.isError && (
        <div className="banner-slot">
          <AlertBanner variant="error">{t.failed}</AlertBanner>
        </div>
      )}

      {lookup.data?.kind === 'notFound' && (
        <div className="banner-slot">
          <AlertBanner variant="warning">{t.notFound}</AlertBanner>
        </div>
      )}
    </form>
  );
};
