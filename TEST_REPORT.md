# 低血鈉計算機自動化測試報告

- **測試日期**：2026-10-25
- **測試對象**：`na.js`（commit `134b0fd`，10/25 邊界修正版）
- **執行方式**：`node --test na.test.mjs na.literature.test.mjs`（Node 22；GitHub Actions 於每次 push 與 PR 自動執行）
- **結果**：64 項測試，**58 通過、0 失敗、6 項 todo**（4 項與文獻不一致、2 項功能未實作）。不一致 #3（FE_Urea 切點）已於 PR #4 依臨床端決定改為 55% 並解決

> 本 PR **沒有修改** `na.js`、`index.html` 或任何公式、閾值、速率上限與臨床文字。下面列出的問題都只是記錄，是否修改由臨床端判斷。唯一已修改的是不一致 #3，由臨床端決定後在 PR #4 處理。

## 測試檔說明

| 檔案 | 內容 |
|---|---|
| `na.test.mjs` | 原有 10 項測試（作者 10/24–10/25 撰寫），PR #4 另加 2 項（鈉缺失量、FE_Urea 55%） |
| `na.literature.test.mjs` | 本次新增 52 項，每個數值範例都標註出處；與文獻不一致者以 `todo` 標記，不會讓 CI 變紅 |
| `.github/workflows/test.yml` | push／PR 時自動跑上述兩個檔案 |

`na.js` 原本就是獨立 ES module（`index.html` 以 `import` 載入），所以不需要另外抽出計算邏輯，程式行為完全沒有變動。

### 引用文獻代號

| 代號 | 文獻 | 核對方式 |
|---|---|---|
| ESE2014 | Spasovski G, et al. *Eur J Endocrinol* 2014;170(3):G1–G47. [doi:10.1530/EJE-13-1020](https://doi.org/10.1530/EJE-13-1020) | 逐句核對全文推薦條文與 Table 6（§6.2.1.2、§6.3.1.2、§6.3.1.4–5、§7.1.1.1–3、§7.1.2.4、§7.2.1.4、§7.2.1.6、§7.5.1.1–4、§7.1 Advice） |
| AM2012 | Adrogué HJ, Madias NE. The challenge of hyponatremia. *J Am Soc Nephrol* 2012;23:1140–1148. [doi:10.1681/ASN.2012020128](https://doi.org/10.1681/ASN.2012020128) | 核對 Table 1 公式與 Table 2 三個情境之數值 |
| FIG3 | 本 repo `assets/fig3-diagnostic-algorithm.png`（教科書 Figure 43-2） | 對照圖中切點 |
| FENSKE08 | Fenske W, et al. *J Clin Endocrinol Metab* 2008;93:2991–2997. [doi:10.1210/jc.2008-0330](https://doi.org/10.1210/jc.2008-0330) | 核對摘要（FE_UA 12%） |
| WATSON80 | Watson PE, et al. *Am J Clin Nutr* 1980;33:27–39 | 公式係數（與 `references.md` 相同） |
| KATZ73／HILLIER99 | Katz MA. *NEJM* 1973;289:843；Hillier TA, et al. *Am J Med* 1999;106:399 | 每 100 mg/dL 校正 1.6／2.4 |
| HOORN17 | Hoorn EJ, Zietse R. Diagnosis and treatment of hyponatremia: compilation of the guidelines. *J Am Soc Nephrol* 2017;28:1340–1349. [doi:10.1681/ASN.2016101139](https://doi.org/10.1681/ASN.2016101139)（PMC5407738） | 核對全文 Table 2（美國 2013 與歐洲 2014 指引對照表）與正文 |
| SALSA-P | Baek SH, et al. SALSA 試驗計畫書，*Trials* 2017. [doi:10.1186/s13063-017-1865-z](https://doi.org/10.1186/s13063-017-1865-z)（PMID 28356136，PMC5372334） | 核對 Rapid intermittent bolus 組劑量 |
| SALSA21 | Baek SH, et al. *JAMA Intern Med* 2021;181(1):81–92. [doi:10.1001/jamainternmed.2020.5519](https://doi.org/10.1001/jamainternmed.2020.5519)（PMC7589081） | 核對 Methods 之 relowering 條件與劑量 |

Adrogué & Madias *NEJM* 2000 原文沒有開放全文，無法逐字核對，所以 Adrogué–Madias 範例改用同作者 2012 年 JASN 綜論中可驗證的 Table 2 數值。

美國 2013 專家共識（Verbalis JG, et al. *Am J Med* 2013）原文網站拒絕存取，改以 HOORN17 Table 2 的逐列對照作為美國指引數值的出處。

---

## 一、通過項目

### Adrogué–Madias 公式與輸液

| 項目 | 輸入 | 文獻值 | 工具值 | 出處 |
|---|---|---|---|---|
| 3% NaCl 每公升 ΔNa | Na 110、TBW 30 L | ↑13.0 | ↑13.01 | AM2012 Table 2 |
| 0.9% NaCl 每公升 ΔNa | 同上 | ↑1.4 | ↑1.42 | AM2012 Table 2 |
| 0.9% NaCl + KCl 30 mEq/L | 同上（Na+K 184） | ↑2.4 | ↑2.39 | AM2012 Table 2 情境 (3) |
| Lactated Ringer's | 同上 | ↑0.8（Na+K 135） | ↑0.77（工具 Na+K 134） | AM2012 Table 2 |
| 0.45% NaCl | 同上 | ↓1.1 | ↓1.06 | AM2012 Table 2 |
| D5W | 同上 | ↓3.5 | ↓3.55 | AM2012 Table 2 |
| 3% NaCl +4 mEq/L over 6 h | 60 kg 女性、Na 110 | 308 mL、51 mL/h | 307.5 mL、51.2 mL/h | AM2012 Table 2 情境 (1)（文獻先把 13.0 取整再算） |
| NaCl % → mEq/L | 0.45／0.9／2／3／5% | 77／154／—／513／— | 77.0／154.0／342.2／513.3／855.6 | AM2012 Table 2；分子量 58.44 |

另外也驗證了：
- 不同性別、年齡經 TBW 對速率的影響。
- 降鈉（負目標）時 D5W 可行，3% NaCl 則判為方向相反。
- 目標 0、分母 0、時間 ≤ 0、缺 Na／TBW、負的外加 K、未知輸液 key 的防呆。
- 目標超過 24h 剩餘上限時出現 ODS 警示；目標剛好等於上限時不出現。
- 等張液（0.9%、LR）在 SIADH 或高張尿時的脫鹽警示。

### 總體水 (TBW)

- **體重係數**：男 0.6、女 0.5、老年男 0.5、老年女 0.45，與 ESE2014 §7.1 Advice 一致。
- **年齡切點**：64.9 歲與 65 歲兩側都驗過。
- **Watson 公式**：男女係數與 WATSON80 一致。
- **退回係數法**：身高 99／251 cm、身高缺值、男性缺年齡時會自動退回體重係數法；女性公式不含年齡，缺年齡仍可使用 Watson。

### 3% NaCl Bolus 與 Step 1

- **ESE 方案**：150 mL over 20 min、可改 2 mL/kg；中度症狀單次 150 mL。與 ESE2014 §7.1.1.1、§7.1 Advice、§7.2.1.4 一致。
- **24h 上限**：首 24h ≤ 10、其後每 24h ≤ 8、48h 合計 18，與 ESE2014 §7.1.2.4、§7.2.1.6 一致。
- **有限體積 Bolus**：與質量守恆 (TBW×S + V×C)/(TBW+V) 完全一致（3 組數據）。
- **SALSA 中度症狀**：2 mL/kg over 20 min，與 SALSA-P 一致；以四捨五入取整數 mL。嚴重症狀與未填體重時的劑量與計畫書不同，見不一致 #4。
- **美國方案嚴重症狀**：100 mL over 10 min、最多 3 次，與 HOORN17 Table 2「Bolus 3% NaCl (100 ml over 10 min × 3 as needed)」一致。
- **美國高 ODS 風險**：目標 4–6、上限 8 mEq/L/24h，風險因子含低血鉀、酒精、營養不良、肝病，與 HOORN17 Table 2 及正文一致。
- **主要 ODS 風險因子邊界**：Na 105／105.1、K 3.49／3.5，以及酒精、營養不良、肝病；高風險設定優先於指引選擇。
- **24h 累計配額**：
  - 直接輸入的升幅優先於起始 Na。
  - 升幅 7.9／8／10／10.1 的分級正確。
  - 血鈉下降不算成負升幅。
  - 經過時間 6／23.5／30 小時的剩餘時窗計算正確。

### 過度矯正救援

- **起始劑量**：D5W 10 mL/kg over 1 h、DDAVP 2 μg，與 ESE2014 §7.5.1.3–7.5.1.4 一致；SALSA21 Methods 的 relowering 也是「dextrose 5%, infusion of 10 mL/kg over 1 hour and/or intravenous desmopressin 2 µg」。
- **公式**：封閉單室公式、Adrogué–Madias D5W 對照公式都已驗算。
- **防呆**：目標 ≥ 目前值、缺 TBW、缺體重。

### Step 2：滲透壓與偽性低血鈉

- **高血糖校正**：Katz +1.6、Hillier +2.4 per 100 mg/dL；血糖 ≤ 100 不校正。
- **計算滲透壓**：2Na + Glc/18 + BUN/2.8 (+ EtOH/4.6)。
- **有效滲透壓**：不含 BUN 與乙醇。
- **分界點**：279.9／280／285／285.1 的分支正確（依工具現行切點）。
- **ESE2014 §6.2.1.2**：實測滲透壓 < 275 一律歸真性低張，200／250／274.9 都正確。
- **偽性低血鈉**：
  - Indirect ISE、280–285 → 判為偽性低血鈉，不進 Step 3。
  - Direct ISE、同樣數值 → 判為外源溶質高間隙，進 Step 3。
  - 間隙 ≤ 10 的情況也驗過。
- **無效滲透壓物質**：高 BUN、乙醇的情況正確判為真性低張；BUN 剛好 20 不觸發（條件是 > 20）。
- **缺值與邊界**：Na 缺值、0、負值、NaN；缺實測 Osm 的兩個分支；Na 135 與 134.9 的分界。

### Step 3 & 4：尿液分類

- **U_Osm ≤ 100**：四種體液狀態都歸 Cat 4；100.1 歸 Cat 3。與 ESE2014 §6.3.1.2 一致。
- **U_Na 切點**：30 屬低尿鈉、30.1 屬高尿鈉；切點 20 模式下 20／20.1 亦同。與 ESE2014 §6.3.1.4–5 一致。
- **六大分類**：每個分支與 equivocal 並列候選的內容與順序；利尿劑加入 Cat 1 候選。
- **脫鹽風險**：U_Na + U_K 154（不算）與 154.1（算）；U_Osm 500 與 501。
- **Fürst ratio 三段邊界**：0.5 與 1.0 都歸中段。
- **缺值**：無 U_Osm、U_Osm 0／NaN、無 U_Na。

### FE_Urea／FE_UA 與單位換算

- **三種單位模式結果相同**：BUN+UUN、BUN+Urine Urea ÷ 2.14、Urea+Urea 對同一檢體都算出 20%。用 Playwright 開啟實際頁面，三種模式也都顯示 20.0%，頁面沒有 JS 錯誤。
- **換算係數**：2.14 = 尿素分子量 60.06 ÷ 28.014（兩個氮），誤差 < 0.2%。
- **單位無關**：FE_Urea、FE_UA 是無因次比值。只要血尿兩邊用同一單位，mmol/L、μmol/L 與 mg/dL 的結果相同。
- **判讀分段邊界**：FE_Urea 35／50；FE_UA 4／12（FE_UA 12% 與 FENSKE08 一致）。
- **缺值**：任一值缺漏、為 0 或 NaN 都不計算；尿液尿素 0 合法。

### 3% NaCl 泡製

找不到可驗證的文獻泡製範例，所以改用 **NaCl 質量守恆** 驗算：
- **模式 A**：4 組基底液與支數組合。
- **模式 B**：4 組基底液與目標濃度組合。
- **防呆**：抽出量 ≥ 袋量、負支數、目標濃度超出範圍都正確拋錯。

---

## 二、與文獻不一致的地方（需要臨床判斷）

### 不一致 #1：實測滲透壓 286–295 的歸類

| | 內容 |
|---|---|
| 輸入 | Serum Na 122（Indirect ISE）、Measured Osm 288、Glucose 90、BUN 14 |
| 文獻預期 | FIG3：P_osm 280–290 → **偽性低血鈉**；> 295 才是高張性 |
| 工具實際 | `hypertonic_or_unmeasured_osmoles`（「高實測滲透壓伴滲透壓間隙升高」），並導向 Step 3 |
| 原因 | 工具的等張區間是 280–285，> 285 一律走高張分支 |
| 出處 | `assets/fig3-diagnostic-algorithm.png`；ESE2014 只規定 < 275 一定是低張，沒有給等張上限 |
| 臨床影響 | 高三酸甘油酯血症或副蛋白血症的偽性低血鈉，若實測 Osm 落在 286–290，主標題不會顯示「偽性低血鈉」。不過說明文字裡仍有提到 Indirect ISE 的高血脂／高蛋白可能。 |
| 測試 | `na.literature.test.mjs`「[FIG3] 實測滲透壓 280–290…」標為 `todo` |

### 不一致 #2：正常血容但 U_Na ≤ 30

| | 內容 |
|---|---|
| 輸入 | U_Osm 400、U_Na 15、體液狀態 euvolemic |
| 文獻預期 | ESE2014 §6.3.1.4："If urine sodium concentration is ≤30 mmol/l, we suggest accepting low effective arterial volume"。ESE 演算法先看尿鈉，不先看臨床體液判斷（理由是理學檢查判斷體液狀態的敏感度低）。主分類應為低有效動脈血容積（Cat 1／Cat 5）。 |
| 工具實際 | 主分類 **Cat 3（SIADH）**，Cat 1 列為第二候選，並附提示「臨床上最常為尚未察覺之亞臨床低血容」 |
| 出處 | ESE2014 §6.3.1.4；`assets/fig1-ese-algorithm.png` |
| 臨床影響 | 主分類若顯示 SIADH，可能被理解為「限水」；如果其實是低血容，限水方向就錯了。不過工具已經有警示文字與候選並列。 |
| 測試 | 「[ESE2014] §6.3.1.4…」標為 `todo` |

### 不一致 #3：FE_Urea 支持 SIAD 的切點（✅ 已解決）

臨床端決定統一採用 ESE 2014 的 > 55%，已在 PR #4 修改 `na.js` 判讀文字。原始紀錄如下：

| | 內容 |
|---|---|
| 輸入 | FE_Urea 52% |
| 文獻預期 | ESE2014 Table 6 補充準則："Fractional urea excretion >55%"。52% 不符合 SIAD 補充準則 |
| 工具實際 | 判讀文字為「FE_Urea > 50%：支持正常血容積（如 SIADH）」 |
| 出處 | ESE2014 Table 6（§5.8.1，已逐字核對）。同一張表另列 FE_UA > 12%（與工具一致）、FENa > 0.5%（工具未實作）、Serum uric acid < 4 mg/dL（與工具一致） |
| 臨床影響 | FE_Urea 50–55% 的病人會被提示支持 SIADH，但 ESE 的補充準則要求 > 55%。這只是判讀文字，不影響 6 大分類或速率計算。 |
| 測試 | 「FE_Urea 判讀分段」測試已改為驗證 55% 邊界 |

### 不一致 #4：SALSA 方案嚴重症狀劑量與未填體重時的體積

| | 內容 |
|---|---|
| 輸入 | 方案選 SALSA、嚴重症狀、體重 60 kg（以及未填體重） |
| 文獻預期 | SALSA-P（Rapid intermittent bolus 組）："In the case of moderately severe symptoms, ... 2 mL/kg 3% hypertonic saline over 20 min (100 mL, 3% saline for unknown body weight)"；"In cases of severe symptoms, ... 4 mL/kg 3% hypertonic saline over 40 min (200 mL, 3% saline for unknown body weight)"。60 kg 嚴重症狀應為 240 mL over 40 min |
| 工具實際 | 嚴重症狀標題為「3% NaCl 2 mL/kg IV Bolus over 20 min」，60 kg 算 120 mL；未填體重時不分輕重都退回 150 mL |
| 出處 | SALSA-P（試驗計畫書）。JAMA 2021 正文沒有寫劑量細節，只寫 RIB 組 1 小時內平均累積 220.4 mL |
| 臨床影響 | 選 SALSA 方案的嚴重症狀病人，工具建議量只有試驗計畫書的一半；未填體重時中度症狀多給、嚴重症狀少給。預設方案是 ESE，選 SALSA 才受影響 |
| 測試 | 「[SALSA-P] 嚴重症狀 4 mL/kg over 40 min」標為 `todo` |

### 不一致 #5：美國方案一般風險的 24h 目標下限

| | 內容 |
|---|---|
| 輸入 | 上限指引選 US 2013、無高 ODS 風險 |
| 文獻預期 | HOORN17 Table 2 美國指引："Minimum: 4–8 mmol/L per d, 4–6 mmol/L per d (high risk of ODS)"；"Limits: 10–12 mmol/L per d, 8 mmol/L per d (high risk of ODS)" |
| 工具實際 | 一般風險目標 6–8（下限 6）、上限 10 |
| 出處 | HOORN17 Table 2 |
| 臨床影響 | 上限取 10–12 的下緣，比文獻保守，沒有安全疑慮。目標下限 6 比文獻的 4 高，可能讓使用者以為升 4–5 mEq/L 還「沒達標」 |
| 測試 | 「[HOORN17] 美國一般風險最低矯正 4 mmol/L」標為 `todo`；高風險 4–6／8 測試通過 |

另外，HOORN17 Table 2 把美國指引的中度症狀寫成「Continuous infusion 3% NaCl (0.5–2 ml/kg per h)」，沒有提到 Bolus；工具的美國中度症狀寫成「100 mL Bolus 或 0.5–2 mL/kg/h」。Verbalis 原文無法取得，所以「100 mL Bolus」這個選項找不到可核對的出處，列為待確認。

### 文獻之間本身就不一致（工具選了其中一種，記錄供參考）

1. **U_Osm 100、U_Na 30 剛好落在分界上**：
   - ESE2014 推薦條文：U_Osm ≤ 100、U_Na ≤ 30。工具依此實作，測試通過。
   - 同一份指引的流程圖（repo 的 `fig1`）：寫成 < 100／≥ 100、< 30／≥ 30。
   - 兩者對剛好等於 100 或 30 的病人結論相反。`references.md` 依條文，但 `fig1` 依流程圖。
2. **TBW 體重係數**：
   - ESE2014 與 MDCalc 用 0.6／0.5／0.5／0.45。工具依此實作。
   - AM2012 Table 1 寫「0.6 in children, 0.55 in men, and 0.5 in women」，不分年齡。
3. **Lactated Ringer's 的 Na+K**：
   - AM2012 Table 2 用 135。
   - 工具提供 134（Na 130 + K 4）與 130 兩個選項。134 算出的每公升 ΔNa 取一位小數與文獻相同；選 130 會低估約 0.15 mEq/L。

---

## 三、找不到可驗證範例或未實作的項目

| 項目 | 狀況 |
|---|---|
| **FENa** | `na.js` 沒有 FENa 計算，所以無法測試 mg/dL 與 mmol/L 換算。測試標為 `todo`。 |
| **FE_Urea 以 mmol/L 輸入** | 畫面只有 mg/dL。`same_urea` 模式的血中尿素是由 Step 2 的 BUN（mg/dL）× 2.14 自動帶入。若檢驗室回報 mmol/L，使用者必須自行換算（BUN mg/dL = Urea mmol/L × 2.8），否則結果會錯。測試標為 `todo`。 |
| **3% NaCl 床邊泡製配方** | 找不到刊登「500 mL 0.9% NaCl 抽 100 mL + 6 支 10% NaCl 20 mL」的文獻，只以質量守恆驗算。另外，市售點滴袋常有 overfill（實際容量大於標示），實際濃度可能略低於計算值，工具沒有提醒。 |
| **老年切點 65 歲** | ESE2014 說「elderly」但沒有定義年齡。65 歲來自 MDCalc 慣例，找不到原始文獻定義。 |
| **FE_Urea < 35% 支持腎前性** | 常見教學值，本次沒有取得可逐字核對的原始研究。 |
| **FE_UA < 4%、S_UA < 4 mg/dL、U_Cl < 20** | 是常見教學切點，但本次沒有取得可逐字核對的原始文獻。 |
| **K < 3.5 作為高 ODS 風險** | HOORN17 轉述美國指引只寫「hypokalemia」，3.5 是工具自己定的數值。 |
| **乙醇係數 4.6 vs 3.7** | 工具的間隙計算用 4.6，另外計算 3.7 的值但沒有用在分支判斷。哪個係數較準，文獻有爭議（Purssell 2001 建議 3.7），本次沒有核對原文。 |
| **Adrogué–Madias NEJM 2000 原文範例** | 沒有開放全文，改用同作者 JASN 2012 範例。 |

---

## 四、缺值與極端值的觀察（非錯誤，供判斷）

1. **年齡未填**：視為非老年。男性用 0.6、女性用 0.5，比老年係數大，算出的輸液速率較快（較不保守）。頁面預設年齡為 55，只有使用者把年齡清空時才會發生。
2. **Glucose／BUN 未填**：計算滲透壓時當作 0，滲透壓間隙會偏大。例如 Na 122、Osm 283 時，間隙顯示為 39。工具有 `hasFullStandardCalcInputs` 旗標，但沒有用在分支判斷。
3. **沒有數值上限**：`na.js` 不檢查體重、血鈉等上限。例如體重 1000 kg 仍會算出 TBW 600 L。HTML 的 `min`／`max` 不會阻擋手動輸入。
4. **非數字輸入**：例如 "1,000"、"120 mEq/L" 會解析成 NaN，各函式都視為無效，不會被當成 0。這是正確的設計。
