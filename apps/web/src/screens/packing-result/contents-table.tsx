import { Button, EmptyState } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

import { packedTotal, remainingTotal } from './packing-draft';
import type { PackedLine } from './types';

const t = messages.packingResult;

/**
 * ③ 포장 구성 표 — **담긴 것만** 보인다.
 *
 * ⭐ **LOT 을 분절해 보인다**(공유계약 E-2). 34자리 식별자를 붙여 쓰면 실물 라벨과 눈으로
 * 대조할 수 없다 — **저장은 원문, 표시만 그룹핑**이다.
 *
 * ⚠ 이 화면은 세로 예산이 슬랙 0이라(스펙 §3-1) 줄이 넘치면 **이 구획 안에서** 스크롤한다.
 * 화면 전체가 스크롤하면 액션바가 밀려 확정 버튼이 사라진다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 파일을 참조하지 않는다.
 */

/**
 * 표시용 분절 — **공유계약 E-2**(✓확정 2026-08-02).
 *
 * 저장은 원문, 표시만 그룹으로 끊는다. 34자리를 붙여 쓰면 작업자가 실물 라벨과 화면을 **눈으로
 * 대조할 수 없다.**
 *
 * ⛔ **끊는 자리를 화면이 지어내지 않는다.** 그룹 길이는 계약이 정한 자릿수 구성에서 오고,
 * 그 구성이 걸리는 것은 **34자리 형식 하나**다. 형식이 다른 값을 같은 규칙으로 끊으면 없는
 * 경계를 있는 것처럼 보여 대조를 오히려 방해한다 — 그때는 **원문을 그대로 낸다.**
 */
const LOT_GROUPS = [9, 9, 6, 6, 4] as const;

const GROUPED_LENGTH = LOT_GROUPS.reduce((sum, size) => sum + size, 0);

export const segmentLotNo = (lotNo: string): string => {
  if (lotNo.length !== GROUPED_LENGTH) return lotNo;

  const parts: string[] = [];
  let cursor = 0;

  for (const size of LOT_GROUPS) {
    parts.push(lotNo.slice(cursor, cursor + size));
    cursor += size;
  }

  return parts.join(' · ');
};

export interface ContentsTableProps {
  lines: PackedLine[];
  onRemove: (shipmentLotAllocationId: number) => void;
}

export const ContentsTable = ({ lines, onRemove }: ContentsTableProps) => (
  <div className="packing-contents">
    {/*
     * ⛔ **열 머리글 줄을 두지 않는다**(사용자 지적 2026-09-10). 스펙은 이 자리를 「내용물/수량
     *   목록」이라고만 적고 열 구성을 정하지 않으며, 같은 성격의 `P-02-08` 도면은
     *   `✅ LOT-…0031  ABC-123  100 EA` 형태의 머리글 없는 목록이다. 세로 예산이 슬랙 0 인
     *   화면이라(§3-1) 머리줄 한 줄이 담은 줄 하나를 통째로 가져간다.
     */}
    {lines.length === 0 ? (
      <EmptyState size="sm" title={t.contents.empty} />
    ) : (
      <ul className="packing-contents-list" aria-label={t.panes.packing}>
        {lines.map((row) => (
          <li className="packing-contents-line" key={String(row.shipmentLotAllocationId)}>
            {/* 담긴 줄임을 나타내는 표식 — 값이 아니라 상태다. */}
            <span className="packing-contents-mark" aria-hidden="true">
              ✓
            </span>
            <span className="packing-contents-item">{row.itemCode}</span>
            {/* LOT 은 분절해 보인다(공유계약 E-2) — 붙여 쓰면 실물 라벨과 대조할 수 없다. */}
            <span className="packing-contents-lot">{segmentLotNo(row.lotNo)}</span>
            <span className="packing-contents-qty">{String(row.qty)}</span>
            {/*
             * ⛔ **되돌릴 수 있는 조작이라 72px 을 걸지 않는다.** 모든 버튼을 키우면 정작 큰 것
             * (확정)이 눈에 띄지 않아 크기가 뜻을 잃는다.
             */}
            <Button
              type="button"
              variant="text"
              size="sm"
              onClick={() => {
                onRemove(row.shipmentLotAllocationId);
              }}
            >
              {t.contents.remove}
            </Button>
          </li>
        ))}
      </ul>
    )}

    <p className="packing-total">{t.contents.total(packedTotal(lines), remainingTotal(lines))}</p>
  </div>
);
