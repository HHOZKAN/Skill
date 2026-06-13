import { useRef, useEffect } from 'react';

interface Props { density?: number; seed?: number }

export default function Starfield({ density = 0.00009, seed = 7 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let raf: number;
    let stars: { x:number;y:number;r:number;base:number;amp:number;sp:number;ph:number;warm:boolean }[] = [];
    let w = 0, h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let running = true;
    let s = seed * 9301 + 49297;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    function build() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.max(60, Math.floor(w * h * density));
      stars = [];
      s = seed * 9301 + 49297;
      for (let i = 0; i < count; i++) {
        stars.push({ x: rnd()*w, y: rnd()*h, r: rnd()*0.9+0.25, base: rnd()*0.35+0.08, amp: rnd()*0.25+0.05, sp: rnd()*0.0009+0.0002, ph: rnd()*Math.PI*2, warm: rnd()>0.86 });
      }
    }

    function frame(t: number) {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      for (const st of stars) {
        const a = st.base + st.amp * (0.5 + 0.5 * Math.sin(t * st.sp + st.ph));
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = st.warm ? `rgba(235,214,170,${a})` : `rgba(206,222,250,${a})`;
        ctx.shadowBlur = st.r > 0.8 ? 3 : 0;
        ctx.shadowColor = st.warm ? 'rgba(235,214,170,0.5)' : 'rgba(206,222,250,0.5)';
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(frame);
    }

    build();
    raf = requestAnimationFrame(frame);
    const onResize = () => build();
    window.addEventListener('resize', onResize);
    return () => { running = false; cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); };
  }, [density, seed]);

  return <canvas ref={ref} className="bg-stars" />;
}
