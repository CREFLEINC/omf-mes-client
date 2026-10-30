import { IconButton } from '@crefle/web-ui';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useApiClient } from './api-context';
import { runRequest } from './request';

/** 검사기준 버전 도면 한 장 — 첨부 식별자와 받은 그림. */
export interface InspectionDrawing {
  attachmentId: number;
  blob: Blob;
}

/**
 * 검사기준 버전의 도면(서버 P-155) — 기준서(TCKT) 엑셀 올리기가 버전에 첨부로 붙인다. 목록을 받고 그림마다 내용을 받는다.
 * 부품 IQC 화면(`parts-iqc-inspection/queries.ts` `useDrawings`)과 같은 조회다(omf-all-around#208 · 공용으로 옮김).
 */
export const useInspectionDrawings = (versionId: number | null) => {
  const { client } = useApiClient();
  return useQuery({
    queryKey: ['inspection-drawings', versionId ?? 0] as const,
    enabled: versionId !== null,
    staleTime: Infinity,
    queryFn: async (): Promise<InspectionDrawing[]> => {
      const listed = await runRequest(() =>
        client.GET('/app/attachments', {
          params: {
            query: { targetTypeCode: 'INSPECTION_PLAN_VERSION', targetId: versionId as number },
          },
        }),
      );
      const rows = [...listed.items].sort((a, b) => a.attachmentId - b.attachmentId);
      return Promise.all(
        rows.map(async (row) => ({
          attachmentId: row.attachmentId,
          blob: (await runRequest(() =>
            client.GET('/app/attachments/{attachmentId}/content', {
              params: { path: { attachmentId: row.attachmentId } },
              parseAs: 'blob',
            }),
          )) as Blob,
        })),
      );
    },
  });
};

/**
 * 도면 보기 — 한 장씩 같은 크기 틀 안에 원본 비율로 맞춰 보이고, 양옆 화살표 · 아래 점으로 넘긴다(사용자 시안 · #208).
 * 위아래로 늘어놓으면 장마다 칸 폭으로 커져 탭이 길어졌다. 한 장뿐이면 화살표 · 점을 두지 않는다.
 * 주소는 효과 안에서 만들고 거둔다 — 렌더에서 만들면 개발 모드의 효과 두 번 실행이 그 주소를 먼저 거둬 그림이 깨지고,
 * 다른 버전으로 바뀌면 이전 버전 그림의 주소를 거둬 남지 않게 한다.
 */
export const InspectionDrawingImages = ({
  drawings,
  altOf,
  labels,
}: {
  drawings: readonly InspectionDrawing[];
  altOf: (index: number) => string;
  labels: { prev: string; next: string };
}) => {
  const [urls, setUrls] = useState<string[]>([]);
  const [current, setCurrent] = useState(0);
  useEffect(() => {
    const made = drawings.map((drawing) => URL.createObjectURL(drawing.blob));
    setUrls(made);
    setCurrent(0);
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, [drawings]);

  const count = urls.length;
  const shown = Math.min(current, Math.max(count - 1, 0));
  const go = (index: number): void => setCurrent((index + count) % count);
  const url = urls[shown];

  return (
    <div
      className="inspection-drawings"
      role="group"
      aria-roledescription="carousel"
      // 화살표 키로도 넘긴다 — 틀에 초점이 있을 때만.
      tabIndex={count > 1 ? 0 : undefined}
      onKeyDown={(event) => {
        if (count < 2) return;
        if (event.key === 'ArrowLeft') go(shown - 1);
        if (event.key === 'ArrowRight') go(shown + 1);
      }}
    >
      <div className="inspection-drawings-stage">
        {count > 1 && (
          <IconButton
            icon="chevron_left"
            aria-label={labels.prev}
            className="inspection-drawings-nav is-prev"
            onClick={() => go(shown - 1)}
          />
        )}
        {url !== undefined && <img key={url} src={url} alt={altOf(shown + 1)} />}
        {count > 1 && (
          <IconButton
            icon="chevron_right"
            aria-label={labels.next}
            className="inspection-drawings-nav is-next"
            onClick={() => go(shown + 1)}
          />
        )}
      </div>
      {count > 1 && (
        <div className="inspection-drawings-dots">
          {urls.map((dotUrl, index) => (
            <button
              key={dotUrl}
              type="button"
              aria-label={altOf(index + 1)}
              aria-current={index === shown ? 'true' : undefined}
              onClick={() => setCurrent(index)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
