(() => {
  "use strict";

  let CFG;
  let PERCENTILES = window.ACL_PERCENTILES || {};
  const STORE_KEY = "projecte-acl-eina-v1";
  const CONFIG_STORE_KEY = "projecte-acl-config-v1";
  const BLANK = "__BLANK__";
  const DIMENSIONS = [
    ["literal", "Literal"],
    ["reorganitzacio", "Reorganització"],
    ["inferencial", "Inferencial"],
    ["critica", "Crítica"]
  ];
  CFG = window.ACL_CONFIG || loadStoredConfig();
  if (!window.ACL_PERCENTILES && CFG?.percentiles) PERCENTILES = CFG.percentiles;
  const root = document.getElementById("app");
  let storageOkay = true;
  let state = loadState();

  function emptyState() {
    return { schemaVersion: 1, group: null, students: [], selectedId: null, activeTab: "corrector" };
  }

  function loadStoredConfig() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CONFIG_STORE_KEY) || "null");
      return isValidConfig(parsed) ? normalizeConfig(parsed) : null;
    } catch (_) {
      return null;
    }
  }

  function normalizeConfig(config) {
    // La docent ha confirmat que el full ACL-4 conté 24–25 per al decatipus 8.
    // Corregeix també les claus ja guardades en el navegador, sense tocar les respostes.
    const grade4 = config?.grades?.["4"];
    const range8 = grade4?.decatypeRanges?.find(range => range.decatype === 8);
    if (range8 && (range8.min !== 24 || range8.max !== 25 || range8.valid !== true)) {
      range8.min = 24;
      range8.max = 25;
      range8.valid = true;
      range8.sourceNote = "Correcció confirmada per la docent: 24–25 (full Excel original protegit)";
    }
    return config;
  }

  function isValidConfig(parsed) {
    if (!parsed || !parsed.grades || typeof parsed.grades !== "object") return false;
    for (const gradeNumber of ["1", "2", "3", "4", "5", "6"]) {
      const grade = parsed.grades[gradeNumber];
      if (!grade || !Array.isArray(grade.items) || grade.items.length !== grade.itemCount) return false;
      if (!grade.items.every(item => item && Number.isInteger(item.number) && /^[abcde]$/.test(item.answer) && DIMENSIONS.some(([key]) => key === item.dimension))) return false;
    }
    return true;
  }

  function renderConfigSetup() {
    root.innerHTML = `
      <main class="app-shell">
        <header class="brand-row">
          <div><div class="eyebrow">Avaluació de la comprensió lectora</div><h1>ACL · Registre de resultats</h1><p class="subtitle">Obri el corrector des del web i conserva les claus només en este dispositiu.</p></div>
          <div class="privacy-chip">La clau no s'envia al web</div>
        </header>
        <section class="card setup-card">
          <h2 class="card-title">Carrega la clau ACL en este navegador</h2>
          <p class="card-copy">Tria el fitxer <code>config/private/acl-valencià-online.json</code> que tens a la carpeta local del projecte. El navegador el llig ací mateix i el guarda en l'emmagatzematge local d'este dispositiu; no es puja al repositori ni s'envia a cap servidor.</p>
          <div class="field"><label for="config-file">Fitxer de configuració privada</label><input id="config-file" type="file" accept="application/json,.json"></div>
          <p class="helper">Per a usar un altre ordinador o navegador, carrega el fitxer també allí. Les dades de l'alumnat també es guarden només en este navegador i es poden exportar com a còpia JSON.</p>
          <div id="config-error" class="warning-inline" hidden>No s'ha pogut llegir eixe fitxer. Tria la còpia JSON ACL original, no un Excel o CSV.</div>
        </section>
      </main>`;
    document.getElementById("config-file").addEventListener("change", loadConfigFile);
  }

  function loadConfigFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!isValidConfig(parsed)) throw new Error("invalid config");
        const normalized = normalizeConfig(parsed);
        localStorage.setItem(CONFIG_STORE_KEY, JSON.stringify(normalized));
        CFG = normalized;
        PERCENTILES = normalized.percentiles || {};
        render();
      } catch (_) {
        document.getElementById("config-error").hidden = false;
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (parsed && parsed.schemaVersion === 1 && Array.isArray(parsed.students)) return parsed;
    } catch (_) {
      storageOkay = false;
    }
    return emptyState();
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(state));
      storageOkay = true;
    } catch (_) {
      storageOkay = false;
    }
    const line = document.getElementById("save-status");
    if (line) line.textContent = storageOkay
      ? "Canvis guardats en este navegador. Descarrega una còpia JSON per conservar o traslladar el grup."
      : "No s'ha pogut guardar al navegador. Descarrega una còpia JSON abans de tancar.";
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  }

  function currentGrade() {
    return state.group ? CFG.grades[String(state.group.grade)] : null;
  }

  function currentStudent() {
    return state.students.find(s => s.id === state.selectedId) || null;
  }

  function makeId() {
    return (globalThis.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `al-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function renderSetup() {
    root.innerHTML = `
      <main class="app-shell">
        <header class="brand-row">
          <div><div class="eyebrow">Eina local de resultats</div><h1>ACL · Registre de resultats</h1><p class="subtitle">Una graella de correcció per curs, amb resums individuals i del grup.</p></div>
          <div class="privacy-chip">Funciona en este dispositiu</div>
        </header>
        <div class="notice"><strong>Prototip en revisió.</strong> Les claus provenen del corrector valencià facilitat. La classificació textual d'ACL-6 encara té incidències pendents de revisió. Les dades que introduïsques es queden al navegador; exporta una còpia JSON per a conservar-les.</div>
        <section class="card setup-card">
          <h2 class="card-title">Crea un grup de prova</h2>
          <p class="card-copy">Cada fitxer de treball correspon a un curs, grup i passada. Pots obrir-lo sense connexió i exportar el registre per a Excel.</p>
          <form id="setup-form">
            <div class="form-grid">
              <div class="field"><label for="grade">Curs de la prova</label><select id="grade" required>${Object.entries(CFG.grades).map(([n,g]) => `<option value="${n}">${n}é de Primària · ${g.itemCount} ítems</option>`).join("")}</select></div>
              <div class="field"><label for="group">Grup</label><input id="group" placeholder="Ex.: 5é A" required></div>
              <div class="field"><label for="school-year">Curs escolar</label><input id="school-year" placeholder="Ex.: 2026–2027"></div>
              <div class="field"><label for="date">Data d'aplicació</label><input id="date" type="date"></div>
              <div class="field"><label for="pass">Passada</label><select id="pass"><option value="P1">P1 · primera passada</option><option value="P2">P2 · segona passada</option><option value="altre">Altra</option></select></div>
              <div class="field"><label for="mode">Modalitat</label><select id="mode"><option value="paper">Paper corregit</option><option value="forms">Forms</option></select></div>
            </div>
            <div class="actions form-actions"><button class="primary" type="submit">Obrir el corrector</button><button class="secondary" type="button" id="restore-button">Carregar còpia JSON</button><input id="restore-file" type="file" accept="application/json,.json" hidden></div>
            <p class="helper">El prototip treballa primer amb les claus valencianes del corrector compartit. La versió castellana encara no està configurada.</p>
          </form>
        </section>
      </main>`;
    document.getElementById("setup-form").addEventListener("submit", createGroup);
    document.getElementById("restore-button").addEventListener("click", () => document.getElementById("restore-file").click());
    document.getElementById("restore-file").addEventListener("change", restoreBackup);
  }

  function createGroup(event) {
    event.preventDefault();
    if (state.group && (state.students.length || Object.keys(state.group).length) && !confirm("Crear un altre grup? Exporta abans el grup actual si vols conservar-lo.")) return;
    state = emptyState();
    state.group = {
      grade: Number(document.getElementById("grade").value),
      group: document.getElementById("group").value.trim(),
      schoolYear: document.getElementById("school-year").value.trim(),
      date: document.getElementById("date").value,
      pass: document.getElementById("pass").value,
      mode: document.getElementById("mode").value
    };
    saveState();
    render();
  }

  function renderWorkspace() {
    const grade = currentGrade();
    if (!grade) return renderSetup();
    const tab = state.activeTab || "corrector";
    const student = currentStudent();
    const group = state.group;
    root.innerHTML = `
      <main class="app-shell">
        <header class="brand-row">
          <div><div class="eyebrow">Avaluació de la comprensió lectora</div><h1>ACL · Registre de resultats</h1><p class="subtitle">Corrector ràpid i resum del grup, sense fórmules amagades.</p></div>
          <div class="privacy-chip">Les dades es queden en este navegador</div>
        </header>
        ${grade.textTypeIssues && ((grade.textTypeIssues.unmappedQuestions || []).length || Object.keys(grade.textTypeIssues.ambiguousQuestions || {}).length) ? `<div class="notice"><strong>Revisió de criteris:</strong> ACL-${group.grade} té ítems amb tipologia textual duplicada o sense classificar en l'Excel actual; eixos ítems no entren en la interpretació per tipus de text.</div>` : ""}
        <section class="card topbar">
          <div class="group-meta">
            <span class="meta-pill">ACL-${group.grade} · ${grade.itemCount} ítems</span>
            <span class="meta-pill">Grup ${esc(group.group)}</span>
            ${group.schoolYear ? `<span class="meta-pill">${esc(group.schoolYear)}</span>` : ""}
            <span class="meta-pill">${group.pass === "P1" ? "P1" : group.pass === "P2" ? "P2" : "Altra passada"}</span>
            <span class="meta-pill">${group.mode === "paper" ? "Paper" : "Forms"}</span>
          </div>
          <div class="actions"><button class="secondary" id="export-json">Descarregar còpia JSON</button><button class="secondary" id="export-csv">Exportar resum CSV</button><button class="quiet" id="change-config">Canviar clau ACL</button><button class="quiet" id="new-group">Nou grup</button><button class="quiet" id="restore-workspace">Obrir còpia</button><input id="restore-file" type="file" accept="application/json,.json" hidden></div>
        </section>
        <nav class="nav-tabs" aria-label="Vistes del projecte">
          <button class="tab ${tab === "corrector" ? "active" : ""}" data-tab="corrector">Corrector d'alumnat</button>
          <button class="tab ${tab === "resultats" ? "active" : ""}" data-tab="resultats">Resultats del grup</button>
        </nav>
        ${tab === "corrector" ? renderCorrector(grade, student) : renderResults(grade)}
        <p class="footnote" id="save-status">${storageOkay ? "Canvis guardats en este navegador. Descarrega una còpia JSON per a conservar o traslladar el grup." : "No s'ha pogut guardar al navegador. Descarrega una còpia JSON abans de tancar."}</p>
      </main>`;
    bindWorkspace(grade);
  }

  function renderCorrector(grade, student) {
    const roster = state.students.map(s => {
      const done = Object.keys(s.answers || {}).length;
      return `<button class="student-row ${student && s.id === student.id ? "selected" : ""}" data-student="${esc(s.id)}"><span class="student-name">${esc(s.name)}</span><span class="student-progress">${done}/${grade.itemCount}</span></button>`;
    }).join("");
    const answered = student ? Object.keys(student.answers || {}).length : 0;
    return `<div class="workspace">
      <aside class="card roster">
        <div class="roster-head"><h2>Alumnat</h2><span class="count">${state.students.length}</span></div>
        <div class="roster-list">${roster || `<div class="empty-state">Afig l'alumnat per començar a corregir.</div>`}</div>
        <div class="roster-add">
          <div class="field"><label for="one-student">Afegir una persona</label><input id="one-student" placeholder="Nom o codi de l'alumne/a"></div>
          <div class="actions"><button class="secondary" id="add-one">Afegir</button></div>
          <div class="field" style="margin-top:10px"><label for="bulk-students">O enganxa una llista, una persona per línia</label><textarea id="bulk-students" placeholder="Alumne/a 1&#10;Alumne/a 2"></textarea></div>
          <div class="actions"><button class="secondary" id="add-bulk">Afegir llista</button>${student ? `<button class="quiet" id="delete-student">Eliminar seleccionat</button>` : ""}</div>
          <p class="helper">Pots usar noms o codis interns. Esta informació s'emmagatzema en el navegador d'este dispositiu.</p>
        </div>
      </aside>
      <section class="card panel-card main-panel">
        ${student ? `<div class="panel-head"><div><h2>${esc(student.name)}</h2><p>Tria l'alternativa marcada en el full de l'alumne. El resultat es calcula en seleccionar-la.</p></div><div class="progress-box"><strong>${answered}/${grade.itemCount}</strong>respostes registrades</div></div>
          ${grade.textTypeIssues && ((grade.textTypeIssues.unmappedQuestions || []).length || Object.keys(grade.textTypeIssues.ambiguousQuestions || {}).length) ? `<div class="warning-inline">La classificació per tipus de text té incidències en ACL-${state.group.grade}. Es mostraran els totals que es puguen calcular i s'indicaran els ítems pendents.</div>` : ""}
          <div class="question-grid">${grade.items.map(item => renderQuestion(item, student.answers[String(item.number)], Object.prototype.hasOwnProperty.call(student.answers || {}, String(item.number)))).join("")}</div>
        ` : `<div class="empty-state">Selecciona o afig un alumne/a per a obrir el corrector. Cada curs carrega el seu nombre d'ítems i les seues pròpies respostes correctes.</div>`}
      </section>
    </div>`;
  }

  function renderQuestion(item, selected, hasEntry) {
    const answer = hasEntry ? selected : null;
    const isBlank = answer === BLANK;
    const status = !hasEntry ? "Sense registrar" : isBlank ? "En blanc" : (answer === item.answer ? "Encert" : "Errada");
    const cls = !hasEntry ? "unanswered" : isBlank ? "blank-recorded" : (answer === item.answer ? "correct" : "incorrect");
    const options = ["a", "b", "c", "d", "e"].slice(0, currentGrade().optionCount);
    return `<article class="question ${cls}">
      <div class="question-top"><span class="question-number">Ítem ${item.number}</span><span class="question-meta">${esc(dimensionName(item.dimension))}${item.textType ? ` · ${esc(item.textType)}` : ""}</span></div>
      <div class="option-row" role="group" aria-label="Resposta de l'ítem ${item.number}">
        ${options.map(opt => `<button class="option ${answer === opt ? "selected" : ""}" data-question="${item.number}" data-answer="${opt}" aria-pressed="${answer === opt}">${opt.toUpperCase()}</button>`).join("")}
        <button class="option blank ${isBlank ? "selected" : ""}" data-question="${item.number}" data-answer="${BLANK}" aria-pressed="${isBlank}">En blanc</button>
      </div>
      <div class="question-status">${status}</div>
    </article>`;
  }

  function dimensionName(key) {
    return DIMENSIONS.find(([id]) => id === key)?.[1] || "Dimensió pendent";
  }

  function calculate(student, grade) {
    const items = grade.items;
    const result = { correct: 0, wrong: 0, blank: 0, unrecorded: 0, dimensions: {}, textTypes: {}, raw: 0 };
    for (const [key, name] of DIMENSIONS) result.dimensions[key] = { name, correct: 0, wrong: 0, blank: 0, total: 0, answered: 0 };
    for (const item of items) {
      const itemKey = String(item.number);
      const hasEntry = Object.prototype.hasOwnProperty.call(student.answers || {}, itemKey);
      const response = hasEntry ? student.answers[itemKey] : null;
      const dim = result.dimensions[item.dimension];
      if (dim) dim.total += 1;
      let type = null;
      if (item.textType) {
        result.textTypes[item.textType] ||= { correct: 0, wrong: 0, blank: 0, total: 0, answered: 0 };
        type = result.textTypes[item.textType];
        type.total += 1;
      }
      if (!hasEntry) {
        result.unrecorded += 1;
        continue;
      }
      if (response === BLANK || response === "") {
        result.blank += 1;
        if (dim) dim.blank += 1;
        if (type) type.blank += 1;
        continue;
      }
      if (dim) dim.answered += 1;
      if (type) type.answered += 1;
      if (response === item.answer) {
        result.correct += 1;
        if (dim) dim.correct += 1;
        if (type) type.correct += 1;
      } else {
        result.wrong += 1;
        if (dim) dim.wrong += 1;
        if (type) type.wrong += 1;
      }
    }
    result.completed = result.unrecorded === 0;
    for (const [key] of DIMENSIONS) {
      const score = result.dimensions[key].correct;
      result.dimensions[key].percentile = result.completed
        ? (PERCENTILES[String(state.group.grade)]?.[key]?.[String(score)] ?? null)
        : null;
    }
    result.raw = result.correct;
    const range = result.completed && result.correct + result.wrong
      ? (grade.decatypeRanges || []).find(r => r.valid && result.raw >= r.min && result.raw <= r.max)
      : null;
    result.decatype = range ? range.decatype : null;
    result.decatypePending = result.completed && result.correct + result.wrong > 0 && !range;
    const missingTypeItems = items.filter(i => !i.textType).map(i => i.number);
    result.missingTypeItems = missingTypeItems;
    return result;
  }

  function renderResults(grade) {
    if (!state.students.length) return `<section class="card panel-card"><div class="empty-state">Afig alumnat en la pestanya «Corrector d'alumnat» per a veure el resum del grup.</div></section>`;
    const rows = state.students.map(student => ({ student, result: calculate(student, grade) }));
    const completeRows = rows.filter(r => r.result.completed);
    const mean = completeRows.length ? completeRows.reduce((sum, r) => sum + r.result.raw, 0) / completeRows.length : null;
    const totalAnswered = completeRows.reduce((sum, r) => sum + r.result.correct + r.result.wrong, 0);
    const totalWrong = completeRows.reduce((sum, r) => sum + r.result.wrong, 0);
    const decatypeCounts = Array.from({ length: 10 }, (_, i) => ({ level: i + 1, count: completeRows.filter(r => r.result.decatype === i + 1).length }));
    const pendingDecatypes = completeRows.filter(r => r.result.decatypePending).length;
    const incompleteCount = rows.length - completeRows.length;
    const domainData = DIMENSIONS.map(([key, name]) => {
      const correct = completeRows.reduce((sum, r) => sum + r.result.dimensions[key].correct, 0);
      const wrong = completeRows.reduce((sum, r) => sum + r.result.dimensions[key].wrong, 0);
      const blank = completeRows.reduce((sum, r) => sum + r.result.dimensions[key].blank, 0);
      const answered = correct + wrong;
      const total = completeRows.reduce((sum, r) => sum + r.result.dimensions[key].total, 0);
      const correctPct = answered ? correct / answered * 100 : 0;
      const pcs = completeRows.map(r => r.result.dimensions[key].percentile).filter(v => v !== null);
      const meanPc = pcs.length ? Math.round(pcs.reduce((a,b) => a+b, 0) / pcs.length) : null;
      return { key, name, correct, wrong, blank, answered, total, correctPct, meanPc };
    });
    const domainRows = domainData.map(d => `<div class="report-chart-row">
      <div class="report-chart-label"><strong>${d.name}</strong><strong>${completeRows.length && d.answered ? `${Math.round(d.correctPct)}%` : "—"}</strong></div>
      <div class="report-chart-track" role="img" aria-label="${d.name}: ${completeRows.length && d.answered ? `${Math.round(d.correctPct)} per cent d'encerts` : "sense dades"}"><span style="width:${d.correctPct}%"></span></div>
      <div class="report-chart-detail">${completeRows.length ? `${d.correct}/${d.total} encerts · ${d.wrong} errors · ${d.blank} en blanc${d.meanPc !== null ? ` · PC mig ${d.meanPc}` : ""}` : "Esperant una prova completa"}</div>
    </div>`).join("");
    const types = [...new Set(grade.items.map(i => i.textType).filter(Boolean))];
    const typeData = completeRows.length ? types.map(name => {
      const correct = completeRows.reduce((sum, r) => sum + (r.result.textTypes[name]?.correct || 0), 0);
      const wrong = completeRows.reduce((sum, r) => sum + (r.result.textTypes[name]?.wrong || 0), 0);
      const blank = completeRows.reduce((sum, r) => sum + (r.result.textTypes[name]?.blank || 0), 0);
      const total = completeRows.reduce((sum, r) => sum + (r.result.textTypes[name]?.total || 0), 0);
      const answered = correct + wrong;
      const pct = answered ? correct / answered * 100 : 0;
      return { name, correct, wrong, blank, total, answered, pct };
    }) : [];
    const typeRows = typeData.map(d => `<div class="report-chart-row">
      <div class="report-chart-label"><strong>${esc(d.name)}</strong><strong>${d.answered ? `${Math.round(d.pct)}%` : "—"}</strong></div>
      <div class="report-chart-track" role="img" aria-label="${esc(d.name)}: ${d.answered ? `${Math.round(d.pct)} per cent d'encerts` : "sense dades"}"><span style="width:${d.pct}%"></span></div>
      <div class="report-chart-detail">${d.correct}/${d.total} encerts · ${d.wrong} errors · ${d.blank} en blanc</div>
    </div>`).join("") || `<p class="helper">${completeRows.length ? "No hi ha una classificació textual completa per a este curs." : "Esperant una prova completa per a mostrar els totals."}</p>`;
    const focusAreas = [
      ...domainData.filter(d => d.answered).map(d => ({ name: d.name, pct: d.correctPct, kind: "Dimensió" })),
      ...typeData.filter(d => d.answered).map(d => ({ name: d.name, pct: d.pct, kind: "Tipus textual" }))
    ].sort((a, b) => a.pct - b.pct).slice(0, 3);
    const groupNarrative = completeRows.length ? (() => {
      const best = [...domainData].filter(d => d.answered).sort((a, b) => b.correctPct - a.correctPct)[0];
      const needs = [...domainData].filter(d => d.answered).sort((a, b) => a.correctPct - b.correctPct)[0];
      const weakestTypes = [...typeData].filter(d => d.answered).sort((a, b) => a.pct - b.pct).slice(0, 2);
      const lowCount = completeRows.filter(r => r.result.decatype !== null && r.result.decatype <= 3).length;
      const dimensionalReading = best && needs
        ? `En les dimensions, els percentatges més alts i més baixos corresponen, respectivament, a ${best.name} (${Math.round(best.correctPct)}%) i ${needs.name} (${Math.round(needs.correctPct)}%).`
        : "No hi ha respostes contestades suficients per a comparar les dimensions.";
      return `<p>Hi ha ${completeRows.length} proves completes per a la interpretació grupal. La puntuació mitjana és ${mean.toFixed(1)} encerts de ${grade.itemCount}. ${dimensionalReading} Les respostes en blanc sumen ${completeRows.reduce((sum, r) => sum + r.result.blank, 0)}; convé revisar-les separadament dels errors.</p>${weakestTypes.length ? `<p>Per tipus de text, els percentatges més baixos corresponen a ${weakestTypes.map(t => `${esc(t.name)} (${Math.round(t.pct)}%)`).join(" i ")}. Estos resultats poden orientar la selecció de textos i activitats, tenint en compte quants ítems representa cada categoria.</p>` : ""}<p>Els resultats individuals situen ${lowCount} casos en decatipus 1–3 segons els intervals carregats. La guia ACL planteja els decatipus com una comparació normativa i recomana interpretar-los junt amb les dimensions, els tipus d'error i l'observació docent; per això, este informe orienta la planificació i no és un diagnòstic.</p>`;
    })() : `<p>Encara no hi ha proves completes per a redactar la interpretació grupal.</p>`;
    const interventionIdeas = {
      literal: "Practicar la localització d'informació explícita amb preguntes qui, què, quan i on; subratllar la frase del text que justifica cada resposta i distingir informació rellevant de la secundària.",
      reorganitzacio: "Ordenar seqüències, agrupar dades amb criteris donats, triar títols que resumixen paràgrafs i elaborar esquemes o resums breus sense informació redundant.",
      inferencial: "Combinar pistes del text amb coneixements previs per predir resultats, explicar relacions de causa i efecte i deduir el significat de paraules desconegudes pel context; demanar sempre quina pista ho sosté.",
      critica: "Distingir fets d'opinions i realitat de fantasia, valorar comportaments o missatges i justificar el judici propi amb evidències del text."
    };
    const individualNarratives = completeRows.map(({ student, result }) => {
      const dimensions = DIMENSIONS.map(([key, name]) => {
        const d = result.dimensions[key];
        return { key, name, pct: d.correct + d.wrong ? d.correct / (d.correct + d.wrong) * 100 : null, correct: d.correct, answered: d.correct + d.wrong, blank: d.blank };
      }).filter(d => d.pct !== null).sort((a, b) => a.pct - b.pct);
      const weakest = dimensions[0];
      const strongest = dimensions[dimensions.length - 1];
      const profile = weakest ? `La dimensió amb menys encerts és ${weakest.name} (${Math.round(weakest.pct)}%, ${weakest.correct}/${weakest.answered} respostes contestades${weakest.blank ? ` i ${weakest.blank} en blanc` : ""}); la més alta és ${strongest.name} (${Math.round(strongest.pct)}%).` : "No hi ha respostes contestades per a comparar les dimensions.";
      const blanks = result.blank ? ` Ha deixat ${result.blank} resposta/es en blanc, que es revisen per separat dels errors.` : " No consten respostes en blanc.";
      const support = result.decatype !== null && result.decatype <= 3
        ? `<p><strong>Possible intervenció (decatipus ${result.decatype}):</strong> prioritzar activitats breus i guiades de ${weakest?.name.toLocaleLowerCase() || "comprensió lectora"}. ${weakest ? interventionIdeas[weakest.key] : "Revisar primer les respostes i el procés lector amb l'alumne/a."} Repassar després les respostes amb el text al davant i observar si pot explicar quina pista l'ha ajudat.</p>`
        : "";
      return `<article class="subcard individual-analysis-card"><h4>${esc(student.name)} · ${result.raw}/${grade.itemCount} · ${result.decatype === null ? (result.decatypePending ? "decatipus pendent" : "decatipus no disponible") : `decatipus ${result.decatype}`}</h4><p>${profile}${blanks}</p>${support}</article>`;
    }).join("");
    const maxDecatypeCount = Math.max(1, ...decatypeCounts.map(d => d.count));
    const decatypeBars = decatypeCounts.map(d => `<div class="distribution-column" aria-label="Decatipus ${d.level}: ${d.count} alumnes">
      <strong>${d.count}</strong><div class="distribution-track"><span style="height:${Math.max(d.count ? 6 : 0, d.count / maxDecatypeCount * 100)}%"></span></div><small>D${d.level}</small>
    </div>`).join("");
    const typeIssue = (grade.textTypeIssues?.unmappedQuestions?.length || Object.keys(grade.textTypeIssues?.ambiguousQuestions || {}).length)
      ? `<div class="warning-inline">El resum per tipus de text exclou ítems amb classificació pendent: ${grade.textTypeIssues.unmappedQuestions.join(", ") || "cap"}${Object.keys(grade.textTypeIssues.ambiguousQuestions).length ? `; amb doble classificació: ${Object.keys(grade.textTypeIssues.ambiguousQuestions).join(", ")}` : ""}. Cal revisar la plantilla original abans d'interpretar este bloc.</div>` : "";
    const table = rows.map(({ student, result }) => `<tr>
      <td><button class="table-link" data-open-student="${esc(student.id)}">${esc(student.name)}</button></td>
      <td>${result.completed ? "Completa" : `Pendent · ${grade.itemCount - result.unrecorded}/${grade.itemCount}`}</td>
      <td class="numeric">${result.raw}/${grade.itemCount}${result.completed ? "" : " · provisional"}</td><td class="numeric">${result.wrong}</td><td class="numeric">${result.blank}</td>
      <td class="numeric">${result.decatype ?? (result.decatypePending ? "Revisar barem" : "—")}</td>
      ${DIMENSIONS.map(([key]) => `<td class="numeric">${result.completed ? `${result.dimensions[key].correct}/${result.dimensions[key].total}${result.dimensions[key].percentile !== null ? ` · PC ${result.dimensions[key].percentile}` : ""}` : "pendent"}</td>`).join("")}
    </tr>`).join("");
    return `<section class="card panel-card">
      ${typeIssue}
      <div class="result-grid">
        <div class="metric"><div class="metric-label">Alumnat registrat</div><div class="metric-value">${rows.length}</div></div>
        <div class="metric"><div class="metric-label">Proves completes · mitjana directa</div><div class="metric-value">${mean === null ? "—" : `${mean.toFixed(1)}<span class="metric-foot"> / ${grade.itemCount}</span>`}</div></div>
        <div class="metric"><div class="metric-label">Respostes en blanc · proves completes</div><div class="metric-value">${completeRows.reduce((sum, r) => sum + r.result.blank, 0)}</div></div>
        <div class="metric"><div class="metric-label">Errors sobre respostes contestades</div><div class="metric-value">${totalAnswered ? `${Math.round(totalWrong / totalAnswered * 100)}%` : "—"}</div></div>
      </div>
      ${incompleteCount ? `<div class="warning-inline">${incompleteCount} registre/s encara incomplet/s. No entren en les mitjanes, percentils ni distribució del grup fins que cada ítem estiga marcat com a resposta o «En blanc».</div>` : ""}
      <header class="report-heading">
        <div><div class="eyebrow">Informe de grup</div><h2>Resultats per a orientar la intervenció</h2><p>Tria si vols incloure també la taula individual amb els noms en el document.</p></div>
        <div class="report-actions no-print"><label class="report-student-option"><input id="include-student-results" type="checkbox" checked>Incloure noms i resultats individuals</label><button class="primary report-print-button" id="print-report" type="button">Imprimir o guardar en PDF</button></div>
      </header>
      <div class="result-columns report-columns">
        <section class="subcard report-chart-card"><h3>Dimensions de comprensió</h3><p class="helper chart-explainer">Percentatge d'encerts sobre les respostes contestades. Les respostes en blanc es mostren a banda.</p>${domainRows}</section>
        <section class="subcard report-chart-card"><h3>Resultats per tipus textual</h3><p class="helper chart-explainer">Percentatge d'encerts per tipus de text; els ítems sense classificació no entren en el càlcul.</p>${typeRows}</section>
        <section class="subcard report-chart-card distribution-card"><h3>Distribució per decatipus</h3><p class="helper chart-explainer">Nombre d'alumnes en cada nivell, segons els intervals locals.</p><div class="distribution-chart" role="img" aria-label="Distribució del grup entre els deu decatipus">${decatypeBars}</div>${pendingDecatypes ? `<p class="helper">${pendingDecatypes} resultat/s pendent/s de revisar el barem.</p>` : ""}<p class="helper">Es compten només proves completes amb puntuació classificable.</p></section>
        <section class="subcard report-focus-card"><h3>Àrees amb percentatge d'encerts més baix</h3>${focusAreas.length ? `<ol>${focusAreas.map(a => `<li><strong>${esc(a.name)}</strong> <span>${Math.round(a.pct)}% · ${a.kind}</span></li>`).join("")}</ol><p class="helper">Són pistes per a revisar objectius i activitats amb la informació d'aula. No són una conclusió diagnòstica.</p>` : `<p class="helper">Cal completar almenys una prova per a calcular les àrees del grup.</p>`}</section>
      </div>
      <section class="subcard report-interpretation"><h3>Interpretació del grup</h3>${groupNarrative}<p><strong>Possible resposta educativa:</strong> planificar activitats a partir de les dimensions amb resultats més baixos (${focusAreas.filter(a => a.kind === "Dimensió").map(a => esc(a.name)).join(", ") || "sense dades dimensionals suficients"}); modelar en veu alta com es troba una pista, es relaciona amb la pregunta i es justifica la resposta. Revisar l'evolució amb treballs d'aula, no només amb esta puntuació.</p></section>
      <div class="report-method-note">El resum grupal utilitza només les proves completes. Els percentatges comparen encerts amb respostes contestades i compten els blancs a banda. Els decatipus i percentils són provisionals fins a confirmar-los amb el manual.</div>
      <h3 class="section-title individual-section">Registre individual</h3>
      <div class="table-wrap individual-section"><table><thead><tr><th>Alumne/a</th><th>Estat</th><th class="numeric">Puntuació</th><th class="numeric">Errors</th><th class="numeric">En blanc</th><th class="numeric">Decatipus*</th><th class="numeric">Literal · PC</th><th class="numeric">Reorg. · PC</th><th class="numeric">Infer. · PC</th><th class="numeric">Crítica · PC</th></tr></thead><tbody>${table}</tbody></table></div>
      <h3 class="section-title individual-section">Lectura individual i propostes per a decatipus 1–3</h3>
      ${individualNarratives || `<p class="helper individual-section">Les interpretacions individuals apareixeran quan hi haja proves completes.</p>`}
    </section>`;
  }

  function bindWorkspace(grade) {
    document.querySelectorAll("[data-tab]").forEach(button => button.addEventListener("click", () => { state.activeTab = button.dataset.tab; saveState(); render(); }));
    document.querySelectorAll("[data-student]").forEach(button => button.addEventListener("click", () => { state.selectedId = button.dataset.student; render(); }));
    document.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
      const student = currentStudent(); if (!student) return;
      student.answers ||= {};
      student.answers[button.dataset.question] = button.dataset.answer;
      saveState(); render();
    }));
    document.querySelectorAll("[data-open-student]").forEach(button => button.addEventListener("click", () => {
      state.selectedId = button.dataset.openStudent; state.activeTab = "corrector"; saveState(); render();
    }));
    document.getElementById("add-one")?.addEventListener("click", addOne);
    document.getElementById("one-student")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addOne(); } });
    document.getElementById("add-bulk")?.addEventListener("click", addBulk);
    document.getElementById("delete-student")?.addEventListener("click", deleteStudent);
    document.getElementById("export-json")?.addEventListener("click", exportJson);
    document.getElementById("export-csv")?.addEventListener("click", () => exportCsv(grade));
    document.getElementById("print-report")?.addEventListener("click", () => {
      const includeStudents = document.getElementById("include-student-results")?.checked;
      document.body.classList.toggle("print-with-students", Boolean(includeStudents));
      window.addEventListener("afterprint", () => document.body.classList.remove("print-with-students"), { once: true });
      window.print();
    });
    document.getElementById("change-config")?.addEventListener("click", () => {
      if (!confirm("Vols llevar la clau guardada d'este navegador? El grup i les respostes es conservaran.")) return;
      try { localStorage.removeItem(CONFIG_STORE_KEY); } catch (_) { storageOkay = false; }
      CFG = null;
      renderConfigSetup();
    });
    document.getElementById("new-group")?.addEventListener("click", () => {
      if (confirm("Vols crear un altre grup? Descarrega primer una còpia JSON del grup actual si la necessites.")) { state = emptyState(); saveState(); render(); }
    });
    document.getElementById("restore-workspace")?.addEventListener("click", () => document.getElementById("restore-file").click());
    document.getElementById("restore-file")?.addEventListener("change", restoreBackup);
  }

  function normalizeName(name) { return String(name || "").trim().replace(/\s+/g, " "); }

  function addNames(names) {
    let added = 0;
    for (const raw of names) {
      const name = normalizeName(raw);
      if (!name || state.students.some(s => s.name.toLocaleLowerCase() === name.toLocaleLowerCase())) continue;
      const student = { id: makeId(), name, answers: {} };
      state.students.push(student); state.selectedId = student.id; added++;
    }
    if (added) { saveState(); render(); }
    else alert("No s'ha afegit cap nom nou. Comprova que no estiga ja en la llista.");
  }

  function addOne() {
    const input = document.getElementById("one-student");
    if (!input || !normalizeName(input.value)) return;
    const name = input.value; input.value = ""; addNames([name]);
  }

  function addBulk() {
    const input = document.getElementById("bulk-students");
    if (!input || !input.value.trim()) return;
    const names = input.value.split(/\r?\n/); input.value = ""; addNames(names);
  }

  function deleteStudent() {
    const student = currentStudent();
    if (!student || !confirm(`Eliminar ${student.name} i les seues respostes d'este grup?`)) return;
    state.students = state.students.filter(s => s.id !== student.id);
    state.selectedId = state.students[0]?.id || null;
    saveState(); render();
  }

  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function safeFilename(value) { return String(value || "ACL").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_|_$/g, "") || "ACL"; }

  function exportJson() {
    const name = safeFilename(`${state.group?.grade}PRI_${state.group?.group}_${state.group?.pass}`);
    download(`${name}_ACL_copia.json`, JSON.stringify(state, null, 2), "application/json;charset=utf-8");
  }

  function csvCell(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }

  function exportCsv(grade) {
    const headers = ["Curs", "Grup", "Curs escolar", "Passada", "Data", "Alumne/a", "Estat", "Puntuació directa", "Errors", "En blanc", "Decatipus"];
    for (const [, name] of DIMENSIONS) headers.push(`${name} encerts`, `${name} errors %`, `${name} PC`);
    const types = [...new Set(grade.items.map(i => i.textType).filter(Boolean))];
    for (const type of types) headers.push(`${type} encerts`, `${type} màxim`);
    for (const item of grade.items) headers.push(`Ítem ${item.number}`);
    const rows = state.students.map(student => {
      const result = calculate(student, grade);
      const out = [state.group.grade, state.group.group, state.group.schoolYear, state.group.pass, state.group.date, student.name, result.completed ? "completa" : "pendent", result.raw, result.wrong, result.blank, result.decatype ?? (result.decatypePending ? "revisar barem" : "")];
      for (const [key] of DIMENSIONS) {
        const d = result.dimensions[key];
        out.push(d.correct, d.correct + d.wrong ? (d.wrong / (d.correct + d.wrong) * 100).toFixed(1) : "", d.percentile ?? "");
      }
      for (const type of types) out.push(result.textTypes[type]?.correct || 0, grade.items.filter(i => i.textType === type).length);
      for (const item of grade.items) {
        const key = String(item.number);
        out.push(!Object.prototype.hasOwnProperty.call(student.answers || {}, key) ? "pendent" : (student.answers[key] === BLANK || student.answers[key] === "") ? "en blanc" : student.answers[key]);
      }
      return out;
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\r\n");
    const name = safeFilename(`${state.group.grade}PRI_${state.group.group}_${state.group.pass}`);
    download(`${name}_ACL_resultats.csv`, "\ufeff" + csv, "text/csv;charset=utf-8");
  }

  function restoreBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || parsed.schemaVersion !== 1 || !parsed.group || !Array.isArray(parsed.students) || !CFG.grades[String(parsed.group.grade)]) throw new Error("format");
        if (!confirm("Carregar esta còpia? Substituirà el grup que tens obert.")) return;
        state = parsed; saveState(); render();
      } catch (_) { alert("No s'ha pogut llegir la còpia. Tria un JSON ACL exportat des d'esta eina."); }
      finally { event.target.value = ""; }
    };
    reader.readAsText(file);
  }

  function render() {
    if (!CFG || !CFG.grades) {
      renderConfigSetup();
      return;
    }
    if (!state.group) renderSetup(); else renderWorkspace();
  }

  render();
})();

