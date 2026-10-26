/**
 * na.js — 低血鈉 (Hyponatremia) 臨床快速分類診斷、安全矯正目標、3% NaCl 調配與速率計算核心引擎
 * 適用族群：成人急診與住院患者（Adult ED / Inpatient）
 * 資料最後校對：2026-10-25
 */

export const MOLAR_MASS_NACL = 58.44; // g/mol

/**
 * 將百分比 NaCl 轉換為精確 mEq/L (或採用臨床慣用標示值)
 * 純 NaCl 計算：1% = 10 g/L = 10000 / 58.44 = 171.1157 mEq/L
 * 0.9% = 154.0 mEq/L, 2% = 342.2 mEq/L, 3% = 513.3 mEq/L, 5% = 855.6 mEq/L, 10% = 1711.2 mEq/L
 */
export function percentNaClToMeqL(percent) {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new RangeError("percent must be a non-negative finite number");
  }
  return (percent * 10000) / MOLAR_MASS_NACL;
}

/**
 * 嚴格區分「未填寫 (null/undefined/"")」與「數值 0」
 * 若為空白回傳 null；若為非數值或無限大回傳 NaN
 */
export function parseOptionalNumber(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    return Number.isFinite(raw) ? raw : Number.NaN;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : Number.NaN;
  }
  return Number.NaN;
}

/**
 * 具名 3% NaCl 急症 Bolus 方案（不混拼不同指引之劑量與間隔）
 */
export const BOLUS_REGIMENS = {
  ese_2014: {
    id: "ese_2014",
    name: "歐洲指引方案 (ESE 2014)",
    citation: "Spasovski et al., Eur J Endocrinol 2014",
    severe: {
      title: "嚴重症狀：3% NaCl 150 mL IV Bolus over 20 min",
      bolusType: "fixed_or_weight",
      fixedVolumeMl: 150,
      weightBasedMlPerKg: 2,
      infusionMinutes: 20,
      repeatRule:
        "第 1 次 150 mL 輸注完後立即抽血測 Na，並在等待報告期間直接給予第 2 次 150 mL（20 min）；若症狀仍未改善可重複，直至血鈉上升達 5 mmol/L。",
      stopRule:
        "① 症狀改善，或 ② 血鈉首小時已上升達 5 mmol/L（轉為 0.9% NaCl 維持靜脈管路並找病因），或 ③ 總上升達 10 mmol/L 仍無改善（須立即尋找其他腦病變／意識障礙原因）。",
      recheckRule: "每次 Bolus 後立即複查 Na，之後於第 1、6、12、24 小時密集追蹤。",
    },
    moderate: {
      title: "中度嚴重症狀：3% NaCl 單次 150 mL IV Bolus over 20 min",
      bolusType: "fixed_or_weight",
      fixedVolumeMl: 150,
      weightBasedMlPerKg: 2,
      infusionMinutes: 20,
      repeatRule: "單次 150 mL（或 2 mL/kg）輸注 20 分鐘；目標 24 小時上升 5 mmol/L。",
      stopRule: "第 1、6、12 小時複查血鈉；首 24h 上限 10 mmol/L、其後每 24h 上限 8 mmol/L。",
      recheckRule: "於第 1、6、12、24 小時複查血鈉並監測尿量。",
    },
  },
  us_2013: {
    id: "us_2013",
    name: "美國專家共識／AAFP 方案 (US 2013 / AAFP 2015)",
    citation: "Verbalis et al., Am J Med 2013; Braun et al., AAFP 2015",
    severe: {
      title: "嚴重症狀：3% NaCl 100 mL IV Bolus over 10 min（最多重複 3 次）",
      bolusType: "fixed",
      fixedVolumeMl: 100,
      weightBasedMlPerKg: null,
      infusionMinutes: 10,
      repeatRule:
        "若急性嚴重神經學症狀（抽搐、昏迷、腦疝脫徵象）持續，每 10 分鐘可再給 100 mL 3% NaCl，最多共 3 次（總量上限 300 mL）。",
      stopRule:
        "① 嚴重症狀緩解，或 ② 血鈉已快速拉升 4–6 mEq/L，或 ③ 已給滿 3 次 100 mL Bolus。",
      recheckRule: "Bolus 後立即複查血鈉，活躍期每 2 小時（q2h）追蹤血鈉與每小時尿量。",
    },
    moderate: {
      title: "中度嚴重症狀：3% NaCl 100 mL Bolus 或 0.5–2 mL/kg/h 連續輸注",
      bolusType: "fixed",
      fixedVolumeMl: 100,
      weightBasedMlPerKg: null,
      infusionMinutes: 20,
      repeatRule: "可給予單次 100 mL Bolus 或以 0.5–2 mL/kg/h 緩慢滴注並每 2–4h 監測。",
      stopRule: "症狀改善或已達當日目標升幅（一般慢性 6–8、高 ODS 風險 4–6 mEq/L/24h）。",
      recheckRule: "每 2–4 小時複查血鈉與尿量。",
    },
  },
  salsa_2021: {
    id: "salsa_2021",
    name: "SALSA 體重導向快速間歇性 Bolus 方案 (JAMA Intern Med 2021)",
    citation: "Baek et al., JAMA Intern Med 2021 (SALSA Trial)",
    severe: {
      title: "嚴重症狀：3% NaCl 2 mL/kg IV Bolus over 20 min",
      bolusType: "weight",
      fixedVolumeMl: null,
      weightBasedMlPerKg: 2,
      infusionMinutes: 20,
      repeatRule:
        "依體重給予 2 mL/kg 輸注 20 分鐘；每 1–6 小時評估，若症狀持續或血鈉未達首 6h 目標（上升 5–9 mEq/L）可重複給予 2 mL/kg。",
      stopRule:
        "症狀緩解且血鈉已上升 5–9 mEq/L；注意若發生過度矯正，SALSA 方案即刻啟動 D5W 10 mL/kg + Desmopressin 2 μg 降鈉救援。",
      recheckRule: "第 1、6、12、18、24、48 小時複查血鈉並監測尿量。",
    },
    moderate: {
      title: "中度嚴重症狀：3% NaCl 2 mL/kg IV Bolus over 20 min",
      bolusType: "weight",
      fixedVolumeMl: null,
      weightBasedMlPerKg: 2,
      infusionMinutes: 20,
      repeatRule:
        "起始給予單次 2 mL/kg 3% NaCl 輸注 20 分鐘；每 6 小時複查血鈉，僅於症狀未改善或血鈉上升不足時重複 2 mL/kg。",
      stopRule: "血鈉上升達目標或症狀改善即停止追加 Bolus。",
      recheckRule: "第 1、6、12、18、24、48 小時複查血鈉。",
    },
  },
};

/**
 * 標準點滴資料庫（修正 2% NaCl 精確值 342.2 mEq/L 與 LR 內含 K 4 mEq/L 共 134 mEq/L）
 */
export const INFUSATES = [
  {
    key: "hypertonic_5",
    label: "5% NaCl (高張鹽水)",
    shortLabel: "5% NaCl",
    naMeqL: 855.6,
    intrinsicKMeqL: 0,
    effectiveMeqL: 855.6,
    mdcalcListedMeqL: 856,
    note: "極高張鹽水（855.6 mEq/L），需中央靜脈管路或嚴密監測",
  },
  {
    key: "hypertonic_3",
    label: "3% NaCl (標準高張鹽水)",
    shortLabel: "3% NaCl",
    naMeqL: 513.3,
    intrinsicKMeqL: 0,
    effectiveMeqL: 513.3,
    mdcalcListedMeqL: 513,
    note: "急診治療嚴重症狀與高張輸注首選（513.3 mEq/L）",
  },
  {
    key: "custom_mix",
    label: "床邊泡製高張鹽水 (由下方泡製計算機回代)",
    shortLabel: "自訂泡製液",
    naMeqL: 513.3,
    intrinsicKMeqL: 0,
    effectiveMeqL: 513.3,
    mdcalcListedMeqL: null,
    note: "自動帶入下方床邊泡製計算機算出的實際濃度（mEq/L）",
  },
  {
    key: "hypertonic_2",
    label: "2% NaCl (342.2 mEq/L；MDCalc 標 341)",
    shortLabel: "2% NaCl",
    naMeqL: 342.2,
    intrinsicKMeqL: 0,
    effectiveMeqL: 342.2,
    mdcalcListedMeqL: 341,
    note: "純 NaCl 分子量 58.44 換算為 342.2 mEq/L（MDCalc 頁面近似標為 341）",
  },
  {
    key: "ns_09",
    label: "0.9% NaCl (Normal Saline 生理食鹽水)",
    shortLabel: "0.9% NaCl",
    naMeqL: 154,
    intrinsicKMeqL: 0,
    effectiveMeqL: 154,
    mdcalcListedMeqL: 154,
    note: "低血容補液首選；但 SIADH 若 UNa+UK > 154 會發生脫鹽惡化 (Desalination)",
  },
  {
    key: "lr_134",
    label: "Lactated Ringer's (含內建 K 4：Na+K = 134 mEq/L)",
    shortLabel: "LR (Na+K 134)",
    naMeqL: 130,
    intrinsicKMeqL: 4,
    effectiveMeqL: 134,
    mdcalcListedMeqL: 130,
    note: "依 Adrogué-Madias (Na+K) 模型，LR 含 Na 130 + K 4 = 134 mEq/L",
  },
  {
    key: "lr_130",
    label: "Lactated Ringer's (僅計 Na 130 mEq/L，對照 MDCalc)",
    shortLabel: "LR (僅計 Na 130)",
    naMeqL: 130,
    intrinsicKMeqL: 0,
    effectiveMeqL: 130,
    mdcalcListedMeqL: 130,
    note: "僅計入 Na 130 mEq/L（供與 MDCalc #480 單純對照）",
  },
  {
    key: "half_ns_045",
    label: "0.45% NaCl (Half Saline 半張鹽水)",
    shortLabel: "0.45% NaCl",
    naMeqL: 77,
    intrinsicKMeqL: 0,
    effectiveMeqL: 77,
    mdcalcListedMeqL: 77,
    note: "低張液（77 mEq/L），一般低血鈉輸注會使血鈉下降",
  },
  {
    key: "quarter_ns_02",
    label: "0.2% NaCl (Quarter Saline 四分之一張鹽水)",
    shortLabel: "0.2% NaCl",
    naMeqL: 34.2,
    intrinsicKMeqL: 0,
    effectiveMeqL: 34.2,
    mdcalcListedMeqL: 34,
    note: "低張液（34.2 mEq/L），輸注會降低血鈉",
  },
  {
    key: "d5w",
    label: "5% Dextrose in Water (D5W 自由水，0 mEq/L)",
    shortLabel: "D5W (0 mEq/L)",
    naMeqL: 0,
    intrinsicKMeqL: 0,
    effectiveMeqL: 0,
    mdcalcListedMeqL: 0,
    note: "無電解質自由水（0 mEq/L），用於高血鈉或低血鈉過度矯正之降鈉救援",
  },
];

/**
 * 計算總體液量 TBW (L)
 * - fraction: MDCalc #480 / Adrogué-Madias 體重比例法 (男 <65: 0.6, 男 ≥65 或 女 <65: 0.5, 女 ≥65: 0.45)
 * - watson: Watson (1980) 經驗公式 (本工具擴充選項，需填寫身高 heightCm)
 */
export function calculateTbw({
  weightKg,
  sex = "male",
  ageYears = 50,
  heightCm = null,
  method = "fraction",
}) {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return {
      tbwL: null,
      methodUsed: null,
      factor: null,
      usedFallback: false,
      fallbackReason: null,
      description: "請輸入有效體重 (kg)",
    };
  }

  const isElderly = Number.isFinite(ageYears) && ageYears >= 65;
  const isFemale = sex === "female";

  let fractionFactor = 0.6;
  if (isFemale && isElderly) {
    fractionFactor = 0.45;
  } else if (isFemale || isElderly) {
    fractionFactor = 0.5;
  }
  const fractionTbw = weightKg * fractionFactor;

  if (method === "watson") {
    const validHeight = Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 250;
    const validAge = Number.isFinite(ageYears) && ageYears >= 18 && ageYears <= 120;
    if (!validHeight || (!isFemale && !validAge)) {
      return {
        tbwL: fractionTbw,
        fractionTbwL: fractionTbw,
        watsonTbwL: null,
        methodUsed: "fraction",
        factor: fractionFactor,
        usedFallback: true,
        fallbackReason:
          "Watson (1980) 公式需要有效成人身高 (100–250 cm) 與年齡；因未填寫或超出範圍，已自動切換為 MDCalc #480 體重係數法。",
        description: `MDCalc #480 體重係數法 (${fractionFactor} × ${weightKg} kg = ${fractionTbw.toFixed(1)} L)`,
      };
    }

    const watsonTbw = isFemale
      ? -2.097 + 0.1069 * heightCm + 0.2466 * weightKg
      : 2.447 - 0.09516 * ageYears + 0.1074 * heightCm + 0.3362 * weightKg;

    if (watsonTbw <= 5) {
      return {
        tbwL: fractionTbw,
        fractionTbwL: fractionTbw,
        watsonTbwL: null,
        methodUsed: "fraction",
        factor: fractionFactor,
        usedFallback: true,
        fallbackReason: "Watson 計算結果異常，已自動切換為體重係數法。",
        description: `MDCalc #480 體重係數法 (${fractionTbw.toFixed(1)} L)`,
      };
    }

    return {
      tbwL: watsonTbw,
      fractionTbwL: fractionTbw,
      watsonTbwL: watsonTbw,
      methodUsed: "watson",
      factor: watsonTbw / weightKg,
      usedFallback: false,
      fallbackReason: null,
      description: `Watson (1980) 身高體重公式 (${watsonTbw.toFixed(1)} L；對照體重係數法為 ${fractionTbw.toFixed(1)} L)`,
    };
  }

  // Also compute Watson if height is available for reference
  let watsonRef = null;
  if (Number.isFinite(heightCm) && heightCm >= 100 && heightCm <= 250 && Number.isFinite(ageYears) && ageYears >= 18) {
    const w = isFemale
      ? -2.097 + 0.1069 * heightCm + 0.2466 * weightKg
      : 2.447 - 0.09516 * ageYears + 0.1074 * heightCm + 0.3362 * weightKg;
    if (w > 5) watsonRef = w;
  }

  return {
    tbwL: fractionTbw,
    fractionTbwL: fractionTbw,
    watsonTbwL: watsonRef,
    methodUsed: "fraction",
    factor: fractionFactor,
    usedFallback: false,
    fallbackReason: null,
    description: `MDCalc #480 體重係數法 (${fractionFactor} × ${weightKg} kg = ${fractionTbw.toFixed(1)} L)`,
  };
}

/**
 * 有限體積混合模型計算單次 Bolus 對血鈉之影響
 * 公式：ΔNa = [V_L × (C_infusate - S_Na)] / (TBW + V_L)
 * 對照每公升線性近似：V_L × (C_infusate - S_Na) / (TBW + 1)
 */
export function calculateFiniteBolusDeltaNa({
  tbwL,
  serumNa,
  bolusMl,
  infusateNaPlusK = 513.3,
}) {
  if (
    !Number.isFinite(tbwL) ||
    tbwL <= 0 ||
    !Number.isFinite(serumNa) ||
    serumNa <= 0 ||
    !Number.isFinite(bolusMl) ||
    bolusMl <= 0 ||
    !Number.isFinite(infusateNaPlusK)
  ) {
    return null;
  }
  const volumeL = bolusMl / 1000;
  const deltaNaFinite = (volumeL * (infusateNaPlusK - serumNa)) / (tbwL + volumeL);
  const deltaNaPer1L = (infusateNaPlusK - serumNa) / (tbwL + 1);
  const linearApprox = volumeL * deltaNaPer1L;

  return {
    bolusMl,
    volumeL,
    infusateNaPlusK,
    deltaNaFinite,
    deltaNaPer1L,
    linearApprox,
  };
}

/**
 * Step 1：急症分流、症狀分級、具名 3% NaCl Bolus 方案與 24h/48h 累計矯正預算
 */
export function evaluateStep1Triage({
  serumNa = null,
  symptomSeverity = "mild_none", // 'severe' | 'moderate' | 'mild_none'
  severeSymptomsList = [],
  moderateSymptomsList = [],
  onset = "chronic_or_unknown", // 'acute_lt_48h' | 'chronic_or_unknown'
  regimenKey = "ese_2014", // 'ese_2014' | 'us_2013' | 'salsa_2021'
  limitGuideline = "us_cjasn", // 'us_cjasn' | 'ese_2014'
  weightKg = null,
  tbwL = null,
  serumK = null,
  majorOdsFlags = {}, // { alcoholism, malnutrition, liverDisease, naLe105, hypokalemia }
  secondaryOdsFlags = {}, // { olderFemaleThiazide, lowSolutePolydipsia }
  initialNa24h = null,
  priorRise24hInput = null,
  elapsedHours24h = null,
  includePlannedBolusInQuota = false,
  customBolusConcMeqL = 513.3,
}) {
  // 1. 決定實際症狀等級（若勾選了任何嚴重症狀，自動升級為 severe；勾選中度症狀升為 moderate）
  let effectiveSeverity = symptomSeverity;
  if (Array.isArray(severeSymptomsList) && severeSymptomsList.length > 0) {
    effectiveSeverity = "severe";
  } else if (
    effectiveSeverity === "mild_none" &&
    Array.isArray(moderateSymptomsList) &&
    moderateSymptomsList.length > 0
  ) {
    effectiveSeverity = "moderate";
  }

  const regimen = BOLUS_REGIMENS[regimenKey] || BOLUS_REGIMENS.ese_2014;
  const isEmergencyBolusIndicated =
    effectiveSeverity === "severe" || effectiveSeverity === "moderate";

  // 2. 計算 100 mL、150 mL、300 mL (2x150 / 3x100)、2 mL/kg Bolus 體積與預期升幅（皆使用有限體積公式）
  const bolus100 = calculateFiniteBolusDeltaNa({
    tbwL,
    serumNa,
    bolusMl: 100,
    infusateNaPlusK: customBolusConcMeqL,
  });
  const bolus150 = calculateFiniteBolusDeltaNa({
    tbwL,
    serumNa,
    bolusMl: 150,
    infusateNaPlusK: customBolusConcMeqL,
  });
  const bolus300 = calculateFiniteBolusDeltaNa({
    tbwL,
    serumNa,
    bolusMl: 300,
    infusateNaPlusK: customBolusConcMeqL,
  });
  const weightBolusMl =
    Number.isFinite(weightKg) && weightKg > 0 ? Math.round(weightKg * 2) : null;
  const bolus2MlKg = weightBolusMl
    ? calculateFiniteBolusDeltaNa({
        tbwL,
        serumNa,
        bolusMl: weightBolusMl,
        infusateNaPlusK: customBolusConcMeqL,
      })
    : null;

  let activeRegimenBolus = null;
  if (regimen.id === "us_2013") {
    activeRegimenBolus = bolus100;
  } else if (regimen.id === "salsa_2021") {
    activeRegimenBolus = bolus2MlKg || bolus150;
  } else {
    activeRegimenBolus = bolus150;
  }

  // 3. 判定主要確診 ODS 風險因子 vs 次要修飾因子
  const activeMajorOdsReasons = [];
  if ((Number.isFinite(serumNa) && serumNa <= 105) || majorOdsFlags.naLe105) {
    activeMajorOdsReasons.push("Serum Na ≤ 105 mEq/L");
  }
  if ((Number.isFinite(serumK) && serumK < 3.5) || majorOdsFlags.hypokalemia) {
    activeMajorOdsReasons.push("低血鉀 (K < 3.5 mEq/L；注意補鉀亦會提升血鈉)");
  }
  if (majorOdsFlags.alcoholism) {
    activeMajorOdsReasons.push("慢性酒精使用疾患 (Alcoholism)");
  }
  if (majorOdsFlags.malnutrition) {
    activeMajorOdsReasons.push("營養不良／惡病質 (Malnutrition)");
  }
  if (majorOdsFlags.liverDisease) {
    activeMajorOdsReasons.push("晚期肝病／肝硬化 (Advanced liver disease)");
  }

  const activeSecondaryOdsReasons = [];
  if (secondaryOdsFlags.olderFemaleThiazide) {
    activeSecondaryOdsReasons.push("老年女性／Thiazide 相關低血鈉（易快速水利尿）");
  }
  if (secondaryOdsFlags.lowSolutePolydipsia) {
    activeSecondaryOdsReasons.push("低溶質攝取／原發性多飲（給水或溶質後極易自發性水利尿過矯）");
  }

  const hasMajorOdsRisk = activeMajorOdsReasons.length > 0;
  const hasSecondaryOdsRisk = activeSecondaryOdsReasons.length > 0;

  const onsetNote =
    onset === "acute_lt_48h"
      ? "⏱️ 已標記為「明確急性發作 (< 48h，如術後無張力輸液、馬拉松／MDMA 急性水中毒)」：急性腦水腫為主要致死威脅，有症狀時應立即給予 3% NaCl Bolus 快速拉升 4–6 mEq/L 緩解腦水腫。惟若發作時間有任何不確定，或合併上述主要 ODS 風險因子，仍須嚴格遵守下方 24h 安全上限（ESE 2014 對急慢性均採 ≤ 10 mmol/L/24h 上限）。"
      : "⏱️ 慢性 (≥ 48h) 或發作時間不明（預設安全模式）：腦細胞已完成有機滲透壓物質排出之代償，過快升鈉將引發滲透壓去髓鞘症候群 (ODS)，必須嚴格控管 24h / 48h 升鈉上限。";

  const isHyponatremia = Number.isFinite(serumNa) ? serumNa < 135 : null;
  const nonHyponatremiaNote =
    isHyponatremia === false
      ? serumNa > 145
        ? `ℹ️ 目前輸入實測血鈉為 ${serumNa} mEq/L (> 145 mEq/L)，屬於「高血鈉 (Hypernatremia)」而非低血鈉。若欲使用 Step 5B Adrogué-Madias 計算低張液降鈉速率，請將目標變化量設為負值（如 −6 mEq/L）。`
        : `ℹ️ 目前輸入實測血鈉為 ${serumNa} mEq/L (135–145 mEq/L)，屬於正常血鈉範圍（非低血鈉 < 135 mEq/L）。`
      : null;

  // 4. 明確數值化目標 (Target)、警示門檻 (Warning) 與絕對上限 (Hard Ceiling)
  let limits;
  if (hasMajorOdsRisk) {
    limits = {
      profileId: "high_ods_risk",
      profileName: "高 ODS 風險方案 (US Expert Panel 2013 / CJASN 2024)",
      targetMin24h: 4,
      targetMax24h: 6,
      recommendedTarget24h: 5,
      warning24h: 6,
      hardLimit24h: 8,
      hardLimitSecond24h: 8,
      hardLimit48h: 16,
      rationale:
        "具備主要 ODS 風險因子：24h 目標升幅為 4–6 mEq/L（建議目標 5 mEq/L），達 6 mEq/L 即觸發減速警示，任何 24 小時絕對上限為 8 mEq/L。",
    };
  } else if (limitGuideline === "ese_2014") {
    limits = {
      profileId: "ese_standard",
      profileName: "歐洲指引標準方案 (ESE 2014)",
      targetMin24h: 5,
      targetMax24h: 8,
      recommendedTarget24h: 6,
      warning24h: 8,
      hardLimit24h: 10,
      hardLimitSecond24h: 8,
      hardLimit48h: 18,
      rationale:
        "一般慢性或發作時間不明之低血鈉（ESE 2014）：首 24h 絕對上限 10 mmol/L，其後每 24h 上限 8 mmol/L（48h 總上限 18 mmol/L）；臨床日常目標建議設於 5–8 mmol/L 以留出安全緩衝。",
    };
  } else {
    limits = {
      profileId: "us_standard",
      profileName: "美國／國際標準慢性方案 (US 2013 / AAFP 2015)",
      targetMin24h: 6,
      targetMax24h: 8,
      recommendedTarget24h: 6,
      warning24h: 8,
      hardLimit24h: 10,
      hardLimitSecond24h: 8,
      hardLimit48h: 18,
      rationale:
        "一般慢性或發作時間不明之低血鈉：24h 建議目標 6–8 mEq/L（達 8 mEq/L 觸發警示），首 24h 絕對上限 10 mEq/L，48h 總上限 18 mEq/L。",
    };
  }

  // 5. 計算過去 24h 已發生之升幅 (Prior 24h Rise) 與剩餘安全配額
  let priorRise24h = 0;
  let priorRiseSource = "none";
  if (Number.isFinite(priorRise24hInput) && priorRise24hInput >= 0) {
    priorRise24h = priorRise24hInput;
    priorRiseSource = "direct_input";
  } else if (
    Number.isFinite(initialNa24h) &&
    Number.isFinite(serumNa) &&
    initialNa24h > 0
  ) {
    priorRise24h = Math.max(0, serumNa - initialNa24h);
    priorRiseSource = "from_initial_na";
  }

  const plannedBolusRise =
    includePlannedBolusInQuota &&
    isEmergencyBolusIndicated &&
    activeRegimenBolus &&
    activeRegimenBolus.deltaNaFinite > 0
      ? activeRegimenBolus.deltaNaFinite
      : 0;

  const committedRise24h = priorRise24h + plannedBolusRise;

  const remainingRecommendedTarget24h = Math.max(
    0,
    limits.recommendedTarget24h - committedRise24h,
  );
  const remainingTargetMax24h = Math.max(0, limits.targetMax24h - committedRise24h);
  const remainingWarning24h = Math.max(0, limits.warning24h - committedRise24h);
  const remainingHardLimit24h = Math.max(0, limits.hardLimit24h - committedRise24h);

  const validElapsedHours =
    Number.isFinite(elapsedHours24h) && elapsedHours24h > 0 && elapsedHours24h < 24
      ? elapsedHours24h
      : 0;
  const remainingWindowHours = Math.max(1, 24 - validElapsedHours);

  let overcorrectionStatus = "within_budget";
  let overcorrectionAlert = null;
  if (priorRise24h > limits.hardLimit24h) {
    overcorrectionStatus = "exceeded_hard_limit";
    overcorrectionAlert = `🚨 24h 累計已上升 ${priorRise24h.toFixed(1)} mEq/L，已超過絕對安全上限 (${limits.hardLimit24h} mEq/L)！請立即停止所有升鈉輸液，並使用 Step 5 過度矯正救援（D5W + Desmopressin）重新降回安全範圍。`;
  } else if (committedRise24h >= limits.hardLimit24h) {
    overcorrectionStatus = "reached_hard_limit";
    overcorrectionAlert = `⚠️ 計入先前升幅與本波 Bolus 後已達 ${committedRise24h.toFixed(1)} mEq/L（觸及 24h 上限 ${limits.hardLimit24h} mEq/L）。本 24 小時內不應再追加主動升鈉！`;
  } else if (committedRise24h >= limits.warning24h) {
    overcorrectionStatus = "reached_warning_or_target";
    overcorrectionAlert = `⚠️ 24h 累計升幅已達 ${committedRise24h.toFixed(1)} mEq/L（已達目標／警示門檻 ${limits.warning24h} mEq/L）。建議暫停主動高張鹽水輸注，改為嚴密監測尿量與 q2–4h 血鈉，防止自發性水利尿造成超標。`;
  }

  // 建議剩餘時間之平均小時升幅（絕不在已升 4–6 後還照 0.25–0.33 mEq/L/h 跑滿 24h）
  const suggestedHourlyRateMeqL =
    remainingRecommendedTarget24h > 0
      ? remainingRecommendedTarget24h / remainingWindowHours
      : 0;

  return {
    serumNa,
    isHyponatremia,
    nonHyponatremiaNote,
    effectiveSeverity,
    isEmergencyBolusIndicated,
    onset,
    onsetNote,
    regimen,
    activeStepProtocol:
      effectiveSeverity === "severe"
        ? regimen.severe
        : effectiveSeverity === "moderate"
          ? regimen.moderate
          : null,
    bolus100,
    bolus150,
    bolus300,
    bolus2MlKg,
    activeRegimenBolus,
    hasMajorOdsRisk,
    hasSecondaryOdsRisk,
    activeMajorOdsReasons,
    activeSecondaryOdsReasons,
    limits,
    priorRise24h,
    priorRiseSource,
    plannedBolusRise,
    committedRise24h,
    remainingRecommendedTarget24h,
    remainingTargetMax24h,
    remainingWarning24h,
    remainingHardLimit24h,
    remainingWindowHours,
    suggestedHourlyRateMeqL,
    overcorrectionStatus,
    overcorrectionAlert,
  };
}

/**
 * Step 2：確認真性低張性低血鈉、有效張力 (Effective Tonicity)、高血糖校正血鈉與滲透壓間隙 (Osmolal Gap)
 * 修正重點：
 * - 嚴格區分「實測血鈉 (用於計算滲透壓)」與「Katz/Hillier 高血糖校正血鈉」
 * - 區分「總滲透壓 (含無效滲透壓物質 BUN/Ethanol)」與「有效滲透壓/張力 (Effective Osm = 2×Na + Glc/18)」
 * - 當 Measured Osm ≥ 280 (甚至 > 285)，但 Effective Osm < 280 且是由高 BUN 或 Ethanol 造成時，
 *   正確歸類為「真性低張性低血鈉合併無效滲透壓物質 (Azotemia / Ethanol)」，並導引進入 Step 3！
 * - 當 Measured Osm 280–285 且使用 Indirect ISE 時，假性低血鈉因實測 Na 被低估，連帶使 Calculated Osm 被低估，
 *   算術上必然產生視同 Osmolal Gap > 10，故須同時提示假性低血鈉 (改測 Direct ISE) 與外源溶質！
 */
export function evaluateStep2Osmolality({
  serumNa = null,
  measuredOsm = null,
  glucoseMgDl = null,
  bunMgDl = null,
  ethanolMgDl = null,
  iseMethod = "indirect", // 'indirect' | 'direct'
}) {
  if (!Number.isFinite(serumNa) || serumNa <= 0) {
    return {
      isValid: false,
      branchId: "missing_na",
      title: "請先輸入實測血鈉 (Serum Na)",
    };
  }

  // 1. 高血糖校正血鈉 (MDCalc #50: Katz 1973 & Hillier 1999) — 僅於 Glucose > 100 時校正
  let katzCorrectedNa = null;
  let hillierCorrectedNa = null;
  const hasGlucose = Number.isFinite(glucoseMgDl) && glucoseMgDl >= 0;
  if (hasGlucose) {
    const deltaGlc = Math.max(0, glucoseMgDl - 100);
    katzCorrectedNa = serumNa + 0.016 * deltaGlc;
    hillierCorrectedNa = serumNa + 0.024 * deltaGlc;
  }

  // 2. 有效滲透壓 / 張力 (Effective Osmolality / Tonicity = 2 × Na_measured + Glucose / 18)
  const glucoseOsmTerm = hasGlucose ? glucoseMgDl / 18 : 0;
  const effectiveOsm = 2 * serumNa + glucoseOsmTerm;

  // 3. 無效滲透壓物質貢獻 (BUN / 2.8 與 Ethanol / 4.6)
  const hasBun = Number.isFinite(bunMgDl) && bunMgDl >= 0;
  const bunOsmTerm = hasBun ? bunMgDl / 2.8 : 0;

  const hasEthanol = Number.isFinite(ethanolMgDl) && ethanolMgDl >= 0;
  const ethanolOsmTerm46 = hasEthanol ? ethanolMgDl / 4.6 : 0;
  const ethanolOsmTerm37 = hasEthanol ? ethanolMgDl / 3.7 : 0;

  const calculatedOsmNoEthanol = 2 * serumNa + glucoseOsmTerm + bunOsmTerm;
  const calculatedOsmWithEthanol = calculatedOsmNoEthanol + ethanolOsmTerm46;
  const hasFullStandardCalcInputs = hasGlucose && hasBun;

  // 4. 滲透壓間隙 (Osmolal Gap = Measured Osm - Calculated Osm)
  const hasMeasuredOsm = Number.isFinite(measuredOsm) && measuredOsm > 0;
  const osmolalGapNoEthanol = hasMeasuredOsm ? measuredOsm - calculatedOsmNoEthanol : null;
  const osmolalGapAfterEthanol = hasMeasuredOsm
    ? measuredOsm - calculatedOsmWithEthanol
    : null;

  // 5. 判斷無效滲透壓物質（BUN / Ethanol）是否足以解釋 Measured Osm ≥ 280
  const ineffectiveOsmContribution =
    bunOsmTerm +
    ethanolOsmTerm46 +
    (osmolalGapNoEthanol !== null && hasEthanol && ethanolMgDl > 0
      ? Math.max(0, osmolalGapNoEthanol - 10)
      : 0);

  let branchId;
  let branchTitle;
  let branchBadge;
  let clinicalSummary;
  let nextAction;
  let proceedToStep3 = false;
  let iseExplanation =
    iseMethod === "direct"
      ? "目前已標註為 Direct ISE（如血氣機 ABG/VBG）：不受高血脂／高蛋白固體相體積影響；若仍低血鈉且滲透壓正常，應考慮等張無鈉灌洗液吸收（如 TURP 甘胺酸／山梨醇）或外源性溶質。"
      : "若為中央檢驗室傳統 Indirect ISE（稀釋法）：嚴重高三酸甘油酯血症或高蛋白血症（如多發性骨髓瘤）會造成假性低血鈉，建議改用血氣機 Direct ISE 重測確認。";

  if (serumNa >= 135) {
    branchId = "not_hyponatremia";
    branchTitle =
      serumNa > 145
        ? `高血鈉 (Hypernatremia, Serum Na = ${serumNa} > 145 mEq/L)`
        : `正常血鈉範圍 (Normal Serum Na = ${serumNa} mEq/L ≥ 135)`;
    branchBadge = `Serum Na ${serumNa} mEq/L (非低血鈉)`;
    clinicalSummary =
      serumNa > 145
        ? `實測血鈉為 ${serumNa} mEq/L (> 145)，屬於高血鈉（有效張力 ${effectiveOsm.toFixed(1)} mOsm/kg），不適用低血鈉鑑別流程。`
        : `實測血鈉為 ${serumNa} mEq/L (135–145)，未達低血鈉定義 (< 135 mEq/L)。`;
    nextAction =
      serumNa > 145
        ? "請評估自由水虧損與尿崩症／高張液輸入原因；若欲試算低張點滴（如 D5W、0.45% NaCl）降鈉速率，可使用 Step 5B 並將目標變化量設為負值。"
        : "無需進入低血鈉 Step 3/4 尿液分類。";
    proceedToStep3 = false;
  } else if (!hasMeasuredOsm) {
    if (effectiveOsm > 285 && hasGlucose && glucoseMgDl >= 250) {
      branchId = "hypertonic_hyperglycemia_suspected";
      branchTitle = "疑似高張性／高血糖轉移性低血鈉 (待補實測 Serum Osm)";
      branchBadge = "Effective Osm > 285";
      clinicalSummary = `實測 Serum Osm 尚未輸入，但依血糖 ${glucoseMgDl} mg/dL 計算之有效張力已達 ${effectiveOsm.toFixed(1)} mOsm/kg（Katz 校正 Na ${katzCorrectedNa.toFixed(1)}、Hillier 校正 Na ${hillierCorrectedNa.toFixed(1)} mEq/L）。`;
      nextAction =
        "請補齊實測 Serum Osmolality；針對高血糖進行輸液與胰島素治療，血鈉將隨血糖下降而回升。";
      proceedToStep3 = katzCorrectedNa !== null && katzCorrectedNa < 135;
    } else {
      branchId = "pending_measured_osm";
      branchTitle = "待輸入實測血清滲透壓 (Measured Serum Osmolality)";
      branchBadge = `有效張力估計 ${effectiveOsm.toFixed(1)} mOsm/kg`;
      clinicalSummary = `目前僅由有效滲透壓估算為 ${effectiveOsm.toFixed(1)} mOsm/kg。請輸入實測 Serum Osmolality 以排除假性低血鈉或未測量外源性滲透壓物質（Mannitol、乙醇、毒性醇類）。`;
      nextAction =
        "若臨床高度懷疑真性低張性低血鈉，可同步往下填寫 Step 3 尿液滲透壓與尿鈉。";
      proceedToStep3 = effectiveOsm < 280;
    }
  } else if (effectiveOsm > 285) {
    // 有效張力本身 > 285（例如嚴重高血糖）
    branchId = "hypertonic";
    branchTitle = "高張性／轉移性低血鈉 (Hypertonic / Translocational Hyponatremia)";
    branchBadge = `Measured ${measuredOsm} / Effective ${effectiveOsm.toFixed(1)} mOsm/kg`;
    clinicalSummary = `有效滲透壓（張力）為 ${effectiveOsm.toFixed(1)} mOsm/kg (> 285)，代表細胞外液具高張溶質（如高血糖${hasGlucose ? ` ${glucoseMgDl} mg/dL，Katz 校正 Na = ${katzCorrectedNa.toFixed(1)} mEq/L` : ""}）將水分由細胞內拉出稀釋血鈉。`;
    nextAction =
      "治療高血糖或停用高張溶質（Mannitol／高張葡萄糖）；隨高血糖矯正，水分回到細胞內，血鈉會自動回升。若 Katz/Hillier 校正後血鈉仍 < 135 mEq/L，代表同時合併低張性低血鈉。";
    proceedToStep3 = katzCorrectedNa !== null && katzCorrectedNa < 135;
  } else if (
    measuredOsm >= 280 &&
    effectiveOsm < 280 &&
    (bunMgDl > 20 || (hasEthanol && ethanolMgDl > 0)) &&
    effectiveOsm + Math.max(0, osmolalGapAfterEthanol ?? 0) < 280
  ) {
    // Codex 核心修正：實測總滲透壓 ≥ 280 (甚至 > 285)，但有效張力 < 280 且由高 BUN 或 Ethanol 等無效滲透壓物質墊高所致！
    branchId = "hypotonic_with_ineffective_osmoles";
    branchTitle =
      "真性低張性低血鈉合併無效滲透壓物質升高 (True Hypotonic Hyponatremia with Azotemia / Ethanol)";
    branchBadge = `總滲透壓 ${measuredOsm} ≥ 280，但有效張力 ${effectiveOsm.toFixed(1)} < 280`;
    clinicalSummary = `⚠️ 重要臨床陷阱（PMC13424767）：雖然實測總滲透壓為 ${measuredOsm} mOsm/kg (≥ 280)，但高 BUN（貢獻 +${bunOsmTerm.toFixed(1)} mOsm/kg）與乙醇（貢獻 +${ethanolOsmTerm46.toFixed(1)} mOsm/kg）屬於可自由穿透細胞膜的「無效滲透壓物質 (Ineffective osmoles)」，不會拉水出細胞。病患的實際有效張力 (Effective Tonicity = 2×Na + Glc/18) 僅 ${effectiveOsm.toFixed(1)} mOsm/kg (< 280)，本質上仍是「真性低張性低血鈉」！`;
    nextAction =
      "切勿誤判為高張性或假性低血鈉而忽略治療！請直接進入 Step 3 評估 Urine Osm、Urine Na 與體液狀態。";
    proceedToStep3 = true;
  } else if (measuredOsm > 285) {
    // Measured Osm > 285，且非單純高 BUN / 已知乙醇所致（例如 Mannitol、Sorbitol、Contrast 或未填乙醇之高 Osmolal Gap）
    if (osmolalGapNoEthanol !== null && osmolalGapNoEthanol > 10) {
      branchId = "hypertonic_or_unmeasured_osmoles";
      branchTitle =
        "高實測滲透壓伴滲透壓間隙升高 (> 285 mOsm/kg & Osmolal Gap > 10)";
      branchBadge = `Measured ${measuredOsm}｜Osm Gap ${osmolalGapNoEthanol.toFixed(1)}`;
      clinicalSummary = `實測滲透壓 ${measuredOsm} mOsm/kg (> 285)，但有效張力（2×Na + Glc/18）僅 ${effectiveOsm.toFixed(1)} mOsm/kg，滲透壓間隙高達 ${osmolalGapNoEthanol.toFixed(1)} mOsm/kg。需考慮外源性溶質：若為 Mannitol、Sorbitol、顯影劑、Glycine、Maltose (IVIG)，屬「有效滲透壓物質」造成轉移性高張低血鈉；若為未填報之乙醇或毒性醇類（甲醇、乙二醇），則為無效滲透壓物質合併真性低張性低血鈉（另若使用 Indirect ISE 亦須排除嚴重高血脂／高蛋白造成之假性高間隙）。`;
      nextAction =
        "1. 核對用藥史（Mannitol、IVIG、灌洗液、顯影劑）與抽測血中乙醇／毒性醇類、ABG/VBG Direct ISE。2. 若為乙醇／毒性醇類所致，仍應同時進入 Step 3 評估低張性低血鈉。";
      proceedToStep3 = true;
    } else {
      branchId = "hypertonic";
      branchTitle = "高滲透壓性低血鈉 (Measured Osm > 285 mOsm/kg)";
      branchBadge = `Measured ${measuredOsm} mOsm/kg`;
      clinicalSummary = `實測血清滲透壓 ${measuredOsm} mOsm/kg (> 285)。${!hasGlucose || !hasBun ? "請補齊血糖 (Glucose) 與尿素氮 (BUN) 以精確計算有效張力與滲透壓間隙。" : "考慮高血糖或外源性高張溶質（Mannitol、Sorbitol、顯影劑）。"}`;
      nextAction =
        "請確認血糖與 BUN 數值以排除尿毒症（Azotemia）造成之假性高滲透壓，並評估是否有 Mannitol／顯影劑使用史。";
      proceedToStep3 = false;
    }
  } else if (measuredOsm >= 280 && measuredOsm <= 285) {
    // 280–285 mOsm/kg: Isotonic / Pseudohyponatremia vs Osmolal Gap > 10
    // 注意：在 Indirect ISE 下，若發生假性低血鈉（如真實 Na 140 但 Indirect ISE 測得 122），
    // 代入 2×122 算出之 Calculated Osm 必然偏低，算術上同樣會呈現 Osmolal Gap > 10！
    if (osmolalGapNoEthanol !== null && osmolalGapNoEthanol > 10) {
      if (iseMethod === "direct") {
        branchId = "isotonic_high_gap";
        branchTitle =
          "等張滲透壓伴高滲透壓間隙 (280–285 mOsm/kg & Direct ISE Osmolal Gap > 10)";
        branchBadge = `Measured ${measuredOsm}｜Osm Gap ${osmolalGapNoEthanol.toFixed(1)}`;
        clinicalSummary = `已使用 Direct ISE 排除高血脂／高蛋白假性低血鈉，實測滲透壓落於 280–285 mOsm/kg 但滲透壓間隙高達 ${osmolalGapNoEthanol.toFixed(1)} mOsm/kg (> 10)。提示血中存在未測量外源性溶質（乙醇、甲醇、乙二醇、丙二醇，或 TURP／子宮鏡等張無鈉灌洗液如甘胺酸 Glycine、山梨醇 Sorbitol、Mannitol）！`;
        nextAction =
          "檢測血中乙醇、毒性醇類與手術灌洗液吸收史；若為乙醇等無效滲透壓物質，其底層仍為真性低張性低血鈉，請同步評估 Step 3。";
        proceedToStep3 = true;
      } else {
        branchId = "isotonic_pseudohyponatremia";
        branchTitle =
          "等張性／假性低血鈉 或 未測量外源溶質 (280–285 mOsm/kg, Indirect ISE Osm Gap > 10)";
        branchBadge = `Measured ${measuredOsm}｜視同 Osm Gap ${osmolalGapNoEthanol.toFixed(1)}`;
        clinicalSummary = `實測滲透壓正常（${measuredOsm} mOsm/kg，280–285 等張區間），而由實測 Na (${serumNa}) 推算之滲透壓間隙為 ${osmolalGapNoEthanol.toFixed(1)} mOsm/kg (> 10)。請注意兩大鑑別：① **假性低血鈉 (Pseudohyponatremia)**：在傳統 Indirect ISE 下，嚴重高三酸甘油酯血症或高蛋白血症（多發性骨髓瘤等）會使實測 Na 被假性低估，連帶使計算滲透壓偏低而產生假性高 Osmolal Gap！② **外源性未測量溶質**：乙醇、毒性醇類或無鈉灌洗液將原本低張之血漿墊高至 280–285。`;
        nextAction = `${iseExplanation} 同時若懷疑飲酒或中毒，請加測血中乙醇／毒性醇類（若為乙醇墊高，底層仍可能為真性低張性低血鈉）。`;
        proceedToStep3 = false;
      }
    } else {
      branchId = "isotonic_pseudohyponatremia";
      branchTitle = "等張性／假性低血鈉 (Isotonic / Pseudohyponatremia, 280–285 mOsm/kg)";
      branchBadge = `Measured ${measuredOsm} mOsm/kg｜Osm Gap ≤ 10`;
      clinicalSummary = `實測滲透壓正常（${measuredOsm} mOsm/kg）且無顯著滲透壓間隙。最常見於高三酸甘油酯血症（Hypertriglyceridemia）、高蛋白血症／多發性骨髓瘤（Paraproteinemia）或阻塞性黃疸脂蛋白 X（Lipoprotein X）。`;
      nextAction = iseExplanation;
      proceedToStep3 = false;
    }
  } else {
    // Measured Osm < 280 mOsm/kg (True Hypotonic Hyponatremia)
    branchId = "true_hypotonic";
    branchTitle = "真性低張性低血鈉 (True Hypotonic Hyponatremia, < 280 mOsm/kg)";
    branchBadge = `Measured ${measuredOsm} / Effective ${effectiveOsm.toFixed(1)} mOsm/kg`;
    clinicalSummary = `實測滲透壓 ${measuredOsm} mOsm/kg (< 280) 且有效張力 ${effectiveOsm.toFixed(1)} mOsm/kg (< 280)，確認為真性低張性低血鈉。${osmolalGapNoEthanol !== null && osmolalGapNoEthanol > 10 ? `（註：Osmolal Gap = ${osmolalGapNoEthanol.toFixed(1)} > 10，請同步留意外源性醇類或溶質）。` : ""}`;
    nextAction =
      "請進入 Step 3 & Step 4：檢視尿液滲透壓 (Urine Osm)、尿鈉 (Urine Na)、尿鉀 (Urine K) 與臨床體液狀態。";
    proceedToStep3 = true;
  }

  return {
    isValid: true,
    serumNa,
    measuredOsm,
    glucoseMgDl,
    bunMgDl,
    ethanolMgDl,
    iseMethod,
    katzCorrectedNa,
    hillierCorrectedNa,
    effectiveOsm,
    glucoseOsmTerm,
    bunOsmTerm,
    ethanolOsmTerm46,
    ethanolOsmTerm37,
    calculatedOsmNoEthanol,
    calculatedOsmWithEthanol,
    hasFullStandardCalcInputs,
    osmolalGapNoEthanol,
    osmolalGapAfterEthanol,
    ineffectiveOsmContribution,
    branchId,
    branchTitle,
    branchBadge,
    clinicalSummary,
    nextAction,
    iseExplanation,
    proceedToStep3,
  };
}

/**
 * 六大低張性低血鈉標準分類定義（含典型診斷、生理機轉、標準處置與臨床陷阱）
 */
export const HYPOTONIC_CATEGORIES = {
  cat1_hypovol_low_una: {
    id: "cat1_hypovol_low_una",
    code: "Category 1",
    name: "低血容 ＋ 低尿鈉 (Hypovolemic, Low Urine Na)",
    criteriaText: "Hypovolemic, U_Osm > 100 mOsm/kg, U_Na ≤ 20–30 mEq/L",
    physiology:
      "有效動脈血容積不足（腎外體液流失）→ 同時活化 ADH（濃縮尿液 U_Osm > 100）與 RAAS／交感神經（腎小管強烈保鈉 U_Na < 20–30）。",
    typicalDiagnoses: [
      "腸胃道流失：腹瀉 (Diarrhea)、早期嘔吐／引流",
      "第三空間流失 (Third spacing)：急性胰臟炎、腸阻塞、腹膜炎、大面積燒傷",
      "皮膚大量流汗／中暑脫水",
      "遠期已停用之利尿劑 (Remote diuretics，藥效已退、進入腎臟保鈉期)",
    ],
    usualManagement: [
      "給予等張晶體液（0.9% NaCl 或平衡鹽液）補充有效血容積",
      "治療造成體液流失之根本病因（止瀉、處理外科急症等）",
      "若合併嚴重神經學急症，仍須先依 Step 1 給予 3% NaCl Bolus",
    ],
    pitfalls: [
      "⚠️ 極高自發性過度矯正風險！一旦輸液補足血容積，低血容對 ADH 的刺激會瞬間解除，引發大量水利尿（Brisk water diuresis，尿量突增 > 100–200 mL/h、U_Osm < 100），使血鈉在數小時內暴衝！",
      "務必每小時監測尿量、每 2–4h 追蹤血鈉；若尿量暴增或升幅接近目標，立即停生理食鹽水並評估 D5W ± Desmopressin (DDAVP) 踩煞車。",
    ],
  },
  cat2_hypovol_high_una: {
    id: "cat2_hypovol_high_una",
    code: "Category 2",
    codeShort: "Cat 2",
    name: "低血容 ＋ 高尿鈉 (Hypovolemic, High Urine Na)",
    criteriaText: "Hypovolemic, U_Osm > 100 mOsm/kg, U_Na > 20–30 mEq/L",
    physiology:
      "有效血容積不足（刺激 ADH 使 U_Osm > 100），但因腎小管受藥物、內分泌缺乏、碳酸氫根尿或腦耗鹽影響而無法保鈉（U_Na > 20–30）。",
    typicalDiagnoses: [
      "利尿劑作用中（特別是 Thiazide 類利尿劑）",
      "原發性腎上腺功能不全／鹽皮質激素缺乏 (Addison's disease，常伴高血鉀、低血壓)",
      "急性頻繁嘔吐／鼻胃管引流（代謝性鹼中毒致 HCO₃⁻ 攜帶 Na⁺ 排出 → 高 U_Na，但尿氯 U_Cl < 20 mEq/L！）",
      "腦耗鹽症候群／腎耗鹽症候群 (CSW / RSW，屬排除診斷，見於蜘蛛膜下腔出血 SAH 或腦外傷後)",
      "滲透性利尿 (Osmotic diuresis) 或腎小管間質疾病",
    ],
    usualManagement: [
      "立即停用 Thiazide 等致病利尿劑",
      "以 0.9% NaCl 補充血容積（若為 CSW 或嚴重症狀常需 3% NaCl 並考慮 Fludrocortisone 0.1–0.2 mg/day）",
      "懷疑腎上腺功能不全時，立即抽血檢驗 Cortisol / ACTH 並給予壓力劑量 Hydrocortisone（如 100 mg IV）",
      "頻繁嘔吐者補充 0.9% NaCl + KCl 矯正低氯代謝性鹼中毒",
    ],
    pitfalls: [
      "⚠️ 給予 Hydrocortisone 或停用 Thiazide／補液後，ADH 刺激會迅速消退並出現大量水利尿，極易導致過度矯正（ODS 高風險），需密集追蹤 Na 與尿量！",
      "若懷疑利尿劑干擾尿鈉解讀，可計算 FE_Urea（< 35% 支持有效血容積不足）；若懷疑嘔吐干擾，請測尿氯 U_Cl（< 20 mEq/L 支持低血容）。",
    ],
  },
  cat3_euvol_adh: {
    id: "cat3_euvol_adh",
    code: "Category 3",
    name: "正常血容 ＋ 尿未極度稀釋 (Euvolemic, U_Osm > 100 mOsm/kg)",
    criteriaText: "Euvolemic, U_Osm > 100 mOsm/kg (通常 U_Na > 20–30 mEq/L)",
    physiology:
      "臨床無水腫亦無明顯脫水，但非滲透壓性或異常 ADH 活性持續存在，使腎臟無法排出自由水（U_Osm > 100），且因血容積正常／微張而隨飲食排鈉（U_Na > 20–30；若極低鹽飲食 U_Na 亦可偏低）。",
    typicalDiagnoses: [
      "抗利尿激素不適當分泌症候群 (SIADH / SIAD — 須先完成排除診斷！)",
      "次發性腎上腺功能不全／糖皮質激素缺乏 (Secondary adrenal / glucocorticoid deficiency)",
      "嚴重甲狀腺功能低下 (Severe hypothyroidism / Myxedema)",
      "藥物誘發：SSRIs/SNRIs、Carbamazepine/Oxcarbazepine、Opioids、NSAIDs、Desmopressin、抗精神病藥、Cyclophosphamide",
      "術後狀態、嚴重疼痛、劇烈噁心、中樞神經感染／出血、肺部病灶（肺炎、小細胞肺癌 SCLC）",
    ],
    mandatoryExclusions: [
      "1. 排除腎上腺功能不全：務必檢驗 Morning Cortisol / ACTH（糖皮質激素缺乏表現與 SIADH 完全相同，但需補充類固醇而非僅限水！）",
      "2. 排除甲狀腺功能低下：檢驗 TSH、Free T4",
      "3. 排除腎功能不全 (eGFR) 與利尿劑使用（特別是隱藏或近期使用之 Thiazides）",
      "4. 排除亞臨床低血容（若體液狀態不確定，可參考血清尿酸 S_UA < 4 mg/dL、FE_Uric Acid > 11–12%、FE_Urea > 55% 支持 SIADH）",
    ],
    usualManagement: [
      "第一線：限制水分攝取 (Fluid restriction，通常 500–1000 mL/day 或低於每日尿量 500 mL) ＋ 停用致病藥物／治療內分泌病因",
      "二線（特別是當 U_Osm > 500 mOsm/kg 或 Fürst ratio (U_Na+U_K)/S_Na > 1.0 預期單純限水會失敗時）：",
      "  • 口服尿素 (Oral Urea 15–60 g/day，增加尿溶質排出自由水，ESE 指引推薦)",
      "  • 口服鹽錠 (NaCl tabs) ＋ 低劑量 Loop diuretic (如 Furosemide 20 mg PO BID，降低尿液濃縮能力)",
      "  • 選擇性使用 3% NaCl（有症狀或急性惡化時）或照會腎臟科評估 Vaptans（Tolvaptan；切勿與 3% NaCl 併用，留意肝功能與過矯風險）",
    ],
    pitfalls: [
      "🚨 脫鹽惡化陷阱 (Desalination phenomenon)：在 SIADH 患者（特別是 U_Na + U_K > 154 mEq/L 或 U_Osm > 500 mOsm/kg），輸注 0.9% NaCl (154 mEq/L) 會導致輸入的鈉從高張尿排掉、留住淨自由水，反而使血鈉越補越低！",
    ],
  },
  cat4_dilute_urine: {
    id: "cat4_dilute_urine",
    code: "Category 4",
    name: "尿液適當極度稀釋／低 ADH 活性 (U_Osm ≤ 100 mOsm/kg)",
    criteriaText: "U_Osm ≤ 100 mOsm/kg (通常為 Euvolemic 或輕度低血容)",
    physiology:
      "ADH 活性已適當被抑制，腎臟正在全力排出極度稀釋尿（U_Osm ≤ 100 mOsm/kg）；之所以仍低血鈉，是因為「飲水量超過腎臟最大排水極限」或「每日溶質攝取過低，缺乏溶質可夾帶水分排出」。",
    typicalDiagnoses: [
      "原發性／心因性多飲症 (Primary / Psychogenic polydipsia，常見於精神科用藥口乾或大量飲水)",
      "低溶質攝取症 (Low solute intake / 'Tea and toast' diet，老人或營養不良僅喝湯水少蛋白質與鹽)",
      "啤酒狂飲症 (Beer potomania，大量啤酒含高水分但幾乎無蛋白質與鈉鉀溶質)",
    ],
    usualManagement: [
      "原發性多飲症：限制水分攝取並調整引起口乾之藥物",
      "Beer potomania / 低溶質攝取：恢復漸進式營養與蛋白質／電解質攝取（謹慎控制初期溶質補充速度！）",
    ],
    pitfalls: [
      "🚨 全場最高過度矯正風險！因為病患體內的 ADH 原本就處於完全抑制狀態（U_Osm ≤ 100），一旦停止喝水，或一旦給予生理食鹽水／高蛋白飲食提供溶質（每給 154 mOsm 溶質即可在 U_Osm 75 下瞬間排出 > 2000 mL 自由水！），血鈉會在數小時內暴衝 15–20 mEq/L 導致 ODS！",
      "除非有抽搐／昏迷等危及生命之嚴重症狀，盡量避免給予高張鹽水或大量 0.9% NaCl；務必放置尿管或嚴密計量每小時尿量，一發生大量稀釋尿立即以 D5W ± DDAVP 控制升速。",
    ],
  },
  cat5_hypervol_low_una: {
    id: "cat5_hypervol_low_una",
    code: "Category 5",
    name: "高血容 ＋ 低尿鈉 (Hypervolemic, Low Urine Na)",
    criteriaText: "Hypervolemic (水腫／腹水), U_Osm > 100 mOsm/kg, U_Na ≤ 20–30 mEq/L",
    physiology:
      "全身總細胞外液（ECF）與總體鈉增加（表現為周邊水腫、肺水腫、腹水），但「有效動脈血容積 (EABV)」低下 → 強烈刺激 ADH（保水稀釋血鈉）與 RAAS（腎臟強烈保鈉 U_Na < 20–30）。",
    typicalDiagnoses: [
      "鬱血性心衰竭 (Congestive heart failure, HFrEF / HFpEF)",
      "肝硬化伴腹水 (Liver cirrhosis with ascites)",
      "腎病症候群 (Nephrotic syndrome) 或嚴重低白蛋白血症",
    ],
    usualManagement: [
      "限制水分與鈉鹽攝取 (Fluid & sodium restriction)",
      "使用 Loop diuretics（如 Furosemide）利尿排鈉排水；肝硬化常搭配 Spironolactone 與白蛋白輸注",
      "積極治療心衰竭、肝硬化或腎病症候群本身",
      "除非出現嚴重神經學急症（抽搐／昏迷），否則避免輸注 0.9% NaCl 或 3% NaCl 以免加重肺水腫與體液過負荷",
    ],
    pitfalls: [
      "若採檢前已給予 Loop diuretics，U_Na 會因藥效而升高 > 30 mEq/L；此時可檢驗 FE_Urea（< 35% 仍可證實有效動脈血容積不足）。",
      "晚期肝硬化患者為 ODS 極高風險群，24h 血鈉升幅務必控制在 4–6 mEq/L（絕對上限 ≤ 8 mEq/L）。",
    ],
  },
  cat6_hypervol_high_una: {
    id: "cat6_hypervol_high_una",
    code: "Category 6",
    name: "高血容 ＋ 高尿鈉 (Hypervolemic, High Urine Na)",
    criteriaText: "Hypervolemic (水腫), U_Osm > 100 mOsm/kg, U_Na > 20–30 mEq/L",
    physiology:
      "腎功能嚴重受損（GFR 顯著下降），腎小管同時喪失稀釋自由水與濃縮保鈉的能力（常呈等滲尿 U_Osm 約 250–350 mOsm/kg 且 U_Na > 30 mEq/L），或為心衰／肝硬化患者剛接受利尿劑治療後。",
    typicalDiagnoses: [
      "急性腎損傷 (Acute Kidney Injury, AKI — 少尿期或腎小管壞死 ATN)",
      "晚期慢性腎臟病／末期腎病 (Advanced CKD / ESRD)",
      "心衰竭或肝硬化正在接受利尿劑治療（Diuretic effect in hypervolemia）",
    ],
    usualManagement: [
      "嚴格限制水分與鹽分攝取",
      "若仍有殘餘腎功能，嘗試高劑量 Loop diuretics",
      "若對利尿劑無反應且合併急性肺水腫、高血鉀、嚴重酸中毒或尿毒症，安排血液透析 (HD) 或連續性腎臟替代治療 (CRRT)",
    ],
    pitfalls: [
      "⚠️ 透析安全警示：嚴重慢性低血鈉患者接受 HD 時，標準透析液鈉濃度（138–140 mEq/L）會在數小時內快速拉升血鈉導致 ODS！照會腎臟科時務必提醒調降透析液鈉濃度、縮短首次透析時間／血流量，或改採 CRRT 並調配置換液鈉濃度。",
    ],
  },
};

/**
 * Step 3 & Step 4：尿液指標、生理機轉、干擾校正與 6 大分類判讀
 */
export function evaluateStep3And4UrineAndClassification({
  serumNa = null,
  urineOsm = null,
  urineNa = null,
  urineK = null,
  volumeStatus = "equivocal", // 'hypovolemic' | 'euvolemic' | 'hypervolemic' | 'equivocal'
  uNaCutoffMode = 30, // 30 (ESE 2014) | 20 (US / Classic)
  confounders = {}, // { onDiuretics, vomitingNg, priorSaline, nonConcurrentLab }
  feInputs = {}, // { serumCr, urineCr, serumUrea, urineUrea, ureaUnitMode, serumUa, urineUa, urineCl }
}) {
  const hasUrineOsm = Number.isFinite(urineOsm) && urineOsm > 0;
  const hasUrineNa = Number.isFinite(urineNa) && urineNa >= 0;
  const hasUrineK = Number.isFinite(urineK) && urineK >= 0;
  const cutoff = uNaCutoffMode === 20 ? 20 : 30;
  const isUNaGrayZone = hasUrineNa && urineNa >= 20 && urineNa <= 30;

  // 1. 計算 Fürst Ratio = (U_Na + U_K) / S_Na 與 Desalination 風險
  let urineElectrolyteSum = null;
  let furstRatio = null;
  let furstInterpretation = null;
  let desalinationRisk = "low_or_unknown";
  let desalinationMessage = null;

  if (hasUrineNa && hasUrineK) {
    urineElectrolyteSum = urineNa + urineK;
    if (Number.isFinite(serumNa) && serumNa > 0) {
      furstRatio = urineElectrolyteSum / serumNa;
      if (furstRatio > 1.0) {
        furstInterpretation =
          "Fürst Ratio > 1.0：尿液有效電解質濃度高於血漿（腎臟正在滯留自由水／排出高張尿），單純限水極難成功，且給予 0.9% NaCl 極易使血鈉惡化！";
      } else if (furstRatio >= 0.5) {
        furstInterpretation =
          "Fürst Ratio 0.5–1.0：需嚴格限水（建議 < 500 mL/day）方有機會提升血鈉。";
      } else {
        furstInterpretation =
          "Fürst Ratio < 0.5：尿液電解質張力低於血漿一半，腎臟具排出自由水能力，適度限水（< 1 L/day）通常有效。";
      }
    }

    if (urineElectrolyteSum > 154) {
      desalinationRisk = "high_confirmed";
      desalinationMessage = `🚨 確定高脫鹽風險 (Desalination)：U_Na (${urineNa}) + U_K (${urineK}) = ${urineElectrolyteSum.toFixed(1)} mEq/L > 0.9% NaCl (154 mEq/L)！若為 SIADH（ADH 固定偏高），輸注 0.9% NaCl 會把鹽分從高張尿排掉並滯留自由水，導致血鈉越補越低！`;
    } else if (hasUrineOsm && urineOsm > 500) {
      desalinationRisk = "suspected_high_uosm";
      desalinationMessage = `⚠️ 高濃縮尿風險提示：U_Osm = ${urineOsm} > 500 mOsm/kg（雖目前 U_Na + U_K = ${urineElectrolyteSum.toFixed(1)} ≤ 154），在 SIADH 仍不建議輸注 0.9% NaCl，且單純限水失敗率高。`;
    } else {
      desalinationRisk = "low";
    }
  } else if (hasUrineOsm && urineOsm > 500) {
    desalinationRisk = "suspected_high_uosm";
    desalinationMessage = `⚠️ 高濃縮尿風險提示：U_Osm = ${urineOsm} > 500 mOsm/kg，高度提示尿液濃縮；建議補填 Urine K 以計算 U_Na + U_K 是否 > 154 mEq/L，並避免在 SIADH 輸注 0.9% NaCl。`;
  }

  // 2. 計算進階指標：FE_Urea、FE_Uric Acid、Urine Cl、Serum Uric Acid
  let feUrea = null;
  let feUreaCmp = null;
  let feUreaInterpretation = null;
  let feUreaUnitNote = null;
  const sCr = feInputs.serumCr;
  const uCr = feInputs.urineCr;
  const sUrea = feInputs.serumUrea;
  const uUrea = feInputs.urineUrea;
  const ureaUnitMode = feInputs.ureaUnitMode || "same_nitrogen"; // 'same_nitrogen' (BUN/UUN) | 'same_urea' (Urea/Urea) | 'bun_and_urine_urea'

  if (
    Number.isFinite(sCr) &&
    sCr > 0 &&
    Number.isFinite(uCr) &&
    uCr > 0 &&
    Number.isFinite(sUrea) &&
    sUrea > 0 &&
    Number.isFinite(uUrea) &&
    uUrea >= 0
  ) {
    let normalizedUrineUrea = uUrea;
    if (ureaUnitMode === "bun_and_urine_urea") {
      // Urine Urea (mg/dL) 除以 2.14 轉為 Urine Urea Nitrogen (UUN, mg/dL) 以對齊 Serum BUN (mg/dL)
      normalizedUrineUrea = uUrea / 2.14;
      feUreaUnitNote = "已將 Urine Urea 除以 2.14 轉換為 UUN (mg/dL) 與 Serum BUN 對齊";
    } else if (ureaUnitMode === "same_urea") {
      feUreaUnitNote = "血尿皆使用 Urea (mg/dL) 同單位計算";
    } else {
      feUreaUnitNote = "血尿皆使用尿素氮 BUN / UUN (mg/dL) 同單位計算";
    }

    feUrea = ((normalizedUrineUrea * sCr) / (sUrea * uCr)) * 100;
    // 判讀用四捨五入到 1e-6，避免浮點誤差（如 55.00000000000001）讓恰為切點的值落到錯誤區間
    feUreaCmp = Math.round(feUrea * 1e6) / 1e6;
    if (feUreaCmp < 35) {
      feUreaInterpretation =
        "FE_Urea < 35%：支持有效動脈血容積不足／腎前性低灌流（如脫水、心衰、肝硬化），即使使用利尿劑致 U_Na 假性偏高亦具參考價值。（註：屬輔助證據，請結合臨床）";
    } else if (feUreaCmp > 55) {
      feUreaInterpretation =
        "FE_Urea > 55%：支持正常血容積（如 SIADH）或腎性鹽分流失。（註：屬輔助證據，不可單憑此數值確診 SIADH）";
    } else {
      feUreaInterpretation =
        "FE_Urea 35–55%：介於交界區，請結合臨床體液評估、FE_UA 與病史綜合判斷。";
    }
  }

  let feUa = null;
  let feUaInterpretation = null;
  const sUa = feInputs.serumUa;
  const uUa = feInputs.urineUa;
  if (
    Number.isFinite(sCr) &&
    sCr > 0 &&
    Number.isFinite(uCr) &&
    uCr > 0 &&
    Number.isFinite(sUa) &&
    sUa > 0 &&
    Number.isFinite(uUa) &&
    uUa >= 0
  ) {
    feUa = ((uUa * sCr) / (sUa * uCr)) * 100;
    const feUaCmp = Math.round(feUa * 1e6) / 1e6;
    if (feUaCmp > 12) {
      feUaInterpretation =
        "FE_UA > 12%：支持 SIADH 或腦／腎耗鹽症候群 (CSW/RSW)，即使患者正在使用利尿劑亦支持 SIADH/CSW。（矯正血鈉後：SIADH 之 FE_UA 會降回 < 11%，CSW 則持續 > 11%）";
    } else if (feUaCmp < 4) {
      feUaInterpretation = "FE_UA < 4%：支持有效動脈血容積不足／腎前性低血容。";
    } else {
      feUaInterpretation =
        "FE_UA 4–12%（正常範圍）：見於心因性多飲、低溶質攝取或利尿劑引發之低血容。";
    }
  }

  let serumUaNote = null;
  if (Number.isFinite(sUa) && sUa > 0) {
    serumUaNote =
      sUa < 4
        ? `Serum Uric Acid = ${sUa} mg/dL (< 4.0)：支持 SIADH 或 CSW（近端腎小管尿酸排泄增加）。`
        : sUa > 5
          ? `Serum Uric Acid = ${sUa} mg/dL (> 5.0)：支持有效動脈血容積不足（低血容或利尿劑作用）。`
          : `Serum Uric Acid = ${sUa} mg/dL（中間值 4.0–5.0）。`;
  }

  let urineClNote = null;
  const uCl = feInputs.urineCl;
  if (Number.isFinite(uCl) && uCl >= 0) {
    urineClNote =
      uCl < 20
        ? `Urine Cl = ${uCl} mEq/L (< 20)：強烈支持「低血容伴代謝性鹼中毒（如頻繁嘔吐／NG 引流）」！此時高 U_Na 是因腎臟排 HCO₃⁻ 被迫帶出 Na⁺ 所致，應給予 0.9% NaCl + KCl 補液。`
        : `Urine Cl = ${uCl} mEq/L (≥ 20)：未呈典型嘔吐低尿氯表現。`;
  }

  // 3. 整理干擾因子警示
  const confounderWarnings = [];
  if (confounders.onDiuretics) {
    confounderWarnings.push(
      "💊 使用利尿劑中（特別是 Thiazides／Loop diuretics）：會直接抑制腎小管鈉重吸收，使 U_Na 假性升高 (> 30 mEq/L)，掩蓋低血容或心衰／肝硬化！建議搭配 FE_Urea (< 35% 支持低灌流) 或 FE_UA 輔助判讀。",
    );
  }
  if (confounders.vomitingNg) {
    confounderWarnings.push(
      "🤮 頻繁嘔吐／鼻胃管引流：代謝性鹼中毒時腎臟排出大量 HCO₃⁻ 會強迫攜帶 Na⁺ 排出，導致低血容患者出現 U_Na > 30 mEq/L 的假象！請檢驗尿氯 Urine Cl（若 < 20 mEq/L 即可證實為低血容）。",
    );
  }
  if (confounders.priorSaline) {
    confounderWarnings.push(
      "💧 採檢前已輸注生理食鹽水／含鈉點滴：可能已改變尿鈉與尿滲透壓（若低血容已被部分矯正，ADH 下降會使 U_Osm 降低；若為 SIADH 輸注 0.9% NaCl 則會使 U_Na 升高）。請對照補液前檢體或追蹤趨勢。",
    );
  }
  if (confounders.nonConcurrentLab) {
    confounderWarnings.push(
      "⏱️ 血液與尿液非同期採檢：低血鈉的體液與 ADH 狀態可能隨小時快速變動，建議盡可能以同期血尿檢體解讀。",
    );
  }
  if (isUNaGrayZone) {
    confounderWarnings.push(
      `⚖️ 尿鈉位於灰區 (U_Na = ${urineNa} mEq/L，介於 20–30 mEq/L)：歐洲指引 (ESE 2014) 以 30 mmol/L 為切點，傳統美國文獻常以 20 mEq/L 為切點。處於 20–30 灰區時，請勿單憑 U_Na 絕對二分，務必結合體液狀態、飲食鹽分攝取與 FE_Urea / S_UA 綜合判斷。`,
    );
  }

  // 4. 決定主分類與候選分類（含 Equivocal 體液不確定時之並列比較）
  let primaryCategory = null;
  let candidateCategories = [];
  let activeFlowNodes = ["node_hypotonic"];
  let classificationMode = "pending";

  if (!hasUrineOsm) {
    classificationMode = "pending_uosm";
  } else if (urineOsm <= 100) {
    // U_Osm <= 100 mOsm/kg → Category 4 (Appropriately dilute urine / low ADH)
    activeFlowNodes.push("node_uosm", "node_uosm_low", "node_cat4");
    primaryCategory = HYPOTONIC_CATEGORIES.cat4_dilute_urine;
    candidateCategories = [HYPOTONIC_CATEGORIES.cat4_dilute_urine];
    classificationMode = "confirmed_dilute";
  } else {
    // U_Osm > 100 mOsm/kg
    activeFlowNodes.push("node_uosm", "node_uosm_high");
    if (!hasUrineNa) {
      classificationMode = "pending_una";
    } else {
      const isUNaLow = urineNa <= cutoff;
      activeFlowNodes.push("node_una", isUNaLow ? "node_una_low" : "node_una_high");
      if (!isUNaLow && confounders.onDiuretics) {
        activeFlowNodes.push("node_diuretics_yes");
      } else if (!isUNaLow) {
        activeFlowNodes.push("node_diuretics_no");
      }

      if (volumeStatus === "hypovolemic") {
        if (isUNaLow) {
          primaryCategory = HYPOTONIC_CATEGORIES.cat1_hypovol_low_una;
          candidateCategories = [HYPOTONIC_CATEGORIES.cat1_hypovol_low_una];
          activeFlowNodes.push("node_cat1");
          if (isUNaGrayZone) {
            candidateCategories.push(HYPOTONIC_CATEGORIES.cat2_hypovol_high_una);
          }
        } else {
          primaryCategory = HYPOTONIC_CATEGORIES.cat2_hypovol_high_una;
          candidateCategories = [HYPOTONIC_CATEGORIES.cat2_hypovol_high_una];
          activeFlowNodes.push("node_cat2");
          if (confounders.onDiuretics || confounders.vomitingNg || (feUreaCmp !== null && feUreaCmp < 35) || (Number.isFinite(uCl) && uCl < 20)) {
            candidateCategories.push(HYPOTONIC_CATEGORIES.cat1_hypovol_low_una);
          }
        }
        classificationMode = "single_volume";
      } else if (volumeStatus === "euvolemic") {
        primaryCategory = HYPOTONIC_CATEGORIES.cat3_euvol_adh;
        candidateCategories = [HYPOTONIC_CATEGORIES.cat3_euvol_adh];
        activeFlowNodes.push("node_cat3");
        if (isUNaLow) {
          // Euvolemic but low U_Na: could be low-salt intake SIADH OR occult hypovolemia (Category 1)!
          candidateCategories.push(HYPOTONIC_CATEGORIES.cat1_hypovol_low_una);
          confounderWarnings.push(
            "🔍 正常血容但低尿鈉 (U_Na ≤ 20–30)：臨床上最常為「尚未被理學檢查察覺之亞臨床低血容 (Category 1)」，或是「極低鹽飲食下之 SIADH / 初期甲狀腺低下 (Category 3)」。建議評估姿位性生命徵象、POCUS IVC 與 S_UA / FE_Urea。",
          );
        }
        classificationMode = "single_volume";
      } else if (volumeStatus === "hypervolemic") {
        if (isUNaLow) {
          primaryCategory = HYPOTONIC_CATEGORIES.cat5_hypervol_low_una;
          candidateCategories = [HYPOTONIC_CATEGORIES.cat5_hypervol_low_una];
          activeFlowNodes.push("node_cat5");
          if (isUNaGrayZone) {
            candidateCategories.push(HYPOTONIC_CATEGORIES.cat6_hypervol_high_una);
          }
        } else {
          primaryCategory = HYPOTONIC_CATEGORIES.cat6_hypervol_high_una;
          candidateCategories = [
            HYPOTONIC_CATEGORIES.cat6_hypervol_high_una,
            HYPOTONIC_CATEGORIES.cat5_hypervol_low_una,
          ];
          activeFlowNodes.push("node_cat6");
        }
        classificationMode = "single_volume";
      } else {
        // volumeStatus === 'equivocal' (體液狀態不確定 — 並列候選比較與下一步建議)
        classificationMode = "equivocal_volume_comparison";
        if (isUNaLow) {
          candidateCategories = [
            HYPOTONIC_CATEGORIES.cat1_hypovol_low_una,
            HYPOTONIC_CATEGORIES.cat5_hypervol_low_una,
            HYPOTONIC_CATEGORIES.cat3_euvol_adh,
          ];
          primaryCategory = HYPOTONIC_CATEGORIES.cat1_hypovol_low_una;
          activeFlowNodes.push("node_cat1", "node_cat5");
        } else {
          candidateCategories = [
            HYPOTONIC_CATEGORIES.cat3_euvol_adh,
            HYPOTONIC_CATEGORIES.cat2_hypovol_high_una,
            HYPOTONIC_CATEGORIES.cat6_hypervol_high_una,
          ];
          primaryCategory = HYPOTONIC_CATEGORIES.cat3_euvol_adh;
          activeFlowNodes.push("node_cat3", "node_cat2");
        }
      }
    }
  }

  return {
    hasUrineOsm,
    hasUrineNa,
    hasUrineK,
    urineOsm,
    urineNa,
    urineK,
    volumeStatus,
    uNaCutoff: cutoff,
    isUNaGrayZone,
    urineElectrolyteSum,
    furstRatio,
    furstInterpretation,
    desalinationRisk,
    desalinationMessage,
    feUrea,
    feUreaInterpretation,
    feUreaUnitNote,
    feUa,
    feUaInterpretation,
    serumUaNote,
    urineClNote,
    confounderWarnings,
    classificationMode,
    primaryCategory,
    candidateCategories,
    activeFlowNodes,
  };
}

/**
 * Step 5A：3% NaCl 床邊泡製換算器（模式 A 整支安瓿快泡法 ＆ 模式 B 等體積精準抽換法）
 */
export function calculate3PercentMixing({
  mode = "mode_a_ampoules", // 'mode_a_ampoules' | 'mode_b_isovolumetric'
  baseFluidPercent = 0.9, // 0.9 (0.9% NaCl) | 0 (Sterile Water / D5W) | 0.45 (0.45% NaCl)
  bagVolumeMl = 500,
  withdrawMl = 100,
  ampouleCount = 6,
  ampouleVolumeMl = 20,
  ampouleConcPercent = 10,
  targetPercent = 3.0,
}) {
  if (
    !Number.isFinite(bagVolumeMl) ||
    bagVolumeMl <= 0 ||
    !Number.isFinite(baseFluidPercent) ||
    baseFluidPercent < 0 ||
    !Number.isFinite(ampouleVolumeMl) ||
    ampouleVolumeMl <= 0 ||
    !Number.isFinite(ampouleConcPercent) ||
    ampouleConcPercent <= baseFluidPercent
  ) {
    throw new RangeError("Invalid mixing base parameters");
  }

  if (mode === "mode_b_isovolumetric") {
    if (
      !Number.isFinite(targetPercent) ||
      targetPercent <= baseFluidPercent ||
      targetPercent >= ampouleConcPercent
    ) {
      throw new RangeError("targetPercent must be between baseFluidPercent and ampouleConcPercent");
    }

    // 精準等體積抽換量 X (mL)：(V - X)*C_base + X*C_amp = V*C_target  =>  X = V * (C_target - C_base) / (C_amp - C_base)
    const exactReplaceMl =
      (bagVolumeMl * (targetPercent - baseFluidPercent)) /
      (ampouleConcPercent - baseFluidPercent);
    const exactAmpoulesNeeded = exactReplaceMl / ampouleVolumeMl;
    const exactRemainingBaseMl = bagVolumeMl - exactReplaceMl;
    const exactNaClGrams = (bagVolumeMl * targetPercent) / 100;
    const exactMeqL = percentNaClToMeqL(targetPercent);

    // 對照：若改抽整數支（例如四捨五入至最近整數支 ampouleCount = Math.round(exactAmpoulesNeeded)）並維持等體積
    const roundedAmps = Math.round(exactAmpoulesNeeded);
    const roundedReplaceMl = roundedAmps * ampouleVolumeMl;
    const roundedRemainingBaseMl = Math.max(0, bagVolumeMl - roundedReplaceMl);
    const roundedFinalVolumeMl = roundedRemainingBaseMl + roundedReplaceMl;
    const roundedGrams =
      (roundedRemainingBaseMl * baseFluidPercent +
        roundedReplaceMl * ampouleConcPercent) /
      100;
    const roundedPercent = (roundedGrams / roundedFinalVolumeMl) * 100;
    const roundedMeqL = percentNaClToMeqL(roundedPercent);

    return {
      mode: "mode_b_isovolumetric",
      baseFluidPercent,
      bagVolumeMl,
      targetPercent,
      exactReplaceMl,
      exactAmpoulesNeeded,
      exactRemainingBaseMl,
      finalVolumeMl: bagVolumeMl,
      totalNaClGrams: exactNaClGrams,
      finalPercent: targetPercent,
      finalMeqL: exactMeqL,
      roundedWholeAmpouleComparison: {
        roundedAmps,
        roundedReplaceMl,
        finalVolumeMl: roundedFinalVolumeMl,
        finalPercent: roundedPercent,
        finalMeqL: roundedMeqL,
      },
      summaryText: `模式 B（維持總量 ${bagVolumeMl} mL 等體積抽換）：從 ${baseFluidPercent}% NaCl ${bagVolumeMl} mL 精準抽出 ${exactReplaceMl.toFixed(1)} mL 丟棄（剩 ${exactRemainingBaseMl.toFixed(1)} mL），再加入 ${ampouleConcPercent}% NaCl ${exactReplaceMl.toFixed(1)} mL（約 ${exactAmpoulesNeeded.toFixed(2)} 支 ${ampouleVolumeMl} mL 安瓿）＝ 總體積 ${bagVolumeMl} mL 之 ${targetPercent.toFixed(2)}% NaCl (${exactMeqL.toFixed(1)} mEq/L)。`,
    };
  }

  // Mode A: 整支安瓿快泡法
  if (
    !Number.isFinite(withdrawMl) ||
    withdrawMl < 0 ||
    withdrawMl >= bagVolumeMl ||
    !Number.isFinite(ampouleCount) ||
    ampouleCount < 0
  ) {
    throw new RangeError("Invalid Mode A withdrawMl or ampouleCount");
  }

  const remainingBaseMl = bagVolumeMl - withdrawMl;
  const addedAmpouleVolumeMl = ampouleCount * ampouleVolumeMl;
  const finalVolumeMl = remainingBaseMl + addedAmpouleVolumeMl;
  const baseGrams = (remainingBaseMl * baseFluidPercent) / 100;
  const addedGrams = (addedAmpouleVolumeMl * ampouleConcPercent) / 100;
  const totalNaClGrams = baseGrams + addedGrams;
  const finalPercent = (totalNaClGrams / finalVolumeMl) * 100;
  const finalMeqL = percentNaClToMeqL(finalPercent);

  return {
    mode: "mode_a_ampoules",
    baseFluidPercent,
    bagVolumeMl,
    withdrawMl,
    remainingBaseMl,
    ampouleCount,
    ampouleVolumeMl,
    ampouleConcPercent,
    addedAmpouleVolumeMl,
    finalVolumeMl,
    baseGrams,
    addedGrams,
    totalNaClGrams,
    finalPercent,
    finalMeqL,
    summaryText: `模式 A（整支安瓿泡製）：${baseFluidPercent}% NaCl ${bagVolumeMl} mL 抽出 ${withdrawMl} mL 丟棄（剩 ${remainingBaseMl} mL）＋ 加入 ${ampouleCount} 支 ${ampouleConcPercent}% NaCl（${addedAmpouleVolumeMl} mL）＝ 總體積 ${finalVolumeMl} mL，實質濃度 ${finalPercent.toFixed(2)}% NaCl (${finalMeqL.toFixed(1)} mEq/L，總含鹽 ${totalNaClGrams.toFixed(2)} g)。`,
  };
}

/**
 * Step 5B：Adrogué-Madias 點滴速率計算機（含所有防呆：分母為零、方向相反、時間 ≤ 0、加鉀、自訂泡製濃度回代）
 */
export function calculateInfusionPlan({
  serumNa,
  tbwL,
  infusateKey = "hypertonic_3",
  customInfusateConcMeqL = 513.3,
  addedKMeqL = 0,
  targetDeltaNaMeqL = 6,
  timeHours = 24,
  remainingHardLimit24h = null,
  desalinationRisk = "low_or_unknown",
  categoryId = null,
}) {
  if (!Number.isFinite(serumNa) || serumNa <= 0) {
    return { isValid: false, error: "請輸入有效的實測血鈉 (Serum Na > 0)" };
  }
  if (!Number.isFinite(tbwL) || tbwL <= 0) {
    return { isValid: false, error: "請輸入有效的體重以計算總體液量 (TBW > 0)" };
  }
  if (!Number.isFinite(timeHours) || timeHours <= 0) {
    return { isValid: false, error: "預計輸注時間 (Hours) 必須大於 0" };
  }
  if (!Number.isFinite(targetDeltaNaMeqL)) {
    return { isValid: false, error: "請輸入有效的目標血鈉變化量 (ΔNa)" };
  }

  const safeAddedK = Number.isFinite(addedKMeqL) && addedKMeqL >= 0 ? addedKMeqL : 0;
  const hourlyGoalMeqL = targetDeltaNaMeqL / timeHours;
  const projected24hChange = hourlyGoalMeqL * 24;

  // 為所有標準點滴建立對照表
  const allFluidsTable = INFUSATES.map((item) => {
    const baseConc =
      item.key === "custom_mix" && Number.isFinite(customInfusateConcMeqL)
        ? customInfusateConcMeqL
        : item.effectiveMeqL;
    const totalConc = baseConc + safeAddedK;
    const deltaNaPer1L = (totalConc - serumNa) / (tbwL + 1);

    let status = "achievable";
    let statusMessage = null;
    let rateMlPerHour = null;
    let totalVolumeMl = null;

    if (Math.abs(targetDeltaNaMeqL) < 1e-6) {
      status = "zero_target";
      rateMlPerHour = 0;
      totalVolumeMl = 0;
      statusMessage = "目標變化量為 0 mEq/L（無需主動輸注變動血鈉）";
    } else if (Math.abs(deltaNaPer1L) < 1e-6) {
      status = "zero_denominator";
      statusMessage =
        "無法達標：輸液有效濃度 (Na+K) 與目前血鈉相等（ΔNa/L = 0），輸注不會改變血鈉";
    } else if (targetDeltaNaMeqL * deltaNaPer1L < 0) {
      status = "opposite_direction";
      statusMessage =
        targetDeltaNaMeqL > 0
          ? `方向相反：此輸液 (Na+K ${totalConc.toFixed(1)} mEq/L) 低於目前血鈉 (${serumNa})，輸注每公升會使血鈉下降 ${Math.abs(deltaNaPer1L).toFixed(2)} mEq/L，無法用來升鈉！`
          : `方向相反：此輸液 (Na+K ${totalConc.toFixed(1)} mEq/L) 高於目前血鈉 (${serumNa})，輸注每公升會使血鈉上升 ${deltaNaPer1L.toFixed(2)} mEq/L，無法用來降鈉！`;
    } else {
      rateMlPerHour = (hourlyGoalMeqL / deltaNaPer1L) * 1000;
      totalVolumeMl = rateMlPerHour * timeHours;
    }

    const isIsotonicDesalinationDanger =
      (item.key === "ns_09" || item.key === "lr_134" || item.key === "lr_130") &&
      (desalinationRisk === "high_confirmed" ||
        desalinationRisk === "suspected_high_uosm" ||
        categoryId === "cat3_euvol_adh");

    return {
      ...item,
      baseConcMeqL: baseConc,
      addedKMeqL: safeAddedK,
      totalConcMeqL: totalConc,
      deltaNaPer1L,
      status,
      statusMessage,
      rateMlPerHour,
      totalVolumeMl,
      isIsotonicDesalinationDanger,
    };
  });

  const selectedFluid =
    allFluidsTable.find((f) => f.key === infusateKey) || allFluidsTable[1];

  const warnings = [];
  if (
    Number.isFinite(remainingHardLimit24h) &&
    targetDeltaNaMeqL > remainingHardLimit24h + 1e-6
  ) {
    warnings.push(
      `🚨 目標升幅 (${targetDeltaNaMeqL.toFixed(1)} mEq/L) 超過本 24h 剩餘安全上限 (${remainingHardLimit24h.toFixed(1)} mEq/L)！有發生滲透壓去髓鞘症候群 (ODS) 之風險，請調降目標升幅。`,
    );
  }
  if (selectedFluid.isIsotonicDesalinationDanger) {
    warnings.push(
      `🚨 脫鹽惡化警示 (Desalination Warning)：Adrogué-Madias 公式僅計算初始細胞外液混合，未計入腎臟排尿！在 SIADH 或高張尿 (U_Na+U_K > 154 / U_Osm > 500) 患者輸注 ${selectedFluid.shortLabel}，腎臟會將鹽分快速排出並滯留水分，實際上會使血鈉不升反降！`,
    );
  }
  warnings.push(
    "📌 臨床監測必讀：Adrogué-Madias 公式假設為封閉系統（不含排尿與不顯性流失）。治療期間一旦出現自發性水利尿（尿量 > 100–200 mL/h），實際血鈉上升速度會遠快於公式預測！務必每 2–4 小時抽血追蹤 Serum Na 並監測每小時尿量。",
  );

  return {
    isValid: true,
    serumNa,
    tbwL,
    targetDeltaNaMeqL,
    timeHours,
    hourlyGoalMeqL,
    projected24hChange,
    selectedFluid,
    allFluidsTable,
    warnings,
  };
}

/**
 * Step 5C：過度矯正救援計算機 (Overcorrection Rescue — D5W + Desmopressin DDAVP)
 * 封閉單室自由水估算：V_D5W (L) = TBW × (Na_current / Na_target - 1)
 * Adrogué-Madias 對照：V_AM (L) = (Na_current - Na_target) / [Na_current / (TBW + 1)]
 * 指引經驗性起始劑量 (ESE 2014 / SALSA 2021)：D5W 10 mL/kg IV over 1 h (或 US 2013: 3 mL/kg/h) + DDAVP 2 μg IV/SC
 */
export function calculateOvercorrectionRescue({
  currentNa,
  targetRelowerNa,
  weightKg,
  tbwL,
}) {
  if (
    !Number.isFinite(currentNa) ||
    currentNa <= 0 ||
    !Number.isFinite(targetRelowerNa) ||
    targetRelowerNa <= 0
  ) {
    return {
      isValid: false,
      error: "請輸入有效的目前血鈉 (Current Na) 與目標降回血鈉 (Target Na)",
    };
  }
  if (targetRelowerNa >= currentNa) {
    return {
      isValid: false,
      error:
        "過度矯正降鈉救援之「目標血鈉 (Target Na)」必須低於「目前血鈉 (Current Na)」",
    };
  }
  if (!Number.isFinite(tbwL) || tbwL <= 0) {
    return {
      isValid: false,
      error: "請先輸入有效體重以計算 TBW",
    };
  }

  const desiredDropMeqL = currentNa - targetRelowerNa;

  // 1. 封閉單室自由水估算公式：V_D5W (L) = TBW * (Na_current / Na_target - 1)
  const closedCompartmentVolumeL = tbwL * (currentNa / targetRelowerNa - 1);
  const closedCompartmentVolumeMl = closedCompartmentVolumeL * 1000;

  // 2. Adrogué-Madias 1L D5W 降幅與推估體積
  const deltaNaPer1LD5w = -currentNa / (tbwL + 1); // mEq/L per 1 L D5W
  const adrogueMadiasVolumeL = desiredDropMeqL / Math.abs(deltaNaPer1LD5w);
  const adrogueMadiasVolumeMl = adrogueMadiasVolumeL * 1000;

  // 3. 指引經驗性起始處置 (ESE 2014 / SALSA 2021 / US 2013)
  const validWeight = Number.isFinite(weightKg) && weightKg > 0;
  const salsaBolus10MlKg = validWeight ? weightKg * 10 : null;
  const usInfusion3MlKgHr = validWeight ? weightKg * 3 : null;
  const per1MeqDrop3MlKg = validWeight ? weightKg * 3 : null;

  return {
    isValid: true,
    currentNa,
    targetRelowerNa,
    desiredDropMeqL,
    tbwL,
    weightKg: validWeight ? weightKg : null,
    closedCompartmentVolumeL,
    closedCompartmentVolumeMl,
    deltaNaPer1LD5w,
    adrogueMadiasVolumeL,
    adrogueMadiasVolumeMl,
    salsaBolus10MlKg,
    usInfusion3MlKgHr,
    per1MeqDrop3MlKg,
    ddavpGuidance: {
      dose: "Desmopressin (DDAVP) 2 μg IV 或 SC（部分方案用 1–2 μg q6–8h）",
      indication:
        "用於阻斷內源性水利尿（Brisk water diuresis，尿量 > 100–200 mL/h），防止在輸注 D5W 時腎臟繼續排出大量稀釋尿而抵銷降鈉效果。",
      contraindicationWarning:
        "⚠️ 若病患為原發性多飲症（Psychogenic polydipsia）且無法配合嚴格禁水／仍會自行大量飲水，給予 DDAVP 可能誘發嚴重急性水中毒與腦水腫，須高度謹慎！",
      monitoringSteps: [
        "1. 立即停止所有升鈉措施（停 3% NaCl、0.9% NaCl、Vaptans、Urea）。",
        "2. 給予 DDAVP 2 μg IV/SC 鎖住尿液自由水排出（除非無法配合限水之多飲症）。",
        "3. 輸注 D5W（如 ESE/SALSA 建議 10 mL/kg over 1h，或 US 建議 3 mL/kg/h 連續滴注），每 1–2 小時抽血複查 Serum Na。",
        "4. 一旦血鈉安全降回 24h 目標上限以內，即調降或停止快速 D5W 灌注，改依尿量等量補充維持血鈉穩定。",
      ],
    },
  };
}

/**
 * 鈉缺失量 (MDCalc #95 Sodium Deficit in Hyponatremia)
 * 鈉缺失量 (mEq) = TBW × (目標 Na − 實測 Na)；換算點滴體積 (mL) = 缺失量 ÷ 點滴濃度 × 1000
 * 注意：未計入點滴本身帶入的水分，所需體積會比 Adrogué-Madias 公式少，僅供對照
 */
export function calculateSodiumDeficit({ tbwL, serumNa, targetNa, infusateMeqL = 513.3 }) {
  if (
    !Number.isFinite(tbwL) ||
    tbwL <= 0 ||
    !Number.isFinite(serumNa) ||
    serumNa <= 0 ||
    !Number.isFinite(targetNa) ||
    targetNa <= serumNa ||
    !Number.isFinite(infusateMeqL) ||
    infusateMeqL <= 0
  ) {
    return null;
  }
  const deficitMeq = tbwL * (targetNa - serumNa);
  return {
    deficitMeq,
    infusateMeqL,
    infusateVolumeMl: (deficitMeq / infusateMeqL) * 1000,
  };
}

/**
 * 產生去識別化臨床病歷摘要 (EMR Clinical Note)
 * 僅供臨床評估紀錄參考，不產生直接可照抄之未覆核醫囑
 */
export function buildClinicalSummaryNote({
  tbwResult,
  step1,
  step2,
  step34,
  infusionPlan,
  mixingResult,
  rescueResult,
}) {
  const lines = [
    "【Hyponatremia Clinical Assessment & Rate Reference】",
    `• Serum Na: ${Number.isFinite(step1?.serumNa) ? `${step1.serumNa} mEq/L` : "未填"}｜Onset: ${step1?.onset === "acute_lt_48h" ? "< 48h (Acute)" : "≥ 48h or Unknown (Chronic)"}`,
  ];

  if (tbwResult?.tbwL) {
    lines.push(`• TBW 估算: ${tbwResult.description}`);
  }

  if (step1) {
    const symMap = {
      severe: "Severe symptoms (嚴重神經學症狀)",
      moderate: "Moderately severe symptoms (中度嚴重症狀)",
      mild_none: "Mild or asymptomatic (無或輕微症狀)",
    };
    lines.push(`• Step 1 症狀分級: ${symMap[step1.effectiveSeverity] || step1.effectiveSeverity}`);
    if (step1.isEmergencyBolusIndicated && step1.activeStepProtocol) {
      lines.push(`  - 急症處置參考 (${step1.regimen.name}): ${step1.activeStepProtocol.title}`);
      if (step1.activeRegimenBolus) {
        lines.push(
          `  - 單次 ${step1.activeRegimenBolus.bolusMl} mL Bolus 預期升幅 (有限體積公式): +${step1.activeRegimenBolus.deltaNaFinite.toFixed(2)} mEq/L`,
        );
      }
    }
    lines.push(
      `• ODS 風險與矯正上限 (${step1.limits.profileName}): 24h 目標 ${step1.limits.targetMin24h}–${step1.limits.targetMax24h} (建議 ${step1.limits.recommendedTarget24h})｜警示門檻 ${step1.limits.warning24h}｜24h 絕對上限 ≤ ${step1.limits.hardLimit24h} mEq/L (48h ≤ ${step1.limits.hardLimit48h} mEq/L)`,
    );
    if (step1.activeMajorOdsReasons.length > 0) {
      lines.push(`  - 主要 ODS 風險因子: ${step1.activeMajorOdsReasons.join("、")}`);
    }
    if (step1.priorRise24h > 0 || step1.plannedBolusRise > 0) {
      lines.push(
        `  - 24h 累計追蹤: 先前已升 +${step1.priorRise24h.toFixed(1)} mEq/L${step1.plannedBolusRise > 0 ? `，計入本次 Bolus (+${step1.plannedBolusRise.toFixed(1)})` : ""} → 剩餘 24h 目標配額 ${step1.remainingRecommendedTarget24h.toFixed(1)} mEq/L (剩餘上限配額 ${step1.remainingHardLimit24h.toFixed(1)} mEq/L)`,
      );
    }
  }

  if (step2?.isValid) {
    lines.push(`• Step 2 滲透壓與張力判讀: ${step2.branchTitle}`);
    lines.push(
      `  - Measured Osm: ${step2.measuredOsm ?? "未填"} mOsm/kg｜Effective Tonicity (2×Na+Glc/18): ${step2.effectiveOsm.toFixed(1)} mOsm/kg｜Calc Osm: ${step2.calculatedOsmNoEthanol.toFixed(1)} mOsm/kg${step2.osmolalGapNoEthanol !== null ? `｜Osm Gap: ${step2.osmolalGapNoEthanol.toFixed(1)}` : ""}`,
    );
    if (step2.katzCorrectedNa !== null) {
      lines.push(
        `  - 高血糖校正 Na: Katz ${step2.katzCorrectedNa.toFixed(1)} mEq/L / Hillier ${step2.hillierCorrectedNa.toFixed(1)} mEq/L`,
      );
    }
  }

  if (step34?.hasUrineOsm) {
    lines.push(
      `• Step 3/4 尿液與體液分類: U_Osm ${step34.urineOsm} mOsm/kg｜U_Na ${step34.urineNa ?? "未填"} mEq/L${step34.hasUrineK ? `｜U_K ${step34.urineK} mEq/L (Fürst ratio ${step34.furstRatio ? step34.furstRatio.toFixed(2) : "N/A"})` : ""}｜ECF: ${step34.volumeStatus}`,
    );
    if (step34.primaryCategory) {
      lines.push(
        `  - 主分類: ${step34.primaryCategory.code} — ${step34.primaryCategory.name}`,
      );
    }
    if (step34.feUrea !== null) {
      lines.push(`  - FE_Urea: ${step34.feUrea.toFixed(1)}% (${step34.feUreaUnitNote})`);
    }
    if (step34.feUa !== null) {
      lines.push(`  - FE_UA: ${step34.feUa.toFixed(1)}%`);
    }
  }

  if (infusionPlan?.isValid && infusionPlan.selectedFluid) {
    const sf = infusionPlan.selectedFluid;
    lines.push(
      `• Step 5 輸液速率試算 (Adrogué-Madias): 選用 ${sf.shortLabel} (有效 Na+K = ${sf.totalConcMeqL.toFixed(1)} mEq/L) → ΔNa/1L = ${sf.deltaNaPer1L >= 0 ? "+" : ""}${sf.deltaNaPer1L.toFixed(2)} mEq/L`,
    );
    if (sf.rateMlPerHour !== null) {
      lines.push(
        `  - 目標 ${infusionPlan.targetDeltaNaMeqL >= 0 ? "+" : ""}${infusionPlan.targetDeltaNaMeqL.toFixed(1)} mEq/L over ${infusionPlan.timeHours}h: 估算起始速率 ${sf.rateMlPerHour.toFixed(1)} mL/h (總量 ${sf.totalVolumeMl.toFixed(0)} mL)`,
      );
    } else if (sf.statusMessage) {
      lines.push(`  - 速率試算提示: ${sf.statusMessage}`);
    }
  }

  if (mixingResult) {
    lines.push(`• 3% NaCl 床邊泡製換算參考: ${mixingResult.summaryText}`);
  }

  if (rescueResult?.isValid) {
    lines.push(
      `• 過度矯正救援試算 (${rescueResult.currentNa} → ${rescueResult.targetRelowerNa} mEq/L): 封閉單室自由水估算 D5W ${rescueResult.closedCompartmentVolumeMl.toFixed(0)} mL${rescueResult.salsaBolus10MlKg ? `｜指引起始 D5W 10 mL/kg = ${rescueResult.salsaBolus10MlKg.toFixed(0)} mL over 1h` : ""} ± DDAVP 2 μg IV/SC`,
    );
  }

  lines.push(
    "⚠️ 備註：本摘要由臨床決策輔助工具產生，不含病患個資；公式未涵蓋自發性水利尿，請每 2–4h 追蹤 Serum Na 與每小時尿量，並由醫師與藥師覆核。",
  );

  return lines.join("\n");
}

/**
 * 單次作業狀態管理器（不寫入 localStorage，且任何輸入變更立即使舊結果／病歷摘要失效）
 */
export function createSessionEvaluationStore() {
  let revision = 0;
  let isStale = true;
  let lastResult = null;
  let copyableSummary = null;

  return {
    markInputChanged() {
      revision += 1;
      isStale = true;
      copyableSummary = null;
      return { revision, isStale, copyableSummary };
    },
    commitEvaluation(payload) {
      revision += 1;
      isStale = false;
      lastResult = payload;
      copyableSummary = buildClinicalSummaryNote(payload);
      return {
        revision,
        isStale,
        lastResult,
        copyableSummary,
      };
    },
    clearAll() {
      revision += 1;
      isStale = true;
      lastResult = null;
      copyableSummary = null;
      return {
        revision,
        isStale,
        lastResult,
        copyableSummary,
      };
    },
    getState() {
      return {
        revision,
        isStale,
        lastResult: isStale ? null : lastResult,
        copyableSummary: isStale ? null : copyableSummary,
      };
    },
  };
}

