# 3D 大衛打獅熊(davidbeasts3d)

> 真 3D 護羊之戰——撒母耳記上十七章三十四至三十七節:少年牧人大衛為父親放羊,有時來了
> 獅子,有時來了熊,從群中叼走羊羔;大衛追趕擊打,把羊羔從野獸口中救出來——
> 「耶和華救我脫離獅子和熊的爪」。
> ★兒童安全鐵則:不流血,野獸敗=側躺被制伏,大衛敗=溫柔跪地、溫柔重試。

## 野獸陣容(BOSS 種類×數量,本作招牌)

首頁可選七種陣容:**獅子 ×1/×2/×3、熊 ×1/×2/×3、獅+熊雙獸夾攻**。
- 熊:出手慢、更痛、血更厚(1.3x)、走得慢;獅子:快而靈。
- 群獸公平:獸越多,單獸傷害越低(總壓力仍上升);蜂蜜更常出現;
  同一時刻只有一隻獸亮紅色撲擊預告(看得懂該閃誰)。

## 玩法

- **護羊之戰**:大衛 100 血,打光野獸血量獲勝。
- **與獸纏鬥**:各 300 血馬拉松,戰滿三百回合以血量判定。
- **牧場練習**:野獸只走位不攻擊,自由練手感。

WASD 自由走位、Shift 衝刺;**J=輕拳**(快、傷害低)、**K(或空白鍵/點畫面)=重拳**
(慢、傷害高、命中擊退,可長按蓄力放開=**聖靈金光**金色光波,可一發穿透多隻野獸);
**C=格擋**(近戰減傷,剛舉起被打=完美格擋);野獸重攻擊(撲擊)出手前會有紅色扇形
預告,快閃開!場上偶爾出現野地的蜂蜜,走近可回血 25%。

難度六檔:幼兒/兒童/入門/標準/全力獸王/**死神(黑獸)⚠**(黑化紅眼+獠牙閃現+黑手抓心,
恐怖元素只在這一檔——投影上課安全)。

## 開發

```bash
npm install && npm run dev
npm run build && npx vite preview --port 4189
node scripts/gen-voice.mjs   # 烤語音(msedge-tts,累加式,已烤過的句子會跳過)
node scripts/verify-davidbeasts.mjs http://localhost:4189 scratch   # 六關端到端驗收
```

## 部署

**已上架:https://hfpc-davidbeasts3d.pages.dev**(Cloudflare Pages)
GitHub:https://github.com/summer09201017-cloud/davidbeasts3d

⚠ 這一段在 2026-07-30 之前一直寫著「尚未上架」,但其實早就上線了(文件脫節)。已更正。

```bash
npm install          # 本機第一次要先裝(此 repo 預設沒有 node_modules)
npm run dev          # 本機開發
npm run build        # 產出 dist/
npx wrangler pages deploy dist --project-name hfpc-davidbeasts3d   # 上線
```

改了內容 → **一定要 bump `public/sw.js` 的 `CACHE_NAME`**,否則使用者會一直拿到快取的舊版。

線上驗收要注意三個會害你誤判的陷阱(2026-07-30 全部踩過一遍):
- `?bust=` 對 Cloudflare 靜態資源**沒有用**(query 不算快取鍵)→ 要送
  `curl -H 'Cache-Control: no-cache' -H 'Pragma: no-cache'` 才拿到剛部署的版本。
- 抓 `/`(根路徑),不要抓 `/index.html`(可能被 307 轉址,拿到 0 bytes 像檔案掛了)。
- **部署後正式網址約有 1 分鐘傳播延遲**。當下看還是舊版是正常的,不要急著重新部署一輪。
- ⚠ **Cloudflare Pages 不能用「`.git/config` 是不是 404」驗有沒有外洩** ——
  Pages 對任何不存在的路徑都回首頁 HTML 且狀態碼 **200**(單頁應用的 fallback),
  所以那條測試在這裡**一定誤報成「外洩」**。要驗就**看內容**(有沒有 `[core]` / `url = `),
  不要看狀態碼。(尋羊記是 Worker `--assets`,那邊才會正確回 404。)
  順帶說:這個 repo 部署的是 `dist/`,`.git` 根本不在裡面,結構上就不可能外洩。
