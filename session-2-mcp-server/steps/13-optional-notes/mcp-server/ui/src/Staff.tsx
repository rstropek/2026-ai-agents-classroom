import abcjs from 'abcjs';
import { useEffect, useRef } from 'react';

/**
 * Draws ABC notation as SVG with abcjs. abcjs paints in currentColor, so the staff takes the
 * text color of its container and follows the host's light or dark theme.
 */
export function Staff({ abc, label }: { abc: string; label: string }) {
  const element = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (element.current) {
      abcjs.renderAbc(element.current, abc, {
        responsive: 'resize',
        staffwidth: 220,
        paddingtop: 0,
        paddingbottom: 0,
        paddingleft: 0,
        paddingright: 0,
        ariaLabel: label,
      });
    }
  }, [abc, label]);

  return <div className="staff" ref={element} />;
}
