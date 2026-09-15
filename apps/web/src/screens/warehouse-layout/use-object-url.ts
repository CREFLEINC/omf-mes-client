import { useEffect, useState } from 'react';

/**
 * 받아 둔 덩어리를 `<img src>` 가 읽을 수 있는 주소로 바꾼다.
 *
 * ⭐ **만든 주소는 반드시 되돌려준다.** `createObjectURL` 이 만든 주소는 그 덩어리를 문서가
 * 닫힐 때까지 붙들어 둔다 — 도면은 수 MB 라, 창고를 몇 번 갈아 보는 것만으로 브라우저가 그
 * 그림들을 전부 들고 있게 된다. 그 새는 자리는 화면에서 **아무 증상도 보이지 않는다.**
 *
 * ⭐ **주소를 상태에 둔다.** 참조에 두면 주소가 생겨도 다시 그리지 않아 첫 회 그림이 비고,
 * 렌더 중에 만들면 정리할 자리가 없다. 「덩어리가 바뀌면 만들고, 바뀌기 전에 되돌려준다」를
 * 효과 하나로 붙여 둔다.
 *
 * 이 화면 슬라이스가 소유한다 — 다른 화면 슬라이스의 같은 이름 부품을 참조하지 않는다.
 */
export const useObjectUrl = (blob: Blob | null | undefined): string | undefined => {
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (blob === null || blob === undefined) {
      /* ⛔ 앞 그림의 주소를 남겨 두지 않는다 — 도면이 없는 창고에 남의 그림이 걸린다. */
      setUrl(undefined);
      return undefined;
    }

    const created = URL.createObjectURL(blob);

    setUrl(created);

    return () => {
      URL.revokeObjectURL(created);
    };
  }, [blob]);

  return url;
};
