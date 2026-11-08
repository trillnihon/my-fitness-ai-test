/* 初期データ。初回起動時に1回だけ投入する。
 * ジム設備: 公式ページで確認できた範囲のみ confirmed。機種名・モデルは推測で埋めない。
 * 食品: 一般食品の参考値のみ。チェーン店の個別商品は出典を確認したものだけを登録する方針のため初期は0件。 */
(function () {
  const CHECKED = '2026-11-08';
  const ATTIVO_URL = 'https://attivo.jp/oyama.html';

  const GYM = {
    id: 'gym-attivo-oyama',
    name: 'アッティーボジム 小山店',
    chain: 'ATTIVO',
    address: '栃木県小山市喜沢1475 おやまゆうえんハーヴェストウォーク パークタウンサウス内1階',
    hours: '平日10:00〜22:00／土10:00〜20:00／日祝10:00〜18:00（毎月1日・16日休）',
    source: ATTIVO_URL, checked: CHECKED,
    note: '営業時間・住所は公式ページと栃ナビで確認。変更されている場合があります。',
  };

  const m = (id, name, category, extra) => Object.assign({
    id, gymId: GYM.id, name, category, kind: 'strength', maker: null, model: null,
    status: 'confirmed', source: ATTIVO_URL, sourceNote: '', checked: CHECKED,
  }, extra);

  const MACHINES = [
    m('mc-tread', 'ランニングマシン', 'cardio', { kind: 'cardio', maker: 'Star Trac', sourceNote: '公式ページ「ランニングマシン 33台」。有酸素エリアにStar Tracロゴ。各台のメーカー表記はなし。' }),
    m('mc-bike', 'バイク', 'cardio', { kind: 'cardio', maker: 'Star Trac', sourceNote: '公式ページ「バイク 17台」。有酸素エリアにStar Tracロゴ。負荷段階の上限は未確認。' }),
    m('mc-cross', 'クロストレーナー', 'cardio', { kind: 'cardio', maker: 'Star Trac', sourceNote: '公式ページ「クロストレーナー 5台」。' }),
    m('mc-free', 'フリーウエイト', 'other', { sourceNote: '公式ページの設備欄に「フリーウエイトエリア」。器具の内訳は未記載。' }),
    m('mc-bw', '自重負荷台', 'other', { sourceNote: '公式ページの設備欄に「自重負荷台」。' }),
    // 本人の実績に出てくるマシン。公式ページは「トレーニングマシン 24台（Nautilusロゴ）」のみで機種名は未確認。
    m('mc-chest', '胸のマシン（チェストプレス系）', 'chest', { status: 'unconfirmed', source: '利用者登録', sourceNote: '公式ページは「トレーニングマシン24台・Nautilusロゴ」のみ。正確な機種は未確認。店頭で機種名を確認して編集してください。' }),
    m('mc-back', '背中のマシン（ラットプル／ロー系）', 'back', { status: 'unconfirmed', source: '利用者登録', sourceNote: '正確な機種は未確認。' }),
    m('mc-shoulder', '肩のマシン（ショルダープレス系）', 'shoulder', { status: 'unconfirmed', source: '利用者登録', sourceNote: '正確な機種は未確認。' }),
  ];

  // 参考値（per = 1単位あたり）。公式値ではないため source に明記する。
  const EST = 'AI参考値（日本食品標準成分表の一般的な値を目安にした概算・未照合）';
  const f = (name, unit, kcal, p, fat, c, salt, extra) => Object.assign({
    id: 'food-' + name, name, unit, kcal, protein: p, fat, carbs: c, salt,
    maker: '', seller: '', jan: '', amount: unit, valueType: 'estimate', source: EST, checked: CHECKED,
  }, extra);
  const FOODS = [
    f('ごはん（茶碗1杯150g）', '1杯150g', 234, 3.8, 0.5, 55.7, 0),
    f('ごはん（大盛り250g）', '1杯250g', 390, 6.3, 0.8, 92.8, 0),
    f('食パン（6枚切り1枚）', '1枚60g', 149, 5.3, 2.5, 27.8, 0.7),
    f('鶏むね肉 皮なし（100g）', '100g', 105, 23.3, 1.9, 0.1, 0.1),
    f('鶏もも肉 皮つき（100g）', '100g', 190, 16.6, 14.2, 0, 0.2),
    f('豚ロース（100g）', '100g', 248, 19.3, 19.2, 0.2, 0.1),
    f('牛もも（100g）', '100g', 196, 19.5, 13.3, 0.4, 0.1),
    f('鮭 切り身（80g）', '1切80g', 106, 17.8, 3.3, 0.1, 0.2),
    f('サバ水煮缶（1缶190g）', '1缶190g', 330, 39.7, 20.3, 0.4, 1.7),
    f('卵（1個50g）', '1個', 71, 6.1, 5.1, 0.2, 0.2),
    f('納豆（1パック45g）', '1パック', 86, 7.4, 4.5, 5.4, 0),
    f('絹ごし豆腐（150g）', '150g', 84, 7.4, 5.3, 3.0, 0),
    f('牛乳（200ml）', '200ml', 126, 6.8, 7.8, 9.9, 0.2),
    f('無脂肪ヨーグルト（100g）', '100g', 42, 4.0, 0.2, 5.7, 0.1),
    f('バナナ（1本 可食部100g）', '1本', 93, 1.1, 0.2, 22.5, 0),
    f('りんご（1/2個 150g）', '150g', 80, 0.2, 0.3, 23.3, 0),
    f('ブロッコリー（100g）', '100g', 37, 5.4, 0.6, 6.6, 0.1),
    f('キャベツ（100g）', '100g', 21, 1.3, 0.2, 5.2, 0),
    f('みそ汁（1杯）', '1杯', 40, 2.5, 1.2, 4.5, 1.5),
    f('おにぎり 鮭（1個）', '1個', 180, 4.5, 1.5, 38, 1.1),
    f('プロテイン（ホエイ1杯30g）', '1杯30g', 120, 22, 2, 3, 0.3, { note: '製品により大きく異なる。商品ごとに登録推奨。' }),
    f('ビール（350ml缶）', '350ml', 140, 1.1, 0, 10.9, 0, { alcoholPct: 5, volumeMl: 350 }),
    f('ビール（500ml缶）', '500ml', 200, 1.6, 0, 15.6, 0, { alcoholPct: 5, volumeMl: 500 }),
    f('ハイボール（350ml缶 7%）', '350ml', 170, 0, 0, 3, 0, { alcoholPct: 7, volumeMl: 350, note: '糖質・度数は製品で異なる。' }),
    f('日本酒（1合180ml）', '1合', 193, 0.7, 0, 8.8, 0, { alcoholPct: 15, volumeMl: 180 }),
    f('焼酎（ロック 100ml 25%）', '100ml', 203, 0, 0, 0, 0, { alcoholPct: 25, volumeMl: 100 }),
    f('ワイン（グラス120ml）', '120ml', 82, 0.2, 0, 2.4, 0, { alcoholPct: 12, volumeMl: 120 }),
  ];

  const STORES = ['ベイシア', 'ヨークベニマル', 'とりせん', 'たいらや', 'イオン', 'トライアル',
    'セブン‐イレブン', 'ファミリーマート', 'ローソン', 'その他'];

  // 公開ファイルに個人情報を入れないため、プロフィールは空で開始し、初回設定またはバックアップ復元で入れる。
  const PROFILE = {
    age: null, sex: '', heightCm: null, weightKg: null, goalKg: null, bodyFatPct: null,
    freqPerWeek: null, goals: [], conditions: '', constraints: '', experience: '',
    homeGymId: GYM.id, setupDone: false,
  };

  async function seedIfEmpty() {
    if (await DB.kvGet('seeded', false)) return false;
    await DB.kvSet('profile', PROFILE);
    await DB.put('gyms', GYM);
    for (const x of MACHINES) await DB.put('machines', x);
    for (const x of FOODS) await DB.put('foods', x);
    await DB.kvSet('seeded', true);
    return true;
  }

  window.SEED = { seedIfEmpty, STORES, GYM, MACHINES, FOODS };
})();
