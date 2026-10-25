# 低血鈉（Hyponatremia）快速分類診斷、3% NaCl 泡製與速率計算系統

成人急診與住院低血鈉 5 步驟臨床決策輔助工具：整合急症 3% NaCl Bolus 具名方案、24h/48h 累計安全矯正配額追蹤、血清滲透壓與有效張力分流、尿液指標（$\text{FE}_{\text{Urea}}$、$\text{FE}_{\text{UA}}$、Fürst Ratio、脫鹽警示）、6 大鑑別診斷分類、動態高亮流程圖、3% NaCl 床邊泡製雙模式換算、Adrogué-Madias 點滴速率計算與過度矯正降鈉救援（D5W + DDAVP）。

- **主網址**：<https://er.kiwi-ai.uk/na/>
- **備用網址**：<https://tools.kiwi-ai.uk/na/>｜<https://kiwi-ed-tools.pages.dev/na/>
- **GitHub Pages 原址**：<https://xyzkiwi.github.io/na/>

## 適用族群與隱私安全

- **適用族群**：成人急診與住院患者（Adult ED / Inpatient，年齡 $\ge 18$ 歲）。小兒患者體液分布與輸液規範不同，請使用兒科專用工具。
- **共用電腦與隱私保護**：本工具純前端運算，**不儲存、不自動寫入 `localStorage` 或傳送任何病患數值**；修改任何輸入欄位時，舊計算結果與病歷摘要會立即自動更新／失效，並提供一鍵「清除重填」按鈕供共用工作站安全交班。

## 使用方式

1. **Step 1 急症分流與矯正目標**：勾選神經學症狀等級（嚴重 vs 中度嚴重 vs 無/輕微）、選擇具名 3% NaCl Bolus 方案（ESE 2014 / US 2013 / SALSA 2021）、檢核主要 ODS 風險因子，並可輸入過去 24h 已上升之血鈉幅度以自動扣除剩餘安全配額。
2. **Step 2 滲透壓與有效張力**：輸入 `Serum Na`、`Measured Serum Osm`、`Glucose`、`BUN`（選填 `Ethanol`），自動區分「實測血鈉計算滲透壓」、「有效張力 ($2\text{Na} + \text{Glc}/18$)」、「Katz/Hillier 高血糖校正血鈉」與「滲透壓間隙 (Osmolal Gap)」，避免將高 BUN／乙醇之真性低張性低血鈉誤判為高張性。
3. **Step 3 & Step 4 尿液指標與 6 大分類**：輸入 `Urine Osm`、`Urine Na`、`Urine K` 與體液狀態（支援 `Equivocal` 不確定時並列候選比較，及 $U_{\text{Na}}$ `30` vs `20` 切點切換與 `20–30` 灰區提示），選填計算 $\text{FE}_{\text{Urea}}$（支援 BUN/UUN 與 Urine Urea 除以 2.14 單位轉換）、$\text{FE}_{\text{UA}}$、$U_{\text{Cl}}$，並在互動式流程圖即時高亮顯示當前路徑。
4. **Step 5 泡製、速率與救援**：
   - **3% NaCl 床邊泡製換算器**：支援「模式 A 整支安瓿快泡法（如 0.9% NaCl 500 mL 抽 100 mL + 6 支 10% NaCl 20 mL = 520 mL 之 3.00% NaCl）」與「模式 B 等體積精準抽換法（抽換 115.38 mL）」，自訂支數後可即時將實際濃度回代至速率計算機。
   - **Adrogué-Madias 點滴速率計算機**：支援 MDCalc #480 體重係數法與選填身高之 Watson (1980) TBW 公式，內建 `2% NaCl (342.2 mEq/L)`、`LR (134 vs 130 mEq/L)`、外加 `KCl` 及 SIADH 脫鹽（Desalination）紅燈警示。
   - **過度矯正救援（D5W + DDAVP）**：提供封閉單室自由水估算與指引經驗性劑量（$10\text{ mL/kg}$ over 1h + Desmopressin $2\text{ }\mu\text{g}$ IV/SC）及監測步驟。

## 資料來源與校對

- 完整指引與公式出處請見 [`references.md`](./references.md)：
  - European Clinical Practice Guideline (ESE / ESICM / ERA-EDTA, *Eur J Endocrinol* 2014)
  - US Expert Panel Recommendations (Verbalis et al., *Am J Med* 2013) & AAFP (Braun et al., 2015)
  - SALSA Randomized Clinical Trial (Baek et al., *JAMA Intern Med* 2021)
  - Adrogué & Madias (*NEJM* 2000)、Watson TBW (*Am J Clin Nutr* 1980)、Katz (1973) & Hillier (1999)
  - CJASN 2024 (Sterns RH)、NDT 2024 (Adrogué & Madias)、PMC13424767 (2026)
- **資料最後校對**：2026-10-25
- **校對方式**：逐條核對原始文獻切點與公式推導，並以 `na.test.mjs` 自動化單元測試驗證所有分類邊界、缺值、有限體積 Bolus、泡製濃度回代與防呆邏輯。

## 驗證

```powershell
node --test .\na.test.mjs .\na.literature.test.mjs
```

- `na.literature.test.mjs`：對照文獻範例（ESE 2014、Adrogué & Madias JASN 2012 等）的測試，與文獻不一致處以 `todo` 標記，詳見 [`TEST_REPORT.md`](./TEST_REPORT.md)
- GitHub Actions 會在每次 push 與 PR 自動執行上述測試

## 更新方法

1. 修改 `na.js` 之臨床規則或公式，並同步更新 `na.test.mjs` 測試案例
2. 執行 `node --test .\na.test.mjs` 確認全數通過
3. 更新 `index.html`、`README.md`、`references.md` 與 [ed-tools 入口頁](https://github.com/xyzKIWI/ed-tools) 之「資料校對」日期
4. Commit 並 push 至 `main`，由 GitHub Pages 自動發佈

## 免責聲明

本工具僅供成人臨床決策「輔助參考」，不取代醫師臨床判斷、正式醫囑、院內藥事調配規範、官方仿單與最新臨床指引。Adrogué-Madias 與自由水公式無法預測治療途中突發之自發性水利尿（Brisk water diuresis），使用高張鹽水或進行降鈉救援時，必須密集追蹤血鈉與每小時尿量，並由醫療與藥事人員再次人工核對。

## License

MIT
