# 低血鈉（Hyponatremia）臨床診斷演算法、公式與實證文獻彙整

> **適用族群**：成人急診與住院患者（Adult ED / Inpatient）  
> **資料最後校對**：2026-10-25

---

## 一、 核心臨床指引與重要文獻（Primary Clinical Guidelines & Studies）

1. **歐洲臨床實踐指引 (ESE / ESICM / ERA-EDTA 2014)**
   - Spasovski G, Vanholder R, Allolio B, et al. *Clinical practice guideline on diagnosis and treatment of hyponatraemia.* **Eur J Endocrinol.** 2014;170(3):G1–G47. [Full Text](https://academic.oup.com/ejendo/article/170/3/G1/6668028)
   - **重點**：
     - 將症狀分為「嚴重症狀（抽搐、昏迷、深度嗜睡、心肺窘迫）」與「中度嚴重症狀（嘔吐、混亂、步態不穩）」。
     - 嚴重症狀：立即輸注 **3% NaCl 150 mL（或 2 mL/kg）over 20 min**，抽血測 Na 同時給予第 2 次 150 mL，目標首小時提升 5 mmol/L。
     - 診斷演算法優先使用 **Urine Osmolality ($\le 100$ vs $> 100\text{ mOsm/kg}$)** 與 **Urine Sodium ($\le 30$ vs $> 30\text{ mmol/L}$)**，因臨床理學檢查評估體液容積敏感度與特異度偏低。
     - 安全矯正上限：首 24 小時 $\le 10\text{ mmol/L}$，其後每 24 小時 $\le 8\text{ mmol/L}$。

2. **美國專家共識建議 (US Expert Panel 2013)**
   - Verbalis JG, Goldsmith SR, Greenberg A, et al. *Diagnosis, evaluation, and treatment of hyponatremia: expert panel recommendations.* **Am J Med.** 2013;126(10 Suppl 1):S1–S42. [PubMed](https://pubmed.ncbi.nlm.nih.gov/24074529/)
   - **重點**：
     - 急性嚴重症狀：給予 **3% NaCl 100 mL IV bolus over 10 min**，若症狀持續可每 10 分鐘重複，最多共 3 次（總量 300 mL），目標快速上升 4–6 mEq/L 緩解腦水腫。
     - 區分一般慢性低血鈉（目標 6–8 mEq/L/24h，首 24h 上限 10–12、48h 上限 18 mEq/L）與**高 ODS 風險群**（$\text{Na} \le 105\text{ mEq/L}$、低血鉀、酗酒、營養不良、晚期肝病：24h 目標 **4–6 mEq/L**，任何 24h 絕對上限 **8 mEq/L**）。

3. **AAFP 急診與住院臨床實務綜論 (AAFP 2015)**
   - Braun MM, Barstow CH, Pyzocha NJ. *Diagnosis and management of sodium disorders: hyponatremia and hypernatremia.* **Am Fam Physician.** 2015;91(5):299–307. [PDF](https://www.aafp.org/afp/2015/0301/p299.pdf)

4. **SALSA 隨機對照臨床試驗 (JAMA Internal Medicine 2021)**
   - Baek SH, Jo YH, Ahn S, et al. *Risk of Overcorrection in Rapid Intermittent Bolus vs Slow Continuous Infusion Therapies of Hypertonic Saline for Patients With Symptomatic Hyponatremia: The SALSA Randomized Clinical Trial.* **JAMA Intern Med.** 2021;181(1):81–92. [DOI](https://doi.org/10.1001/jamainternmed.2020.5519)
   - **重點**：
     - 比較 3% NaCl **快速間歇性 Bolus（2 mL/kg IV over 20 min）** 與慢速連續輸注：兩組過度矯正率相當，但快速間歇性 Bolus 在第 1 小時達成目標升鈉之比例顯著較高，且需要降鈉救援治療（D5W 10 mL/kg + DDAVP 2 μg）的比例較低。

5. **無效滲透壓物質（BUN／乙醇）與診斷推理陷阱 (JIM High Impact Case Reports 2026)**
   - *Diagnostic Reasoning in Hyponatremia: Osmolality, Tonicity, and Osmolal Gap.* **J Investig Med High Impact Case Rep.** 2026. [PMC13424767](https://pmc.ncbi.nlm.nih.gov/articles/PMC13424767/) / [Publisher](https://journals.sagepub.com/doi/10.1177/23247096261474690)
   - **重點**：
     - 三病例診斷推理報告，強調不可機械式套用「實測總滲透壓 $> 285\text{ mOsm/kg} =$ 高張性低血鈉」。
     - **尿素（Urea/BUN）與乙醇（Ethanol）為無效滲透壓物質（Ineffective osmoles）**，可自由穿透細胞膜，雖會拉高實測總滲透壓（Measured Osm），但不會提高有效張力（Effective Tonicity $= 2\times\text{Na} + \text{Glucose}/18$）。此類病患本質上仍為**真性低張性低血鈉**，須進一步評估尿液與體液狀態。

6. **最新低血鈉安全矯正與治療綜論 (CJASN 2024 & NDT 2024)**
   - Sterns RH. *Treatment of Severe Hyponatremia.* **Clin J Am Soc Nephrol (CJASN).** 2024;19(6):793–795. [DOI](https://doi.org/10.2215/CJN.0000000000000244)
   - Adrogué HJ, Madias NE. *The Syndrome of Inappropriate Antidiuresis.* **Nephrol Dial Transplant.** 2024;39(10):1583–1593. [DOI](https://academic.oup.com/ndt/article/39/10/1583/7713921)

---

## 二、 核心數學與生理公式（Mathematical & Physiological Formulas）

### 1. 血清滲透壓、有效張力與高血糖校正血鈉
- **計算總滲透壓（Calculated Serum Osmolarity，必須使用實測血鈉 $\text{Na}_{\text{measured}}$）**：
  $$\text{Calculated Osm} = 2 \times \text{Na}_{\text{measured}} + \frac{\text{Glucose}}{18} + \frac{\text{BUN}}{2.8} + \left(\frac{\text{Ethanol}}{4.6}\right)$$
- **有效滲透壓／張力（Effective Osmolality / Tonicity，扣除無效溶質 BUN 與 Ethanol）**：
  $$\text{Effective Osm (Tonicity)} = 2 \times \text{Na}_{\text{measured}} + \frac{\text{Glucose}}{18}$$
- **滲透壓間隙（Osmolal Gap）**：
  $$\text{Osmolal Gap} = \text{Measured Osm} - \left(2 \times \text{Na}_{\text{measured}} + \frac{\text{Glucose}}{18} + \frac{\text{BUN}}{2.8}\right)$$
  （正常值 $\le 10\text{ mOsm/kg}$；$> 10$ 提示未測量溶質如乙醇、甲醇、乙二醇、丙二醇、Mannitol、Sorbitol、Maltose）。
- **高血糖校正血鈉（MDCalc #50，僅於 $\text{Glucose} > 100\text{ mg/dL}$ 時適用）**：
  - **Katz (1973)**：$\text{Na}_{\text{Katz}} = \text{Na}_{\text{measured}} + 0.016 \times (\text{Glucose} - 100)$
  - **Hillier (1999)**：$\text{Na}_{\text{Hillier}} = \text{Na}_{\text{measured}} + 0.024 \times (\text{Glucose} - 100)$

### 2. 尿液輔助指標與脫鹽風險（Urine Indices & Desalination Check）
- **尿素排泄分率（$\text{FE}_{\text{Urea}}$）**（血尿素氮 BUN 與尿尿素氮 UUN 須同單位；若尿液報告為 Urine Urea mg/dL，需除以 $2.14$ 轉換為 UUN mg/dL）：
  $$\text{FE}_{\text{Urea}} (\%) = \frac{U_{\text{Urea\_eq}} \times S_{\text{Cr}}}{S_{\text{Urea\_eq}} \times U_{\text{Cr}}} \times 100$$
  （$< 35\%$ 支持有效動脈血容積不足／腎前性低灌流，即使使用利尿劑致 $U_{\text{Na}} > 30$ 仍具參考價值）。
- **尿酸排泄分率（$\text{FE}_{\text{UA}}$）**：
  $$\text{FE}_{\text{UA}} (\%) = \frac{U_{\text{UA}} \times S_{\text{Cr}}}{S_{\text{UA}} \times U_{\text{Cr}}} \times 100$$
  （$> 12\%$ 支持 SIADH 或 CSW/RSW；$< 4\%$ 支持低血容）。
- **Fürst Ratio（尿液／血漿有效電解質比）與脫鹽現象（Desalination）**：
  $$\text{Fürst Ratio} = \frac{U_{\text{Na}} + U_{\text{K}}}{\text{Na}_{\text{serum}}}$$
  - 若 $U_{\text{Na}} + U_{\text{K}} > 154\text{ mEq/L}$，在 SIADH（ADH 固定偏高）患者輸注 0.9% NaCl ($154\text{ mEq/L}$) 會發生**脫鹽惡化（Desalination）**，使血鈉反而下降（Steele et al., *Ann Intern Med* 1997; Verbalis et al., 2013）。

### 3. 總體液量（TBW）、Adrogué-Madias 速率公式與有限體積 Bolus 模型
- **MDCalc #480 / Adrogué-Madias (2000) 體重比例法**：
  - 成年男性（$< 65$ 歲）：$0.60 \times \text{Weight (kg)}$
  - 老年男性（$\ge 65$ 歲）或成年女性（$< 65$ 歲）：$0.50 \times \text{Weight (kg)}$
  - 老年女性（$\ge 65$ 歲）：$0.45 \times \text{Weight (kg)}$
- **Watson (1980) 身高體重經驗公式（本工具進階對照選項，需填寫身高）**：
  - 男性：$\text{TBW} = 2.447 - 0.09516 \times \text{Age} + 0.1074 \times \text{Height (cm)} + 0.3362 \times \text{Weight (kg)}$
  - 女性：$\text{TBW} = -2.097 + 0.1069 \times \text{Height (cm)} + 0.2466 \times \text{Weight (kg)}$
- **每輸注 1 公升點滴對血鈉之影響（Adrogué & Madias, *NEJM* 2000）**：
  $$\Delta\text{Na}_{\text{per 1L}} = \frac{(\text{Infusate Na} + \text{Infusate K}) - \text{Serum Na}}{\text{TBW} + 1}$$
- **有限體積（Finite-Volume）單次 Bolus 精確混合公式（$V$ 單位為公升 L）**：
  $$\Delta\text{Na}_{\text{bolus}} = \frac{V \times (C_{\text{infusate}} - \text{Serum Na})}{\text{TBW} + V}$$
- **過度矯正降鈉救援之封閉單室自由水估算公式**：
  $$V_{\text{D5W (L)}} = \text{TBW} \times \left(\frac{\text{Na}_{\text{current}}}{\text{Na}_{\text{target}}} - 1\right)$$

---

## 三、 本專案收錄之原始參考流程圖（Included Reference Figures）

1. [`assets/fig1-ese-algorithm.png`](./assets/fig1-ese-algorithm.png)：歐洲指引（ESE 2014）低血鈉診斷演算法（優先看 Urine Osmolality $\le 100$ vs $> 100\text{ mOsm/kg}$，再看 Urine Na $< 30$ vs $\ge 30\text{ mmol/L}$）。
2. [`assets/fig2-geekymedics-assessment.png`](./assets/fig2-geekymedics-assessment.png)：Geeky Medics 傳統體液狀態優先評估圖（Hypovolaemic vs Euvolaemic vs Hypervolaemic）。
3. [`assets/fig3-diagnostic-algorithm.png`](./assets/fig3-diagnostic-algorithm.png)：經典教科書低血鈉診斷流程圖（$P_{\text{Na}} < 135 \to P_{\text{osm}} \to U_{\text{osm}} \to \text{ECF}_{\text{vol}}$）。
