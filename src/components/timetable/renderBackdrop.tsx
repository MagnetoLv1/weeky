// BottomSheet 배경(backdrop) 렌더 함수
import React from 'react';
import { BottomSheetBackdrop } from '@gorhom/bottom-sheet';

// 아래로 내리면 사라지고, 인덱스 0에서 나타남. 터치 시 닫힘
export function renderBackdrop(
  props: React.ComponentProps<typeof BottomSheetBackdrop>,
) {
  return (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      pressBehavior="close"
    />
  );
}
