/* バーコード読み取り。
 * 1) カメラのライブ読み取り（HTTPS が必要）: BarcodeDetector → なければ ZXing
 * 2) 写真から読み取り（HTTP でも可・iPhone でも可）: ZXing
 * 3) どちらも駄目なら JAN を手入力 */
(function () {
  let zxingP = null;
  function loadZxing() {
    if (window.ZXing) return Promise.resolve(window.ZXing);
    if (zxingP) return zxingP;
    zxingP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/zxing.min.js';
      s.onload = () => res(window.ZXing);
      s.onerror = () => { zxingP = null; rej(new Error('読み取りライブラリを読み込めません')); };
      document.head.appendChild(s);
    });
    return zxingP;
  }
  function hints(Z) {
    const h = new Map();
    h.set(Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.EAN_13, Z.BarcodeFormat.EAN_8, Z.BarcodeFormat.UPC_A, Z.BarcodeFormat.UPC_E]);
    h.set(Z.DecodeHintType.TRY_HARDER, true);
    return h;
  }

  const liveAvailable = () => !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /** video 要素にカメラを出し、読めたら onCode(text)。戻り値の stop() で停止。 */
  async function startLive(video, onCode) {
    let stopped = false, stream = null, reader = null;
    const stop = () => {
      stopped = true;
      if (reader) try { reader.reset(); } catch (e) { /* noop */ }
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
    if ('BarcodeDetector' in window) {
      const det = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream; await video.play();
      const tick = async () => {
        if (stopped) return;
        try {
          const r = await det.detect(video);
          if (r && r[0]) { stop(); onCode(r[0].rawValue); return; }
        } catch (e) { /* 次フレーム */ }
        setTimeout(tick, 250);
      };
      tick();
      return { stop };
    }
    const Z = await loadZxing();
    reader = new Z.BrowserMultiFormatReader(hints(Z));
    await reader.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (res) => {
      if (res && !stopped) { stop(); onCode(res.getText()); }
    });
    return { stop };
  }

  async function decodeFile(file) {
    const Z = await loadZxing();
    const url = URL.createObjectURL(file);
    try {
      const reader = new Z.BrowserMultiFormatReader(hints(Z));
      const res = await reader.decodeFromImageUrl(url);
      return res.getText();
    } finally { URL.revokeObjectURL(url); }
  }

  function validJan(code) {
    if (!/^\d{8}$|^\d{12,13}$/.test(code)) return false;
    const d = code.padStart(13, '0').split('').map(Number);
    if (code.length === 8) {
      const e = code.split('').map(Number);
      const s = e.slice(0, 7).reduce((a, v, i) => a + v * (i % 2 ? 1 : 3), 0);
      return (10 - s % 10) % 10 === e[7];
    }
    const s = d.slice(0, 12).reduce((a, v, i) => a + v * (i % 2 ? 3 : 1), 0);
    return (10 - s % 10) % 10 === d[12];
  }

  /** Open Food Facts（無料・キー不要）で JAN を照会。送るのは JAN コードのみ。 */
  async function lookupOFF(jan) {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(jan)}.json?fields=product_name,product_name_ja,brands,quantity,serving_size,serving_quantity,nutriments`;
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.status !== 1 || !j.product) return null;
    const p = j.product, n = p.nutriments || {};
    const sq = +p.serving_quantity || null;
    const per = (k) => {
      if (sq && n[k + '_serving'] != null) return +n[k + '_serving'];
      if (n[k + '_100g'] != null) return +n[k + '_100g'];
      return null;
    };
    const kcal = per('energy-kcal');
    return {
      name: p.product_name_ja || p.product_name || '', maker: p.brands || '', jan,
      amount: p.quantity || '', unit: sq && n['energy-kcal_serving'] != null ? `1食(${p.serving_size || sq + 'g'})` : '100g',
      kcal, protein: per('proteins'), fat: per('fat'), carbs: per('carbohydrates'), salt: per('salt'),
      valueType: 'external', source: 'Open Food Facts（利用者投稿データ・要確認） ' + `https://world.openfoodfacts.org/product/${jan}`,
      checked: new Date().toISOString().slice(0, 10),
    };
  }

  window.BARCODE = { liveAvailable, startLive, decodeFile, validJan, lookupOFF };
})();
