// ---------- Tab switching ----------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ---------- Helpers ----------
function round(n) { return Math.round(n); }
function fmt(n) { return round(n).toLocaleString('en-IN'); }
function syncSliderLabel(sliderId, labelId) {
  const el = document.getElementById(sliderId);
  document.getElementById(labelId).textContent = el.value;
}

// =========================================================
// ENERGY TAB
// =========================================================
const pmef_cfpp_lower = 49; // tons/PJ
const pmef_cfpp_upper = 68; // tons/PJ
const pm_gas_ef = 121.6; // kg/MMSCM
const emission_control = { "Washed Coal": 20, "FGD": 30, "Upgraded ESP": 99.4 };

function getSelectedTechniques() {
  return Array.from(document.querySelectorAll('.technique:checked')).map(el => el.value);
}

function computeEnergy() {
  const total_electricity = parseFloat(document.getElementById('total_electricity').value) || 0;
  const cfpp_percentage = parseFloat(document.getElementById('cfpp_percentage').value);
  const gas_percentage = parseFloat(document.getElementById('gas_percentage').value);
  const blending_ratio = parseFloat(document.getElementById('blending_ratio').value) / 100;
  const techniques = getSelectedTechniques();

  syncSliderLabel('cfpp_percentage', 'cfpp_percentage_val');
  syncSliderLabel('gas_percentage', 'gas_percentage_val');
  syncSliderLabel('blending_ratio', 'blending_ratio_val');

  // Intervention 1 — Replace coal with non-fossil sources
  const cfpp_electricity = cfpp_percentage * total_electricity / 100; // BUs
  let coal_burnt = cfpp_electricity * 1e9 * 0.666; // kg
  coal_burnt = (coal_burnt / 100 + coal_burnt) / 1e9; // Million Tonnes
  const cfpp_electricity_pj = (cfpp_electricity * 1e9) / (277.788e6); // PJ
  const pm25_lower = pmef_cfpp_lower * cfpp_electricity_pj / 1000; // kT
  const pm25_upper = pmef_cfpp_upper * cfpp_electricity_pj / 1000; // kT

  document.getElementById('cfpp_output').innerHTML =
    `CFPPs produced <strong>${fmt(cfpp_electricity)}</strong> BUs of electricity by burning <strong>${fmt(coal_burnt)}</strong> Million Tonnes of coal`;
  document.getElementById('cfpp_pm25_output').innerHTML =
    `PM2.5 emissions from CFPPs: <strong>${fmt(pm25_lower)}&ndash;${fmt(pm25_upper)} kilo Tonnes</strong>`;

  // Intervention 2 — Emission control technologies
  const pm25_actual_lower = pm25_lower / 0.03;
  const pm25_actual_upper = pm25_upper / 0.03;
  let pm25_reduced_lower, pm25_reduced_upper;
  if (!techniques.includes('Upgraded ESP')) {
    pm25_reduced_lower = pm25_actual_lower * (1 - 0.97);
    pm25_reduced_upper = pm25_actual_upper * (1 - 0.97);
  } else {
    pm25_reduced_lower = pm25_actual_lower;
    pm25_reduced_upper = pm25_actual_upper;
  }
  techniques.forEach(t => {
    pm25_reduced_lower *= (1 - emission_control[t] / 100);
    pm25_reduced_upper *= (1 - emission_control[t] / 100);
  });
  document.getElementById('control_pm25_output').innerHTML =
    `PM2.5 emissions from CFPPs after emission control: <strong>${fmt(pm25_reduced_lower)}&ndash;${fmt(pm25_reduced_upper)} kilo Tonnes</strong>`;

  // Intervention 3 — Replace coal with gas
  const gas_electricity = cfpp_electricity * gas_percentage / 100; // BUs
  const cfpp_electricity_rem = (cfpp_electricity - gas_electricity) * 1e9; // Units
  const gas_required = (gas_electricity * 1e9 / 1e6) / 5; // MMSC
  const cfpp_electricity_pj2 = cfpp_electricity_rem / (277.788e6); // PJ
  const pm_cfpp_l = pmef_cfpp_lower * cfpp_electricity_pj2 / 1000;
  const pm_cfpp_u = pmef_cfpp_upper * cfpp_electricity_pj2 / 1000;
  const pm_gas = pm_gas_ef * gas_required / 1e6; // kT
  const pml = pm_cfpp_l + pm_gas;
  const pmu = pm_cfpp_u + pm_gas;
  document.getElementById('gas_pm25_output').innerHTML =
    `PM2.5 emissions from CFPPs + Gas: <strong>${fmt(pml)}&ndash;${fmt(pmu)} kilo Tonnes</strong>`;

  // Intervention 4 — Blend imported coal
  const sp0 = 0.666;
  const spi = 0.45;
  const spd = (0.94 * sp0 * spi / (spi - 0.06 * sp0));
  const sp = (spi * spd) / (blending_ratio * (spd - spi) + spi);
  let coal_required = (cfpp_electricity * 1e9) * sp / 1000; // Tonnes
  coal_required = (coal_required / 100 + coal_required); // + transport losses

  const pm_emission_factor_lower = pm25_reduced_lower / coal_burnt; // kg/Tonne coal
  const pm_emission_factor_upper = pm25_reduced_upper / coal_burnt;
  const pm_l = pm_emission_factor_lower * coal_required / 1e6;
  const pm_u = pm_emission_factor_upper * coal_required / 1e6;
  document.getElementById('blend_pm25_output').innerHTML =
    `PM2.5 emissions after emission control and blending: <strong>${fmt(pm_l)}&ndash;${fmt(pm_u)} kilo Tonnes</strong>`;
}

['total_electricity', 'cfpp_percentage', 'gas_percentage', 'blending_ratio'].forEach(id => {
  document.getElementById(id).addEventListener('input', computeEnergy);
});
document.querySelectorAll('.technique').forEach(el => el.addEventListener('change', computeEnergy));

// =========================================================
// BRICKS TAB
// =========================================================
const pmef_fcbtk = 0.18; // g/kg bricks
const pmef_clamp = 1; // g/kg bricks
const pmef_zzk = 0.6 * pmef_fcbtk; // g/kg bricks
const brick_weight = 3.5; // kgs
const BAU_TOTAL = 284; // kT, business as usual (74+21+5 mix baseline)

function computeBricks() {
  const total_bricks = parseFloat(document.getElementById('total_bricks').value) || 0;
  const fcbtk_percentage = parseFloat(document.getElementById('fcbtk_percentage').value);
  const clamps_percentage = parseFloat(document.getElementById('clamps_percentage').value);
  const zzk_percentage = parseFloat(document.getElementById('zzk_percentage').value);
  const replace_coal = parseFloat(document.getElementById('replace_coal').value) / 100;

  syncSliderLabel('fcbtk_percentage', 'fcbtk_percentage_val');
  syncSliderLabel('clamps_percentage', 'clamps_percentage_val');
  syncSliderLabel('zzk_percentage', 'zzk_percentage_val');
  syncSliderLabel('replace_coal', 'replace_coal_val');

  const total_pct = fcbtk_percentage + clamps_percentage + zzk_percentage;
  const warningEl = document.getElementById('bricks_warning');
  const resultsEl = document.getElementById('bricks_results');

  if (total_pct !== 100) {
    warningEl.hidden = false;
    resultsEl.style.opacity = '0.4';
    resultsEl.style.pointerEvents = 'none';
    return;
  }
  warningEl.hidden = true;
  resultsEl.style.opacity = '1';
  resultsEl.style.pointerEvents = 'auto';

  const fcbtk_bricks = (fcbtk_percentage / 100) * total_bricks;
  const clamps_bricks = (clamps_percentage / 100) * total_bricks;
  const zzk_bricks = (zzk_percentage / 100) * total_bricks;

  document.getElementById('fcbtk_bricks_output').textContent = `FCBTK bricks: ${fcbtk_bricks.toFixed(0)} Billion bricks`;
  const pm25_fcbtk = round(fcbtk_bricks * brick_weight * pmef_fcbtk); // kT
  document.getElementById('fcbtk_pm25_output').innerHTML = `PM2.5 emissions from FCBTKs: <strong>${pm25_fcbtk} kilo Tonnes</strong>`;

  document.getElementById('clamps_bricks_output').textContent = `Clamps bricks: ${clamps_bricks.toFixed(0)} Billion bricks`;
  const pm25_clamp = round(clamps_bricks * brick_weight * pmef_clamp); // kT
  document.getElementById('clamps_pm25_output').innerHTML = `PM2.5 emissions from Clamps: <strong>${pm25_clamp} kilo Tonnes</strong>`;

  document.getElementById('zzk_bricks_output').textContent = `ZZKs bricks: ${zzk_bricks.toFixed(0)} Billion bricks`;
  const pm25_zzk = round(zzk_bricks * brick_weight * pmef_zzk); // kT
  document.getElementById('zzk_pm25_output').innerHTML = `PM2.5 emissions from ZZKs: <strong>${pm25_zzk} kilo Tonnes</strong>`;

  // Intervention 3 — Co-fire coal with biomass pellets in FCBTKs
  const coal = fcbtk_bricks / 6.6571428571428575; // MT
  const coal_reduced = coal * (1 - replace_coal);
  const coal_pmef = 3.03; // g/kg coal
  const biomass = fcbtk_bricks / 9.32; // MT
  const biomass_increased = biomass * (1 + replace_coal);
  const biomass_pmef = coal_pmef * 0.54; // g/kg biomass
  const pm25_after_cofire = (coal_pmef * coal_reduced) + (biomass_pmef * biomass_increased); // kT
  document.getElementById('cofire_pm25_output').innerHTML =
    `PM2.5 emissions from FCBTKs after cofiring: <strong>${round(pm25_after_cofire)} kilo Tonnes</strong>`;

  // Total
  const total_pm25 = round(pm25_after_cofire + pm25_clamp + pm25_zzk);
  document.getElementById('total_pm25_value').textContent = `${total_pm25} kilo Tonnes`;
  const deltaPct = round(total_pm25 / 2.84 - 100);
  const deltaLabel = deltaPct < 0 ? `${Math.abs(deltaPct)}% less than business as usual` : `${deltaPct}% more than business as usual`;
  document.getElementById('total_pm25_delta').textContent = `${deltaLabel} (BAU = 74+21+5 = ${BAU_TOTAL} kT)`;
}

['total_bricks', 'fcbtk_percentage', 'clamps_percentage', 'zzk_percentage', 'replace_coal'].forEach(id => {
  document.getElementById(id).addEventListener('input', computeBricks);
});

// ---------- Init ----------
computeEnergy();
computeBricks();