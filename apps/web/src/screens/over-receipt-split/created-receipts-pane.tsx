import { Chip } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { Link } from 'react-router';

import type { CreatedReceiptView } from './types';

const t = messages.overReceiptSplit;

/**
 * 다음 화면(W-01-11 신규 P/O 등록)으로 가는 주소.
 *
 * **질의 열쇠 `receipt`는 받는 쪽이 읽는 이름이다** — 그쪽 화면은 진입 맥락을 주소에서만 읽으므로
 * (상태로 넘기면 새로고침·뒤로가기·공유에서 사라진다) 이 열쇠가 두 화면 사이의 계약이다.
 * 주소가 라우트 표에 실제로 있는지는 `routes/index.test.tsx`가 잇는다 — 한쪽만 고치면
 * 죽은 링크가 남는데, 이 슬라이스의 시험도 그쪽 화면의 시험도 그 어긋남을 보지 못한다.
 *
 * **내부 번호를 주소에 싣는 것은 표시가 아니다.** 계약이 입하 상세를 내부 번호로 받으므로
 * 업무 번호로는 조회 경로를 만들 수 없다 — 사람이 읽는 자리에는 넣지 않는다(#44).
 */
export const poRegisterEntryPath = (inboundReceiptId: number): string =>
  `/logistics/po-register?receipt=${String(inboundReceiptId)}`;

export interface CreatedReceiptsPaneProps {
  /** 만들어진 전표. 갈래에 따라 1건 또는 2건이다 */
  receipts: readonly CreatedReceiptView[];
}

/**
 * 등록 결과 — **만들어진 전표 번호**를 낸다.
 *
 * **건수를 함께 밝힌다.** 두 건이 만들어졌다는 것이 이 화면의 요점인데 번호만 나열하면
 * 두 줄이 한 전표의 두 표기처럼 읽힐 수 있다.
 *
 * **어느 건이 정량분이고 어느 건이 초과분인지 응답이 알려 주지 않는다.** 배열 순서로
 * 추측해 라벨을 붙이면 틀린 라벨이 되돌릴 수 없는 전표에 붙는다 — 모른다는 사실을 밝힌다.
 *
 * **내부 번호를 내지 않는다**(#44). 이제는 받지만 **링크 주소에만** 싣는다 — 사람이 읽는
 * 자리(전표번호·상태·링크 이름)에는 넣지 않는다. `inboundReceiptNo`는 사용자가 나중에 이
 * 전표를 찾을 때 쓰는 업무 번호라 내는 것이 맞다 — 이 구분이 이 화면에서 처음 갈리는 자리다.
 *
 * **다음 화면으로 가는 길이 전표마다 선다.** 두 건이 만들어졌을 때 하나로 합치면 어느 전표를
 * 정산하는지 화면이 지어내야 하는데, 응답은 그것을 알려 주지 않는다 — 위와 같은 사정이다.
 *
 * **버튼이 아니라 링크로 둔다.** 주소를 갖는 이동이라 새 탭·주소 복사가 그대로 되고,
 * 히스토리가 한 칸만 늘어 뒤로가기 한 번으로 이 결과 화면에 돌아온다.
 *
 * **사라지는 알림으로 내지 않는다.** 이 번호는 적어 두거나 옮겨 적을 값이라
 * 몇 초 뒤에 없어지면 안 된다 — 저장 성공을 토스트로 내는 다른 화면과 갈리는 자리다.
 */
export const CreatedReceiptsPane = ({ receipts }: CreatedReceiptsPaneProps) => (
  /* 사용자가 부르지 않은 시점에 나타나는 내용이라 살아 있는 영역으로 알린다. */
  <div role="status" aria-label={t.panes.result}>
    <p>{t.result.count(receipts.length)}</p>

    {/*
     * **이름 하나에 값 하나로 짝을 맞춘다.** `<dt>` 하나 뒤의 `<dd>`는 전부 그 이름의 값이라,
     * 상태 칩을 전표번호 아래에 그대로 두면 보조기술이 「전표번호: IR-…, SAMPLE_…」로 읽는다 —
     * 이름 없는 값이 아니라 **틀린 이름이 붙은 값**이 된다.
     */}
    <dl className="filter-bar">
      {receipts.map((created) => (
        <div className="field-cell" key={created.inboundReceiptNo}>
          <dt className="field-label">{t.result.receiptNo}</dt>
          <dd>{created.inboundReceiptNo}</dd>
          <dt className="field-label">{t.result.status}</dt>
          <dd>
            {/* 상태 코드는 값으로 분기하지 않고 그대로 보인다(공유계약 G-2). */}
            <Chip variant="status" size="sm">
              {created.statusCode}
            </Chip>
          </dd>
        </div>
      ))}
    </dl>

    <p className="field-note">{t.result.unlabeled}</p>

    {/*
     * **이름-값 목록 밖에 둔다.** 이동은 이 전표가 **가진 값**이 아니라 그 전표로 하는 일이라,
     * `<dd>`로 넣으면 보조기술이 「상태: …」의 값으로 읽고 `<dl>` 안에 그냥 두면 이름 없는
     * 조각이 목록에 섞인다. 그래서 목록을 닫고 **자기 줄**에 세운다(배치 규범 4 — 액션 줄).
     *
     * **어느 전표의 것인지는 보이는 글자가 밝힌다.** 두 건이면 링크도 둘이라 글자가 같으면
     * 가릴 수 없고, 그때 고르는 것은 사용자 몫이다 — 화면이 어느 쪽이 초과분인지 지어내지 않는다.
     */}
    <div className="filter-bar">
      {receipts.map((created) => (
        <Link key={created.inboundReceiptNo} to={poRegisterEntryPath(created.inboundReceiptId)}>
          {t.result.registerPo(created.inboundReceiptNo)}
        </Link>
      ))}
    </div>
  </div>
);
