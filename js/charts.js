/* 依存なしのSVG折れ線グラフ（体重と7日平均）。 */
(function () {
  function weightChart(points, goalKg) {
    if (!points.length) return '<p class="muted">体重の記録がまだありません。</p>';
    const W = 340, H = 180, P = { l: 34, r: 10, t: 10, b: 22 };
    const vals = points.flatMap((p) => [p.kg, p.avg]).concat(goalKg ? [goalKg] : []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 2) { lo -= 1; hi += 1; }
    lo = Math.floor(lo); hi = Math.ceil(hi);
    const t0 = Date.parse(points[0].date), t1 = Date.parse(points[points.length - 1].date);
    const span = Math.max(t1 - t0, 86400000);
    const x = (d) => P.l + (Date.parse(d) - t0) / span * (W - P.l - P.r);
    const y = (v) => P.t + (hi - v) / (hi - lo) * (H - P.t - P.b);
    const line = (k) => points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p[k]).toFixed(1)}`).join('');
    let g = '';
    for (let v = lo; v <= hi; v += Math.max(1, Math.round((hi - lo) / 4))) {
      g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" stroke-opacity=".12"/>`
        + `<text x="${P.l - 4}" y="${y(v) + 3}" text-anchor="end">${v}</text>`;
    }
    if (goalKg) g += `<line x1="${P.l}" x2="${W - P.r}" y1="${y(goalKg)}" y2="${y(goalKg)}" stroke="#2f855a" stroke-dasharray="4 3"/>`
      + `<text x="${W - P.r}" y="${y(goalKg) - 3}" text-anchor="end">目標${goalKg}</text>`;
    const dots = points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.kg).toFixed(1)}" r="2.5" fill="#7c3aed" fill-opacity=".55"/>`).join('');
    const lab = (d) => d.slice(5).replace('-', '/');
    g += `<text x="${P.l}" y="${H - 6}">${lab(points[0].date)}</text><text x="${W - P.r}" y="${H - 6}" text-anchor="end">${lab(points[points.length - 1].date)}</text>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="体重の推移">${g}${dots}`
      + (points.length > 1 ? `<path d="${line('avg')}" fill="none" stroke="#7c3aed" stroke-width="2.5"/>` : '')
      + `</svg><p class="muted">点＝毎日の体重　線＝7日平均${goalKg ? '　破線＝目標' : ''}</p>`;
  }
  window.CHARTS = { weightChart };
})();
