import { AlertBanner, Button } from '@crefle/web-ui';
import { messages } from '@omf-mes/i18n';
import { useNavigate } from 'react-router';

/**
 * W-02-07 「바꿀 수 없는 조건」 구획.
 *
 * ⛔ **이 구획에는 컨트롤이 하나도 없다.** 유형·승인·자재 출고요청·자원 배정 넷은 전부
 * 확정이라 사용자가 고를 것이 없고, 고를 수 없는 것을 컨트롤로 그리면 — 비활성이든 기본값
 * 꺼짐이든 — 「지금은 이렇지만 켤 수도 있는 것」으로 읽힌다. 확정을 기본값으로 구현하면
 * 확정이 무너진다(G-4). 그래서 넷을 **값**으로만 적는다.
 *
 * ⛔ **자원 배정은 구획 자체를 만들지 않는다.** 비어 있는 배정 구획을 두면 「채워야 하는데
 * 못 채운 자리」가 되고, 넷 중 이것만 성격이 달라진다. 여기 한 줄로 대신한다.
 *
 * 넷을 한 자리에 모은 이유는 흩어 놓으면 각각이 개별 제약으로 읽히기 때문이다 — 모아 놓아야
 * 「이 화면은 원래 이렇게 생겼다」로 읽힌다.
 *
 * ⭐ 자재 출고요청 줄에만 **갈 길을 단추로 낸다**(`W-02-10`). 링크는 확정을 무르는 컨트롤이
 * 아니라 확정이 가리키는 길이라 성격이 다르다 — 막힌 것만 알리고 길을 안 내주면 사람이
 * 화면 밖에서 임의로 처리한다(G-3). 나머지 셋에는 갈 곳이 없으므로 두지 않는다.
 */
/** W-02-10 추가 자재 출고 요청(수동). 주소는 `patterns/web-screen-catalog.ts` 의 그 화면 자리다. */
const MATERIAL_ISSUE_REQUEST_PATH = '/production/material-issue-requests';

export const FixedTermsPane = () => {
  const t = messages.emergencyWorkOrder.fixedTerms;
  const navigate = useNavigate();
  const terms = [t.type, t.approval, t.materialRequest, t.resource];

  return (
    <section className="pane emergency-work-order-pane" aria-label={t.title}>
      <h2 className="pane-title">{t.title}</h2>

      {/*
       * ⭐ **읽는 값 넷이라 자리를 적게 쓴다.** 손댈 것이 없는 구획이 화면 위쪽을 넓게 차지하면
       * 정작 할 일(품목 고르기 → 입력 → 발행)이 아래로 밀린다. 라벨·값을 한 줄에 붙이고
       * 까닭은 보조 글자로 내린다 — 담는 내용은 그대로다.
       */}
      <dl className="emergency-work-order-terms">
        {terms.map((term) => (
          <div className="emergency-work-order-term" key={term.label}>
            <dt className="field-label">{term.label}</dt>
            <dd>
              <strong>{term.value}</strong>
              {/* 곁설명은 할 일이 남는 둘(자재·자원)에만 있다 — 없는 항목은 값만 선다. */}
              {'note' in term && <p>{term.note}</p>}
            </dd>
            {term === t.materialRequest && (
              /* 「초기화」와 같은 DS 테두리 단추. 누르면 W-02-10 화면으로 이동만 한다. */
              <Button
                className="emergency-work-order-term-link"
                variant="outlined"
                onClick={() => {
                  void navigate(MATERIAL_ISSUE_REQUEST_PATH);
                }}
              >
                {t.materialRequestLink}
              </Button>
            )}
          </div>
        ))}
      </dl>

      <div className="banner-slot">
        <AlertBanner variant="info">{t.internalOrder}</AlertBanner>
      </div>
    </section>
  );
};
