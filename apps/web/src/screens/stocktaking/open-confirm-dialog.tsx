import { Button, Dialog } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

const t = messages.stocktaking;

/**
 * 창 본문에 그대로 나열할 값.
 *
 * **이름이 아니라 값이 온다.** 참조 풀이(창고)와 블라인드 표기는 화면이 이미 끝냈고, 이 창은
 * 받은 것을 그리기만 한다 — 여기서 다시 만들면 **확인한 값과 보내는 값이 갈린다.**
 *
 * **번호를 담지 않는다**(#44). 창고는 「코드 · 이름」이나 풀지 못한 사정 문구로 오며,
 * 이 타입에 번호 자리가 없어 화면으로 샐 경로도 없다.
 */
export interface OpenSummary {
  countTypeCode: string;
  warehouseName: string;
  plannedDate: string;
  /** 「예」/「아니오」 — `true`·`false`를 그대로 내면 값이 읽히지 않는다. */
  blindCount: string;
}

export interface OpenConfirmDialogProps {
  summary: OpenSummary;
  onConfirm: () => void;
  onClose: () => void;
}

interface SummaryRow {
  key: string;
  label: string;
  value: string;
}

/** 나열 차례가 개시 폼의 칸 차례·버튼 사유의 차례와 같다. 갈리면 맞춰 보기 어렵다. */
const toRows = (summary: OpenSummary): SummaryRow[] => [
  { key: 'countType', label: t.fields.countType, value: summary.countTypeCode },
  { key: 'warehouse', label: t.fields.warehouse, value: summary.warehouseName },
  { key: 'plannedDate', label: t.fields.plannedDate, value: summary.plannedDate },
  { key: 'blindCount', label: t.fields.blindCount, value: summary.blindCount },
];

/**
 * 개시 확인 — **되돌릴 수 없는 쓰기 앞의 마지막 층이다.**
 *
 * 개시한 실사를 지우거나 취소하거나 다시 여는 오퍼레이션이 계약에 없다(실측 — 이 자원의
 * 경로는 넷뿐이다). 잘못 만든 전표를 이 화면이 되돌릴 수 없으므로, 보내기 직전에 무엇을
 * 보내는지 한 번 더 보이는 값이 그만큼 크다. 그 사실을 **문장으로 밝힌다** — 값만 다시
 * 보이면 사용자는 「틀리면 지우면 된다」로 읽는다.
 *
 * **창 안에 선택칸을 두지 않는다**(#45 · DS `design-system-v2-webui#68`). 이 창은 값을
 * 고치는 자리가 아니라 확인하는 자리다 — 고칠 것이 있으면 닫고 폼에서 고친다.
 *
 * **상태 칩을 쓰지 않는다.** 설치본의 `StatusChipProps`에 `disabled`가 없어(실측) 비활성
 * 표현이 어긋나는 갭이 있다 — 이 슬라이스는 걸릴 자리를 만들지 않고 평문으로 낸다.
 *
 * **스크림 클릭으로 닫히는 것을 막는다**(`closeOnBackdropClick={false}`). 실수로 닫혀도
 * 초안이 남아 잃는 것은 없지만, 되돌릴 수 없는 조작을 확인하는 창이 스치는 클릭에 사라지면
 * 확인 자체가 형식이 된다 — 파기 확인 창과 갈리는 자리다.
 *
 * 기존 디자인 시스템 컴포넌트의 조합이라 이 화면 슬라이스가 소유한다.
 */
export const OpenConfirmDialog = ({ summary, onConfirm, onClose }: OpenConfirmDialogProps) => (
  <Dialog
    open
    onClose={onClose}
    size="md"
    closeOnBackdropClick={false}
    title={t.dialog.openTitle}
    footer={
      <>
        {/* 문구가 「확인/취소」가 아니다 — 무엇을 누르는지 창을 다시 읽지 않아도 알아야 한다. */}
        <Button variant="outlined" onClick={onClose}>
          {t.actions.keepEditing}
        </Button>
        <Button onClick={onConfirm}>{t.actions.confirmOpen}</Button>
      </>
    }
  >
    <p>{t.dialog.openLead}</p>

    <dl className="filter-bar">
      {toRows(summary).map((row) => (
        <div className="field-cell" key={row.key}>
          <dt className="field-label">{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>

    <p>{t.dialog.openIrreversible}</p>
  </Dialog>
);
