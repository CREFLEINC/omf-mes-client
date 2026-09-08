import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { PopSelect } from './pop-select';

export interface PopScreenRoute {
  path: string;
  label: string;
}

/**
 * POP 셸이 공개하는 활성 태스크 화면. 진입(P-CO-01)은 사용자 전환이 소유하므로 제외한다.
 * 라우트 표와의 일치는 `routes/pop-common-rules.test.ts`가 지킨다.
 */
export const POP_SCREEN_ROUTES: readonly PopScreenRoute[] = [
  { path: '/pop/work-start', label: 'P-02-01 작업 시작' },
  { path: '/pop/material-input', label: 'P-02-03 자재 투입 스캔' },
  { path: '/pop/tag-issue', label: 'P-02-05 인식표 발행' },
  { path: '/pop/production-result', label: 'P-02-04 작업실적 등록' },
  { path: '/pop/packing-label-reprint', label: 'P-02-09 포장 라벨·인식표 재출력' },
  { path: '/pop/lot-label', label: 'P-02-07 LOT 라벨 출력·부착' },
  { path: '/pop/pqc-inspection', label: 'P-02-13 PQC 제품 검사' },
  { path: '/pop/emergency-work-orders', label: 'P-02-12 긴급 작업지시' },
  { path: '/pop/material-lot-label', label: 'P-01-01 자재LOT 등록·라벨' },
  { path: '/pop/shipping-label', label: 'P-04-02 납품·포장 라벨 출력' },
  { path: '/pop/rework-results', label: 'P-04-03 재작업 실적 등록' },
  { path: '/pop/tool-usage', label: 'P-05-01 공구 사용' },
  { path: '/pop/downtime', label: 'P-05-02 비가동 등록' },
  { path: '/pop/packing-work', label: 'P-02-08 포장 작업' },
  { path: '/pop/repack-label-issue', label: 'P-04-04 재구성 라벨 발행' },
  { path: '/pop/running-change', label: 'P-02-11 러닝체인지 부품 교체' },
  { path: '/pop/goods-issue-qr', label: 'P-01-02 출고 QR 발행' },
  { path: '/pop/work-hold', label: 'P-02-10 작업 중단(홀드) 등록' },
  { path: '/pop/packing', label: 'P-04-01 Packing 실적 등록' },
  { path: '/pop/lot-complete', label: 'P-02-06 생산LOT 완료 처리' },
];

const HEADER_FLAG = 'popScreenNav';

/** POP 공통 헤더의 화면 이동(G-34). 후보는 셸이 가진 활성 라우트 목록만 사용한다. */
export const PopScreenNav = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = POP_SCREEN_ROUTES.some((route) => route.path === pathname) ? pathname : null;

  useEffect(() => {
    document.documentElement.dataset[HEADER_FLAG] = 'on';

    return () => {
      delete document.documentElement.dataset[HEADER_FLAG];
    };
  }, []);

  return (
    <div className="pop-screen-navigation">
      <PopSelect
        aria-label="화면 이동"
        actionLabel="화면 이동"
        value={current}
        placeholder="작업 화면"
        options={POP_SCREEN_ROUTES.map((route) => ({ value: route.path, label: route.label }))}
        onChange={(path) => {
          void navigate(path);
        }}
      />
    </div>
  );
};
