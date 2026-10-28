
"use strict";

const $ = (id) => document.getElementById(id);

const defaults = {
  mode: "analysis",
  force: "100",
  material: "79300",
  customG: "79300",
  wire: "5",
  mean: "40",
  coils: "8",
  targetDeflection: "10",
  springIndex: "8"
};

function getMode() {
  return $("mode").value;
}

function getShearModulus() {
  return $("material").value === "custom"
    ? Number($("customG").value)
    : Number($("material").value);
}

function updateMode() {
  const design = getMode() === "design";

  $("wireField").classList.toggle("hidden", design);
  $("meanField").classList.toggle("hidden", design);
  $("deflectionField").classList.toggle("hidden", !design);
  $("indexField").classList.toggle("hidden", !design);
  $("customGField").classList.toggle(
    "hidden",
    $("material").value !== "custom"
  );

  $("modeNote").textContent = design
    ? "Enter the required load and deflection, spring index and active coils. The calculator estimates the wire and mean coil diameters."
    : "Enter the spring dimensions and applied load to calculate its performance.";
}

function showError(message) {
  $("errorMessage").textContent = message;
}

function clearError() {
  showError("");
}

function getPositive(id, label) {
  const value = Number($(id).value);

  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a number greater than zero.`);
  }

  return value;
}

function validateInputs() {
  const F = getPositive("force", "Applied force");
  const G = getPositive("material", "Shear modulus");

  if ($("material").value === "custom") {
    getPositive("customG", "Custom shear modulus");
  }

  const Na = getPositive("coils", "Active coils");

  if (Na > 1000) {
    throw new Error("Active coils must not exceed 1000.");
  }

  if (getMode() === "analysis") {
    return {
      F,
      G,
      Na,
      d: getPositive("wire", "Wire diameter"),
      D: getPositive("mean", "Mean coil diameter")
    };
  }

  const delta = getPositive(
    "targetDeflection",
    "Target deflection"
  );
  const C = getPositive("springIndex", "Spring index");

  if (C < 4 || C > 12) {
    throw new Error(
      "For this calculator, use a spring index between 4 and 12."
    );
  }

  if (Na < 1) {
    throw new Error("Active coils must be at least 1 for design mode.");
  }

  return { F, G, Na, delta, C };
}

function calculateSpring(input) {
  let { F, G, Na, d, D, delta, C } = input;
  const mode = getMode();

  if (mode === "design") {
    // From delta = 8*F*C^3*Na / (G*d)
    d = (8 * F * Math.pow(C, 3) * Na) / (G * delta);
    D = C * d;

    if (!Number.isFinite(d) || !Number.isFinite(D) || d <= 0 || D <= 0) {
      throw new Error(
        "The design inputs produce invalid dimensions. Check the load, material and target deflection."
      );
    }
  } else {
    C = D / d;
  }

  const k = (G * Math.pow(d, 4)) /
    (8 * Math.pow(D, 3) * Na);

  delta = F / k;

  // Wahl correction factor
  const Kw = ((4 * C - 1) / (4 * C - 4)) + (0.615 / C);

  // Corrected maximum shear stress in MPa (N/mm²)
  const tau = Kw * (8 * F * D) / (Math.PI * Math.pow(d, 3));

  if (![k, delta, Kw, tau].every(Number.isFinite)) {
    throw new Error("The calculation produced an invalid result. Check your inputs.");
  }

  if (k <= 0 || delta <= 0 || tau <= 0) {
    throw new Error("The calculated values must be greater than zero.");
  }

  return { F, G, Na, d, D, C, k, delta, Kw, tau };
}

function formatNumber(value, digits = 3) {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  });
}

function addCheck(type, title, description) {
  const row = document.createElement("div");
  row.className = "check-item";

  const icon = document.createElement("span");
  icon.className = `check-icon ${type}`;
  icon.textContent = type === "ok" ? "✓" : type === "warn" ? "!" : "i";

  const content = document.createElement("div");
  const heading = document.createElement("strong");
  heading.textContent = title;

  const detail = document.createElement("div");
  detail.textContent = description;

  content.append(heading, detail);
  row.append(icon, content);
  $("checkList").append(row);
}

function renderChecks(r) {
  $("checkList").replaceChildren();

  if (r.C >= 4 && r.C <= 12) {
    addCheck(
      "ok",
      "Spring index within 4–12",
      `Calculated C = ${formatNumber(r.C)}.`
    );
  } else {
    addCheck(
      "warn",
      "Review spring index",
      `Calculated C = ${formatNumber(r.C)}. Values outside 4–12 need further engineering review.`
    );
  }

  addCheck(
    "info",
    "Corrected shear stress calculated",
    `Maximum estimated shear stress = ${formatNumber(r.tau)} MPa. Compare with the selected material's allowable shear stress.`
  );

  addCheck(
    "info",
    "Additional design checks required",
    "Verify fatigue, buckling, solid height, free length, end conditions and material-specific limits before manufacturing."
  );

  if (getMode() === "design") {
    addCheck(
      "info",
      "Preliminary dimensions estimated",
      "Check practical wire sizes, coil clearance, manufacturing limits and required tolerances."
    );
  }
}

function renderFormulas(r) {
  const formulas = [
    {
      title: "Spring index",
      equation: "C = D / d",
      detail: `C = ${formatNumber(r.C)}`
    },
    {
      title: "Spring stiffness",
      equation: "k = G × d⁴ / (8 × D³ × Na)",
      detail: `k = ${formatNumber(r.k)} N/mm`
    },
    {
      title: "Axial deflection",
      equation: "δ = F / k",
      detail: `δ = ${formatNumber(r.delta)} mm`
    },
    {
      title: "Wahl correction factor",
      equation: "Kw = (4C − 1)/(4C − 4) + 0.615/C",
      detail: `Kw = ${formatNumber(r.Kw, 5)}`
    },
    {
      title: "Maximum corrected shear stress",
      equation: "τmax = Kw × 8FD / (πd³)",
      detail: `τmax = ${formatNumber(r.tau)} MPa`
    }
  ];

  if (getMode() === "design") {
    formulas.unshift({
      title: "Estimated wire diameter",
      equation: "d = 8 × F × C³ × Na / (G × δtarget)",
      detail: `d = ${formatNumber(r.d)} mm`
    });
  }

  $("formulaDetails").replaceChildren();

  formulas.forEach((item) => {
    const box = document.createElement("div");
    box.className = "formula-line";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const equation = document.createElement("code");
    equation.textContent = item.equation;

    const detail = document.createElement("p");
    detail.textContent = item.detail;

    box.append(title, equation, detail);
    $("formulaDetails").append(box);
  });
}

function renderResults(r) {
  $("outK").textContent = formatNumber(r.k);
  $("outDeflection").textContent = formatNumber(r.delta);
  $("outWire").textContent = formatNumber(r.d);
  $("outMean").textContent = formatNumber(r.D);
  $("outCoils").textContent = formatNumber(r.Na);
  $("outStress").textContent = formatNumber(r.tau);

  $("emptyState").classList.add("hidden");
  $("results").classList.remove("hidden");
  $("resultStatus").textContent = "CALCULATED";
  $("resultStatus").classList.add("calculated");

  renderChecks(r);
  renderFormulas(r);
}

function calculate() {
  clearError();

  try {
    const input = validateInputs();
    const result = calculateSpring(input);
    renderResults(result);
  } catch (error) {
    showError(error.message);
  }
}

function resetCalculator() {
  Object.entries(defaults).forEach(([id, value]) => {
    $(id).value = value;
  });

  updateMode();
  clearError();

  $("results").classList.add("hidden");
  $("emptyState").classList.remove("hidden");
  $("resultStatus").textContent = "READY";
  $("resultStatus").classList.remove("calculated");
}

$("mode").addEventListener("change", updateMode);

$("material").addEventListener("change", () => {
  $("customGField").classList.toggle(
    "hidden",
    $("material").value !== "custom"
  );
});

$("calculateBtn").addEventListener("click", calculate);
$("resetBtn").addEventListener("click", resetCalculator);

updateMode();
