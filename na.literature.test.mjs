import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOptionalNumber,
  percentNaClToMeqL,
  INFUSATES,
  BOLUS_REGIMENS,
  calculateTbw,
  calculateFiniteBolusDeltaNa,
  evaluateStep1Triage,
  evaluateStep2Osmolality,
  evaluateStep3And4UrineAndClassification,
  calculate3PercentMixing,
  calculateInfusionPlan,
  calculateOvercorrectionRescue,
} from "./na.js";

// 文獻對照測試：每個範例都標註出處；與文獻不一致之案例以 { todo } 標記（不影響 CI），並列於 TEST_REPORT.md。
//
// [ESE2014]  Spasovski G, et al. Clinical practice guideline on diagnosis and treatment of hyponatraemia.
//            Eur J Endocrinol 2014;170(3):G1–G47. doi:10.1530/EJE-13-1020
// [AM2012]   Adrogué HJ, Madias NE. The challenge of hyponatremia. J Am Soc Nephrol 2012;23:1140–1148.
//            doi:10.1681/ASN.2012020128（Table 1、Table 2 之 60 kg 女性、TBW 30 L、Na 110 範例）
// [FIG3]     本 repo assets/fig3-diagnostic-algorithm.png（教科書 Figure 43-2 低血鈉診斷流程）
// [FENSKE08] Fenske W, et al. J Clin Endocrinol Metab 2008;93:2991–2997. doi:10.1210/jc.2008-0330
// [WATSON80] Watson PE, et al. Am J Clin Nutr 1980;33:27–39.
// [KATZ73]   Katz MA. N Engl J Med 1973;289:843–844.  [HILLIER99] Hillier TA, et al. Am J Med 1999;106:399–403.
// [HOORN17]  Hoorn EJ, Zietse R. J Am Soc Nephrol 2017;28:1340–1349. doi:10.1681/ASN.2016101139（Table 2 美國／歐洲指引對照）
// [SALSA-P]  Lee A, et al. SALSA 試驗計畫書. Trials 2017;18(1):147. doi:10.1186/s13063-017-1865-z

const close = (actual, expected, tolerance, message) =>
  assert.ok(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${message ?? ""} expected ${expected} ± ${tolerance}, got ${actual}`,
  );

const fluid = (plan, key) => plan.allFluidsTable.find((f) => f.key === key);

const step2 = (o) => evaluateStep2Osmolality(o);
const step34 = (o) => evaluateStep3And4UrineAndClassification(o);

// ───────────────────────── 輸液濃度 ─────────────────────────

test("NaCl % 換算 mEq/L 與 [AM2012] Table 2 及分子量 58.44 一致", () => {
  // [AM2012] Table 2：3% NaCl 513、0.9% NaCl 154、0.45% NaCl 77
  close(percentNaClToMeqL(3), 513, 0.5, "3%");
  close(percentNaClToMeqL(0.9), 154, 0.05, "0.9%");
  close(percentNaClToMeqL(0.45), 77, 0.05, "0.45%");
  close(percentNaClToMeqL(5), 855.6, 0.05, "5%");
  close(percentNaClToMeqL(2), 342.2, 0.05, "2%");
  assert.equal(percentNaClToMeqL(0), 0);
  assert.throws(() => percentNaClToMeqL(-1), RangeError);
  assert.throws(() => percentNaClToMeqL(Number.NaN), RangeError);
  assert.throws(() => percentNaClToMeqL(Number.POSITIVE_INFINITY), RangeError);
});

test("INFUSATES 表的有效濃度 (Na+K) 與百分比換算一致", () => {
  const byKey = Object.fromEntries(INFUSATES.map((f) => [f.key, f]));
  close(byKey.hypertonic_5.effectiveMeqL, percentNaClToMeqL(5), 0.05);
  close(byKey.hypertonic_3.effectiveMeqL, percentNaClToMeqL(3), 0.05);
  close(byKey.hypertonic_2.effectiveMeqL, percentNaClToMeqL(2), 0.05);
  close(byKey.ns_09.effectiveMeqL, percentNaClToMeqL(0.9), 0.05);
  close(byKey.half_ns_045.effectiveMeqL, percentNaClToMeqL(0.45), 0.05);
  close(byKey.quarter_ns_02.effectiveMeqL, percentNaClToMeqL(0.2), 0.05);
  assert.equal(byKey.d5w.effectiveMeqL, 0);
  for (const f of INFUSATES) {
    assert.equal(f.effectiveMeqL, f.naMeqL + f.intrinsicKMeqL, f.key);
  }
});

// ───────────────────────── TBW ─────────────────────────

test("TBW 體重係數與 [ESE2014] §7.1 Advice（Adrogué–Madias）一致：0.6／0.5／0.5／0.45", () => {
  // [ESE2014]："The fraction is 0.6 in non-elderly men and 0.5 in non-elderly women; 0.5 and 0.45 in elderly men and women respectively."
  assert.equal(calculateTbw({ weightKg: 80, sex: "male", ageYears: 40 }).factor, 0.6);
  assert.equal(calculateTbw({ weightKg: 80, sex: "female", ageYears: 40 }).factor, 0.5);
  assert.equal(calculateTbw({ weightKg: 80, sex: "male", ageYears: 80 }).factor, 0.5);
  assert.equal(calculateTbw({ weightKg: 80, sex: "female", ageYears: 80 }).factor, 0.45);
  close(calculateTbw({ weightKg: 80, sex: "female", ageYears: 80 }).tbwL, 36, 1e-9);
});

test("TBW 年齡切點 65 歲（MDCalc 慣例；[ESE2014] 未定義 elderly 年齡）", () => {
  assert.equal(calculateTbw({ weightKg: 70, sex: "male", ageYears: 64.9 }).factor, 0.6);
  assert.equal(calculateTbw({ weightKg: 70, sex: "male", ageYears: 65 }).factor, 0.5);
  assert.equal(calculateTbw({ weightKg: 70, sex: "female", ageYears: 64 }).factor, 0.5);
  assert.equal(calculateTbw({ weightKg: 70, sex: "female", ageYears: 65 }).factor, 0.45);
});

test("TBW 缺值與極端值：體重無效回傳 null；年齡缺值視為非老年（現行行為，見報告）", () => {
  for (const weightKg of [null, undefined, 0, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
    const r = calculateTbw({ weightKg, sex: "male", ageYears: 40 });
    assert.equal(r.tbwL, null, String(weightKg));
    assert.equal(r.methodUsed, null);
  }
  // 年齡未填 (null) → 不視為老年 → 男性 0.6（係數較大、算出速率較快，報告中列為觀察項）
  assert.equal(calculateTbw({ weightKg: 70, sex: "male", ageYears: null }).factor, 0.6);
  assert.equal(calculateTbw({ weightKg: 70, sex: "female", ageYears: null }).factor, 0.5);
  // 引擎本身沒有體重上限（HTML min/max 不會阻擋手動輸入）
  assert.equal(calculateTbw({ weightKg: 1000, sex: "male", ageYears: 40 }).tbwL, 600);
});

test("Watson (1980) 公式係數與 [WATSON80] 一致，身高超出 100–250 cm 自動退回係數法", () => {
  // 男：2.447 − 0.09516×Age + 0.1074×H + 0.3362×W；女：−2.097 + 0.1069×H + 0.2466×W
  const female = calculateTbw({ weightKg: 60, sex: "female", ageYears: 30, heightCm: 160, method: "watson" });
  close(female.tbwL, -2.097 + 0.1069 * 160 + 0.2466 * 60, 1e-9, "female");
  assert.equal(female.methodUsed, "watson");
  // 女性公式不含年齡，年齡缺值仍可用 Watson
  const femaleNoAge = calculateTbw({ weightKg: 60, sex: "female", ageYears: null, heightCm: 160, method: "watson" });
  assert.equal(femaleNoAge.methodUsed, "watson");
  // 男性缺年齡 → 退回係數法
  const maleNoAge = calculateTbw({ weightKg: 70, sex: "male", ageYears: null, heightCm: 170, method: "watson" });
  assert.equal(maleNoAge.methodUsed, "fraction");
  assert.equal(maleNoAge.usedFallback, true);
  for (const heightCm of [99, 251, null, Number.NaN]) {
    const r = calculateTbw({ weightKg: 70, sex: "male", ageYears: 40, heightCm, method: "watson" });
    assert.equal(r.methodUsed, "fraction", String(heightCm));
    assert.equal(r.usedFallback, true);
  }
  assert.equal(calculateTbw({ weightKg: 70, sex: "male", ageYears: 40, heightCm: 100, method: "watson" }).methodUsed, "watson");
  assert.equal(calculateTbw({ weightKg: 70, sex: "male", ageYears: 40, heightCm: 250, method: "watson" }).methodUsed, "watson");
});

// ───────────────────────── Adrogué–Madias ─────────────────────────

test("Adrogué–Madias 每公升 ΔNa 重現 [AM2012] Table 2（60 kg 女性、TBW 30 L、Na 110）", () => {
  const plan = calculateInfusionPlan({ serumNa: 110, tbwL: 30, targetDeltaNaMeqL: 4, timeHours: 6 });
  // Table 2「Effect on [Na+]s per 1 L」：3% ↑13.0、0.9% ↑1.4、Ringer's ↑0.8、0.45% ↓1.1、5% dextrose ↓3.5
  close(fluid(plan, "hypertonic_3").deltaNaPer1L, 13.0, 0.05, "3% NaCl");
  close(fluid(plan, "ns_09").deltaNaPer1L, 1.4, 0.05, "0.9% NaCl");
  close(fluid(plan, "half_ns_045").deltaNaPer1L, -1.1, 0.05, "0.45% NaCl");
  close(fluid(plan, "d5w").deltaNaPer1L, -3.5, 0.05, "D5W");
  // Ringer's：文獻用 Na+K 135；工具的 LR 134 取一位小數同為 0.8
  close(fluid(plan, "lr_134").deltaNaPer1L, 0.8, 0.05, "LR 134");
});

test("[AM2012] Table 2 情境 (1)：+4 mEq/L over 6 h 需 3% NaCl 約 308 mL、51 mL/h", () => {
  const plan = calculateInfusionPlan({
    serumNa: 110,
    tbwL: calculateTbw({ weightKg: 60, sex: "female", ageYears: 40 }).tbwL, // 0.5 × 60 = 30 L
    infusateKey: "hypertonic_3",
    targetDeltaNaMeqL: 4,
    timeHours: 6,
  });
  assert.equal(plan.isValid, true);
  close(plan.selectedFluid.rateMlPerHour, 51, 0.5, "rate");
  close(plan.selectedFluid.totalVolumeMl, 308, 1, "volume"); // 文獻以 13.0 取整計算為 308 mL
  close(plan.hourlyGoalMeqL, 4 / 6, 1e-9);
});

test("[AM2012] Table 2 情境 (3)：0.9% NaCl + 30 mEq KCl/L（Na+K 184）每公升 ↑2.4", () => {
  const plan = calculateInfusionPlan({
    serumNa: 110,
    tbwL: 30,
    infusateKey: "ns_09",
    addedKMeqL: 30,
    targetDeltaNaMeqL: 4,
    timeHours: 24,
  });
  assert.equal(plan.selectedFluid.totalConcMeqL, 184);
  close(plan.selectedFluid.deltaNaPer1L, 2.4, 0.05);
});

test("Adrogué–Madias 公式本體：ΔNa/L = (Na+K − SNa)/(TBW+1)，速率 = (目標/小時)/ΔNa × 1000", () => {
  const plan = calculateInfusionPlan({ serumNa: 120, tbwL: 42, infusateKey: "hypertonic_3", targetDeltaNaMeqL: 8, timeHours: 24 });
  const expectedPerL = (513.3 - 120) / 43;
  close(plan.selectedFluid.deltaNaPer1L, expectedPerL, 1e-9);
  close(plan.selectedFluid.rateMlPerHour, (8 / 24 / expectedPerL) * 1000, 1e-9);
  close(plan.selectedFluid.totalVolumeMl, (8 / expectedPerL) * 1000, 1e-9);
  close(plan.projected24hChange, 8, 1e-9);
});

test("性別與年齡經 TBW 影響速率：同為 70 kg、Na 115、3% NaCl +6/24h，TBW 越小速率越慢", () => {
  const rate = (sex, ageYears) => {
    const tbwL = calculateTbw({ weightKg: 70, sex, ageYears }).tbwL;
    return calculateInfusionPlan({ serumNa: 115, tbwL, targetDeltaNaMeqL: 6, timeHours: 24 }).selectedFluid.rateMlPerHour;
  };
  const youngMale = rate("male", 40); // TBW 42
  const oldMale = rate("male", 70); // TBW 35
  const youngFemale = rate("female", 40); // TBW 35
  const oldFemale = rate("female", 70); // TBW 31.5
  close(youngMale, ((6 / 24) / ((513.3 - 115) / 43)) * 1000, 1e-9);
  close(oldFemale, ((6 / 24) / ((513.3 - 115) / 32.5)) * 1000, 1e-9);
  assert.equal(oldMale, youngFemale);
  assert.ok(youngMale > oldMale && oldMale > oldFemale);
});

test("calculateInfusionPlan 缺值、極端值與防呆", () => {
  for (const serumNa of [null, 0, -1, Number.NaN]) {
    assert.equal(calculateInfusionPlan({ serumNa, tbwL: 30 }).isValid, false, String(serumNa));
  }
  for (const tbwL of [null, 0, -5]) {
    assert.equal(calculateInfusionPlan({ serumNa: 120, tbwL }).isValid, false, String(tbwL));
  }
  for (const timeHours of [0, -1, Number.NaN]) {
    assert.equal(calculateInfusionPlan({ serumNa: 120, tbwL: 30, timeHours }).isValid, false, String(timeHours));
  }
  assert.equal(calculateInfusionPlan({ serumNa: 120, tbwL: 30, targetDeltaNaMeqL: Number.NaN }).isValid, false);

  // 目標 0：所有輸液速率 0
  const zero = calculateInfusionPlan({ serumNa: 120, tbwL: 30, targetDeltaNaMeqL: 0 });
  assert.ok(zero.allFluidsTable.every((f) => f.status === "zero_target" && f.rateMlPerHour === 0));

  // 降鈉（負目標）：D5W 可行、3% NaCl 方向相反
  const lower = calculateInfusionPlan({ serumNa: 150, tbwL: 35, infusateKey: "d5w", targetDeltaNaMeqL: -6, timeHours: 24 });
  assert.equal(lower.selectedFluid.status, "achievable");
  close(lower.selectedFluid.rateMlPerHour, ((-6 / 24) / (-150 / 36)) * 1000, 1e-9);
  assert.equal(fluid(lower, "hypertonic_3").status, "opposite_direction");

  // 負的外加 K 視為 0；未知輸液 key 退回 3% NaCl；自訂泡製濃度非數值時用 513.3
  assert.equal(calculateInfusionPlan({ serumNa: 120, tbwL: 30, addedKMeqL: -20 }).selectedFluid.addedKMeqL, 0);
  assert.equal(calculateInfusionPlan({ serumNa: 120, tbwL: 30, infusateKey: "nope" }).selectedFluid.key, "hypertonic_3");
  assert.equal(
    calculateInfusionPlan({ serumNa: 120, tbwL: 30, infusateKey: "custom_mix", customInfusateConcMeqL: Number.NaN }).selectedFluid.totalConcMeqL,
    513.3,
  );
});

test("目標升幅超過 24h 剩餘上限時出現 ODS 警示；等張液在 SIADH／高張尿出現脫鹽警示", () => {
  const over = calculateInfusionPlan({ serumNa: 118, tbwL: 30, targetDeltaNaMeqL: 9, remainingHardLimit24h: 8 });
  assert.ok(over.warnings.some((w) => /超過本 24h 剩餘安全上限/.test(w)));
  const exact = calculateInfusionPlan({ serumNa: 118, tbwL: 30, targetDeltaNaMeqL: 8, remainingHardLimit24h: 8 });
  assert.ok(!exact.warnings.some((w) => /超過本 24h 剩餘安全上限/.test(w)));

  for (const key of ["ns_09", "lr_134", "lr_130"]) {
    const p = calculateInfusionPlan({ serumNa: 118, tbwL: 30, infusateKey: key, desalinationRisk: "high_confirmed" });
    assert.equal(p.selectedFluid.isIsotonicDesalinationDanger, true, key);
    assert.ok(p.warnings.some((w) => /脫鹽/.test(w)));
  }
  const cat3 = calculateInfusionPlan({ serumNa: 118, tbwL: 30, infusateKey: "ns_09", categoryId: "cat3_euvol_adh" });
  assert.equal(cat3.selectedFluid.isIsotonicDesalinationDanger, true);
  const hypertonic = calculateInfusionPlan({ serumNa: 118, tbwL: 30, infusateKey: "hypertonic_3", desalinationRisk: "high_confirmed" });
  assert.equal(hypertonic.selectedFluid.isIsotonicDesalinationDanger, false);
});

// ───────────────────────── Bolus（有限體積）與 Step 1 ─────────────────────────

test("有限體積 Bolus = 質量守恆 (TBW×S + V×C)/(TBW+V) − S", () => {
  for (const [tbwL, serumNa, bolusMl] of [[30, 110, 150], [42, 118, 100], [25, 105, 300]]) {
    const r = calculateFiniteBolusDeltaNa({ tbwL, serumNa, bolusMl, infusateNaPlusK: 513.3 });
    const v = bolusMl / 1000;
    close(r.deltaNaFinite, (tbwL * serumNa + v * 513.3) / (tbwL + v) - serumNa, 1e-9);
  }
  assert.equal(calculateFiniteBolusDeltaNa({ tbwL: 30, serumNa: null, bolusMl: 150 }), null);
  assert.equal(calculateFiniteBolusDeltaNa({ tbwL: 30, serumNa: 110, bolusMl: 0 }), null);
  assert.equal(calculateFiniteBolusDeltaNa({ tbwL: 0, serumNa: 110, bolusMl: 150 }), null);
});

test("Bolus 方案數值與 [ESE2014] §7.1.1／§7.2.1.4 一致：150 mL 3% over 20 min；可改 2 mL/kg", () => {
  const ese = BOLUS_REGIMENS.ese_2014;
  // 7.1.1.1 "prompt i.v. infusion of 150 ml 3% hypertonic over 20 min"；Advice: "weight-based (2 ml/kg)"
  assert.equal(ese.severe.fixedVolumeMl, 150);
  assert.equal(ese.severe.infusionMinutes, 20);
  assert.equal(ese.severe.weightBasedMlPerKg, 2);
  // 7.2.1.4 "a single i.v. infusion of 150 ml 3% hypertonic saline or equivalent"
  assert.equal(ese.moderate.fixedVolumeMl, 150);
  assert.equal(ese.moderate.infusionMinutes, 20);
});

test("SALSA 方案為 2 mL/kg；Step 1 以 Math.round(體重×2) 計算體積並套用有限體積公式", () => {
  assert.equal(BOLUS_REGIMENS.salsa_2021.severe.weightBasedMlPerKg, 2);
  assert.equal(BOLUS_REGIMENS.salsa_2021.moderate.weightBasedMlPerKg, 2);
  const r = evaluateStep1Triage({ serumNa: 115, symptomSeverity: "severe", regimenKey: "salsa_2021", weightKg: 62.3, tbwL: 31.15 });
  assert.equal(r.activeRegimenBolus.bolusMl, 125);
  close(r.activeRegimenBolus.deltaNaFinite, (0.125 * (513.3 - 115)) / (31.15 + 0.125), 1e-9);
  // 未填體重時 SALSA 退回 150 mL 計算
  const noWeight = evaluateStep1Triage({ serumNa: 115, symptomSeverity: "severe", regimenKey: "salsa_2021", tbwL: 30 });
  assert.equal(noWeight.activeRegimenBolus.bolusMl, 150);
});

test("Step 1 上限與 [ESE2014] §7.1.2.4／§7.2.1.6 一致：首 24h ≤ 10、其後每 24h ≤ 8 mmol/L", () => {
  const ese = evaluateStep1Triage({ serumNa: 120, limitGuideline: "ese_2014" });
  assert.equal(ese.limits.hardLimit24h, 10);
  assert.equal(ese.limits.hardLimitSecond24h, 8);
  assert.equal(ese.limits.hardLimit48h, 18);
});

test("美國方案嚴重症狀 100 mL over 10 min、最多 3 次（[HOORN17] Table 2）", () => {
  const us = BOLUS_REGIMENS.us_2013.severe;
  assert.equal(us.fixedVolumeMl, 100);
  assert.equal(us.infusionMinutes, 10);
  assert.match(us.repeatRule, /最多共 3 次/);
});

test("美國高 ODS 風險：目標 4–6、上限 8 mmol/L/24h（[HOORN17] Table 2）", () => {
  const r = evaluateStep1Triage({ serumNa: 120, limitGuideline: "us_cjasn", majorOdsFlags: { alcoholism: true } });
  assert.equal(r.limits.targetMin24h, 4);
  assert.equal(r.limits.targetMax24h, 6);
  assert.equal(r.limits.hardLimit24h, 8);
});

test(
  "[HOORN17] Table 2：美國一般風險最低矯正 4 mmol/L per d",
  { todo: "工具一般風險目標下限為 6（6–8），文獻為 4–8（見 TEST_REPORT.md 不一致 #5）" },
  () => {
    assert.equal(evaluateStep1Triage({ serumNa: 120, limitGuideline: "us_cjasn" }).limits.targetMin24h, 4);
  },
);

test(
  "[SALSA-P] 嚴重症狀 4 mL/kg over 40 min；未知體重時中度 100 mL、嚴重 200 mL",
  { todo: "工具 SALSA 嚴重症狀為 2 mL/kg over 20 min，未填體重一律 150 mL（見 TEST_REPORT.md 不一致 #4）" },
  () => {
    assert.equal(BOLUS_REGIMENS.salsa_2021.severe.weightBasedMlPerKg, 4);
    assert.equal(BOLUS_REGIMENS.salsa_2021.severe.infusionMinutes, 40);
    const noWeight = evaluateStep1Triage({ serumNa: 115, symptomSeverity: "severe", regimenKey: "salsa_2021", tbwL: 30 });
    assert.equal(noWeight.activeRegimenBolus.bolusMl, 200);
  },
);

test("Step 1 主要 ODS 風險因子（Na ≤ 105、K < 3.5、酒精、營養不良、肝病）切換為 24h 上限 8", () => {
  const atBoundary = evaluateStep1Triage({ serumNa: 105 });
  assert.equal(atBoundary.hasMajorOdsRisk, true);
  assert.equal(atBoundary.limits.hardLimit24h, 8);
  assert.equal(evaluateStep1Triage({ serumNa: 105.1 }).hasMajorOdsRisk, false);
  assert.equal(evaluateStep1Triage({ serumNa: 120, serumK: 3.49 }).hasMajorOdsRisk, true);
  assert.equal(evaluateStep1Triage({ serumNa: 120, serumK: 3.5 }).hasMajorOdsRisk, false);
  for (const flag of ["alcoholism", "malnutrition", "liverDisease"]) {
    const r = evaluateStep1Triage({ serumNa: 120, majorOdsFlags: { [flag]: true } });
    assert.equal(r.limits.profileId, "high_ods_risk", flag);
  }
  // 高風險優先於指引選擇
  assert.equal(evaluateStep1Triage({ serumNa: 104, limitGuideline: "ese_2014" }).limits.profileId, "high_ods_risk");
});

test("Step 1 症狀分級：勾選嚴重症狀自動升級；勾選中度症狀不會降級已選的嚴重", () => {
  assert.equal(evaluateStep1Triage({ severeSymptomsList: ["seizure"] }).effectiveSeverity, "severe");
  assert.equal(evaluateStep1Triage({ moderateSymptomsList: ["vomiting"] }).effectiveSeverity, "moderate");
  assert.equal(evaluateStep1Triage({ symptomSeverity: "severe", moderateSymptomsList: ["vomiting"] }).effectiveSeverity, "severe");
  const mild = evaluateStep1Triage({ serumNa: 128 });
  assert.equal(mild.isEmergencyBolusIndicated, false);
  assert.equal(mild.activeStepProtocol, null);
});

test("Step 1 24h 配額：直接輸入升幅優先於起始 Na；邊界 = 上限時為 reached、超過才 exceeded", () => {
  const both = evaluateStep1Triage({ serumNa: 120, initialNa24h: 110, priorRise24hInput: 3 });
  assert.equal(both.priorRise24h, 3);
  assert.equal(both.priorRiseSource, "direct_input");
  // 一般風險 (us_standard) 上限 10
  assert.equal(evaluateStep1Triage({ serumNa: 120, priorRise24hInput: 10 }).overcorrectionStatus, "reached_hard_limit");
  assert.equal(evaluateStep1Triage({ serumNa: 120, priorRise24hInput: 10.1 }).overcorrectionStatus, "exceeded_hard_limit");
  assert.equal(evaluateStep1Triage({ serumNa: 120, priorRise24hInput: 8 }).overcorrectionStatus, "reached_warning_or_target");
  assert.equal(evaluateStep1Triage({ serumNa: 120, priorRise24hInput: 7.9 }).overcorrectionStatus, "within_budget");
  // 血鈉下降不算負升幅
  assert.equal(evaluateStep1Triage({ serumNa: 118, initialNa24h: 121 }).priorRise24h, 0);
  // 經過時間：剩餘小時數 = 24 − elapsed，最少 1 小時；超出 0–24 範圍則忽略
  assert.equal(evaluateStep1Triage({ serumNa: 120, elapsedHours24h: 6 }).remainingWindowHours, 18);
  assert.equal(evaluateStep1Triage({ serumNa: 120, elapsedHours24h: 23.5 }).remainingWindowHours, 1);
  assert.equal(evaluateStep1Triage({ serumNa: 120, elapsedHours24h: 30 }).remainingWindowHours, 24);
  close(evaluateStep1Triage({ serumNa: 120, elapsedHours24h: 6 }).suggestedHourlyRateMeqL, 6 / 18, 1e-9);
});

// ───────────────────────── 過度矯正救援 ─────────────────────────

test("過度矯正救援起始劑量與 [ESE2014] §7.5.1.3–7.5.1.4 一致：D5W 10 mL/kg over 1 h、DDAVP 2 μg", () => {
  const r = calculateOvercorrectionRescue({ currentNa: 130, targetRelowerNa: 126, weightKg: 70, tbwL: 35 });
  assert.equal(r.salsaBolus10MlKg, 700);
  assert.match(r.ddavpGuidance.dose, /2 μg/);
  close(r.closedCompartmentVolumeL, 35 * (130 / 126 - 1), 1e-9);
  // Adrogué–Madias 對照：每公升 D5W ΔNa = −130/36
  close(r.deltaNaPer1LD5w, -130 / 36, 1e-9);
  close(r.adrogueMadiasVolumeL, 4 / (130 / 36), 1e-9);
  assert.equal(calculateOvercorrectionRescue({ currentNa: 130, targetRelowerNa: 130, weightKg: 70, tbwL: 35 }).isValid, false);
  assert.equal(calculateOvercorrectionRescue({ currentNa: 130, targetRelowerNa: 126, weightKg: 70, tbwL: null }).isValid, false);
  assert.equal(calculateOvercorrectionRescue({ currentNa: 130, targetRelowerNa: 126, weightKg: null, tbwL: 35 }).salsaBolus10MlKg, null);
});

// ───────────────────────── 3% NaCl 泡製（找不到文獻範例，以質量守恆驗算）─────────────────────────

test("泡製模式 A 遵守 NaCl 質量守恆（含不同基底液與支數）", () => {
  const cases = [
    { baseFluidPercent: 0.9, bagVolumeMl: 500, withdrawMl: 100, ampouleCount: 6 },
    { baseFluidPercent: 0, bagVolumeMl: 500, withdrawMl: 50, ampouleCount: 8 },
    { baseFluidPercent: 0.45, bagVolumeMl: 1000, withdrawMl: 200, ampouleCount: 10 },
    { baseFluidPercent: 0.9, bagVolumeMl: 500, withdrawMl: 0, ampouleCount: 0 },
  ];
  for (const c of cases) {
    const r = calculate3PercentMixing({ mode: "mode_a_ampoules", ampouleVolumeMl: 20, ampouleConcPercent: 10, ...c });
    const grams = ((c.bagVolumeMl - c.withdrawMl) * c.baseFluidPercent + c.ampouleCount * 20 * 10) / 100;
    const volume = c.bagVolumeMl - c.withdrawMl + c.ampouleCount * 20;
    close(r.totalNaClGrams, grams, 1e-9, JSON.stringify(c));
    assert.equal(r.finalVolumeMl, volume);
    close(r.finalPercent, (grams / volume) * 100, 1e-9);
    close(r.finalMeqL, percentNaClToMeqL((grams / volume) * 100), 1e-9);
  }
});

test("泡製模式 B 等體積抽換：抽換量使最終濃度恰為目標", () => {
  for (const [base, target, bag] of [[0.9, 3, 500], [0, 3, 500], [0.9, 2, 1000], [0.45, 5, 250]]) {
    const r = calculate3PercentMixing({ mode: "mode_b_isovolumetric", baseFluidPercent: base, bagVolumeMl: bag, targetPercent: target });
    const finalPercent = ((bag - r.exactReplaceMl) * base + r.exactReplaceMl * 10) / bag;
    close(finalPercent, target, 1e-9, `${base}→${target}`);
    close(r.exactAmpoulesNeeded, r.exactReplaceMl / 20, 1e-9);
  }
});

test("泡製輸入防呆：抽出量 ≥ 袋量、負支數、目標濃度超出範圍都拋出 RangeError", () => {
  const a = { mode: "mode_a_ampoules", baseFluidPercent: 0.9, bagVolumeMl: 500, ampouleCount: 6 };
  assert.throws(() => calculate3PercentMixing({ ...a, withdrawMl: 500 }), RangeError);
  assert.throws(() => calculate3PercentMixing({ ...a, withdrawMl: -1 }), RangeError);
  assert.throws(() => calculate3PercentMixing({ ...a, withdrawMl: 100, ampouleCount: -1 }), RangeError);
  assert.throws(() => calculate3PercentMixing({ ...a, bagVolumeMl: 0 }), RangeError);
  assert.throws(() => calculate3PercentMixing({ ...a, ampouleConcPercent: 0.9 }), RangeError);
  const b = { mode: "mode_b_isovolumetric", baseFluidPercent: 0.9, bagVolumeMl: 500 };
  assert.throws(() => calculate3PercentMixing({ ...b, targetPercent: 0.9 }), RangeError);
  assert.throws(() => calculate3PercentMixing({ ...b, targetPercent: 10 }), RangeError);
});

// ───────────────────────── Step 2：滲透壓、高血糖、偽性低血鈉 ─────────────────────────

test("高血糖校正 Na：Katz +1.6、Hillier +2.4 per 100 mg/dL（[KATZ73]、[HILLIER99]），≤ 100 不校正", () => {
  const r = step2({ serumNa: 125, glucoseMgDl: 600 });
  close(r.katzCorrectedNa, 125 + 1.6 * 5, 1e-9);
  close(r.hillierCorrectedNa, 125 + 2.4 * 5, 1e-9);
  const low = step2({ serumNa: 125, glucoseMgDl: 80 });
  assert.equal(low.katzCorrectedNa, 125);
  assert.equal(low.hillierCorrectedNa, 125);
  assert.equal(step2({ serumNa: 125 }).katzCorrectedNa, null);
});

test("計算滲透壓 2Na + Glc/18 + BUN/2.8（+ EtOH/4.6），有效滲透壓不含 BUN／乙醇", () => {
  const r = step2({ serumNa: 120, measuredOsm: 300, glucoseMgDl: 180, bunMgDl: 28, ethanolMgDl: 92 });
  close(r.effectiveOsm, 240 + 10, 1e-9);
  close(r.calculatedOsmNoEthanol, 240 + 10 + 10, 1e-9);
  close(r.calculatedOsmWithEthanol, 260 + 20, 1e-9);
  close(r.osmolalGapNoEthanol, 40, 1e-9);
  close(r.osmolalGapAfterEthanol, 20, 1e-9);
  close(r.ethanolOsmTerm37, 92 / 3.7, 1e-9);
});

test("Step 2 實測滲透壓分界：< 280 低張、280–285 等張、> 285 高張（工具現行切點）", () => {
  const base = { serumNa: 128, glucoseMgDl: 90, bunMgDl: 14 };
  assert.equal(step2({ ...base, measuredOsm: 279.9 }).branchId, "true_hypotonic");
  assert.equal(step2({ ...base, measuredOsm: 280 }).branchId, "isotonic_pseudohyponatremia");
  assert.equal(step2({ ...base, measuredOsm: 285 }).branchId, "isotonic_pseudohyponatremia");
  assert.equal(step2({ ...base, measuredOsm: 285.1 }).branchId, "hypertonic_or_unmeasured_osmoles");
});

test("[ESE2014] §6.2.1.2：實測滲透壓 < 275 一定是低張性低血鈉", () => {
  for (const measuredOsm of [200, 250, 274.9]) {
    const r = step2({ serumNa: 125, measuredOsm, glucoseMgDl: 90, bunMgDl: 14 });
    assert.equal(r.branchId, "true_hypotonic", String(measuredOsm));
    assert.equal(r.proceedToStep3, true);
  }
});

test(
  "[FIG3] 實測滲透壓 280–290 屬偽性低血鈉區間：Na 122 (Indirect ISE)、Osm 288 應歸偽性低血鈉",
  { todo: "工具以 285 為等張上限，288 被歸為 hypertonic_or_unmeasured_osmoles 並導向 Step 3（見 TEST_REPORT.md 不一致 #1）" },
  () => {
    const r = step2({ serumNa: 122, measuredOsm: 288, glucoseMgDl: 90, bunMgDl: 14, iseMethod: "indirect" });
    assert.equal(r.branchId, "isotonic_pseudohyponatremia");
  },
);

test("偽性低血鈉：Indirect ISE 下 Osm 280–285 歸為偽性低血鈉、不進 Step 3；Direct ISE 則視為外源溶質", () => {
  const indirect = step2({ serumNa: 120, measuredOsm: 284, glucoseMgDl: 100, bunMgDl: 10, iseMethod: "indirect" });
  assert.equal(indirect.branchId, "isotonic_pseudohyponatremia");
  assert.equal(indirect.proceedToStep3, false);
  assert.match(indirect.nextAction, /Direct ISE/);
  const direct = step2({ serumNa: 120, measuredOsm: 284, glucoseMgDl: 100, bunMgDl: 10, iseMethod: "direct" });
  assert.equal(direct.branchId, "isotonic_high_gap");
  assert.equal(direct.proceedToStep3, true);
  // 間隙 ≤ 10：Na 134、Osm 282、Glc 90、BUN 14 → gap = 282 − 278 = 4
  const smallGap = step2({ serumNa: 134, measuredOsm: 282, glucoseMgDl: 90, bunMgDl: 14 });
  assert.equal(smallGap.branchId, "isotonic_pseudohyponatremia");
  assert.match(smallGap.branchBadge, /Osm Gap ≤ 10/);
});

test("無效滲透壓物質（BUN、乙醇）：實測 ≥ 280 但有效張力 < 280 仍判真性低張", () => {
  const azotemia = step2({ serumNa: 118, measuredOsm: 295, glucoseMgDl: 90, bunMgDl: 140 });
  assert.equal(azotemia.branchId, "hypotonic_with_ineffective_osmoles");
  const ethanol = step2({ serumNa: 125, measuredOsm: 290, glucoseMgDl: 90, bunMgDl: 14, ethanolMgDl: 184 });
  // 有效 255；計算含乙醇 = 255 + 5 + 40 = 300 → 間隙 < 0
  assert.equal(ethanol.branchId, "hypotonic_with_ineffective_osmoles");
  assert.equal(ethanol.proceedToStep3, true);
  // BUN 恰為 20 不觸發（條件為 BUN > 20）
  const bun20 = step2({ serumNa: 130, measuredOsm: 281, glucoseMgDl: 90, bunMgDl: 20 });
  assert.notEqual(bun20.branchId, "hypotonic_with_ineffective_osmoles");
});

test("Step 2 缺值：未填 Na → missing_na；未填實測 Osm → pending 或高血糖疑似分支", () => {
  for (const serumNa of [null, 0, -1, Number.NaN]) {
    assert.equal(step2({ serumNa }).branchId, "missing_na", String(serumNa));
  }
  const pending = step2({ serumNa: 120, glucoseMgDl: 90 });
  assert.equal(pending.branchId, "pending_measured_osm");
  assert.equal(pending.proceedToStep3, true); // 有效張力 245 < 280
  const hyperglyc = step2({ serumNa: 128, glucoseMgDl: 600 });
  assert.equal(hyperglyc.branchId, "hypertonic_hyperglycemia_suspected");
  assert.equal(hyperglyc.proceedToStep3, false); // Katz 136 ≥ 135
  // 未填 Glucose／BUN：間隙以 0 代入，會偏大（現行行為，見報告）
  const noGlcBun = step2({ serumNa: 122, measuredOsm: 283 });
  close(noGlcBun.osmolalGapNoEthanol, 39, 1e-9);
  assert.equal(noGlcBun.hasFullStandardCalcInputs, false);
});

test("Step 2：Na ≥ 135 不進低血鈉流程（134.9 仍為低血鈉）", () => {
  assert.equal(step2({ serumNa: 135, measuredOsm: 280 }).branchId, "not_hyponatremia");
  assert.equal(step2({ serumNa: 150, measuredOsm: 310 }).branchId, "not_hyponatremia");
  assert.equal(step2({ serumNa: 134.9, measuredOsm: 270 }).branchId, "true_hypotonic");
});

// ───────────────────────── Step 3 & 4：尿液分類 ─────────────────────────

test("[ESE2014] §6.3.1.2：U_Osm ≤ 100 → 相對水攝取過多（Cat 4），100 為分界點且屬 ≤ 100", () => {
  for (const volumeStatus of ["hypovolemic", "euvolemic", "hypervolemic", "equivocal"]) {
    assert.equal(step34({ urineOsm: 100, urineNa: 50, volumeStatus }).primaryCategory.id, "cat4_dilute_urine", volumeStatus);
  }
  assert.equal(step34({ urineOsm: 100.1, urineNa: 50, volumeStatus: "euvolemic" }).primaryCategory.id, "cat3_euvol_adh");
});

test("[ESE2014] §6.3.1.4–6.3.1.5：U_Na ≤ 30 為低尿鈉，> 30 為高尿鈉（30 屬低尿鈉）", () => {
  assert.equal(step34({ urineOsm: 300, urineNa: 30, volumeStatus: "hypovolemic" }).primaryCategory.id, "cat1_hypovol_low_una");
  assert.equal(step34({ urineOsm: 300, urineNa: 30.1, volumeStatus: "hypovolemic" }).primaryCategory.id, "cat2_hypovol_high_una");
  assert.equal(step34({ urineOsm: 300, urineNa: 30, volumeStatus: "hypervolemic" }).primaryCategory.id, "cat5_hypervol_low_una");
  assert.equal(step34({ urineOsm: 300, urineNa: 30.1, volumeStatus: "hypervolemic" }).primaryCategory.id, "cat6_hypervol_high_una");
  // 切點 20 模式：20 屬低、20.1 屬高
  assert.equal(step34({ urineOsm: 300, urineNa: 20, volumeStatus: "hypovolemic", uNaCutoffMode: 20 }).primaryCategory.id, "cat1_hypovol_low_una");
  assert.equal(step34({ urineOsm: 300, urineNa: 20.1, volumeStatus: "hypovolemic", uNaCutoffMode: 20 }).primaryCategory.id, "cat2_hypovol_high_una");
  // 非 20 的切點一律視為 30
  assert.equal(step34({ urineOsm: 300, urineNa: 25, uNaCutoffMode: 25 }).uNaCutoff, 30);
});

test("Step 4 六大分類每個分支（含 equivocal 並列候選）", () => {
  const cases = [
    [{ urineOsm: 60, urineNa: 10, volumeStatus: "euvolemic" }, "cat4_dilute_urine", ["cat4_dilute_urine"]],
    [{ urineOsm: 400, urineNa: 10, volumeStatus: "hypovolemic" }, "cat1_hypovol_low_una", ["cat1_hypovol_low_una"]],
    [{ urineOsm: 400, urineNa: 60, volumeStatus: "hypovolemic" }, "cat2_hypovol_high_una", ["cat2_hypovol_high_una"]],
    [{ urineOsm: 400, urineNa: 60, volumeStatus: "euvolemic" }, "cat3_euvol_adh", ["cat3_euvol_adh"]],
    [{ urineOsm: 400, urineNa: 10, volumeStatus: "hypervolemic" }, "cat5_hypervol_low_una", ["cat5_hypervol_low_una"]],
    [{ urineOsm: 400, urineNa: 60, volumeStatus: "hypervolemic" }, "cat6_hypervol_high_una", ["cat6_hypervol_high_una", "cat5_hypervol_low_una"]],
    [{ urineOsm: 400, urineNa: 10, volumeStatus: "equivocal" }, "cat1_hypovol_low_una", ["cat1_hypovol_low_una", "cat5_hypervol_low_una", "cat3_euvol_adh"]],
    [{ urineOsm: 400, urineNa: 60, volumeStatus: "equivocal" }, "cat3_euvol_adh", ["cat3_euvol_adh", "cat2_hypovol_high_una", "cat6_hypervol_high_una"]],
  ];
  for (const [input, primary, candidates] of cases) {
    const r = step34(input);
    assert.equal(r.primaryCategory.id, primary, JSON.stringify(input));
    assert.deepEqual(r.candidateCategories.map((c) => c.id), candidates, JSON.stringify(input));
  }
  // 低血容高尿鈉合併利尿劑 → 加入 Cat 1 為候選
  const diuretic = step34({ urineOsm: 400, urineNa: 60, volumeStatus: "hypovolemic", confounders: { onDiuretics: true } });
  assert.deepEqual(diuretic.candidateCategories.map((c) => c.id), ["cat2_hypovol_high_una", "cat1_hypovol_low_una"]);
  assert.ok(diuretic.activeFlowNodes.includes("node_diuretics_yes"));
});

test(
  "[ESE2014] §6.3.1.4：U_Na ≤ 30 應先接受『低有效動脈血容積』，即使臨床判斷為正常血容",
  { todo: "工具在 euvolemic + U_Na ≤ 30 時主分類為 Cat 3 (SIADH)，Cat 1 僅列為候選（見 TEST_REPORT.md 不一致 #2）" },
  () => {
    const r = step34({ urineOsm: 400, urineNa: 15, volumeStatus: "euvolemic" });
    assert.ok(["cat1_hypovol_low_una", "cat5_hypervol_low_una"].includes(r.primaryCategory.id));
  },
);

test("Step 3 缺值：無 U_Osm → pending_uosm；有 U_Osm > 100 但無 U_Na → pending_una", () => {
  assert.equal(step34({}).classificationMode, "pending_uosm");
  assert.equal(step34({ urineOsm: 0, urineNa: 40 }).classificationMode, "pending_uosm");
  assert.equal(step34({ urineOsm: Number.NaN }).classificationMode, "pending_uosm");
  const noUna = step34({ urineOsm: 300 });
  assert.equal(noUna.classificationMode, "pending_una");
  assert.equal(noUna.primaryCategory, null);
  // U_Osm ≤ 100 不需 U_Na 即可分類
  assert.equal(step34({ urineOsm: 80 }).primaryCategory.id, "cat4_dilute_urine");
});

test("脫鹽風險：U_Na + U_K > 154（154 本身不算）；U_Osm > 500 為疑似", () => {
  assert.equal(step34({ urineOsm: 400, urineNa: 100, urineK: 54.1, serumNa: 120 }).desalinationRisk, "high_confirmed");
  assert.equal(step34({ urineOsm: 400, urineNa: 100, urineK: 54, serumNa: 120 }).desalinationRisk, "low");
  assert.equal(step34({ urineOsm: 501, urineNa: 100, urineK: 30, serumNa: 120 }).desalinationRisk, "suspected_high_uosm");
  assert.equal(step34({ urineOsm: 500, urineNa: 100, urineK: 30, serumNa: 120 }).desalinationRisk, "low");
  assert.equal(step34({ urineOsm: 600, urineNa: 100 }).desalinationRisk, "suspected_high_uosm");
  assert.equal(step34({ urineOsm: 400, urineNa: 100 }).desalinationRisk, "low_or_unknown");
});

test("Fürst ratio (U_Na+U_K)/S_Na：> 1、0.5–1、< 0.5 三段", () => {
  const ratio = (uNa, uK) => step34({ urineOsm: 400, urineNa: uNa, urineK: uK, serumNa: 120 });
  close(ratio(80, 40).furstRatio, 1, 1e-9);
  assert.match(ratio(80, 40).furstInterpretation, /0\.5–1\.0/); // 恰為 1.0 屬中段
  assert.match(ratio(81, 40).furstInterpretation, /> 1\.0/);
  assert.match(ratio(40, 20).furstInterpretation, /0\.5–1\.0/); // 恰為 0.5
  assert.match(ratio(39, 20).furstInterpretation, /< 0\.5/);
  assert.equal(step34({ urineOsm: 400, urineNa: 40, urineK: 20 }).furstRatio, null); // 無 S_Na
});

// ───────────────────────── FE_Urea／FE_UA 與單位換算 ─────────────────────────

test("FE_Urea 公式與三種單位模式（mg/dL）：Urine Urea ÷ 2.14 = UUN", () => {
  const fe = (feInputs) => step34({ urineOsm: 400, urineNa: 40, volumeStatus: "hypovolemic", feInputs }).feUrea;
  // BUN 20、UUN 300、SCr 1.2、UCr 90 → (300×1.2)/(20×90)×100 = 20%
  close(fe({ serumCr: 1.2, urineCr: 90, serumUrea: 20, urineUrea: 300, ureaUnitMode: "same_nitrogen" }), 20, 1e-9);
  // 同一檢體尿液以 Urea mg/dL 報告：300 × 2.14 = 642 → 換算後同為 20%
  close(fe({ serumCr: 1.2, urineCr: 90, serumUrea: 20, urineUrea: 642, ureaUnitMode: "bun_and_urine_urea" }), 20, 1e-9);
  // 血尿皆為 Urea mg/dL（BUN × 2.14）→ 比值不變
  close(fe({ serumCr: 1.2, urineCr: 90, serumUrea: 42.8, urineUrea: 642, ureaUnitMode: "same_urea" }), 20, 1e-9);
  // 未指定模式預設 same_nitrogen
  close(fe({ serumCr: 1.2, urineCr: 90, serumUrea: 20, urineUrea: 300 }), 20, 1e-9);
});

test("尿素／尿素氮換算係數 2.14 = 尿素分子量 60.06 ÷ 2 個氮 28.014（誤差 < 0.2%）", () => {
  close(60.06 / 28.014, 2.14, 0.005);
});

test("FE_Urea 與 FE_UA 為無因次比值：血尿同單位時 mmol/L 與 mg/dL 結果相同", () => {
  // BUN 20 mg/dL = Urea 7.14 mmol/L（÷ 2.8）；UUN 300 mg/dL = 107.1 mmol/L；SCr 1.2 mg/dL = 106.08 μmol/L；UCr 90 mg/dL = 7956 μmol/L
  const mgdl = step34({ urineOsm: 400, urineNa: 40, feInputs: { serumCr: 1.2, urineCr: 90, serumUrea: 20, urineUrea: 300, serumUa: 3, urineUa: 40 } });
  const si = step34({
    urineOsm: 400,
    urineNa: 40,
    feInputs: {
      serumCr: 1.2 * 88.4,
      urineCr: 90 * 88.4,
      serumUrea: 20 / 2.8,
      urineUrea: 300 / 2.8,
      ureaUnitMode: "same_urea",
      serumUa: 3 * 59.48,
      urineUa: 40 * 59.48,
    },
  });
  close(si.feUrea, mgdl.feUrea, 1e-9);
  close(si.feUa, mgdl.feUa, 1e-9);
});

test("FE_Urea 判讀分段：< 35、35–55、> 55（[ESE2014] Table 6）；FE_UA：< 4、4–12、> 12（[FENSKE08] 12%）", () => {
  const fe = (urineUrea) => step34({ urineOsm: 400, urineNa: 40, feInputs: { serumCr: 1, urineCr: 100, serumUrea: 10, urineUrea } });
  assert.match(fe(349).feUreaInterpretation, /< 35%/);
  assert.match(fe(350).feUreaInterpretation, /35–55%/);
  assert.match(fe(540).feUreaInterpretation, /35–55%/);
  assert.match(fe(551).feUreaInterpretation, /> 55%/);
  // 恰為 55%（urineUrea 550）浮點運算得 55.00000000000001，故不測精確邊界
  const ua = (urineUa) => step34({ urineOsm: 400, urineNa: 40, feInputs: { serumCr: 1, urineCr: 100, serumUa: 1, urineUa } });
  assert.match(ua(3.9).feUaInterpretation, /< 4%/);
  assert.match(ua(12).feUaInterpretation, /4–12%/);
  assert.match(ua(12.1).feUaInterpretation, /> 12%/);
});

test("FE 缺值：任一必要值缺漏、為 0 或 NaN 就不計算", () => {
  const full = { serumCr: 1, urineCr: 100, serumUrea: 10, urineUrea: 300 };
  for (const key of Object.keys(full)) {
    const r = step34({ urineOsm: 400, urineNa: 40, feInputs: { ...full, [key]: null } });
    assert.equal(r.feUrea, null, key);
  }
  assert.equal(step34({ urineOsm: 400, feInputs: { ...full, serumCr: 0 } }).feUrea, null);
  assert.equal(step34({ urineOsm: 400, feInputs: { ...full, urineCr: Number.NaN } }).feUrea, null);
  // 尿液尿素 0 合法 → FE 0%
  assert.equal(step34({ urineOsm: 400, feInputs: { ...full, urineUrea: 0 } }).feUrea, 0);
});

test.todo("FENa（鈉排泄分率）尚未實作：na.js 沒有 FENa 計算，無法測試 mg/dL／mmol/L 換算（見 TEST_REPORT.md）");
test.todo("FE_Urea 的 mmol/L 輸入：畫面只提供 mg/dL；Step 2 BUN（mg/dL）會直接帶入血中尿素，無 mmol/L 換算（見 TEST_REPORT.md）");

// ───────────────────────── 輸入解析 ─────────────────────────

test("parseOptionalNumber：逗號、單位文字等非數字輸入回傳 NaN，不會被當成 0", () => {
  assert.ok(Number.isNaN(parseOptionalNumber("1,000")));
  assert.ok(Number.isNaN(parseOptionalNumber("120 mEq/L")));
  assert.equal(parseOptionalNumber(" 120 "), 120);
  assert.equal(parseOptionalNumber("-6"), -6);
  assert.ok(Number.isNaN(parseOptionalNumber({})));
  assert.ok(Number.isNaN(parseOptionalNumber(true)));
});
