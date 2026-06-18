import { useMemo } from "react";
import { useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "../theme/theme";

export default function useResponsiveScreen({ includeTopInset = false } = {}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return useMemo(() => {
    const isSmallPhone = width < 380;
    const isNarrow = width < 430;
    const isCompact = width < 390;
    const isWidePhone = width >= 480;
    const isTabletLike = width >= 720;
    const horizontalPadding = isSmallPhone ? spacing.lg : spacing.xl;
    const topPadding = (includeTopInset ? insets.top : 0) + spacing.lg;
    const bottomPadding = insets.bottom + spacing.xxl;

    return {
      width,
      height,
      insets,
      isSmallPhone,
      isNarrow,
      isCompact,
      isWidePhone,
      isTabletLike,
      horizontalPadding,
      topPadding,
      bottomPadding,
      summaryColumns: isCompact ? 1 : 2,
      stackHeaderActions: isNarrow,
      stackModalActions: isNarrow,
      maxContentWidth: isTabletLike ? 960 : "100%",
    };
  }, [height, includeTopInset, insets, width]);
}
