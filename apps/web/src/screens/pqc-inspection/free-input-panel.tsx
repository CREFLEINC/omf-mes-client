import { TextField } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';

/**
 * 검사 기준이 **없는** 의뢰의 좌측 구획 — 스펙 §5-2 의 두 번째 갈래다.
 *
 * ⭐ **항목표가 없다.** 기준이 없으면 잴 항목도 규격도 없으므로, 판정 하나와 자유 입력만
 * 남는다. 고객 확정(2026-07-15)이 「정상/불량 단순 선택 + 자유 입력으로 검사 진행」이다.
 *
 * ⛔ **막다른 길로 만들지 않는다**(§6). 「기준을 먼저 등록하세요」로 되돌리면 현장이 멈춘다 —
 * 기준 미등록은 실제로 일어나는 상태다.
 *
 * ⛔ **판정 칸을 여기 두지 않는다.** 이 갈래의 「정상/불량 판정」은 **종합 판정 그것**이고
 * (통지 #589 — 두 값짜리 목록을 따로 만들지 말 것), 종합 판정은 우측 구획에 이미 있다.
 * 좌우에 같은 값을 두 번 두면 어느 쪽이 정본인지 사람이 알 수 없다.
 *
 * ⚠ **비어 있음을 「못 불러왔다」와 같은 모양으로 그리지 않는다**(조항 G-9). 이 구획이 서는
 * 것 자체가 「기준이 없다」는 사실의 표시이므로, 오류 문구를 쓰지 않고 그 사실을 말한다.
 *
 * 이 화면이 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */

const t = messages.pqcInspection.noStandard;

export interface FreeInputPanelProps {
  remarks: string;
  onRemarksChange: (value: string) => void;
}

export const FreeInputPanel = ({ remarks, onRemarksChange }: FreeInputPanelProps) => (
  <section className="pane" aria-label={t.heading}>
    <h2 className="field-label">{t.heading}</h2>

    {/* 왜 항목표가 없는지 밝힌다 — 없는 값과 못 불러온 값은 다른 모양이어야 한다(G-9). */}
    <p className="field-note">{t.note}</p>

    {/* 기준이 없어 적을 곳이 여기뿐이다 — 무엇을 보고 판정했는지 사람이 남긴다. */}
    <TextField
      label={t.remarks}
      value={remarks}
      onChange={(event) => onRemarksChange(event.target.value)}
    />
  </section>
);
