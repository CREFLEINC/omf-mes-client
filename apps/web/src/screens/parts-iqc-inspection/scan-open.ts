import { useCallback, useEffect, useRef, useState } from 'react';

/** 스캔으로 연 의뢰와 그 LOT — key 가 바뀔 때마다 결과 추가 창을 다시 연다. */
export type ScanOpen = { requestId: number; lotId: number; key: number };

/**
 * 스캔 열기 상태 — 스캔한 의뢰가 아닌 곳으로 옮겨 서면(다른 의뢰 · 상세 닫기) 거둔다. 남겨 두면 나중에 그 의뢰를 다시 고를 때
 * 결과 추가 창이 또 뜬다. 고른 의뢰가 실제로 바뀔 때만 본다 — 스캔과 함께 고른 의뢰(주소)가 늦게 바뀌는 사이에 거두면 처음
 * 스캔한 의뢰에서 결과 추가 창이 안 열린다(#356).
 */
export const useScanOpen = (selectedId: number | null) => {
  const [scanOpen, setScanOpen] = useState<ScanOpen | null>(null);
  const previousId = useRef(selectedId);
  useEffect(() => {
    const moved = previousId.current !== selectedId;
    previousId.current = selectedId;
    if (moved && scanOpen !== null && scanOpen.requestId !== selectedId) setScanOpen(null);
  }, [scanOpen, selectedId]);
  /* 떠날지 묻는 창에서 「계속 작성」 — 고른 의뢰는 그대로이므로 스캔한 다른 의뢰 열기를 여기서 거둔다. */
  const stay = useCallback(
    () =>
      setScanOpen((current) =>
        current !== null && current.requestId !== selectedId ? null : current,
      ),
    [selectedId],
  );
  return { scanOpen, setScanOpen, stay };
};
