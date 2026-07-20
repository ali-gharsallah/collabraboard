// O-Live — Moteur de workflow compliance. Bloc 1 : cycle de vie du visa 4-yeux.
// Invariants (catalogue v2) : rien ne change d'état par effet de bord — toute
// action publique émet un ÉVÉNEMENT ; les projections (visas, sections, tâches,
// alertes, incidents) sont reconstruites par apply(). Audit append-only (R49).
// Le visa est uniforme : la validation finale est un visa d'étape (R15).

const FINAL = "__FINAL__";
const OliveWfEngineTypesGuard = (t) => ["minPreparateurs", "sectionsPrealables",
  "quatreYeuxRenforce", "engagementSection", "motifRefusMin"].includes(t);

export class WorkflowEngine {
  constructor({ tenantConfig = {} } = {}) {
    this.cfg = { reminderMaxBeforeEscalade: 2, ...tenantConfig };   // R-Q injecté
    this.events = [];                       // source de vérité, append-only
    this.tenantRules = [];                  // R56 : règles additionnelles (durcir seulement)
    this.dossiers = new Map();
    this.absents = new Set();
    this.clock = { months: 0, days: 0 };
    this.rejectedRegistry = new Map();          // R18 : personId → motif
  }

  // ── Émission : UNIQUE porte d'entrée des changements d'état ──
  emit(type, p = {}) {
    const ev = { seq: this.events.length + 1, type, at: `T+${this.clock.months}m/J${this.clock.days}`, ...p };
    Object.freeze(ev);
    this.events.push(ev);                   // R49 : append-only, jamais muté
    this.apply(ev);
    const PASSIVE = new Set(["RAPPEL_INACTIVITE_EMIS", "DOSSIER_ABANDONNE"]);
    if (p.dossierId && this.dossiers.has(p.dossierId) && !PASSIVE.has(type))
      this.dossiers.get(p.dossierId).lastActivityDay = this.clock.days;
    return ev;
  }
  audit() { return this.events; }

  // ── R56 : règles tenant — elles ne peuvent QUE durcir, jamais assouplir ──
  static TENANT_RULE_TYPES = {
    minPreparateurs:   "au moins N contributeurs distincts avant visa",
    sectionsPrealables:"une section n'est visable qu'après une autre",
    quatreYeuxRenforce:"le signataire n'a contribué à AUCUNE section du dossier",
    engagementSection: "pop-up d'engagement (R14) étendu à une section donnée",
    motifRefusMin:     "longueur minimale de la motivation de refus (durcit R7)",
  };
  addTenantRule(rule) {
    if (!OliveWfEngineTypesGuard(rule.type))
      throw new Error(`R56 : type de règle inconnu ou interdit « ${rule.type} » — les règles tenant ne peuvent que durcir, jamais assouplir un invariant`);
    const r = { actif: true, source: "manuel", justification: "", ...rule };
    this.tenantRules.push(r);
    this.emit("REGLE_TENANT_AJOUTEE", { regle: r.id, regleType: r.type,
      source: r.source, justification: r.justification, params: JSON.stringify(r.params ?? {}) });
    return r;
  }
  setTenantRuleActive(id, actif) {
    const r = this.tenantRules.find(x => x.id === id);
    if (!r) throw new Error(`règle ${id} inconnue`);
    r.actif = actif;
    this.emit(actif ? "REGLE_TENANT_ACTIVEE" : "REGLE_TENANT_DESACTIVEE", { regle: id });
  }
  _reglesActives(type) { return this.tenantRules.filter(r => r.actif && r.type === type); }

  // ── Projections ──
  d(id) { const d = this.dossiers.get(id); if (!d) throw new Error(`Dossier ${id} inconnu`); return d; }
  section(id, s) { return this.d(id).sections.get(s); }
  visa(id, s) { return this.section(id, s).visa; }
  dossierState(id) { return this.d(id).state; }
  tasks() { return [...this.dossiers.values()].flatMap(d => d.tasks); }
  alerts() { return [...this.dossiers.values()].flatMap(d => d.alerts); }
  incidents() { return [...this.dossiers.values()].flatMap(d => d.incidents); }

  apply(ev) {
    const H = this["on" + ev.type];
    if (H) H.call(this, ev);
  }

  // ── API publique (émet des événements, ne mute jamais directement) ──
  createDossier(id, { sections, finalValidator, personId = null }) {
    this.emit("DOSSIER_CREE", { dossierId: id, sections, finalValidator, personId });
    // R18 : détection du retour d'un prospect refusé
    if (personId && this.rejectedRegistry.has(personId))
      this.emit("PROSPECT_RETOUR_DETECTE", { dossierId: id, personId,
        motifInitial: this.rejectedRegistry.get(personId) });
  }
  editField(actor, id, s, field, opts = {}) { this.emit("CHAMP_MODIFIE", { actor, dossierId: id, sectionId: s, field, processId: opts.processId }); }
  submitForVisa(id, s, opts = {}) { this.emit("SECTION_SOUMISE", { dossierId: id, sectionId: s, processId: opts.processId }); }
  setValidator(id, s, v) { this.emit("VALIDATEUR_DEFINI", { dossierId: id, sectionId: s, validator: v }); }
  declareAbsent(v) { this.absents.add(v); }
  validatorLeft(v) { this.absents.add(v); this.emit("VALIDATEUR_PARTI", { validator: v }); }

  grantVisa(actor, id, s, detail = "", opts = {}) {
    const sec = this.section(id, s);
    // R13 : le préparateur ne vise JAMAIS sa section — tentative tracée (V-02)
    if (sec.preparers.has(actor)) {
      this.emit("VISA_TENTATIVE_REFUSEE", { actor, dossierId: id, sectionId: s,
        detail: "Principe 4-yeux : préparateur exclu de la validation de sa section" });
      throw new Error("Principe 4-yeux : préparateur exclu de la validation de sa section");
    }
    if (sec.visa.status !== "EN_ATTENTE") throw new Error(`Visa ${s} non accordable (${sec.visa.status})`);
    // R2 : signature réservée au validateur nommé (ou son relais) — dérogation R4 sinon
    const attendu = sec.visa.assignee ?? sec.validator;
    if (attendu && actor !== attendu)
      throw new Error(`${actor} n'est pas le validateur nommé (${attendu}) — visa réservé (R2), dérogation R4 possible`);
    // R14 : pop-up d'engagement obligatoire à la validation finale
    if (s === FINAL) {
      if (opts.engagement !== true)
        throw new Error("Le validateur final doit confirmer l'engagement de sa responsabilité (R14)");
      this.emit("ENGAGEMENT_RESPONSABILITE", { actor, dossierId: id, sectionId: s });
    }
    // R56 : règles tenant additionnelles (elles s'AJOUTENT aux invariants)
    for (const r of this._reglesActives("minPreparateurs"))
      if (sec.preparers.size < r.params.n)
        throw new Error(`${r.id} (règle tenant) : au moins ${r.params.n} contributeurs distincts requis — ${sec.preparers.size} constaté`);
    for (const r of this._reglesActives("sectionsPrealables"))
      if (s === r.params.section) {
        const av = this.section(id, r.params.avant);
        if (!av.visa || av.visa.status !== "ACCORDE")
          throw new Error(`${r.id} (règle tenant) : « ${r.params.section} » n'est visable qu'après « ${r.params.avant} » visée`);
      }
    for (const r of this._reglesActives("quatreYeuxRenforce")) {
      const d = this.d(id);
      for (const [, sx] of d.sections)
        if (sx.preparers.has(actor))
          throw new Error(`${r.id} (règle tenant) : 4-yeux renforcé — ${actor} a contribué au dossier`);
    }
    for (const r of this._reglesActives("engagementSection"))
      if (s === r.params.section && opts.engagement !== true) {
        throw new Error(`${r.id} (règle tenant) : engagement de responsabilité étendu à « ${r.params.section} » (R14)`);
      }
    this.emit("VISA_ACCORDE", { actor, dossierId: id, sectionId: s, processId: opts.processId,
      detail: detail || (sec.visa.assignee !== sec.validator
        ? `visa accordé par relais ${sec.visa.assignee} pour ${sec.validator}` : `visa accordé par ${actor}`) });
  }

  grantVisaByDerogation(actor, id, s, { decideur, fichePoste }) {
    // R4 : à défaut de relais — dérogation tracée adossée à la fiche de poste
    this.emit("DEROGATION", { actor: decideur, dossierId: id, sectionId: s,
      detail: `dérogation pour ${actor}, fiche de poste ${fichePoste}` });
    this.emit("VISA_ACCORDE", { actor, dossierId: id, sectionId: s,
      derogation: { decideur, fichePoste },
      detail: `visa accordé sous dérogation par ${actor} (décideur ${decideur})` });
  }

  refuseVisa(actor, id, s, motivation) {
    if (!motivation || !motivation.trim())
      throw new Error("Refus bloqué : motivation obligatoire (R7)");
    for (const r of this._reglesActives("motifRefusMin"))
      if (motivation.trim().length < r.params.n)
        throw new Error(`${r.id} (règle tenant) : motivation d'au moins ${r.params.n} caractères exigée (durcit R7)`);
    this.emit("VISA_REFUSE", { actor, dossierId: id, sectionId: s, motivation });
  }

  revokeVisa() { throw new Error("La révocation discrétionnaire n'existe pas (R9)"); }

  annulForProcessVice({ by }, id, s, motif) {
    // R14 : prononcée CONJOINTEMENT process owner + validateur final
    const d = this.d(id);
    const hasPO = by.some(x => /ProcessOwner/i.test(x));
    const hasVF = by.includes(d.finalValidator);
    if (!hasPO || !hasVF)
      throw new Error("Annulation conjointe requise : process owner ET validateur final (R14)");
    this.emit("VISA_ANNULE", { actor: by.join("+"), dossierId: id, sectionId: s,
      detail: `process non respecté — ${motif}` });
    this.emit("INCIDENT_OPRISK", { dossierId: id, sectionId: s, motif });
  }

  reassignValidator(actor, id, s, next) {
    if (!/ProcessOwner|COO/i.test(actor))
      throw new Error("Réassignation réservée au process owner / COO (R11)");
    this.emit("VALIDATEUR_CHANGE", { actor, dossierId: id, sectionId: s,
      detail: `${this.section(id, s).validator} → ${next}`, next });
  }

  tickReminder(id, s) {
    const v = this.visa(id, s);
    if (v.status !== "EN_ATTENTE") return;
    if (v.reminders + 1 >= this.cfg.reminderMaxBeforeEscalade + 1) return; // déjà escaladé
    this.emit("VISA_RAPPEL", { dossierId: id, sectionId: s, n: v.reminders + 1 });
    if (this.visa(id, s).reminders >= this.cfg.reminderMaxBeforeEscalade)
      this.emit("VISA_ESCALADE", { dossierId: id, sectionId: s });
  }

  // ═══ Bloc 2 — cycle de vie du dossier (R16–R23) ═══
  attachScreeningAlert(id, alert) {
    this.emit("ALERTE_RATTACHEE", { dossierId: id, alert });
    if (!alert.resolved) this.emit("DOSSIER_SUSPENDU", { dossierId: id,
      motif: "alerte de screening non résolue", restrictions: this.cfg.suspensionRestrictions });
  }
  suspendForMros(id) {
    // R17 : discrétion art. 9a LBA — le client n'est JAMAIS notifié
    this.emit("DOSSIER_SUSPENDU", { dossierId: id, motif: "communication MROS (art. 9a LBA)",
      restrictions: this.cfg.suspensionRestrictions, discret: true });
  }
  restrictions(id) { return this.d(id).restrictions; }
  operationAllowed(id, dir) {
    const d = this.d(id);
    if (d.state !== "SUSPENDU" || !d.restrictions) return true;
    return dir === "IN" ? !!d.restrictions.inflows : !!d.restrictions.outflows;
  }
  reject(id, motif) { this.emit("DOSSIER_REJETE", { dossierId: id, motif }); }
  evalInactivity(id) {
    const d = this.d(id);
    if (!["EN_PREPARATION", "BROUILLON"].includes(d.state)) return;
    const idle = this.clock.days - (d.lastActivityDay ?? 0);
    const [r1, r2, ab] = this.cfg.abandonSchedule ?? [30, 60, 90];   // R19 : paramètre tenant
    if (idle >= ab) { this.emit("DOSSIER_ABANDONNE", { dossierId: id, idle }); return; }
    if (idle >= r2 && d.reminderCount < 2)
      this.emit("RAPPEL_INACTIVITE_EMIS", { dossierId: id, n: 2, idle });
    else if (idle >= r1 && d.reminderCount < 1)
      this.emit("RAPPEL_INACTIVITE_EMIS", { dossierId: id, n: 1, idle });
  }
  reactivate(id) { this.emit("DOSSIER_REACTIVE", { dossierId: id }); }
  requestErasureLpd(id, demande) {
    const d = this.d(id);
    if (d.diligencesStarted) {
      // R20 : la conservation LBA (10 ans dès le début des diligences) prime sur la LPD
      this.emit("EFFACEMENT_LPD_REFUSE", { dossierId: id, demande,
        detail: "conservation LBA (10 ans dès le début des diligences) prime sur l'effacement LPD" });
      return { granted: false, reason: "Obligation de conservation LBA — 10 ans dès le début des diligences" };
    }
    this.emit("EFFACEMENT_LPD_ACCORDE", { dossierId: id, demande });
    return { granted: true };
  }
  changeOfCircumstances(id, { sections, risk, detail }) {
    const processId = `EVT-${this.events.length + 1}`;
    this.emit("COC_RECU", { dossierId: id, processId, sections, risk, detail });
    return processId;
  }
  startRecertification(id) {
    const processId = `RECERT-${this.events.length + 1}`;
    this.emit("RECERT_DEMARREE", { dossierId: id, processId });
    return processId;
  }
  closeEventProcess(id, processId) { this.emit("EVENEMENT_CLOTURE", { dossierId: id, processId }); }
  process(id, pid) { return this.d(id).processes.get(pid); }
  processTrail(id, pid) { return this.events.filter(e => e.dossierId === id && e.processId === pid); }

  attachDocument(id, s, doc) { this.emit("DOCUMENT_RECU", { dossierId: id, sectionId: s, doc }); }
  expireDocument(id, docId) { this.emit("DOCUMENT_EXPIRE", { dossierId: id, docId }); }
  advanceMonths(n) { this.clock.months += n; }             // R8 : le temps seul ne change RIEN
  advanceDays(n) { this.clock.days += n; }
  openRecertification(id) { this.emit("RECERTIFICATION_OUVERTE", { dossierId: id }); }

  // ── Handlers (projections) ──
  onDOSSIER_CREE(ev) {
    const sections = new Map();
    for (const s of ev.sections) sections.set(s.id, {
      id: s.id, label: s.label, state: "EN_PREPARATION", validator: s.validator,
      relay: s.relay, preparers: new Set(), docs: [],
      visa: { status: "AUCUN", assignee: null, reminders: 0, derogation: null, mention: "" } });
    // R15 : la validation finale est une section-visa comme les autres
    sections.set(FINAL, { id: FINAL, label: "Validation finale", state: "EN_PREPARATION",
      validator: ev.finalValidator, relay: null, preparers: new Set(), docs: [],
      visa: { status: "AUCUN", assignee: null, reminders: 0, derogation: null, mention: "" } });
    this.dossiers.set(ev.dossierId, { id: ev.dossierId, state: "EN_PREPARATION",
      sections, finalValidator: ev.finalValidator, personId: ev.personId ?? null,
      tasks: [], alerts: [], incidents: [], screeningAlerts: [], processes: new Map(),
      restrictions: null, readOnly: false, reminderCount: 0,
      lastActivityDay: this.clock.days, diligencesStarted: false });
  }

  onCHAMP_MODIFIE(ev) {
    const d = this.d(ev.dossierId); const sec = d.sections.get(ev.sectionId);
    d.diligencesStarted = true;                            // R20 : point de départ des 10 ans
    sec.preparers.add(ev.actor);
    // le préparateur d'une section l'est aussi vis-à-vis de la validation finale (R13/R15)
    d.sections.get(FINAL).preparers.add(ev.actor);
    // R6/R10 : invalidation CIBLÉE du visa de cette section (attente OU accordé)
    if (sec.visa.status === "EN_ATTENTE" || sec.visa.status === "ACCORDE") {
      const wasPending = sec.visa.status === "EN_ATTENTE";
      sec.visa = { ...sec.visa, status: "INVALIDE" };
      sec.state = "EN_PREPARATION";
      d.alerts.push({ to: sec.validator, type: "VISA_INVALIDE", sectionId: sec.id });
      // R15/V-17 : la validation finale en attente est invalidée à son tour
      const fin = d.sections.get(FINAL);
      if (fin.visa.status === "EN_ATTENTE") {
        fin.visa = { ...fin.visa, status: "INVALIDE" };
        d.state = "EN_PREPARATION";
      }
      void wasPending;
    }
  }

  onSECTION_SOUMISE(ev) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.state = "SOUMISE";
    // R4 : routage — validateur nommé, sinon relais nommé (l'absence sans relais
    // laisse l'assignation vide : seule la dérogation R4 permettra d'accorder)
    const target = this.absents.has(sec.validator) ? (sec.relay ?? null) : sec.validator;
    sec.visa = { ...sec.visa, status: "EN_ATTENTE", assignee: target, reminders: 0 };
  }

  onVALIDATEUR_DEFINI(ev) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.validator = ev.validator;
    if (sec.visa.status === "EN_ATTENTE") sec.visa.assignee = ev.validator;
  }

  onVISA_ACCORDE(ev) {
    const d = this.d(ev.dossierId); const sec = d.sections.get(ev.sectionId);
    sec.visa = { ...sec.visa, status: "ACCORDE",
      derogation: ev.derogation ?? null,
      mention: ev.derogation ? "sous dérogation" : "" };
    sec.state = "VISEE";
    // R15/V-16 : toutes les sections visées → tâche de visa de validation finale
    if (ev.sectionId !== FINAL) {
      const all = [...d.sections.values()].filter(s => s.id !== FINAL);
      if (all.every(s => s.visa.status === "ACCORDE")) {
        const fin = d.sections.get(FINAL);
        fin.visa = { ...fin.visa, status: "EN_ATTENTE",
          assignee: this.absents.has(fin.validator) ? (fin.relay ?? null) : fin.validator };
        d.state = "VALIDATION_FINALE";
      }
    } else { d.state = "ACTIF"; }
  }

  onVISA_REFUSE(ev) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.visa = { ...sec.visa, status: "REFUSE" };       // R7 : retour préparateur…
    sec.state = "EN_PREPARATION";                       // …re-soumission au MÊME validateur
  }

  onVISA_ANNULE(ev) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.visa = { ...sec.visa, status: "ANNULE" };
    sec.state = "EN_PREPARATION";   // incohérence attrapée par le croisement bi-moteur
  }
  onINCIDENT_OPRISK(ev) {
    this.d(ev.dossierId).incidents.push({ type: "RISQUE_OPERATIONNEL",
      sectionId: ev.sectionId, motif: ev.motif });
  }
  onVALIDATEUR_CHANGE(ev) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.validator = ev.next;
    if (sec.visa.status === "EN_ATTENTE") sec.visa.assignee = ev.next;
  }
  onVISA_RAPPEL(ev) { this.visa(ev.dossierId, ev.sectionId).reminders = ev.n; }
  onDOCUMENT_RECU(ev) { this.section(ev.dossierId, ev.sectionId).docs.push({ ...ev.doc, expired: false }); }
  onDOCUMENT_EXPIRE(ev) {
    const d = this.d(ev.dossierId);
    for (const sec of d.sections.values()) {
      const doc = sec.docs.find(x => x.id === ev.docId);
      if (doc) { doc.expired = true;
        // R5/V-07 : valide à réception → le visa reste accordable ; tâche de collecte
        d.tasks.push({ type: "COLLECTE_DOCUMENT", ref: doc.id, sectionId: sec.id }); }
    }
  }
  onRECERTIFICATION_OUVERTE(ev) {
    // R8/V-13 : seul process qui rouvre — les sections repassent en préparation
    const d = this.d(ev.dossierId);
    for (const sec of d.sections.values()) { sec.state = "EN_PREPARATION"; }
    d.state = "EN_PREPARATION";
  }
  // ═══ Handlers Bloc 2 ═══
  onALERTE_RATTACHEE(ev) { this.d(ev.dossierId).screeningAlerts.push(ev.alert); }
  onDOSSIER_SUSPENDU(ev) {
    const d = this.d(ev.dossierId);
    d.previousState = d.state; d.state = "SUSPENDU";
    d.restrictions = ev.restrictions ?? null;             // R22 : le risque décide
  }
  onDOSSIER_REJETE(ev) {
    const d = this.d(ev.dossierId);
    d.state = "REJETE";
    if (d.personId) this.rejectedRegistry.set(d.personId, ev.motif);
  }
  onPROSPECT_RETOUR_DETECTE(ev) {
    this.d(ev.dossierId).alerts.push({ to: "CO", type: "PROSPECT_REFUSE_RETOUR",
      personId: ev.personId, motifInitial: ev.motifInitial });
  }
  onRAPPEL_INACTIVITE_EMIS(ev) {
    const d = this.d(ev.dossierId);
    d.reminderCount = ev.n;
    d.alerts.push({ to: "RM", type: "RAPPEL_INACTIVITE", n: ev.n });
  }
  onDOSSIER_ABANDONNE(ev) {
    const d = this.d(ev.dossierId);
    d.state = "ABANDONNE"; d.readOnly = true;             // R20 : consultable en lecture seule
  }
  onDOSSIER_REACTIVE(ev) {
    const d = this.d(ev.dossierId);
    d.state = "EN_PREPARATION"; d.readOnly = false; d.reminderCount = 0;
  }
  onEFFACEMENT_LPD_REFUSE() {} onEFFACEMENT_LPD_ACCORDE() {}
  onCOC_RECU(ev) {
    const d = this.d(ev.dossierId);
    d.processes.set(ev.processId, { id: ev.processId, type: "EVENEMENT",
      status: "EN_COURS", absorbed: [] });
    // R23 : l'événement de risque est prioritaire — la recert en cours passe en pause
    for (const p of d.processes.values())
      if (p.type === "RECERT" && p.status === "EN_COURS") { p.status = "EN_PAUSE"; p.pausedAtSeq = ev.seq; }
    // R21 : réouverture CIBLÉE des seules sections impactées
    for (const sid of ev.sections) {
      const sec = d.sections.get(sid);
      sec.state = "EN_PREPARATION";
      if (sec.visa.status === "ACCORDE" || sec.visa.status === "EN_ATTENTE")
        sec.visa = { ...sec.visa, status: "INVALIDE" };
    }
    if (ev.risk === "MAJEUR") {
      // R21/R22 : critère de risque majeur → Suspendu + restrictions + MLRO
      d.previousState = d.state; d.state = "SUSPENDU";
      d.restrictions = this.cfg.suspensionRestrictions ?? { inflows: true, outflows: false };
      d.alerts.push({ to: "MLRO", type: "COC_RISQUE_MAJEUR", detail: ev.detail });
    } else {
      d.state = "EN_MISE_A_JOUR";                          // client opérationnel (D-06)
      d.restrictions = null;
    }
  }
  onRECERT_DEMARREE(ev) {
    this.d(ev.dossierId).processes.set(ev.processId,
      { id: ev.processId, type: "RECERT", status: "EN_COURS", absorbed: [] });
  }
  onEVENEMENT_CLOTURE(ev) {
    const d = this.d(ev.dossierId);
    const evt = d.processes.get(ev.processId);
    if (evt) evt.status = "CLOTURE";
    // R23 : la recert reprend en ABSORBANT les sections revalidées par l'événement
    for (const p of d.processes.values()) {
      if (p.type === "RECERT" && p.status === "EN_PAUSE") {
        p.status = "EN_COURS";
        for (const sec of d.sections.values()) {
          const granted = this.events.find(x => x.type === "VISA_ACCORDE"
            && x.dossierId === d.id && x.sectionId === sec.id
            && x.processId === ev.processId && x.seq > (p.pausedAtSeq ?? 0));
          if (granted) p.absorbed.push({ sectionId: sec.id, visaProcess: ev.processId, visaSeq: granted.seq });
        }
      }
    }
  }
  onVISA_TENTATIVE_REFUSEE() {} onVALIDATEUR_PARTI() {} onDEROGATION() {}
}
