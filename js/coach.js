/* 提案・分析ロジック（外部AIを使わない端末内ルール）。
 * 安全性を心拍・年齢だけで断定しない。提案は目安であり、体調が悪い・痛みがあるときは中止を優先する。 */
(function (root) {
  const round = (x, step) => Math.round(x / step) * step;
  const DAY = 86400000;

  function stepFor(kg) { return kg >= 60 ? 5 : 2.5; }

  /** history: 同じマシンの筋トレ記録（新しい順）。ctx: {condition:'good'|'normal'|'tired'|'bad', pain:boolean} */
  function suggestStrength(history, ctx) {
    ctx = ctx || {};
    const out = { kg: null, reps: '12〜15', sets: 3, reasons: [], cautions: [], confidence: 'low' };
    if (ctx.pain) {
      out.reasons.push('痛みがあるため、この種目は休むか、痛みの出ない軽い重量にしてください。');
      out.cautions.push('痛みが続く場合は医療機関に相談してください。');
      out.sets = 0;
      return out;
    }
    if (!history || !history.length) {
      out.reasons.push('記録がまだありません。正しいフォームで12〜15回できる重量を探してください。');
      return out;
    }
    const last = history[0];
    const sets = (last.sets || []).filter((s) => s.kg != null && s.reps != null);
    if (!sets.length) { out.reasons.push('前回のセット記録が不完全です。'); return out; }
    const topKg = Math.max(...sets.map((s) => +s.kg));
    const target = 15;
    const minReps = Math.min(...sets.map((s) => +s.reps));
    const allHit = sets.length >= 3 && minReps >= target;
    const rpe = last.rpe != null && last.rpe !== '' ? +last.rpe : null;
    const step = stepFor(topKg);
    out.confidence = history.length >= 3 ? 'medium' : 'low';
    out.kg = topKg;

    if (ctx.condition === 'bad') {
      out.kg = round(topKg * 0.85, step); out.sets = 2;
      out.reasons.push('体調が悪いため、重量を約15%下げて2セットに減らします。無理なら休んでください。');
      return out;
    }
    if (ctx.condition === 'tired') {
      out.reasons.push('疲れがあるため前回と同じ重量を維持します。');
      return out;
    }
    if (allHit && (rpe == null || rpe <= 8)) {
      const inc = Math.max(step, round(topKg * 0.05, step));
      out.kg = topKg + inc; out.reps = '10〜12';
      out.reasons.push(`前回 ${topKg}kg で全セット${target}回を達成${rpe != null ? `（きつさ${rpe}/10）` : ''}。+${inc}kg に上げ、10〜12回を目標にします。`);
      if (rpe == null) out.cautions.push('前回のきつさが未記録です。上げてみて12回に届かなければ前回の重量に戻してください。');
    } else if (rpe != null && rpe >= 9) {
      out.reasons.push(`前回はきつさ${rpe}/10と高めでした。同じ重量で回数・フォームを安定させます。`);
    } else if (minReps < target - 4) {
      out.kg = round(topKg * 0.95, step);
      out.reasons.push(`前回は最少${minReps}回で目標から大きく不足。約5%下げて回数を確保します。`);
    } else {
      out.reasons.push(`前回 ${topKg}kg・最少${minReps}回。同じ重量で全セット${target}回を目指します。`);
    }
    // 停滞の検出
    if (history.length >= 3) {
      const tops = history.slice(0, 3).map((h) => Math.max(...(h.sets || [{ kg: 0 }]).map((s) => +s.kg || 0)));
      if (tops.every((t) => t === tops[0]) && !allHit) out.cautions.push('3回続けて同じ重量です。睡眠・食事（特にタンパク質）も確認しましょう。');
    }
    return out;
  }

  /** 有酸素（バイク等）。history: 新しい順。profile.age は参考表示にのみ使う。 */
  function suggestCardio(history, ctx, profile) {
    ctx = ctx || {};
    const out = { level: null, minutes: 20, reasons: [], cautions: [], hrRef: null };
    const age = profile && profile.age;
    if (age) {
      const est = 220 - age;
      out.hrRef = `年齢からの最大心拍の目安は約${est}/分（個人差が大きく、安全基準ではありません）`;
    }
    if (ctx.pain || ctx.condition === 'bad') {
      out.minutes = 10; out.reasons.push('体調不良・痛みがあるため、軽い負荷で10分以内、または休みにします。');
      if (history && history[0] && history[0].level) out.level = Math.max(1, history[0].level - 3);
      return out;
    }
    if (!history || !history.length) { out.reasons.push('記録がありません。会話できる程度のきつさで20分から始めましょう。'); return out; }
    const last = history[0];
    out.level = last.level || null; out.minutes = last.minutes || 20;
    const rpe = last.rpe != null && last.rpe !== '' ? +last.rpe : null;
    if (ctx.condition === 'tired') { out.reasons.push('疲れがあるため前回と同じ内容にします。'); return out; }
    if (rpe != null && rpe <= 6) {
      if (out.minutes < 30) { out.minutes += 5; out.reasons.push(`前回は余裕あり（きつさ${rpe}/10）。同じ負荷で時間を+5分。`); }
      else if (out.level) { out.level += 1; out.reasons.push(`前回は余裕あり（きつさ${rpe}/10）。負荷を+1。`); }
    } else if (rpe != null && rpe >= 9) {
      if (out.level) out.level = Math.max(1, out.level - 1);
      out.reasons.push(`前回はきつさ${rpe}/10と高め。負荷を1下げます。`);
    } else {
      out.reasons.push('前回と同じ内容を継続。きつさ（1〜10）を記録すると提案が調整されます。');
    }
    if (last.hrAvg) out.cautions.push(`前回の平均心拍 ${last.hrAvg}/分。胸の痛み・息苦しさ・めまいがあればすぐ中止してください。`);
    return out;
  }

  /** 7日移動平均（日付の昇順の [{date,kg}]）。各日について過去7日間にある記録の平均。 */
  function movingAvg(points, days) {
    days = days || 7;
    const sorted = points.slice().sort((a, b) => a.date.localeCompare(b.date));
    return sorted.map((p) => {
      const t = Date.parse(p.date);
      const win = sorted.filter((q) => { const u = Date.parse(q.date); return u <= t && u > t - days * DAY; });
      return { date: p.date, kg: p.kg, avg: win.reduce((s, q) => s + q.kg, 0) / win.length, n: win.length };
    });
  }

  /** 体重を1日1件に集約（同日複数なら最後の記録）。 */
  function dailyWeights(rows) {
    const byDay = {};
    rows.slice().sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt))
      .forEach((r) => { if (r.kg) byDay[r.date] = { date: r.date, kg: +r.kg, bodyFatPct: r.bodyFatPct }; });
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }

  function pureAlcoholG(ml, pct) { return ml && pct ? Math.round(ml * pct / 100 * 0.8 * 10) / 10 : 0; }

  function mealTotals(meals) {
    const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, salt: 0, alcoholG: 0 };
    meals.forEach((m) => {
      const q = m.qty == null ? 1 : +m.qty;
      ['kcal', 'protein', 'fat', 'carbs', 'salt'].forEach((k) => { t[k] += (+m[k] || 0) * q; });
      t.alcoholG += pureAlcoholG((+m.volumeMl || 0) * q, +m.alcoholPct || 0);
    });
    Object.keys(t).forEach((k) => { t[k] = Math.round(t[k] * 10) / 10; });
    return t;
  }

  /** 週次分析。today: 'YYYY-MM-DD' */
  function weekly(today, weights, meals, workouts) {
    const t = Date.parse(today);
    const inRange = (d, from, to) => { const u = Date.parse(d); return u > t - from * DAY && u <= t - to * DAY; };
    const dw = dailyWeights(weights);
    const thisW = dw.filter((w) => inRange(w.date, 7, 0));
    const prevW = dw.filter((w) => inRange(w.date, 14, 7));
    const avg = (a) => a.length ? a.reduce((s, x) => s + x.kg, 0) / a.length : null;
    const mealDays = new Set(meals.filter((m) => inRange(m.date, 7, 0)).map((m) => m.date));
    const wk = workouts.filter((w) => inRange(w.date, 7, 0));
    const workoutDays = new Set(wk.map((w) => w.date));
    const res = {
      weightAvg: avg(thisW), prevAvg: avg(prevW), weightDays: thisW.length,
      mealDays: mealDays.size, workoutDays: workoutDays.size,
      strengthSets: wk.filter((w) => w.kind === 'strength').reduce((s, w) => s + (w.sets || []).length, 0),
      cardioMin: wk.filter((w) => w.kind === 'cardio').reduce((s, w) => s + (+w.minutes || 0), 0),
      kcalAvg: null, proteinAvg: null, alcoholAvg: null, notes: [], confidence: 'low',
    };
    if (mealDays.size) {
      const tot = mealTotals(meals.filter((m) => inRange(m.date, 7, 0)));
      res.kcalAvg = Math.round(tot.kcal / mealDays.size);
      res.proteinAvg = Math.round(tot.protein / mealDays.size);
      res.alcoholAvg = Math.round(tot.alcoholG / mealDays.size);
    }
    if (res.weightAvg != null && res.prevAvg != null) res.change = Math.round((res.weightAvg - res.prevAvg) * 10) / 10;
    if (res.weightDays < 4) res.notes.push(`今週の体重記録は${res.weightDays}日分です。4日以上で週平均の精度が上がります。`);
    if (res.prevAvg == null) res.notes.push('前週の体重記録がないため、週の変化はまだ計算できません。');
    if (res.mealDays < 5) res.notes.push(`食事記録は${res.mealDays}日分です。記録のない日を含めた平均ではないため、摂取量は目安です。`);
    if (res.weightDays >= 5 && res.prevAvg != null && res.mealDays >= 5) res.confidence = 'medium';
    return res;
  }

  /** タンパク質の目安（体重×1.2〜1.6g）。体重がなければ null。 */
  function proteinTarget(kg) { return kg ? { min: Math.round(kg * 1.2), max: Math.round(kg * 1.6) } : null; }

  const api = { suggestStrength, suggestCardio, movingAvg, dailyWeights, pureAlcoholG, mealTotals, weekly, proteinTarget };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.COACH = api;
})(typeof window !== 'undefined' ? window : globalThis);
