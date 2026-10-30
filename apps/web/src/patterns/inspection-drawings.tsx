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
 * 도면 그림을 위아래로 — 칸 폭에 맞춰 줄인다(원본 비율 그대로).
 * 주소는 효과 안에서 만들고 거둔다 — 렌더에서 만들면 개발 모드의 효과 두 번 실행이 그 주소를 먼저 거둬 그림이 깨지고,
 * 다른 버전으로 바뀌면 이전 버전 그림의 주소를 거둬 남지 않게 한다.
 */
export const InspectionDrawingImages = ({
  drawings,
  altOf,
}: {
  drawings: readonly InspectionDrawing[];
  altOf: (index: number) => string;
}) => {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = drawings.map((drawing) => URL.createObjectURL(drawing.blob));
    setUrls(made);
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, [drawings]);
  return (
    <div className="inspection-drawings">
      {urls.map((url, index) => (
        <img key={url} src={url} alt={altOf(index + 1)} />
      ))}
    </div>
  );
};
