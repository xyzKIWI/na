import assert from "node:assert/strict";
import test from "node:test";
import {
  parseOptionalNumber,
  percentNaClToMeqL,
  calculateTbw,
  calculateFiniteBolusDeltaNa,
  evaluateStep1Triage,
  evaluateStep2Osmolality,
  evaluateStep3And4UrineAndClassification,
  calculate3PercentMixing,
  calculateInfusionPlan,
  calculateOvercorrectionRescue,
  buildClinicalSummaryNote,
  createSessionEvaluationStore,
} from "./na.js";

test("parseOptionalNumber distinguishes empty input from zero and rejects NaN/Infinity", () => {
  assert.equal(parseOptionalNumber(""), null);
  assert.equal(parseOptionalNumber("   "), null);
  assert.equal(parseOptionalNumber(null), null);
  assert.equal(parseOptionalNumber(undefined), null);
  assert.equal(parseOptionalNumber("0"), 0);
  assert.equal(parseOptionalNumber(0), 0);
  assert.equal(parseOptionalNumber("118.5"), 118.5);
  assert.ok(Number.isNaN(parseOptionalNumber("abc")));
  assert.ok(Number.isNaN(parseOptionalNumber(Number.NaN)));
  assert.ok(Number.isNaN(parseOptionalNumber(Number.POSITIVE_INFINITY)));
  assert.ok(Number.isNaN(parseOptionalNumber(Number.NEGATIVE_INFINITY)));
});

test("calculateTbw supports MDCalc #480 fraction and Watson (1980) with fallback when height is missing", () => {
  // Young male: 0.6 * 70 = 42.0 L
  const mYoung = calculateTbw({ weightKg: 70, sex: "male", ageYears: 40, method: "fraction" });
  assert.equal(mYoung.tbwL, 42);
  assert.equal(mYoung.methodUsed, "fraction");

  // Elderly male: 0.5 * 70 = 35.0 L
  const mOld = calculateTbw({ weightKg: 70, sex: "male", ageYears: 70, method: "fraction" });
  assert.equal(mOld.tbwL, 35);

  // Young female: 0.5 * 60 = 30.0 L
  const fYoung = calculateTbw({ weightKg: 60, sex: "female", ageYears: 40, method: "fraction" });
  assert.equal(fYoung.tbwL, 30);

  // Elderly female: 0.45 * 60 = 27.0 L
  const fOld = calculateTbw({ weightKg: 60, sex: "female", ageYears: 72, method: "fraction" });
  assert.ok(Math.abs(fOld.tbwL - 27) < 1e-9);

  // Watson missing height falls back cleanly to fraction
  const wFallback = calculateTbw({
    weightKg: 70,
    sex: "male",
    ageYears: 50,
    heightCm: null,
    method: "watson",
  });
  assert.equal(wFallback.methodUsed, "fraction");
  assert.equal(wFallback.usedFallback, true);
  assert.equal(wFallback.tbwL, 42);

  // Watson with valid height (Male: 2.447 - 0.09516*50 + 0.1074*170 + 0.3362*70 = 39.481 L)
  const wMale = calculateTbw({
    weightKg: 70,
    sex: "male",
    ageYears: 50,
    heightCm: 170,
    method: "watson",
  });
  assert.equal(wMale.methodUsed, "watson");
  assert.equal(wMale.usedFallback, false);
  assert.ok(Math.abs(wMale.tbwL - 39.481) < 1e-3);
});

test("calculateFiniteBolusDeltaNa uses finite-volume formula V(C-S)/(W+V)", () => {
  // TBW = 30 L, Serum Na = 113.3, Infusate = 513.3 (C - S = 400)
  // 150 mL (0.15 L): 0.15 * 400 / (30 + 0.15) = 60 / 30.15 = 1.99004975 mEq/L
  const b150 = calculateFiniteBolusDeltaNa({
    tbwL: 30,
    serumNa: 113.3,
    bolusMl: 150,
    infusateNaPlusK: 513.3,
  });
  assert.ok(Math.abs(b150.deltaNaFinite - 60 / 30.15) < 1e-6);
  // 100 mL (0.10 L): 0.10 * 400 / 30.10 = 40 / 30.10 = 1.3289 mEq/L
  const b100 = calculateFiniteBolusDeltaNa({
    tbwL: 30,
    serumNa: 113.3,
    bolusMl: 100,
    infusateNaPlusK: 513.3,
  });
  assert.ok(Math.abs(b100.deltaNaFinite - 40 / 30.1) < 1e-6);
});

test("Step 1 triage triggers immediate emergency alert, separates symptom grades, and tracks cumulative 24h quota", () => {
  // Immediate severe alert even before serumNa or weightKg are filled
  const earlyAlert = evaluateStep1Triage({
    serumNa: null,
    symptomSeverity: "severe",
    regimenKey: "us_2013",
  });
  assert.equal(earlyAlert.isEmergencyBolusIndicated, true);
  assert.equal(earlyAlert.effectiveSeverity, "severe");
  assert.match(earlyAlert.activeStepProtocol.title, /100 mL/);

  // Secondary modifier alone (olderFemaleThiazide) does NOT trigger major ODS profile, whereas Na <= 105 does
  const secOnly = evaluateStep1Triage({
    serumNa: 118,
    secondaryOdsFlags: { olderFemaleThiazide: true },
  });
  assert.equal(secOnly.hasMajorOdsRisk, false);
  assert.equal(secOnly.hasSecondaryOdsRisk, true);
  assert.equal(secOnly.limits.hardLimit24h, 10);

  const majorOds = evaluateStep1Triage({
    serumNa: 104,
    weightKg: 60,
    tbwL: 30,
    initialNa24h: 99, // Already rose by 5 mEq/L in current 24h!
    elapsedHours24h: 8,
  });
  assert.equal(majorOds.hasMajorOdsRisk, true);
  assert.equal(majorOds.limits.recommendedTarget24h, 5);
  assert.equal(majorOds.limits.warning24h, 6);
  assert.equal(majorOds.limits.hardLimit24h, 8);
  assert.equal(majorOds.priorRise24h, 5);
  assert.equal(majorOds.remainingRecommendedTarget24h, 0);
  assert.equal(majorOds.remainingHardLimit24h, 3);
  assert.equal(majorOds.suggestedHourlyRateMeqL, 0);

  // Exceeding 24h hard limit triggers overcorrection alert
  const exceeded = evaluateStep1Triage({
    serumNa: 112,
    initialNa24h: 102, // +10 mEq/L in high ODS risk (initial 102 <= 105, or alcoholism)
    majorOdsFlags: { alcoholism: true },
  });
  assert.equal(exceeded.overcorrectionStatus, "exceeded_hard_limit");
  assert.match(exceeded.overcorrectionAlert, /已超過絕對安全上限/);

  // Finite-volume 300 mL bolus (2 x 150 mL) uses V=0.3L rather than 2 * bolus150
  const withBolus300 = evaluateStep1Triage({
    serumNa: 113.3,
    weightKg: 60,
    tbwL: 30,
    onset: "acute_lt_48h",
  });
  assert.ok(Math.abs(withBolus300.bolus300.deltaNaFinite - 120 / 30.3) < 1e-6);
  assert.ok(withBolus300.bolus300.deltaNaFinite < withBolus300.bolus150.deltaNaFinite * 2);
  assert.match(withBolus300.onsetNote, /明確急性發作/);

  // Serum Na >= 135 sets isHyponatremia = false and provides nonHyponatremiaNote
  const normalNa = evaluateStep1Triage({ serumNa: 140 });
  assert.equal(normalNa.isHyponatremia, false);
  assert.match(normalNa.nonHyponatremiaNote, /正常血鈉範圍/);
});

test("Step 2 osmolality separates glucose-corrected Na from measured Na and catches hypotonic hyponatremia with high BUN/ethanol", () => {
  // Case 0: Normal Na or Hypernatremia (Na >= 135) must NOT be classified as hyponatremia
  const notHypo = evaluateStep2Osmolality({
    serumNa: 140,
    measuredOsm: 278,
    glucoseMgDl: 90,
    bunMgDl: 14,
  });
  assert.equal(notHypo.branchId, "not_hyponatremia");
  assert.equal(notHypo.proceedToStep3, false);

  // Case A1: Azotemia / Ethanol with Measured Osm = 295 (> 285!), Na = 118, Glucose = 90, BUN = 140 (BUN/2.8 = 50)
  // Effective Osm = 2*118 + 5 = 241 (< 280!)
  // Must NOT be misclassified as hypertonic! Must be hypotonic_with_ineffective_osmoles & proceedToStep3 = true
  const azotemiaCase = evaluateStep2Osmolality({
    serumNa: 118,
    measuredOsm: 295,
    glucoseMgDl: 90,
    bunMgDl: 140,
  });
  assert.equal(azotemiaCase.effectiveOsm, 241);
  assert.equal(azotemiaCase.branchId, "hypotonic_with_ineffective_osmoles");
  assert.equal(azotemiaCase.proceedToStep3, true);

  // Case A2: Azotemia in the 275-280 effectiveOsm zone (Na = 134, Glucose = 144 -> Effective Osm = 276 < 280; BUN = 84 -> Calc = 306, Measured = 306)
  const azotemia276 = evaluateStep2Osmolality({
    serumNa: 134,
    measuredOsm: 306,
    glucoseMgDl: 144,
    bunMgDl: 84,
  });
  assert.equal(azotemia276.effectiveOsm, 276);
  assert.equal(azotemia276.branchId, "hypotonic_with_ineffective_osmoles");
  assert.equal(azotemia276.proceedToStep3, true);

  // Case A3: Milder azotemia (Na = 132, Glucose = 90 -> Effective Osm = 269 < 280; BUN = 31 -> +11.1, Measured = 280)
  const azotemiaMild = evaluateStep2Osmolality({
    serumNa: 132,
    measuredOsm: 280,
    glucoseMgDl: 90,
    bunMgDl: 31,
  });
  assert.equal(azotemiaMild.branchId, "hypotonic_with_ineffective_osmoles");
  assert.equal(azotemiaMild.proceedToStep3, true);

  // Case B: Severe hyperglycemia (Na = 124, Glucose = 700, BUN = 28, Measured Osm = 318)
  const hyperglyCase = evaluateStep2Osmolality({
    serumNa: 124,
    measuredOsm: 318,
    glucoseMgDl: 700,
    bunMgDl: 28,
  });
  assert.ok(Math.abs(hyperglyCase.katzCorrectedNa - 133.6) < 1e-6);
  assert.ok(Math.abs(hyperglyCase.hillierCorrectedNa - 138.4) < 1e-6);
  // Calculated Osm MUST use measured Na (2*124 = 248), not Katz Na!
  assert.ok(Math.abs(hyperglyCase.calculatedOsmNoEthanol - (248 + 700 / 18 + 10)) < 1e-6);
  assert.equal(hyperglyCase.branchId, "hypertonic");

  // Case C1: Classic Pseudohyponatremia on Indirect ISE (Na = 122, Measured Osm = 283, Glc = 90, BUN = 14)
  // Because Indirect ISE Na is falsely low (122), Calc Osm is 254 and apparent Osm Gap is 29 (> 10).
  // On Indirect ISE, this MUST still be identified as isotonic_pseudohyponatremia (and warn about both pseudohyponatremia & unmeasured osmoles)
  const pseudoIndirect122 = evaluateStep2Osmolality({
    serumNa: 122,
    measuredOsm: 283,
    glucoseMgDl: 90,
    bunMgDl: 14,
    iseMethod: "indirect",
  });
  assert.equal(pseudoIndirect122.branchId, "isotonic_pseudohyponatremia");
  assert.equal(pseudoIndirect122.proceedToStep3, false);
  assert.match(pseudoIndirect122.clinicalSummary, /假性低血鈉/);

  // Case C2: Same numbers on Direct ISE (where lipid/protein artifact is already excluded) -> isotonic_high_gap
  const directHighGap122 = evaluateStep2Osmolality({
    serumNa: 122,
    measuredOsm: 283,
    glucoseMgDl: 90,
    bunMgDl: 14,
    iseMethod: "direct",
  });
  assert.equal(directHighGap122.branchId, "isotonic_high_gap");
  assert.equal(directHighGap122.proceedToStep3, true);

  // Case D: True hypotonic hyponatremia (< 280)
  const hypotonicCase = evaluateStep2Osmolality({
    serumNa: 116,
    measuredOsm: 245,
    glucoseMgDl: 90,
    bunMgDl: 14,
  });
  assert.equal(hypotonicCase.branchId, "true_hypotonic");
  assert.equal(hypotonicCase.proceedToStep3, true);
});

test("Step 3 & 4 urine boundaries, gray zone, 6 categories, equivocal volume, FEUrea unit modes, and desalination check", () => {
  // Boundary U_Osm = 100 -> Category 4 (dilute urine)
  const uosm100 = evaluateStep3And4UrineAndClassification({
    serumNa: 118,
    urineOsm: 100,
    urineNa: 15,
    volumeStatus: "euvolemic",
  });
  assert.equal(uosm100.primaryCategory.id, "cat4_dilute_urine");

  // Boundary U_Osm = 101, U_Na = 25 (in 20-30 gray zone):
  // With cutoff = 30 (ESE): U_Na 25 <= 30 -> low U_Na (Cat 1 when hypovolemic)
  // With cutoff = 20 (US): U_Na 25 > 20 -> high U_Na (Cat 2 when hypovolemic)
  const gray30 = evaluateStep3And4UrineAndClassification({
    serumNa: 118,
    urineOsm: 101,
    urineNa: 25,
    volumeStatus: "hypovolemic",
    uNaCutoffMode: 30,
  });
  assert.equal(gray30.isUNaGrayZone, true);
  assert.equal(gray30.primaryCategory.id, "cat1_hypovol_low_una");

  const gray20 = evaluateStep3And4UrineAndClassification({
    serumNa: 118,
    urineOsm: 101,
    urineNa: 25,
    volumeStatus: "hypovolemic",
    uNaCutoffMode: 20,
  });
  assert.equal(gray20.isUNaGrayZone, true);
  assert.equal(gray20.primaryCategory.id, "cat2_hypovol_high_una");

  // Category 3 (Euvolemic SIADH) with U_Na = 110, U_K = 55 -> U_Na + U_K = 165 > 154 (high desalination risk!)
  const cat3Desal = evaluateStep3And4UrineAndClassification({
    serumNa: 118,
    urineOsm: 540,
    urineNa: 110,
    urineK: 55,
    volumeStatus: "euvolemic",
  });
  assert.equal(cat3Desal.primaryCategory.id, "cat3_euvol_adh");
  assert.equal(cat3Desal.desalinationRisk, "high_confirmed");
  assert.ok(cat3Desal.furstRatio > 1.0);
  assert.ok(cat3Desal.primaryCategory.mandatoryExclusions.length >= 3);

  // Category 5 & Category 6 (Hypervolemic low vs high U_Na)
  const cat5 = evaluateStep3And4UrineAndClassification({
    serumNa: 122,
    urineOsm: 420,
    urineNa: 12,
    volumeStatus: "hypervolemic",
  });
  assert.equal(cat5.primaryCategory.id, "cat5_hypervol_low_una");

  const cat6 = evaluateStep3And4UrineAndClassification({
    serumNa: 122,
    urineOsm: 310,
    urineNa: 45,
    volumeStatus: "hypervolemic",
  });
  assert.equal(cat6.primaryCategory.id, "cat6_hypervol_high_una");

  // Equivocal volume status provides multiple candidate categories
  const equivocal = evaluateStep3And4UrineAndClassification({
    serumNa: 118,
    urineOsm: 380,
    urineNa: 48,
    volumeStatus: "equivocal",
  });
  assert.equal(equivocal.classificationMode, "equivocal_volume_comparison");
  assert.ok(equivocal.candidateCategories.length >= 2);

  // FEUrea unit conversion: Serum BUN = 20 mg/dL, Urine Urea = 428 mg/dL (which is 200 mg/dL UUN), S_Cr = 1.0, U_Cr = 40
  // FEUrea = (200 * 1.0) / (20 * 40) * 100 = 25% (< 35% prerenal)
  const withFe = evaluateStep3And4UrineAndClassification({
    serumNa: 120,
    urineOsm: 400,
    urineNa: 40,
    volumeStatus: "hypovolemic",
    confounders: { onDiuretics: true },
    feInputs: {
      serumCr: 1.0,
      urineCr: 40,
      serumUrea: 20,
      urineUrea: 428,
      ureaUnitMode: "bun_and_urine_urea",
      serumUa: 3.2,
      urineUa: 60,
      urineCl: 12,
    },
  });
  assert.ok(Math.abs(withFe.feUrea - 25) < 1e-6);
  assert.match(withFe.feUreaInterpretation, /< 35%/);
  assert.match(withFe.urineClNote, /< 20/);
});

test("3% NaCl bedside mixing Mode A and Mode B math and feedback into Adrogué-Madias rate calculator", () => {
  // Mode A default: 500 mL 0.9% NaCl - 100 mL + 6 amps (120 mL) of 10% NaCl = 520 mL, 15.6 g, 3.000% (513.347 mEq/L)
  const mixA = calculate3PercentMixing({
    mode: "mode_a_ampoules",
    baseFluidPercent: 0.9,
    bagVolumeMl: 500,
    withdrawMl: 100,
    ampouleCount: 6,
    ampouleVolumeMl: 20,
    ampouleConcPercent: 10,
  });
  assert.equal(mixA.finalVolumeMl, 520);
  assert.ok(Math.abs(mixA.totalNaClGrams - 15.6) < 1e-9);
  assert.ok(Math.abs(mixA.finalPercent - 3.0) < 1e-9);
  assert.ok(Math.abs(mixA.finalMeqL - percentNaClToMeqL(3.0)) < 1e-6);

  // Mode A custom: 500 mL 0.9% NaCl - 100 mL + 5 amps (100 mL) of 10% NaCl = 500 mL, 13.6 g = 2.72% (465.43 mEq/L)
  const mixCustom = calculate3PercentMixing({
    mode: "mode_a_ampoules",
    baseFluidPercent: 0.9,
    bagVolumeMl: 500,
    withdrawMl: 100,
    ampouleCount: 5,
    ampouleVolumeMl: 20,
    ampouleConcPercent: 10,
  });
  assert.equal(mixCustom.finalVolumeMl, 500);
  assert.ok(Math.abs(mixCustom.finalPercent - 2.72) < 1e-9);

  // Feed mixCustom.finalMeqL back into calculateInfusionPlan
  const planCustom = calculateInfusionPlan({
    serumNa: 115,
    tbwL: 35,
    infusateKey: "custom_mix",
    customInfusateConcMeqL: mixCustom.finalMeqL,
    addedKMeqL: 20,
    targetDeltaNaMeqL: 6,
    timeHours: 24,
  });
  assert.equal(planCustom.isValid, true);
  assert.ok(
    Math.abs(planCustom.selectedFluid.totalConcMeqL - (mixCustom.finalMeqL + 20)) < 1e-6,
  );

  // Mode B isovolumetric: 500 mL target 3.0% -> exactReplaceMl = 500 * 2.1 / 9.1 = 115.3846 mL; rounded 6 amps (120 mL) = 3.084%
  const mixB = calculate3PercentMixing({
    mode: "mode_b_isovolumetric",
    baseFluidPercent: 0.9,
    bagVolumeMl: 500,
    targetPercent: 3.0,
  });
  assert.ok(Math.abs(mixB.exactReplaceMl - 1050 / 9.1) < 1e-6);
  assert.ok(
    Math.abs(mixB.roundedWholeAmpouleComparison.finalPercent - 3.084) < 1e-6,
  );
});

test("calculateInfusionPlan handles LR 134 vs 130, 2% NaCl 342.2, zero denominator, and opposite direction", () => {
  const plan = calculateInfusionPlan({
    serumNa: 134,
    tbwL: 35,
    infusateKey: "lr_134",
    targetDeltaNaMeqL: 4,
    timeHours: 24,
  });
  // When serumNa == 134 and LR is 134 mEq/L, denominator deltaNaPer1L is 0!
  assert.equal(plan.selectedFluid.status, "zero_denominator");
  assert.equal(plan.selectedFluid.rateMlPerHour, null);

  // D5W (0 mEq/L) or 0.45% NaCl (77 mEq/L) when trying to raise Na (+6 mEq/L) -> opposite_direction
  const d5wRaise = plan.allFluidsTable.find((f) => f.key === "d5w");
  assert.equal(d5wRaise.status, "opposite_direction");
  assert.equal(d5wRaise.rateMlPerHour, null);

  // 2% NaCl exact concentration is 342.2 mEq/L
  const twoPct = plan.allFluidsTable.find((f) => f.key === "hypertonic_2");
  assert.equal(twoPct.baseConcMeqL, 342.2);
});

test("calculateOvercorrectionRescue computes closed-compartment D5W volume and SALSA 10 mL/kg bolus", () => {
  // TBW = 36 L, Current Na = 126, Target Relower Na = 120
  // Closed compartment: 36 * (126/120 - 1) = 36 * 0.05 = 1.8 L = 1800 mL
  const rescue = calculateOvercorrectionRescue({
    currentNa: 126,
    targetRelowerNa: 120,
    weightKg: 60,
    tbwL: 36,
  });
  assert.equal(rescue.isValid, true);
  assert.ok(Math.abs(rescue.closedCompartmentVolumeMl - 1800) < 1e-6);
  assert.equal(rescue.salsaBolus10MlKg, 600);
  assert.equal(rescue.usInfusion3MlKgHr, 180);

  // Rejects when targetRelowerNa >= currentNa
  const invalidRescue = calculateOvercorrectionRescue({
    currentNa: 120,
    targetRelowerNa: 122,
    weightKg: 60,
    tbwL: 36,
  });
  assert.equal(invalidRescue.isValid, false);
});

test("createSessionEvaluationStore invalidates stale results and clinical summary immediately on input change or clear", () => {
  const store = createSessionEvaluationStore();
  assert.equal(store.getState().isStale, true);
  assert.equal(store.getState().copyableSummary, null);

  const tbwResult = calculateTbw({ weightKg: 60, sex: "female", ageYears: 45 });
  const step1 = evaluateStep1Triage({
    serumNa: 114,
    symptomSeverity: "moderate",
    regimenKey: "ese_2014",
    weightKg: 60,
    tbwL: tbwResult.tbwL,
  });
  const step2 = evaluateStep2Osmolality({
    serumNa: 114,
    measuredOsm: 242,
    glucoseMgDl: 95,
    bunMgDl: 14,
  });
  const step34 = evaluateStep3And4UrineAndClassification({
    serumNa: 114,
    urineOsm: 450,
    urineNa: 62,
    urineK: 30,
    volumeStatus: "euvolemic",
  });
  const infusionPlan = calculateInfusionPlan({
    serumNa: 114,
    tbwL: tbwResult.tbwL,
    infusateKey: "hypertonic_3",
    targetDeltaNaMeqL: 6,
    timeHours: 24,
  });

  const committed = store.commitEvaluation({
    tbwResult,
    step1,
    step2,
    step34,
    infusionPlan,
  });
  assert.equal(committed.isStale, false);
  assert.match(committed.copyableSummary, /Serum Na: 114 mEq\/L/);
  assert.match(committed.copyableSummary, /Category 3/);

  // Modifying any input must immediately invalidate stale summary and result
  store.markInputChanged();
  assert.equal(store.getState().isStale, true);
  assert.equal(store.getState().copyableSummary, null);
  assert.equal(store.getState().lastResult, null);

  // Re-commit then clearAll
  store.commitEvaluation({ tbwResult, step1, step2, step34, infusionPlan });
  assert.equal(store.getState().isStale, false);
  store.clearAll();
  assert.equal(store.getState().isStale, true);
  assert.equal(store.getState().copyableSummary, null);
});


test("calculateSodiumDeficit follows MDCalc #95: TBW × (target − current), converted to 3% NaCl volume", async () => {
  const { calculateSodiumDeficit } = await import("./na.js");
  // TBW 30 L, Na 110 → 114: 30 × 4 = 120 mEq → 120 / 513.3 × 1000 = 233.8 mL
  const r = calculateSodiumDeficit({ tbwL: 30, serumNa: 110, targetNa: 114 });
  assert.equal(r.deficitMeq, 120);
  assert.ok(Math.abs(r.infusateVolumeMl - (120 / 513.3) * 1000) < 1e-9);
  assert.equal(calculateSodiumDeficit({ tbwL: 30, serumNa: 110, targetNa: 110 }), null);
  assert.equal(calculateSodiumDeficit({ tbwL: null, serumNa: 110, targetNa: 114 }), null);
  assert.equal(calculateSodiumDeficit({ tbwL: 30, serumNa: null, targetNa: 114 }), null);
});

test("FE_Urea interpretation uses the ESE 2014 Table 6 SIAD cutoff of > 55%", () => {
  const fe = (urineUrea) =>
    evaluateStep3And4UrineAndClassification({
      urineOsm: 400,
      urineNa: 40,
      feInputs: { serumCr: 1, urineCr: 100, serumUrea: 10, urineUrea },
    }).feUreaInterpretation;
  assert.match(fe(500), /35–55%/); // FE_Urea 50%
  assert.match(fe(560), /> 55%/); // FE_Urea 56%
  assert.match(fe(349), /< 35%/);
});

test("calculateWeightBasedInfusionRange converts US 2013 0.5–2 mL/kg/h to mL/h", async () => {
  const { calculateWeightBasedInfusionRange, US_2013_MODERATE_INFUSION_ML_PER_KG_H } = await import("./na.js");
  assert.deepEqual(US_2013_MODERATE_INFUSION_ML_PER_KG_H, { min: 0.5, max: 2 });
  assert.deepEqual(calculateWeightBasedInfusionRange({ weightKg: 60 }), { minMlPerHour: 30, maxMlPerHour: 120 });
  assert.equal(calculateWeightBasedInfusionRange({ weightKg: null }), null);
  assert.equal(calculateWeightBasedInfusionRange({ weightKg: 0 }), null);
});
