import { useEffect, useRef, useState } from 'react';

export default function useElementHeight(enabled = true) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (!enabled || !ref.current) return undefined;
    const element = ref.current;
    const update = () => setHeight(element.getBoundingClientRect().height);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [enabled]);

  return [ref, height];
}
