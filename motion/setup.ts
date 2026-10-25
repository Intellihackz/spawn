// Global motion for Spawn: runs once on the client, before the first page initializes.
import { gsap } from 'gsap';
import { ease, onScroll, setTransition } from '@/engine';
import { startFill } from './fill';
import { startScan } from './blocks';

// The transition: twelve blocks stack up over the page, pink leading and graphite following, and drop away to show the next one.
export function setupMotion() {
  const parts = (c: HTMLElement) => ({ a: c.querySelectorAll('.col .a'), b: c.querySelectorAll('.col .b') });
  setTransition({
    leave: (c) => {
      const { a, b } = parts(c);
      c.classList.remove('is-covering');
      return gsap.timeline({ onComplete: () => c.classList.add('is-covering') })
        .set(c, { autoAlpha: 1 })
        .set([a, b], { scaleY: 0, transformOrigin: '50% 100%' })
        .to(a, { scaleY: 1, duration: 0.5, ease: ease.inOut, stagger: 0.035 })
        .to(b, { scaleY: 1, duration: 0.5, ease: ease.inOut, stagger: 0.035 }, '<0.12');
    },
    enter: (c) => {
      const { a, b } = parts(c);
      c.classList.remove('is-covering');
      return gsap.timeline()
        .set([a, b], { transformOrigin: '50% 0%' })
        .to(b, { scaleY: 0, duration: 0.5, ease: ease.inOut, stagger: 0.035 })
        .to(a, { scaleY: 0, duration: 0.5, ease: ease.inOut, stagger: 0.035 }, '<0.12')
        .set(c, { autoAlpha: 0 });
    },
  });
  // the frame steps aside while scrolling down and returns on scroll up
  let last = 0;
  onScroll(({ y }) => {
    if (Math.abs(y - last) < 4) return;
    document.documentElement.classList.toggle('frame-away', y > 160 && y > last);
    last = y;
  });
  startScan();
  startFill();
}
