/* My Fitness AI 画面とルーティング */
(function () {
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
  const fmt = (v, d) => (v == null ? '–' : (+v).toFixed(d == null ? 0 : d).replace(/\.0+$/, ''));
  const jpDate = (d) => { const [y, m, dd] = d.split('-'); const w = '日月火水木金土'[new Date(d + 'T00:00').getDay()]; return `${+m}/${+dd}(${w})`; };
  const MEAL_TYPES = ['朝食', '昼食', '夕食', '間食'];
  const COND = { good: '好調', normal: 'ふつう', tired: '疲れ気味', bad: '体調不良' };
  const view = $('#view');
  let cleanup = null;

  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function go(hash) { location.hash = hash; }
  function setTitle(t, back) {
    $('#title').textContent = t; $('#backBtn').hidden = !back;
  }
  function guessMealType() { const h = new Date().getHours(); return h < 10 ? '朝食' : h < 15 ? '昼食' : h < 21 ? '夕食' : '間食'; }

  const load = async () => {
    const [weights, meals, workouts, machines, foods, profile] = await Promise.all([
      DB.all('weights'), DB.all('meals'), DB.all('workouts'), DB.all('machines'), DB.all('foods'), DB.kvGet('profile', {}),
    ]);
    return { weights, meals, workouts, machines, foods, profile };
  };
  const byNewest = (a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt);
  const machineName = (machines, id) => { const m = machines.find((x) => x.id === id); return m ? m.name : '（不明なマシン）'; };

  /* ========== ホーム ========== */
  async function home() {
    setTitle('My Fitness AI');
    const d = await load(); const t = today();
    const tm = d.meals.filter((m) => m.date === t); const tot = COACH.mealTotals(tm);
    const dw = COACH.dailyWeights(d.weights); const lastW = dw[dw.length - 1];
    const tw = d.workouts.filter((w) => w.date === t);
    const pt = COACH.proteinTarget(lastW ? lastW.kg : d.profile.weightKg);
    view.innerHTML = `
      <div class="big-actions">
        <a class="big meal" href="#/meal"><span class="ico">🍙</span><span>食事<small>写真・バーコード・検索・手入力</small></span></a>
        <a class="big work" href="#/workout"><span class="ico">🏋️</span><span>運動<small>筋トレ・バイク・次回メニュー</small></span></a>
        <a class="big res" href="#/results"><span class="ico">📈</span><span>結果<small>体重・7日平均・週の変化・履歴</small></span></a>
      </div>
      <div class="card">
        <h2>今日 ${jpDate(t)}</h2>
        <div class="stats">
          <div class="stat"><b>${lastW ? fmt(lastW.kg, 1) : '–'}</b><span>体重kg${lastW && lastW.date !== t ? `（${jpDate(lastW.date)}）` : ''}</span></div>
          <div class="stat"><b>${fmt(tot.kcal)}</b><span>摂取kcal</span></div>
          <div class="stat"><b>${fmt(tot.protein)}</b><span>タンパク質g${pt ? `<br>目安${pt.min}〜${pt.max}` : ''}</span></div>
        </div>
        <p class="muted">運動 ${tw.length}件・食事 ${tm.length}件${tot.alcoholG ? `・純アルコール ${fmt(tot.alcoholG)}g` : ''}</p>
      </div>
      <div class="card">
        <h3>体重をすばやく登録</h3>
        <div class="row">
          <input id="qW" type="number" inputmode="decimal" step="0.1" placeholder="体重 kg" value="">
          <input id="qF" type="number" inputmode="decimal" step="0.1" placeholder="体脂肪率 %（任意）">
        </div>
        <button id="qSave" class="btn primary block">体重を登録</button>
      </div>`;
    $('#qSave').onclick = async () => {
      const kg = num($('#qW').value);
      if (!kg || kg < 20 || kg > 300) return toast('体重を正しく入力してください');
      await DB.put('weights', { date: t, kg, bodyFatPct: num($('#qF').value), note: '' });
      toast('体重を登録しました'); home();
    };
  }

  /* ========== 食事 ========== */
  async function mealHome(q) {
    setTitle('食事');
    const d = await load(); const date = q.date || today();
    const ms = d.meals.filter((m) => m.date === date).sort((a, b) => MEAL_TYPES.indexOf(a.mealType) - MEAL_TYPES.indexOf(b.mealType) || a.createdAt.localeCompare(b.createdAt));
    const tot = COACH.mealTotals(ms);
    view.innerHTML = `
      <div class="card">
        <div class="row" style="align-items:center"><input id="mDate" type="date" value="${date}"></div>
        <div class="stats" style="margin-top:10px">
          <div class="stat"><b>${fmt(tot.kcal)}</b><span>kcal</span></div>
          <div class="stat"><b>${fmt(tot.protein)}</b><span>P g</span></div>
          <div class="stat"><b>${fmt(tot.fat)}/${fmt(tot.carbs)}</b><span>F/C g</span></div>
        </div>
        <p class="muted">食塩 ${fmt(tot.salt, 1)}g${tot.alcoholG ? `・純アルコール ${fmt(tot.alcoholG)}g` : ''}</p>
      </div>
      <div class="big-actions" style="grid-template-columns:1fr 1fr">
        <a class="btn primary" href="#/meal/add?mode=search&date=${date}">🔎 検索・よく食べる</a>
        <a class="btn primary" href="#/meal/add?mode=barcode&date=${date}">▥ バーコード</a>
        <a class="btn primary" href="#/meal/add?mode=photo&date=${date}">📷 写真・栄養表示</a>
        <a class="btn primary" href="#/meal/add?mode=manual&date=${date}">✏️ 手入力</a>
      </div>
      <div class="card"><h3>この日の記録</h3>
        ${ms.length ? `<ul class="list">${ms.map((m) => `
          <li data-id="${m.id}">
            ${m.photo ? `<img class="thumb" src="${m.photo}" alt="">` : ''}
            <div class="main"><div>${esc(m.name || '（名前なし）')}${m.qty && +m.qty !== 1 ? ` ×${fmt(m.qty, 2)}` : ''}</div>
            <div class="sub">${esc(m.mealType)}・${fmt((+m.kcal || 0) * (m.qty == null ? 1 : +m.qty))}kcal・P${fmt((+m.protein || 0) * (m.qty == null ? 1 : +m.qty), 1)}g${m.alcoholPct ? '・🍺' : ''}${m.valueType === 'estimate' ? '<span class="tag warn">推定</span>' : ''}</div></div>
            <a class="btn small" href="#/meal/edit/${m.id}">編集</a></li>`).join('')}</ul>` : '<p class="muted">まだ記録がありません。</p>'}
      </div>`;
    $('#mDate').onchange = (e) => go('#/meal?date=' + e.target.value);
  }

  function foodToMeal(f) {
    return { name: f.name, unit: f.unit, kcal: f.kcal, protein: f.protein, fat: f.fat, carbs: f.carbs, salt: f.salt,
      alcoholPct: f.alcoholPct || null, volumeMl: f.volumeMl || null, seller: f.seller || '', maker: f.maker || '', jan: f.jan || '',
      foodId: f.id, valueType: f.valueType, source: f.source, qty: 1 };
  }

  async function mealAdd(q) {
    const mode = q.mode || 'search'; const date = q.date || today();
    const titles = { search: '食品を検索', barcode: 'バーコード', photo: '写真・栄養表示', manual: '手入力' };
    setTitle(titles[mode] || '食事を追加', true);
    if (mode === 'manual') return mealForm({ date, mealType: guessMealType(), qty: 1, valueType: 'manual' });
    if (mode === 'search') return mealSearch(date);
    if (mode === 'barcode') return mealBarcode(date);
    if (mode === 'photo') return mealPhoto(date);
  }

  async function mealSearch(date) {
    const d = await load();
    const favIds = new Set(await DB.kvGet('favFoods', []));
    // よく食べる: 過去の食事の出現回数
    const freq = {};
    d.meals.forEach((m) => { const k = m.foodId || 'name:' + m.name; freq[k] = (freq[k] || 0) + 1; });
    const recentMeals = {};
    d.meals.slice().sort(byNewest).forEach((m) => { if (!m.foodId && m.name && !recentMeals[m.name]) recentMeals[m.name] = m; });
    view.innerHTML = `
      <input id="fq" type="search" placeholder="商品名・食品名・JANで検索" autocomplete="off">
      <div class="chips" id="storeChips"></div>
      <div class="card" style="margin-top:8px"><ul class="list" id="fres"></ul></div>
      <a class="btn block" href="#/meal/add?mode=manual&date=${date}">見つからない → 手入力で登録</a>`;
    let store = '';
    $('#storeChips').innerHTML = ['すべて', ...SEED.STORES].map((s) => `<button class="chip${s === 'すべて' ? ' on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('');
    $$('#storeChips .chip').forEach((b) => b.onclick = () => { $$('#storeChips .chip').forEach((x) => x.classList.remove('on')); b.classList.add('on'); store = b.dataset.s === 'すべて' ? '' : b.dataset.s; render(); });
    const render = () => {
      const qq = $('#fq').value.trim().toLowerCase();
      const items = [
        ...d.foods.map((f) => ({ kind: 'food', f, score: (favIds.has(f.id) ? 1000 : 0) + (freq[f.id] || 0) })),
        ...Object.values(recentMeals).map((m) => ({ kind: 'meal', f: Object.assign({}, m, { id: null }), score: freq['name:' + m.name] || 0 })),
      ].filter(({ f }) => (!qq || (f.name || '').toLowerCase().includes(qq) || (f.jan || '').includes(qq) || (f.maker || '').toLowerCase().includes(qq))
        && (!store || f.seller === store))
        .sort((a, b) => b.score - a.score || a.f.name.localeCompare(b.f.name, 'ja')).slice(0, 60);
      $('#fres').innerHTML = items.length ? items.map(({ kind, f }, i) => `
        <li><div class="main" data-i="${i}"><div>${favIds.has(f.id) ? '★ ' : ''}${esc(f.name)}</div>
          <div class="sub">${esc(f.unit || '')}・${fmt(f.kcal)}kcal・P${fmt(f.protein, 1)}${f.seller ? '・' + esc(f.seller) : ''}
          ${f.valueType === 'official' ? '<span class="tag ok">公式値</span>' : f.valueType === 'estimate' ? '<span class="tag warn">推定</span>' : f.valueType === 'external' ? '<span class="tag">外部DB</span>' : kind === 'meal' ? '<span class="tag">過去の記録</span>' : '<span class="tag">自分で登録</span>'}</div></div>
          ${f.id ? `<button class="btn small" data-fav="${f.id}">${favIds.has(f.id) ? '★' : '☆'}</button>` : ''}
          <button class="btn small primary" data-i="${i}">追加</button></li>`).join('') : '<li class="muted">該当なし。手入力で登録すると次回から検索できます。</li>';
      $$('#fres [data-i]').forEach((el) => el.onclick = () => {
        const it = items[+el.dataset.i];
        const base = it.kind === 'food' ? foodToMeal(it.f) : Object.assign({}, it.f, { id: undefined, createdAt: undefined, updatedAt: undefined, photo: null, qty: 1 });
        mealForm(Object.assign(base, { date, mealType: guessMealType() }));
      });
      $$('#fres [data-fav]').forEach((el) => el.onclick = async (e) => {
        e.stopPropagation(); const id = el.dataset.fav;
        favIds.has(id) ? favIds.delete(id) : favIds.add(id);
        await DB.kvSet('favFoods', [...favIds]); render();
      });
    };
    $('#fq').oninput = render; render();
  }

  async function findFoodByJan(jan) {
    const foods = await DB.all('foods');
    return foods.find((f) => f.jan === jan);
  }

  async function handleJan(jan, date) {
    if (!BARCODE.validJan(jan)) { toast('JANコードの形式が正しくありません'); return; }
    const local = await findFoodByJan(jan);
    if (local) { toast('登録済みの商品です'); return mealForm(Object.assign(foodToMeal(local), { date, mealType: guessMealType() })); }
    const useOFF = await DB.kvGet('useOFF', true);
    let ext = null;
    if (useOFF && navigator.onLine) {
      toast('外部データベースを検索中…');
      try { ext = await BARCODE.lookupOFF(jan); } catch (e) { ext = null; }
    }
    if (ext && ext.kcal != null) {
      toast('外部データベースで見つかりました。値を確認してください');
      return mealForm(Object.assign({ date, mealType: guessMealType(), qty: 1, saveFood: true }, ext));
    }
    toast('未登録の商品です。栄養表示を見て入力してください');
    mealForm({ date, mealType: guessMealType(), qty: 1, jan, name: ext ? ext.name : '', maker: ext ? ext.maker : '', valueType: 'official', saveFood: true });
  }

  async function mealBarcode(date) {
    const live = BARCODE.liveAvailable();
    view.innerHTML = `
      ${live ? `<div class="card"><h3>カメラで読み取り</h3><video class="scan" id="vid" playsinline muted></video>
        <button id="startCam" class="btn primary block">カメラを起動</button></div>` :
        '<div class="warnbox">この接続ではライブ読み取りが使えません（HTTPSが必要）。下の「写真から読み取り」を使ってください。</div>'}
      <div class="card"><h3>写真から読み取り</h3>
        <input id="bcFile" type="file" accept="image/*" capture="environment">
        <p class="muted">バーコードを画面いっぱいに、ピントを合わせて撮影してください。</p></div>
      <div class="card"><h3>JANコードを入力</h3>
        <div class="row"><input id="janIn" type="text" inputmode="numeric" maxlength="13" placeholder="例 4901234567890"><button id="janGo" class="btn primary" style="flex:none">検索</button></div></div>`;
    let ctl = null;
    if (live) $('#startCam').onclick = async () => {
      try {
        $('#startCam').disabled = true;
        ctl = await BARCODE.startLive($('#vid'), (code) => { ctl = null; handleJan(code, date); });
      } catch (e) { toast('カメラを起動できません: ' + e.message); $('#startCam').disabled = false; }
    };
    cleanup = () => { if (ctl) ctl.stop(); };
    $('#bcFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { toast('読み取り中…'); const code = await BARCODE.decodeFile(f); handleJan(code, date); }
      catch (err) { toast('読み取れませんでした。もう一度撮るか、数字を入力してください'); }
    };
    $('#janGo').onclick = () => handleJan($('#janIn').value.trim(), date);
  }

  function resizeImage(file, max) {
    return new Promise((res, rej) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('画像を読み込めません')); };
      img.src = url;
    });
  }

  async function mealPhoto(date) {
    view.innerHTML = `
      <div class="card"><h3>食事の写真</h3>
        <input id="phFile" type="file" accept="image/*" capture="environment">
        <p class="muted">写真は端末内にだけ保存されます（外部には送信しません）。</p></div>
      <div class="note">AIによる写真からの自動解析は、まだ利用できません（サーバー側のAI接続が未設定）。
        写真を付けたうえで、商品の栄養成分表示を見ながら数値を入力するか、検索から選んでください。</div>`;
    $('#phFile').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const photo = await resizeImage(f, 480);
      mealForm({ date, mealType: guessMealType(), qty: 1, photo, valueType: 'manual' });
    };
  }

  async function mealForm(m) {
    const isEdit = !!m.id;
    setTitle(isEdit ? '食事を編集' : '食事を登録', true);
    const v = (k) => (m[k] == null ? '' : esc(m[k]));
    view.innerHTML = `
      <div class="card">
        ${m.photo ? `<img src="${m.photo}" alt="" style="width:100%;border-radius:10px">` : ''}
        <div class="row"><div><label>日付</label><input id="f_date" type="date" value="${v('date')}"></div>
          <div><label>区分</label><select id="f_mealType">${MEAL_TYPES.map((t) => `<option${t === m.mealType ? ' selected' : ''}>${t}</option>`).join('')}</select></div></div>
        <label>食品名・商品名</label><input id="f_name" value="${v('name')}" placeholder="例 サラダチキン">
        <div class="row"><div><label>量（${esc(m.unit || '1食')}あたり×）</label><input id="f_qty" type="number" inputmode="decimal" step="0.25" value="${m.qty == null ? 1 : m.qty}"></div>
          <div><label>単位</label><input id="f_unit" value="${v('unit')}" placeholder="1個 / 100g"></div></div>
        <p class="muted">以下は「単位」1つあたりの値</p>
        <div class="row"><div><label>エネルギー kcal</label><input id="f_kcal" type="number" inputmode="decimal" value="${v('kcal')}"></div>
          <div><label>タンパク質 g</label><input id="f_protein" type="number" inputmode="decimal" step="0.1" value="${v('protein')}"></div></div>
        <div class="row"><div><label>脂質 g</label><input id="f_fat" type="number" inputmode="decimal" step="0.1" value="${v('fat')}"></div>
          <div><label>炭水化物 g</label><input id="f_carbs" type="number" inputmode="decimal" step="0.1" value="${v('carbs')}"></div>
          <div><label>食塩 g</label><input id="f_salt" type="number" inputmode="decimal" step="0.1" value="${v('salt')}"></div></div>
        <details ${m.alcoholPct || m.jan || m.seller ? 'open' : ''}><summary class="muted" style="margin-top:12px">お酒・購入店・JAN</summary>
          <div class="row"><div><label>アルコール度数 %</label><input id="f_alcoholPct" type="number" inputmode="decimal" step="0.5" value="${v('alcoholPct')}"></div>
            <div><label>容量 ml</label><input id="f_volumeMl" type="number" inputmode="numeric" value="${v('volumeMl')}"></div></div>
          <div class="row"><div><label>購入店</label><select id="f_seller"><option value="">—</option>${SEED.STORES.map((s) => `<option${s === m.seller ? ' selected' : ''}>${s}</option>`).join('')}</select></div>
            <div><label>メーカー</label><input id="f_maker" value="${v('maker')}"></div></div>
          <label>JANコード</label><input id="f_jan" inputmode="numeric" value="${v('jan')}">
          <label>値の種類</label><select id="f_valueType">
            ${[['official', '公式値（パッケージ・公式サイト）'], ['estimate', '推定値'], ['manual', '手入力（未分類）'], ['external', '外部DB（要確認）']].map(([k, l]) => `<option value="${k}"${k === (m.valueType || 'manual') ? ' selected' : ''}>${l}</option>`).join('')}
          </select>
          ${m.source ? `<p class="muted">出典: ${esc(m.source)}</p>` : ''}
        </details>
        ${!m.foodId ? `<label style="display:flex;gap:8px;align-items:center;color:var(--text)"><input id="f_saveFood" type="checkbox" style="width:auto" ${m.saveFood || !isEdit ? 'checked' : ''}> 食品データベースにも保存（次回から検索できる）</label>` : ''}
        <label>メモ</label><input id="f_note" value="${v('note')}">
        <button id="fSave" class="btn primary block">${isEdit ? '保存' : '登録'}</button>
        ${isEdit ? '<button id="fDel" class="btn danger block">この記録を削除</button>' : ''}
      </div>`;
    $('#fSave').onclick = async () => {
      const g = (k) => $('#f_' + k) ? $('#f_' + k).value.trim() : '';
      const rec = Object.assign({}, m, {
        date: g('date') || today(), mealType: g('mealType'), name: g('name'), qty: num(g('qty')) || 1, unit: g('unit'),
        kcal: num(g('kcal')), protein: num(g('protein')), fat: num(g('fat')), carbs: num(g('carbs')), salt: num(g('salt')),
        alcoholPct: num(g('alcoholPct')), volumeMl: num(g('volumeMl')), seller: g('seller'), maker: g('maker'), jan: g('jan'),
        valueType: g('valueType') || 'manual', note: g('note'),
      });
      delete rec.saveFood;
      if (!rec.name && !rec.photo) return toast('食品名を入力してください');
      if (rec.kcal == null && !rec.photo) return toast('カロリーを入力してください（不明なら概算で）');
      if ($('#f_saveFood') && $('#f_saveFood').checked && rec.name) {
        const food = await DB.put('foods', { name: rec.name, unit: rec.unit || '1食', kcal: rec.kcal, protein: rec.protein, fat: rec.fat, carbs: rec.carbs,
          salt: rec.salt, alcoholPct: rec.alcoholPct, volumeMl: rec.volumeMl, seller: rec.seller, maker: rec.maker, jan: rec.jan,
          amount: rec.unit, valueType: rec.valueType, source: rec.source || (rec.valueType === 'official' ? '本人がパッケージ表示から入力' : '本人入力'), checked: today() });
        rec.foodId = food.id;
      }
      await DB.put('meals', rec);
      toast(isEdit ? '保存しました' : '登録しました'); go('#/meal?date=' + rec.date);
    };
    if (isEdit) $('#fDel').onclick = async () => { if (!confirm('この食事記録を削除しますか？')) return; await DB.remove('meals', m.id); toast('削除しました'); go('#/meal?date=' + m.date); };
  }

  async function mealEdit(id) { const m = await DB.get('meals', id); if (!m) return go('#/meal'); mealForm(m); }

  /* ========== 運動 ========== */
  async function workoutHome() {
    setTitle('運動');
    const d = await load(); const t = today();
    const tw = d.workouts.filter((w) => w.date === t).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const strength = d.machines.filter((m) => m.kind === 'strength' && ['chest', 'back', 'shoulder', 'legs', 'arms', 'core'].includes(m.category));
    const cardio = d.machines.filter((m) => m.kind === 'cardio');
    view.innerHTML = `
      <a class="big work" href="#/next" style="margin-bottom:12px"><span class="ico">🧭</span><span>次回メニューを見る<small>前回の記録と今日の体調から提案</small></span></a>
      <div class="card"><h3>筋トレを記録</h3><div class="chips">${strength.map((m) => `<a class="chip" href="#/workout/strength?machine=${m.id}">${esc(m.name)}</a>`).join('')}
        <a class="chip" href="#/workout/strength">＋その他</a></div></div>
      <div class="card"><h3>有酸素を記録</h3><div class="chips">${cardio.map((m) => `<a class="chip" href="#/workout/cardio?machine=${m.id}">${esc(m.name)}</a>`).join('')}</div></div>
      <div class="card"><h3>今日の運動</h3>${tw.length ? `<ul class="list">${tw.map((w) => workoutLi(w, d.machines)).join('')}</ul>` : '<p class="muted">まだありません。</p>'}</div>`;
  }

  function workoutSummary(w) {
    if (w.kind === 'cardio') return `${w.level ? '負荷' + w.level + '・' : ''}${fmt(w.minutes)}分${w.hrAvg ? '・心拍' + w.hrAvg : ''}${w.rpe ? '・きつさ' + w.rpe : ''}`;
    const s = w.sets || [];
    const same = s.length && s.every((x) => x.kg === s[0].kg && x.reps === s[0].reps);
    return (same ? `${fmt(s[0].kg, 1)}kg×${s[0].reps}回×${s.length}セット` : s.map((x) => `${fmt(x.kg, 1)}×${x.reps}`).join(', '))
      + (w.rpe ? `・きつさ${w.rpe}` : '') + (w.restSec ? `・休憩${w.restSec}秒` : '');
  }
  function workoutLi(w, machines) {
    return `<li><div class="main"><div>${esc(machineName(machines, w.machineId))}</div><div class="sub">${workoutSummary(w)}${w.note ? '・' + esc(w.note) : ''}</div></div>
      <a class="btn small" href="#/workout/edit/${w.id}">編集</a></li>`;
  }

  async function strengthForm(q, existing) {
    const d = await load();
    const w = existing || { kind: 'strength', date: today(), machineId: q.machine || '', sets: [], condition: 'normal' };
    setTitle(existing ? '筋トレを編集' : '筋トレを記録', true);
    const strengthMachines = d.machines.filter((m) => m.kind !== 'cardio');
    const prevOf = (mid) => d.workouts.filter((x) => x.machineId === mid && x.id !== w.id && x.kind === 'strength').sort(byNewest);
    let sets = (w.sets && w.sets.length) ? w.sets.map((s) => Object.assign({}, s)) : null;
    if (!sets && q.kg) sets = Array.from({ length: +q.sets || 3 }, () => ({ kg: +q.kg, reps: +q.reps || null }));
    if (!sets) { const p = prevOf(w.machineId)[0]; sets = p ? p.sets.map((s) => ({ kg: s.kg, reps: s.reps })) : [{ kg: '', reps: '' }, { kg: '', reps: '' }, { kg: '', reps: '' }]; }
    const render = () => {
      const prev = prevOf($('#w_machine') ? $('#w_machine').value : w.machineId);
      $('#prevBox').innerHTML = prev.length ? `前回 ${jpDate(prev[0].date)}：${workoutSummary(prev[0])}` : '前回の記録なし';
      $('#setsBody').innerHTML = sets.map((s, i) => `<tr><td>${i + 1}</td>
        <td><input type="number" inputmode="decimal" step="0.5" data-k="kg" data-i="${i}" value="${s.kg == null ? '' : s.kg}"></td>
        <td><input type="number" inputmode="numeric" data-k="reps" data-i="${i}" value="${s.reps == null ? '' : s.reps}"></td>
        <td><button class="btn small" data-del="${i}">✕</button></td></tr>`).join('');
      $$('#setsBody input').forEach((el) => el.oninput = () => { sets[+el.dataset.i][el.dataset.k] = num(el.value); });
      $$('#setsBody [data-del]').forEach((el) => el.onclick = () => { sets.splice(+el.dataset.del, 1); render(); });
    };
    view.innerHTML = `
      <div class="card">
        <div class="row"><div><label>日付</label><input id="w_date" type="date" value="${w.date}"></div>
          <div><label>体調</label><select id="w_cond">${Object.entries(COND).map(([k, l]) => `<option value="${k}"${k === w.condition ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <label>マシン</label><select id="w_machine"><option value="">選択してください</option>${strengthMachines.map((m) => `<option value="${m.id}"${m.id === w.machineId ? ' selected' : ''}>${esc(m.name)}${m.status !== 'confirmed' ? '（機種未確認）' : ''}</option>`).join('')}</select>
        <a class="muted" href="#/machine/new">＋マシンを追加</a>
        <div class="note" id="prevBox"></div>
        <table class="sets" style="margin-top:10px"><thead><tr><th>#</th><th>重量kg</th><th>回数</th><th></th></tr></thead><tbody id="setsBody"></tbody></table>
        <button id="addSet" class="btn small" style="margin-top:8px">＋セット追加（前のセットを複製）</button>
        <div class="row"><div><label>休憩 秒</label><input id="w_rest" type="number" inputmode="numeric" value="${w.restSec || ''}" placeholder="90"></div>
          <div><label>運動時間 分</label><input id="w_min" type="number" inputmode="numeric" value="${w.minutes || ''}"></div></div>
        <div class="row"><div><label>きつさ 1〜10</label><input id="w_rpe" type="number" inputmode="numeric" min="1" max="10" value="${w.rpe || ''}" placeholder="7"></div>
          <div><label>心拍 /分</label><input id="w_hr" type="number" inputmode="numeric" value="${w.hrAvg || ''}"></div></div>
        <p class="muted">きつさの目安：7＝あと3回できる、8＝あと2回、9＝あと1回、10＝限界</p>
        <label>メモ（フォーム・痛み等）</label><input id="w_note" value="${esc(w.note || '')}">
        <button id="wSave" class="btn primary block">保存</button>
        ${existing ? '<button id="wDel" class="btn danger block">削除</button>' : ''}
      </div>`;
    render();
    $('#w_machine').onchange = () => {
      const p = prevOf($('#w_machine').value)[0];
      if (p && !existing) sets = p.sets.map((s) => ({ kg: s.kg, reps: s.reps }));
      render();
    };
    $('#addSet').onclick = () => { const l = sets[sets.length - 1] || { kg: '', reps: '' }; sets.push({ kg: l.kg, reps: l.reps }); render(); };
    $('#wSave').onclick = async () => {
      const mid = $('#w_machine').value; if (!mid) return toast('マシンを選んでください');
      const clean = sets.filter((s) => s.kg != null && s.kg !== '' && s.reps != null && s.reps !== '').map((s) => ({ kg: +s.kg, reps: +s.reps }));
      if (!clean.length) return toast('重量と回数を入力してください');
      const rec = Object.assign({}, w, { date: $('#w_date').value || today(), condition: $('#w_cond').value, machineId: mid, sets: clean,
        restSec: num($('#w_rest').value), minutes: num($('#w_min').value), rpe: num($('#w_rpe').value), hrAvg: num($('#w_hr').value), note: $('#w_note').value.trim() });
      await DB.put('workouts', rec); toast('保存しました'); go('#/workout');
    };
    if (existing) $('#wDel').onclick = async () => { if (!confirm('削除しますか？')) return; await DB.remove('workouts', w.id); go('#/workout'); };
  }

  async function cardioForm(q, existing) {
    const d = await load();
    const w = existing || { kind: 'cardio', date: today(), machineId: q.machine || 'mc-bike', condition: 'normal' };
    setTitle(existing ? '有酸素を編集' : '有酸素を記録', true);
    const cm = d.machines.filter((m) => m.kind === 'cardio');
    const prev = d.workouts.filter((x) => x.machineId === w.machineId && x.id !== w.id).sort(byNewest)[0];
    const init = existing || (q.min ? { level: num(q.level), minutes: num(q.min) } : prev ? { level: prev.level, minutes: prev.minutes } : {});
    view.innerHTML = `
      <div class="card">
        <div class="row"><div><label>日付</label><input id="c_date" type="date" value="${w.date}"></div>
          <div><label>体調</label><select id="c_cond">${Object.entries(COND).map(([k, l]) => `<option value="${k}"${k === w.condition ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <label>マシン</label><select id="c_machine">${cm.map((m) => `<option value="${m.id}"${m.id === w.machineId ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select>
        <div class="note">${prev ? `前回 ${jpDate(prev.date)}：${workoutSummary(prev)}` : '前回の記録なし'}</div>
        <div class="row"><div><label>負荷（レベル）</label><input id="c_level" type="number" inputmode="numeric" value="${init.level || ''}"></div>
          <div><label>時間 分</label><input id="c_min" type="number" inputmode="numeric" value="${init.minutes || ''}"></div></div>
        <div class="row"><div><label>平均心拍 /分</label><input id="c_hr" type="number" inputmode="numeric" value="${w.hrAvg || ''}"></div>
          <div><label>最大心拍 /分</label><input id="c_hrmax" type="number" inputmode="numeric" value="${w.hrMax || ''}"></div></div>
        <div class="row"><div><label>きつさ 1〜10</label><input id="c_rpe" type="number" inputmode="numeric" value="${w.rpe || ''}"></div>
          <div><label>距離 km</label><input id="c_km" type="number" inputmode="decimal" step="0.1" value="${w.km || ''}"></div>
          <div><label>表示kcal</label><input id="c_kcal" type="number" inputmode="numeric" value="${w.kcal || ''}"></div></div>
        <label>メモ</label><input id="c_note" value="${esc(w.note || '')}">
        <button id="cSave" class="btn primary block">保存</button>
        ${existing ? '<button id="cDel" class="btn danger block">削除</button>' : ''}
      </div>`;
    $('#cSave').onclick = async () => {
      const min = num($('#c_min').value); if (!min) return toast('時間を入力してください');
      const rec = Object.assign({}, w, { date: $('#c_date').value || today(), condition: $('#c_cond').value, machineId: $('#c_machine').value,
        level: num($('#c_level').value), minutes: min, hrAvg: num($('#c_hr').value), hrMax: num($('#c_hrmax').value), rpe: num($('#c_rpe').value),
        km: num($('#c_km').value), kcal: num($('#c_kcal').value), note: $('#c_note').value.trim() });
      await DB.put('workouts', rec); toast('保存しました'); go('#/workout');
    };
    if (existing) $('#cDel').onclick = async () => { if (!confirm('削除しますか？')) return; await DB.remove('workouts', w.id); go('#/workout'); };
  }

  async function workoutEdit(id) {
    const w = await DB.get('workouts', id); if (!w) return go('#/workout');
    return w.kind === 'cardio' ? cardioForm({}, w) : strengthForm({}, w);
  }

  async function nextMenu(q) {
    setTitle('次回メニュー', true);
    const d = await load();
    const cond = q.cond || (await DB.kvGet('lastCond', 'normal')); const pain = q.pain === '1';
    await DB.kvSet('lastCond', cond);
    const ctx = { condition: cond, pain };
    const used = [...new Set(d.workouts.filter((w) => w.kind === 'strength').sort(byNewest).map((w) => w.machineId))];
    const cards = used.map((mid) => {
      const hist = d.workouts.filter((w) => w.machineId === mid && w.kind === 'strength').sort(byNewest);
      const s = COACH.suggestStrength(hist, ctx);
      return `<div class="card sug"><h3>${esc(machineName(d.machines, mid))}</h3>
        <div class="w">${s.sets === 0 ? '休み' : `${s.kg != null ? fmt(s.kg, 1) + 'kg' : '重量を探す'} × ${s.reps}回 × ${s.sets}セット`}</div>
        ${s.reasons.map((r) => `<p class="muted">${esc(r)}</p>`).join('')}${s.cautions.map((r) => `<div class="warnbox">${esc(r)}</div>`).join('')}
        ${s.sets ? `<a class="btn small" href="#/workout/strength?machine=${mid}${s.kg != null ? `&kg=${s.kg}&reps=${parseInt(s.reps, 10)}&sets=${s.sets}` : ''}">この内容で記録する</a>` : ''}</div>`;
    }).join('');
    const bikeHist = d.workouts.filter((w) => w.kind === 'cardio').sort(byNewest);
    const c = COACH.suggestCardio(bikeHist, ctx, d.profile);
    const cmid = bikeHist[0] ? bikeHist[0].machineId : 'mc-bike';
    const wk = COACH.weekly(today(), d.weights, d.meals, d.workouts);
    const freq = d.profile.freqPerWeek || 3;
    view.innerHTML = `
      <div class="card"><h3>今日の体調</h3>
        <div class="chips">${Object.entries(COND).map(([k, l]) => `<button class="chip${k === cond ? ' on' : ''}" data-c="${k}">${l}</button>`).join('')}
        <button class="chip${pain ? ' on' : ''}" id="painBtn">痛みあり</button></div>
        <p class="muted">今週の運動 ${wk.workoutDays}/${freq}日</p></div>
      ${cards || '<p class="muted">筋トレの記録がありません。</p>'}
      <div class="card sug"><h3>${esc(machineName(d.machines, cmid))}（有酸素）</h3>
        <div class="w">${c.level ? '負荷' + c.level + '・' : ''}${c.minutes}分</div>
        ${c.reasons.map((r) => `<p class="muted">${esc(r)}</p>`).join('')}${c.cautions.map((r) => `<div class="warnbox">${esc(r)}</div>`).join('')}
        ${c.hrRef ? `<p class="muted">${esc(c.hrRef)}</p>` : ''}
        <a class="btn small" href="#/workout/cardio?machine=${cmid}${c.level ? '&level=' + c.level : ''}&min=${c.minutes}">この内容で記録する</a></div>
      <div class="note">提案は記録から計算した目安です。安全性を保証するものではありません。持病・服薬・痛みがある場合は医師の指示を優先してください。</div>`;
    $$('[data-c]').forEach((b) => b.onclick = () => go(`#/next?cond=${b.dataset.c}${pain ? '&pain=1' : ''}`));
    $('#painBtn').onclick = () => go(`#/next?cond=${cond}${pain ? '' : '&pain=1'}`);
  }

  /* ========== 結果 ========== */
  async function results(q) {
    setTitle('結果');
    const tab = q.tab || 'summary';
    const d = await load(); const t = today();
    const dw = COACH.dailyWeights(d.weights);
    const ma = COACH.movingAvg(dw.slice(-60));
    const wk = COACH.weekly(t, d.weights, d.meals, d.workouts);
    const last = ma[ma.length - 1];
    let body = '';
    if (tab === 'summary') {
      const pt = COACH.proteinTarget(last ? last.kg : d.profile.weightKg);
      body = `
        <div class="card"><h3>体重</h3>
          <div class="stats"><div class="stat"><b>${last ? fmt(last.kg, 1) : '–'}</b><span>最新kg</span></div>
            <div class="stat"><b>${last ? fmt(last.avg, 1) : '–'}</b><span>7日平均</span></div>
            <div class="stat"><b>${wk.change == null ? '–' : (wk.change > 0 ? '+' : '') + wk.change}</b><span>前週比kg</span></div></div>
          ${CHARTS.weightChart(ma, d.profile.goalKg)}
          <a class="btn block" href="#/weight">体重・体脂肪率を記録</a></div>
        <div class="card"><h3>直近7日間</h3>
          <ul class="list">
            <li><div class="main">運動した日</div><b>${wk.workoutDays}日 / 目標${d.profile.freqPerWeek || 3}日</b></li>
            <li><div class="main">筋トレ</div><b>${wk.strengthSets}セット</b></li>
            <li><div class="main">有酸素</div><b>${wk.cardioMin}分</b></li>
            <li><div class="main">摂取kcal（記録日の平均）</div><b>${wk.kcalAvg == null ? '–' : wk.kcalAvg}</b></li>
            <li><div class="main">タンパク質（記録日の平均）</div><b>${wk.proteinAvg == null ? '–' : wk.proteinAvg + 'g'}${pt ? ` <span class="muted">目安${pt.min}〜${pt.max}</span>` : ''}</b></li>
            ${wk.alcoholAvg ? `<li><div class="main">純アルコール（記録日の平均）</div><b>${wk.alcoholAvg}g</b></li>` : ''}
          </ul>
          <p class="muted">分析の確からしさ：${wk.confidence === 'medium' ? '中' : '低（データ不足）'}</p>
          ${wk.notes.map((n) => `<div class="note">${esc(n)}</div>`).join('')}</div>
        <a class="btn primary block" href="#/next">次回メニューを見る</a>`;
    } else {
      const days = {};
      d.weights.forEach((x) => (days[x.date] = days[x.date] || []).push({ t: 'w', x }));
      d.meals.forEach((x) => (days[x.date] = days[x.date] || []).push({ t: 'm', x }));
      d.workouts.forEach((x) => (days[x.date] = days[x.date] || []).push({ t: 'k', x }));
      const keys = Object.keys(days).sort().reverse().slice(0, 60);
      body = keys.length ? keys.map((k) => {
        const tot = COACH.mealTotals(days[k].filter((e) => e.t === 'm').map((e) => e.x));
        return `<div class="daysep">${jpDate(k)}　${tot.kcal ? fmt(tot.kcal) + 'kcal・P' + fmt(tot.protein) + 'g' : ''}</div><div class="card" style="padding:4px 12px"><ul class="list">${days[k].map(({ t: ty, x }) => {
          if (ty === 'w') return `<li><div class="main"><div>⚖️ 体重 ${fmt(x.kg, 1)}kg${x.bodyFatPct ? '・体脂肪' + x.bodyFatPct + '%' : ''}</div>${x.note ? `<div class="sub">${esc(x.note)}</div>` : ''}</div><a class="btn small" href="#/weight/${x.id}">編集</a></li>`;
          if (ty === 'm') return `<li><div class="main"><div>🍙 ${esc(x.name || '食事')}</div><div class="sub">${esc(x.mealType)}・${fmt((+x.kcal || 0) * (x.qty || 1))}kcal</div></div><a class="btn small" href="#/meal/edit/${x.id}">編集</a></li>`;
          return `<li><div class="main"><div>🏋️ ${esc(machineName(d.machines, x.machineId))}</div><div class="sub">${workoutSummary(x)}</div></div><a class="btn small" href="#/workout/edit/${x.id}">編集</a></li>`;
        }).join('')}</ul></div>`;
      }).join('') : '<p class="muted">記録がありません。</p>';
    }
    view.innerHTML = `<div class="seg"><button data-t="summary" class="${tab === 'summary' ? 'on' : ''}">分析</button><button data-t="history" class="${tab === 'history' ? 'on' : ''}">履歴</button></div>${body}`;
    $$('.seg button').forEach((b) => b.onclick = () => go('#/results?tab=' + b.dataset.t));
  }

  async function weightForm(id) {
    const w = id ? await DB.get('weights', id) : { date: today(), kg: '', bodyFatPct: '' };
    setTitle(id ? '体重を編集' : '体重を記録', true);
    view.innerHTML = `<div class="card">
      <label>日付</label><input id="ww_date" type="date" value="${w.date}">
      <div class="row"><div><label>体重 kg</label><input id="ww_kg" type="number" inputmode="decimal" step="0.1" value="${w.kg || ''}"></div>
        <div><label>体脂肪率 %</label><input id="ww_bf" type="number" inputmode="decimal" step="0.1" value="${w.bodyFatPct || ''}"></div></div>
      <label>メモ</label><input id="ww_note" value="${esc(w.note || '')}" placeholder="朝・トイレ後 など">
      <button id="wwSave" class="btn primary block">保存</button>${id ? '<button id="wwDel" class="btn danger block">削除</button>' : ''}
      <p class="muted">毎日同じ条件（朝起きてトイレの後など）で測ると、7日平均の変化が読み取りやすくなります。</p></div>`;
    $('#wwSave').onclick = async () => {
      const kg = num($('#ww_kg').value); if (!kg || kg < 20 || kg > 300) return toast('体重を正しく入力してください');
      await DB.put('weights', Object.assign({}, w, { date: $('#ww_date').value || today(), kg, bodyFatPct: num($('#ww_bf').value), note: $('#ww_note').value.trim() }));
      toast('保存しました'); go('#/results');
    };
    if (id) $('#wwDel').onclick = async () => { if (!confirm('削除しますか？')) return; await DB.remove('weights', id); go('#/results?tab=history'); };
  }

  /* ========== 設定 ========== */
  async function settings() {
    setTitle('設定', true);
    const p = await DB.kvGet('profile', {});
    const hasPin = !!(await DB.kvGet('pin', null));
    const useOFF = await DB.kvGet('useOFF', true);
    view.innerHTML = `
      <div class="card"><h3>プロフィール</h3>
        <div class="row"><div><label>年齢</label><input id="p_age" type="number" inputmode="numeric" value="${p.age || ''}"></div>
          <div><label>身長 cm</label><input id="p_h" type="number" inputmode="decimal" value="${p.heightCm || ''}"></div></div>
        <div class="row"><div><label>目標体重 kg</label><input id="p_goal" type="number" inputmode="decimal" step="0.1" value="${p.goalKg || ''}"></div>
          <div><label>運動頻度 回/週</label><input id="p_freq" type="number" inputmode="numeric" value="${p.freqPerWeek || ''}"></div></div>
        <label>目的</label><input id="p_goals" value="${esc((p.goals || []).join('、'))}">
        <label>運動経験</label><input id="p_exp" value="${esc(p.experience || '')}" placeholder="例 マシン中心で2年">
        <label>既往歴・持病・服薬</label><textarea id="p_cond">${esc(p.conditions || '')}</textarea>
        <label>運動上の制約（痛み・医師の指示など）</label><textarea id="p_cons">${esc(p.constraints || '')}</textarea>
        <button id="pSave" class="btn primary block">保存</button>
        <p class="muted">健康情報は端末内にだけ保存されます。外部には送信しません。</p></div>
      <div class="card"><h3>ジム・マシン</h3>
        <p>${esc(SEED.GYM.name)}</p><p class="muted">${esc(SEED.GYM.address)}<br>${esc(SEED.GYM.hours)}</p>
        <a class="btn block" href="#/machines">マシン一覧・出典を見る／編集</a></div>
      <div class="card"><h3>食品データベース</h3>
        <a class="btn block" href="#/foods">登録食品の一覧・編集</a>
        <label style="display:flex;gap:8px;align-items:center;color:var(--text);margin-top:12px"><input id="s_off" type="checkbox" style="width:auto" ${useOFF ? 'checked' : ''}> 未登録バーコードを Open Food Facts で照会（JANコードのみ送信）</label></div>
      <div class="card"><h3>バックアップ・復元</h3>
        <button id="bExp" class="btn block">バックアップを保存（JSONファイル）</button>
        <label>復元するファイル</label><input id="bImp" type="file" accept="application/json,.json">
        <p class="muted">機種変更や iPhone/Android 間の移行は、このファイルで行えます。定期的に保存してください。</p></div>
      <div class="card"><h3>本人専用ロック</h3>
        <p class="muted">${hasPin ? 'パスコード設定済み。' : '未設定。'}アプリを開くたびにパスコードを求めます（端末内のロックであり、データの暗号化ではありません。端末自体の画面ロックも併用してください）。</p>
        <div class="row"><input id="pin1" type="password" inputmode="numeric" placeholder="新しいパスコード（4桁以上）"><button id="pinSet" class="btn" style="flex:none">設定</button></div>
        ${hasPin ? '<button id="pinOff" class="btn danger block">ロックを解除（無効化）</button>' : ''}</div>
      <div class="card"><h3>このアプリについて</h3><p class="muted">My Fitness AI v0.1（合同会社トリル）／データ保存先：この端末のブラウザ内（IndexedDB）</p>
        <button id="wipe" class="btn danger block">全データを消去</button></div>`;
    $('#pSave').onclick = async () => {
      Object.assign(p, { age: num($('#p_age').value), heightCm: num($('#p_h').value), goalKg: num($('#p_goal').value), freqPerWeek: num($('#p_freq').value),
        goals: $('#p_goals').value.split(/[、,]/).map((s) => s.trim()).filter(Boolean), experience: $('#p_exp').value.trim(),
        conditions: $('#p_cond').value.trim(), constraints: $('#p_cons').value.trim() });
      await DB.kvSet('profile', p); toast('保存しました');
    };
    $('#s_off').onchange = (e) => DB.kvSet('useOFF', e.target.checked);
    $('#bExp').onclick = async () => {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const name = `my-fitness-ai-backup-${today()}.json`;
      const file = new File([blob], name, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      await DB.kvSet('lastBackup', new Date().toISOString());
    };
    $('#bImp').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (!confirm('バックアップを読み込みます。同じIDの記録は上書きされます。よろしいですか？')) return;
      try {
        const n = await DB.importAll(JSON.parse(await f.text()));
        const p = await DB.kvGet('profile', {}); if (p.age || p.weightKg) { p.setupDone = true; await DB.kvSet('profile', p); }
        toast(`${n}件を復元しました`);
      }
      catch (err) { toast('復元できません: ' + err.message); }
    };
    $('#pinSet').onclick = async () => {
      const v = $('#pin1').value; if (!/^\d{4,}$/.test(v)) return toast('4桁以上の数字にしてください');
      await setPin(v); toast('パスコードを設定しました'); settings();
    };
    if (hasPin) $('#pinOff').onclick = async () => { if (!confirm('ロックを無効にしますか？')) return; await DB.kvSet('pin', null); settings(); };
    $('#wipe').onclick = async () => {
      if (!confirm('全データを消去します。元に戻せません。先にバックアップを保存しましたか？')) return;
      if (prompt('消去するには「消去」と入力してください') !== '消去') return;
      await DB.wipe(); toast('消去しました'); await SEED.seedIfEmpty(); go('#/');
    };
  }

  async function machines() {
    setTitle('マシン一覧', true);
    const ms = await DB.all('machines');
    const g = await DB.get('gyms', SEED.GYM.id);
    view.innerHTML = `<div class="note">出典：${g ? `<a href="${esc(g.source)}" target="_blank" rel="noopener">${esc(g.source)}</a>（確認日 ${esc(g.checked)}）` : ''}<br>
      公式ページで確認できたのは設備の種類・台数・メーカーロゴまでです。個別の機種名は未確認です。店頭で確認したら編集してください。</div>
      <div class="card"><ul class="list">${ms.map((m) => `<li><div class="main"><div>${esc(m.name)}${m.status === 'confirmed' ? '<span class="tag ok">確認済</span>' : '<span class="tag warn">未確認</span>'}</div>
        <div class="sub">${esc([m.maker, m.model].filter(Boolean).join(' ') || 'メーカー・機種 未確認')}・${esc(m.sourceNote || m.source || '')}</div></div>
        <a class="btn small" href="#/machine/${m.id}">編集</a></li>`).join('')}</ul></div>
      <a class="btn primary block" href="#/machine/new">＋マシンを追加</a>`;
  }

  async function machineForm(id) {
    const m = id === 'new' ? { gymId: SEED.GYM.id, kind: 'strength', category: 'chest', status: 'unconfirmed', source: '本人確認（店頭）', checked: today() } : await DB.get('machines', id);
    setTitle(id === 'new' ? 'マシンを追加' : 'マシンを編集', true);
    const cats = { chest: '胸', back: '背中', shoulder: '肩', legs: '脚', arms: '腕', core: '体幹', cardio: '有酸素', other: 'その他' };
    view.innerHTML = `<div class="card">
      <label>名前</label><input id="m_name" value="${esc(m.name || '')}" placeholder="例 チェストプレス">
      <div class="row"><div><label>部位</label><select id="m_cat">${Object.entries(cats).map(([k, l]) => `<option value="${k}"${k === m.category ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
        <div><label>種類</label><select id="m_kind"><option value="strength"${m.kind !== 'cardio' ? ' selected' : ''}>筋トレ</option><option value="cardio"${m.kind === 'cardio' ? ' selected' : ''}>有酸素</option></select></div></div>
      <div class="row"><div><label>メーカー</label><input id="m_maker" value="${esc(m.maker || '')}"></div><div><label>機種・型番</label><input id="m_model" value="${esc(m.model || '')}"></div></div>
      <label>確認状態</label><select id="m_status"><option value="confirmed"${m.status === 'confirmed' ? ' selected' : ''}>確認済（出典あり）</option><option value="unconfirmed"${m.status !== 'confirmed' ? ' selected' : ''}>未確認</option></select>
      <label>出典（URL・店頭で確認 など）</label><input id="m_src" value="${esc(m.source || '')}">
      <label>メモ</label><input id="m_note" value="${esc(m.sourceNote || '')}">
      <button id="mSave" class="btn primary block">保存</button></div>`;
    $('#mSave').onclick = async () => {
      const name = $('#m_name').value.trim(); if (!name) return toast('名前を入力してください');
      await DB.put('machines', Object.assign({}, m, { id: id === 'new' ? undefined : m.id, name, category: $('#m_cat').value, kind: $('#m_kind').value,
        maker: $('#m_maker').value.trim() || null, model: $('#m_model').value.trim() || null, status: $('#m_status').value,
        source: $('#m_src').value.trim(), sourceNote: $('#m_note').value.trim(), checked: today() }));
      toast('保存しました'); history.back();
    };
  }

  async function foodsList() {
    setTitle('食品データベース', true);
    const fs = (await DB.all('foods')).sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    const label = { official: '公式値', estimate: '推定値', manual: '手入力', external: '外部DB' };
    view.innerHTML = `<div class="note">「推定値」は一般的な目安です。商品パッケージの栄養成分表示を見て「公式値」で登録すると正確になります。
      初期版ではチェーン店の個別商品は収録していません（出典を確認した商品だけを登録する方針）。</div>
      <div class="card"><ul class="list">${fs.map((f) => `<li><div class="main"><div>${esc(f.name)}<span class="tag">${label[f.valueType] || '—'}</span></div>
        <div class="sub">${esc(f.unit)}・${fmt(f.kcal)}kcal・P${fmt(f.protein, 1)} F${fmt(f.fat, 1)} C${fmt(f.carbs, 1)}${f.seller ? '・' + esc(f.seller) : ''}</div>
        <div class="sub">出典: ${esc(f.source || '—')}（${esc(f.checked || '')}）</div></div>
        <button class="btn small danger" data-del="${f.id}">削除</button></li>`).join('')}</ul></div>`;
    $$('[data-del]').forEach((b) => b.onclick = async () => { if (!confirm('この食品を削除しますか？（過去の食事記録は残ります）')) return; await DB.remove('foods', b.dataset.del); foodsList(); });
  }


  /* ========== 初回設定 ========== */
  async function setup() {
    setTitle('はじめに');
    view.innerHTML = `
      <div class="card"><h2>初回設定</h2>
        <p class="muted">プロフィールはこの端末の中にだけ保存されます。あとから設定で変更できます。</p>
        <div class="row"><div><label>年齢</label><input id="s_age" type="number" inputmode="numeric"></div>
          <div><label>身長 cm（任意）</label><input id="s_h" type="number" inputmode="decimal"></div></div>
        <div class="row"><div><label>今の体重 kg</label><input id="s_w" type="number" inputmode="decimal" step="0.1"></div>
          <div><label>目標体重 kg</label><input id="s_goal" type="number" inputmode="decimal" step="0.1"></div></div>
        <label>運動頻度 回/週</label><input id="s_freq" type="number" inputmode="numeric">
        <label>目的（「、」区切り）</label><input id="s_goals" placeholder="例 体脂肪減少、筋肉量維持">
        <button id="sGo" class="btn primary block">はじめる</button></div>
      <div class="card"><h3>バックアップから復元</h3>
        <p class="muted">以前のデータや、PCで用意した本人用の初期データ（.json）がある場合はこちら。</p>
        <input id="s_imp" type="file" accept="application/json,.json"></div>`;
    $('#sGo').onclick = async () => {
      const age = num($('#s_age').value), w = num($('#s_w').value);
      if (!age || !w) return toast('年齢と体重を入力してください');
      const p = await DB.kvGet('profile', {});
      Object.assign(p, { age, heightCm: num($('#s_h').value), weightKg: w, goalKg: num($('#s_goal').value), freqPerWeek: num($('#s_freq').value),
        goals: $('#s_goals').value.split(/[、,]/).map((x) => x.trim()).filter(Boolean), setupDone: true });
      await DB.kvSet('profile', p);
      await DB.put('weights', { date: today(), kg: w, bodyFatPct: null, note: '初回設定' });
      toast('設定しました'); location.hash = '#/'; route();
    };
    $('#s_imp').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const n = await DB.importAll(JSON.parse(await f.text()));
        const p = await DB.kvGet('profile', {}); p.setupDone = true; await DB.kvSet('profile', p);
        toast(`${n}件を復元しました`); location.hash = '#/'; route();
      } catch (err) { toast('復元できません: ' + err.message); }
    };
  }

  /* ========== ロック ========== */
  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join('');
  }
  async function setPin(v) { const salt = DB.uuid(); await DB.kvSet('pin', { salt, hash: await sha(salt + v) }); }
  async function checkLock() {
    const pin = await DB.kvGet('pin', null);
    if (!pin) return;
    if (!crypto.subtle) return; // HTTP 接続ではハッシュ不可。ロックは HTTPS 版で有効。
    const lock = $('#lock'); lock.hidden = false;
    await new Promise((resolve) => {
      const tryOpen = async () => {
        if (await sha(pin.salt + $('#lockInput').value) === pin.hash) { lock.hidden = true; $('#lockInput').value = ''; resolve(); }
        else { $('#lockMsg').textContent = 'パスコードが違います'; }
      };
      $('#lockBtn').onclick = tryOpen;
      $('#lockInput').onkeydown = (e) => { if (e.key === 'Enter') tryOpen(); };
      $('#lockInput').focus();
    });
  }

  /* ========== ルーター ========== */
  function parse() {
    const h = location.hash.replace(/^#/, '') || '/';
    const [path, qs] = h.split('?');
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    return { parts: path.split('/').filter(Boolean), q };
  }
  async function route() {
    if (cleanup) { try { cleanup(); } catch (e) { /* noop */ } cleanup = null; }
    const { parts, q } = parse();
    const [a, b, c] = parts;
    const prof = await DB.kvGet('profile', {});
    if (!prof.setupDone && a !== 'settings') { $$('.tabbar a').forEach((x) => x.classList.remove('active')); return setup(); }
    const tab = { meal: 'meal', workout: 'workout', next: 'workout', results: 'results', weight: 'results' }[a] || (a ? '' : 'home');
    $$('.tabbar a').forEach((x) => x.classList.toggle('active', x.dataset.tab === tab));
    window.scrollTo(0, 0);
    try {
      if (!a) return await home();
      if (a === 'meal' && !b) return await mealHome(q);
      if (a === 'meal' && b === 'add') return await mealAdd(q);
      if (a === 'meal' && b === 'edit') return await mealEdit(c);
      if (a === 'workout' && !b) return await workoutHome();
      if (a === 'workout' && b === 'strength') return await strengthForm(q);
      if (a === 'workout' && b === 'cardio') return await cardioForm(q);
      if (a === 'workout' && b === 'edit') return await workoutEdit(c);
      if (a === 'next') return await nextMenu(q);
      if (a === 'results') return await results(q);
      if (a === 'weight') return await weightForm(b);
      if (a === 'settings') return await settings();
      if (a === 'machines') return await machines();
      if (a === 'machine') return await machineForm(b);
      if (a === 'foods') return await foodsList();
      return await home();
    } catch (e) {
      console.error(e);
      view.innerHTML = `<div class="warnbox">エラーが発生しました：${esc(e.message)}</div><a class="btn block" href="#/">ホームへ</a>`;
    }
  }

  async function start() {
    $('#backBtn').onclick = () => history.back();
    $('#settingsBtn').onclick = () => go('#/settings');
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
    await SEED.seedIfEmpty();
    await checkLock();
    window.addEventListener('hashchange', route);
    route();
    if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  start();
})();
