import {
  type RefObject,
  useEffect,
  useState,
} from "react";

export type Size2D = {
  width: number;
  height: number;
}

type UseVisualizationSize = {
  size: Size2D;
}

/**
 * Provides and keeps track of the size of the visualization elements dimensions.
 * @param ref vis. root element ref
 */
export const useVisualizationSize = (
  ref: RefObject<HTMLDivElement | null>,
): UseVisualizationSize => {
  const [size, setDimensions] = useState<Size2D>({ width: 0, height: 0 });

  useEffect(() => {
    if (!ref.current) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const { blockSize, inlineSize } = entries[0].borderBoxSize[0];

      const border = { x: 0, y: 0 };
      if (ref.current) {
        const styles = getComputedStyle(ref.current);
        border.x = parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
        border.y = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
      }

      setDimensions({
        width: Math.max(0, Math.floor(inlineSize - border.x)),
        height: Math.max(0, Math.floor(blockSize - border.y)),
      });
    });

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);

  return { size };
}
