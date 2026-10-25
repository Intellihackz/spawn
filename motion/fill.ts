// The one hover treatment for primary targets (buttons, chain rows): a fill. A block of colour sweeps in from the
// side the pointer entered, and leaves toward the side it left. Keyboard focus fills from the left.
// CSS covers touch (the :active press) and reduced motion (a plain colour state), see globals.css.
import { gsap } from 'gsap';
import { ease, isTouch, onPage, prefersReducedMotion } from '@/engine';

const poly = (x: number, from: 'l' | 'r') =>
  from === 'l' ? `polygon(0% 0%, ${x}% 0%, ${x}% 100%, 0% 100%)` : `polygon(${100 - x}% 0%, 100% 0%, 100% 100%, ${100 - x}% 100%)`;

export function startFill() {
  onPage(() => {
    if (isTouch() || prefersReducedMotion()) return;
    const off: (() => void)[] = [];
    document.querySelectorAll<HTMLElement>('[data-fill]').forEach((el) => {
      const fill = el.querySelector<HTMLElement>('.fill');
      if (!fill) return;
      const s = { x: 0, from: 'l' as 'l' | 'r' };
      let tw: gsap.core.Tween | null = null;
      const go = (to: number, from: 'l' | 'r', duration: number) => {
        s.from = from;
        tw?.kill();
        tw = gsap.to(s, { x: to, duration, ease: ease.soft, onUpdate: () => { fill.style.clipPath = poly(s.x, s.from); } });
      };
      const sideOf = (e: PointerEvent) => { const r = el.getBoundingClientRect(); return e.clientX - r.left < r.width / 2 ? 'l' : 'r'; };
      const enter = (e: PointerEvent) => { el.classList.add('is-filled'); go(100, sideOf(e), 0.5); };
      const leave = (e: PointerEvent) => { el.classList.remove('is-filled'); go(0, sideOf(e), 0.45); };
      const focus = () => { if (el.matches(':focus-visible')) { el.classList.add('is-filled'); go(100, 'l', 0.45); } };
      const blur = () => { el.classList.remove('is-filled'); go(0, 'l', 0.4); };
      el.addEventListener('pointerenter', enter);
      el.addEventListener('pointerleave', leave);
      el.addEventListener('focus', focus);
      el.addEventListener('blur', blur);
      off.push(() => {
        tw?.kill();
        el.removeEventListener('pointerenter', enter);
        el.removeEventListener('pointerleave', leave);
        el.removeEventListener('focus', focus);
        el.removeEventListener('blur', blur);
      });
    });
    return () => off.forEach((f) => f());
  });
}
