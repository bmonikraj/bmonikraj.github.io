// Ambient manifold background (home page only).
//
// Draws a smooth, slowly folding height field z(u,v,t) — a sum of a few
// low-frequency sine/cosine terms — as a spline-smoothed wireframe on the
// fixed <canvas data-ambient-manifold>. Line colour runs primary -> accent
// and is read live from the CSS custom properties, so it follows dark mode.
//
// Legibility: text inside the selectors listed in the canvas's data-protect
// attribute is measured (Range.getClientRects) and clipped out of every frame.
// Performance: 30 fps cap, DPR <= 2, capped grid size, pauses when the tab is
// hidden, and no-ops entirely under prefers-reduced-motion.
(function () {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.querySelector('[data-ambient-manifold]');
    if (!canvas || !canvas.getContext) return;

    function hexToRgb(hex) {
        let h = (hex || '').trim().replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const num = parseInt(h, 16);
        return isNaN(num) ? null : [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }

    function readColor(name, fallback) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name);
        return hexToRgb(v) || fallback;
    }

    function textLineRects(selectorList, canvasRect) {
        const rects = [];
        selectorList.forEach((sel) => {
            document.querySelectorAll(sel).forEach((el) => {
                try {
                    const range = document.createRange();
                    range.selectNodeContents(el);
                    Array.prototype.forEach.call(range.getClientRects(), (r) => {
                        if (r.width < 1 || r.height < 1) return;
                        rects.push({
                            x: r.left - canvasRect.left - 6,
                            y: r.top - canvasRect.top - 4,
                            w: r.width + 12,
                            h: r.height + 8
                        });
                    });
                } catch (e) { /* not a text-bearing element; ignore */ }
            });
        });
        return rects;
    }

    const ctx = canvas.getContext('2d');
    const protectSelectors = (canvas.getAttribute('data-protect') || '')
        .split(',').map(s => s.trim()).filter(Boolean);

    let width = 0, height = 0, dpr = 1;
    let cols = 0, rows = 0, amp = 24, originX = 0, originY = 0, spanX = 0, spanY = 0;
    let textRects = [];
    let active = !document.hidden, lastFrame = 0, phase = 0;
    const FRAME_INTERVAL = 1000 / 30;
    const TILT = 0.82;

    // Traveling-wave terms along different axes/speeds, so the surface folds
    // and ripples rather than just bobbing. Smooth everywhere: no seams.
    function heightAt(u, v, t) {
        return Math.sin(u * Math.PI * 2.1 + t) * Math.cos(v * Math.PI * 1.7 - t * 0.8)
            + 0.55 * Math.sin((u + v) * Math.PI * 1.3 - t * 1.15)
            + 0.4 * Math.cos((u - v) * Math.PI * 2.4 + t * 0.6)
            + 0.3 * Math.sin(v * Math.PI * 3.2 + t * 1.4);
    }

    function project(u, v, z) {
        return {
            x: originX + (u - 0.5) * spanX,
            y: originY + (v - 0.5) * spanY * TILT - z * amp
        };
    }

    function updateTextRects() {
        textRects = textLineRects(protectSelectors, canvas.getBoundingClientRect());
    }

    function resize() {
        const rect = canvas.getBoundingClientRect();
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = rect.width;
        height = rect.height;
        if (!width || !height) return;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        textRects = textLineRects(protectSelectors, rect);

        const isSmall = width < 600;
        cols = Math.max(7, Math.min(isSmall ? 11 : 20, Math.round(width / 78)));
        rows = Math.max(5, Math.min(isSmall ? 8 : 14, Math.round(height / 78)));
        amp = Math.min(width, height) * 0.065;
        originX = width / 2;
        originY = height / 2;
        spanX = width * 1.08;
        spanY = height * 1.08;
    }

    // One family of grid lines (rows if axis === 'u', columns if 'v'), drawn
    // as quadratic splines through the projected points. Line width grows
    // with local curvature (discrete second derivative of the height field).
    function drawFamily(axis, steps, cross, primaryRgb, accentRgb) {
        for (let i = 0; i <= cross; i++) {
            const c = cross === 0 ? 0.5 : i / cross;
            const pts = [];
            const zs = [];
            for (let j = 0; j <= steps; j++) {
                const s = j / steps;
                const u = axis === 'u' ? s : c;
                const v = axis === 'u' ? c : s;
                const z = heightAt(u, v, phase);
                zs.push(z);
                pts.push(project(u, v, z));
            }

            ctx.beginPath();
            ctx.moveTo(pts[0].x, pts[0].y);
            for (let j = 1; j < pts.length - 1; j++) {
                const mx = (pts[j].x + pts[j + 1].x) / 2;
                const my = (pts[j].y + pts[j + 1].y) / 2;
                ctx.quadraticCurveTo(pts[j].x, pts[j].y, mx, my);
            }
            ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

            const grad = ctx.createLinearGradient(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y);
            grad.addColorStop(0, `rgba(${primaryRgb.join(',')},0.10)`);
            grad.addColorStop(1, `rgba(${accentRgb.join(',')},0.10)`);
            ctx.strokeStyle = grad;

            let curvature = 0;
            for (let j = 1; j < zs.length - 1; j++) {
                curvature += Math.abs(zs[j - 1] - 2 * zs[j] + zs[j + 1]);
            }
            curvature /= zs.length;
            ctx.lineWidth = 0.6 + Math.min(1, curvature * 6) * 0.7;
            ctx.stroke();
        }
    }

    function step(ts) {
        if (!active) return;
        requestAnimationFrame(step);
        if (ts - lastFrame < FRAME_INTERVAL) return;
        lastFrame = ts;
        if (!width || !height) return;

        phase += 0.0045;

        const primaryRgb = readColor('--primary-color', [27, 35, 64]);
        const accentRgb = readColor('--accent-color', [193, 101, 47]);

        ctx.clearRect(0, 0, width, height);

        ctx.save();
        if (textRects.length) {
            ctx.beginPath();
            ctx.rect(0, 0, width, height);
            textRects.forEach(r => ctx.rect(r.x, r.y, r.w, r.h));
            ctx.clip('evenodd');
        }

        drawFamily('u', cols, rows, primaryRgb, accentRgb);
        drawFamily('v', rows, cols, primaryRgb, accentRgb);

        ctx.restore();
    }

    resize();
    requestAnimationFrame(step);

    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resize, 200);
    });

    // The canvas is fixed but the protected text scrolls, so the clip boxes
    // (viewport-relative) are refreshed on scroll too.
    let scrollScheduled = false;
    window.addEventListener('scroll', () => {
        if (scrollScheduled) return;
        scrollScheduled = true;
        requestAnimationFrame(() => {
            updateTextRects();
            scrollScheduled = false;
        });
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
        active = !document.hidden;
        if (active) requestAnimationFrame(step);
    });
})();
