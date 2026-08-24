import React from "react";
import { T } from "./tokens";
// Source : docs/reference/olive-demo.html 21819–22615 — moteur workflow event-sourced OliveWfEngine
// (R1–R62) + seed wfSemerDemo + composants WfBranche/WfPuce + helpers. Porté verbatim.
// pushParamAudit hors périmètre → non requis ici (le moteur émet ses propres événements).

export const FINAL = "__FINAL__";
const OliveWfEngineTypesGuard = (t: string) => ["minPreparateurs", "sectionsPrealables",
  "quatreYeuxRenforce", "engagementSection", "motifRefusMin"].includes(t);

export class OliveWfEngine {
  [key: string]: any;
  constructor({ tenantConfig = {} }: any = {}) {
    this.cfg = { reminderMaxBeforeEscalade: 2, r59ScoreSeuil: null, r60FraicheurJours: null, r61SeuilFile: null, ...tenantConfig };
    this.events = [];
    this.tenantRules = [];
    this.dossiers = new Map();
    this.absents = new Set();
    this.clock = { months: 0, days: 0 };
    this.rejectedRegistry = new Map();
    this.recusations = new Map();
    this.habilitations = new Map();
  }
  emit(type: string, p: any = {}) {
    const ev = { seq: this.events.length + 1, type, at: `T+${this.clock.months}m/J${this.clock.days}`, ...p };
    Object.freeze(ev);
    this.events.push(ev);
    this.apply(ev);
    const PASSIVE = new Set(["RAPPEL_INACTIVITE_EMIS", "DOSSIER_ABANDONNE"]);
    if (p.dossierId && this.dossiers.has(p.dossierId) && !PASSIVE.has(type)) this.dossiers.get(p.dossierId).lastActivityDay = this.clock.days;
    return ev;
  }
  audit() { return this.events; }
  addTenantRule(rule: any) {
    if (!OliveWfEngineTypesGuard(rule.type)) throw new Error(`R56 : type de règle inconnu ou interdit « ${rule.type} »`);
    const r = { actif: true, source: "manuel", justification: "", ...rule };
    this.tenantRules.push(r);
    this.emit("REGLE_TENANT_AJOUTEE", { regle: r.id, regleType: r.type, source: r.source, justification: r.justification, params: JSON.stringify(r.params ?? {}) });
    return r;
  }
  setTenantRuleActive(id: string, actif: boolean) {
    const r = this.tenantRules.find((x: any) => x.id === id);
    if (!r) throw new Error(`règle ${id} inconnue`);
    r.actif = actif;
    this.emit(actif ? "REGLE_TENANT_ACTIVEE" : "REGLE_TENANT_DESACTIVEE", { regle: id });
  }
  _reglesActives(type: string) { return this.tenantRules.filter((r: any) => r.actif && r.type === type); }
  d(id: string) { const d = this.dossiers.get(id); if (!d) throw new Error(`Dossier ${id} inconnu`); return d; }
  section(id: string, s: string) { return this.d(id).sections.get(s); }
  visa(id: string, s: string) { return this.section(id, s).visa; }
  dossierState(id: string) { return this.d(id).state; }
  tasks() { return [...this.dossiers.values()].flatMap((d: any) => d.tasks); }
  alerts() { return [...this.dossiers.values()].flatMap((d: any) => d.alerts); }
  incidents() { return [...this.dossiers.values()].flatMap((d: any) => d.incidents); }
  apply(ev: any) { const H = this["on" + ev.type]; if (H) H.call(this, ev); }
  createDossier(id: string, { sections, finalValidator, personId = null }: any) {
    this.emit("DOSSIER_CREE", { dossierId: id, sections, finalValidator, personId });
    if (personId && this.rejectedRegistry.has(personId)) this.emit("PROSPECT_RETOUR_DETECTE", { dossierId: id, personId, motifInitial: this.rejectedRegistry.get(personId) });
  }
  editField(actor: string, id: string, s: string, field: string, opts: any = {}) { this.emit("CHAMP_MODIFIE", { actor, dossierId: id, sectionId: s, field, processId: opts.processId }); }
  submitForVisa(id: string, s: string, opts: any = {}) {
    this.emit("SECTION_SOUMISE", { dossierId: id, sectionId: s, processId: opts.processId });
    if (this.cfg.r61SeuilFile != null) {
      const sec = this.section(id, s);
      const v = sec.visa.assignee ?? sec.validator;
      if (v) {
        const n = this._fileVisas(v);
        if (n > this.cfg.r61SeuilFile) {
          this.emit("GOULOT_SIGNALE", { validateur: v, file: n, seuil: this.cfg.r61SeuilFile });
          if (sec.relay) this.emit("ROUTAGE_RELAIS_PROPOSE", { dossierId: id, sectionId: s, validateur: v, relais: sec.relay });
        }
      }
    }
  }
  setValidator(id: string, s: string, v: string) { this.emit("VALIDATEUR_DEFINI", { dossierId: id, sectionId: s, validator: v }); }
  declareAbsent(v: string) { this.absents.add(v); }
  validatorLeft(v: string) { this.absents.add(v); this.emit("VALIDATEUR_PARTI", { validator: v }); }
  grantVisa(actor: string, id: string, s: string, detail = "", opts: any = {}) {
    const sec = this.section(id, s);
    const habJ = this.habilitations.get(actor);
    if (habJ !== undefined && habJ < this.clock.days) {
      if (opts.derogation) {
        this.emit("DEROGATION_PRONONCEE", { actor: opts.derogation.decideur, dossierId: id, sectionId: s, beneficiaire: actor, ficheDePoste: opts.derogation.ficheDePoste, motif: "habilitation expirée — R58 via R4" });
      } else {
        this.d(id).tasks.push({ type: "RENOUVELLEMENT_HABILITATION", actor });
        this.emit("VISA_TENTATIVE_REFUSEE", { actor, dossierId: id, sectionId: s, detail: "R58 : habilitation expirée (J" + habJ + ")" });
        throw new Error(`R58 : habilitation de ${actor} expirée (J${habJ}) — visa refusé`);
      }
    }
    const kR57 = id + "|" + s;
    if (this.recusations.has(kR57) && this.recusations.get(kR57).has(actor)) {
      this.emit("VISA_TENTATIVE_REFUSEE", { actor, dossierId: id, sectionId: s, detail: "R57 : validateur récusé — visa définitivement interdit" });
      throw new Error(`R57 : ${actor} s'est récusé sur ${s} — visa définitivement interdit`);
    }
    if (sec.preparers.has(actor)) {
      this.emit("VISA_TENTATIVE_REFUSEE", { actor, dossierId: id, sectionId: s, detail: "Principe 4-yeux : préparateur exclu de la validation de sa section" });
      throw new Error("Principe 4-yeux : préparateur exclu de la validation de sa section");
    }
    if (sec.visa.status !== "EN_ATTENTE") throw new Error(`Visa ${s} non accordable (${sec.visa.status})`);
    const d59 = this.d(id);
    const r59actif = s === FINAL && this.cfg.r59ScoreSeuil != null && d59.scoreRisque != null && d59.scoreRisque >= this.cfg.r59ScoreSeuil;
    const deuxiemeR59 = r59actif && sec.visa.premierSignataire != null;
    const attendu = sec.visa.assignee ?? sec.validator;
    if (attendu && actor !== attendu && !deuxiemeR59) throw new Error(`${actor} n'est pas le validateur nommé (${attendu}) — visa réservé (R2)`);
    if (s === FINAL && this.cfg.r60FraicheurJours != null) {
      const d60 = this.d(id);
      const perimees: string[] = [];
      for (const [nom, sx] of d60.sections) {
        if (nom === FINAL || !sx.visa || sx.visa.status !== "ACCORDE") continue;
        const ref = sx.reconfirmeLe ?? sx.visaAccordeLe;
        if (ref != null && (this.clock.days - ref) > this.cfg.r60FraicheurJours) perimees.push(nom);
      }
      if (perimees.length) {
        for (const nom of perimees) d60.tasks.push({ type: "RECONFIRMATION_SECTION", dossierId: id, sectionId: nom });
        this.emit("RECONFIRMATION_REQUISE_R60", { dossierId: id, sections: perimees.join(","), seuilJours: this.cfg.r60FraicheurJours });
        throw new Error(`R60 : re-confirmation requise : ${perimees.join(", ")}`);
      }
    }
    if (s === FINAL) {
      if (opts.engagement !== true) throw new Error("Le validateur final doit confirmer l'engagement de sa responsabilité (R14)");
      this.emit("ENGAGEMENT_RESPONSABILITE", { actor, dossierId: id, sectionId: s });
    }
    for (const r of this._reglesActives("minPreparateurs")) if (sec.preparers.size < r.params.n) throw new Error(`${r.id} (règle tenant) : au moins ${r.params.n} contributeurs distincts requis`);
    for (const r of this._reglesActives("sectionsPrealables")) if (s === r.params.section) { const av = this.section(id, r.params.avant); if (!av.visa || av.visa.status !== "ACCORDE") throw new Error(`${r.id} (règle tenant) : « ${r.params.section} » n'est visable qu'après « ${r.params.avant} »`); }
    for (const r of this._reglesActives("quatreYeuxRenforce")) { const d = this.d(id); for (const [, sx] of d.sections) if (sx.preparers.has(actor)) throw new Error(`${r.id} (règle tenant) : 4-yeux renforcé — ${actor} a contribué au dossier`); }
    for (const r of this._reglesActives("engagementSection")) if (s === r.params.section && opts.engagement !== true) throw new Error(`${r.id} (règle tenant) : engagement de responsabilité étendu à « ${r.params.section} » (R14)`);
    if (r59actif) {
      const premier = sec.visa.premierSignataire ?? null;
      if (premier === null) { sec.visa.premierSignataire = actor; this.emit("VISA_FINAL_PREMIER_SIGNATAIRE", { actor, dossierId: id, score: d59.scoreRisque, seuil: this.cfg.r59ScoreSeuil }); return; }
      if (actor === premier) throw new Error(`R59 : la validation finale exige deux signataires DISTINCTS`);
    }
    sec.visaAccordeLe = this.clock.days;
    this.emit("VISA_ACCORDE", { actor, dossierId: id, sectionId: s, processId: opts.processId, detail: detail || (sec.visa.assignee !== sec.validator ? `visa accordé par relais ${sec.visa.assignee} pour ${sec.validator}` : `visa accordé par ${actor}`) });
  }
  grantVisaByDerogation(actor: string, id: string, s: string, { decideur, fichePoste }: any) {
    this.emit("DEROGATION", { actor: decideur, dossierId: id, sectionId: s, detail: `dérogation pour ${actor}, fiche de poste ${fichePoste}` });
    this.emit("VISA_ACCORDE", { actor, dossierId: id, sectionId: s, derogation: { decideur, fichePoste }, detail: `visa accordé sous dérogation par ${actor} (décideur ${decideur})` });
  }
  refuseVisa(actor: string, id: string, s: string, motivation: string) {
    if (!motivation || !motivation.trim()) throw new Error("Refus bloqué : motivation obligatoire (R7)");
    for (const r of this._reglesActives("motifRefusMin")) if (motivation.trim().length < r.params.n) throw new Error(`${r.id} (règle tenant) : motivation d'au moins ${r.params.n} caractères exigée (durcit R7)`);
    this.emit("VISA_REFUSE", { actor, dossierId: id, sectionId: s, motivation });
  }
  revokeVisa() { throw new Error("La révocation discrétionnaire n'existe pas (R9)"); }
  annulForProcessVice({ by }: any, id: string, s: string, motif: string) {
    const d = this.d(id);
    const hasPO = by.some((x: string) => /ProcessOwner/i.test(x));
    const hasVF = by.includes(d.finalValidator);
    if (!hasPO || !hasVF) throw new Error("Annulation conjointe requise : process owner ET validateur final (R14)");
    this.emit("VISA_ANNULE", { actor: by.join("+"), dossierId: id, sectionId: s, detail: `process non respecté — ${motif}` });
    this.emit("INCIDENT_OPRISK", { dossierId: id, sectionId: s, motif });
  }
  reassignValidator(actor: string, id: string, s: string, next: string) {
    if (!/ProcessOwner|COO/i.test(actor)) throw new Error("Réassignation réservée au process owner / COO (R11)");
    this.emit("VALIDATEUR_CHANGE", { actor, dossierId: id, sectionId: s, detail: `${this.section(id, s).validator} → ${next}`, next });
  }
  tickReminder(id: string, s: string) {
    const v = this.visa(id, s);
    if (v.status !== "EN_ATTENTE") return;
    if (v.reminders + 1 >= this.cfg.reminderMaxBeforeEscalade + 1) return;
    this.emit("VISA_RAPPEL", { dossierId: id, sectionId: s, n: v.reminders + 1 });
    if (this.visa(id, s).reminders >= this.cfg.reminderMaxBeforeEscalade) this.emit("VISA_ESCALADE", { dossierId: id, sectionId: s });
  }
  attachScreeningAlert(id: string, alert: any) {
    this.emit("ALERTE_RATTACHEE", { dossierId: id, alert });
    if (!alert.resolved) this.emit("DOSSIER_SUSPENDU", { dossierId: id, motif: "alerte de screening non résolue", restrictions: this.cfg.suspensionRestrictions });
  }
  suspendForMros(id: string) { this.emit("DOSSIER_SUSPENDU", { dossierId: id, motif: "communication MROS (art. 9a LBA)", restrictions: this.cfg.suspensionRestrictions, discret: true }); }
  restrictions(id: string) { return this.d(id).restrictions; }
  operationAllowed(id: string, dir: string) {
    const d = this.d(id);
    if (d.state !== "SUSPENDU" || !d.restrictions) return true;
    return dir === "IN" ? !!d.restrictions.inflows : !!d.restrictions.outflows;
  }
  reject(id: string, motif: string) { this.emit("DOSSIER_REJETE", { dossierId: id, motif }); }
  evalInactivity(id: string) {
    const d = this.d(id);
    if (!["EN_PREPARATION", "BROUILLON"].includes(d.state)) return;
    const idle = this.clock.days - (d.lastActivityDay ?? 0);
    const [r1, r2, ab] = this.cfg.abandonSchedule ?? [30, 60, 90];
    if (idle >= ab) { this.emit("DOSSIER_ABANDONNE", { dossierId: id, idle }); return; }
    if (idle >= r2 && d.reminderCount < 2) this.emit("RAPPEL_INACTIVITE_EMIS", { dossierId: id, n: 2, idle });
    else if (idle >= r1 && d.reminderCount < 1) this.emit("RAPPEL_INACTIVITE_EMIS", { dossierId: id, n: 1, idle });
  }
  reactivate(id: string) { this.emit("DOSSIER_REACTIVE", { dossierId: id }); }
  requestErasureLpd(id: string, demande: any) {
    const d = this.d(id);
    if (d.diligencesStarted) { this.emit("EFFACEMENT_LPD_REFUSE", { dossierId: id, demande, detail: "conservation LBA prime" }); return { granted: false, reason: "Obligation de conservation LBA — 10 ans" }; }
    this.emit("EFFACEMENT_LPD_ACCORDE", { dossierId: id, demande });
    return { granted: true };
  }
  changeOfCircumstances(id: string, { sections, risk, detail }: any) { const processId = `EVT-${this.events.length + 1}`; this.emit("COC_RECU", { dossierId: id, processId, sections, risk, detail }); return processId; }
  startRecertification(id: string) { const processId = `RECERT-${this.events.length + 1}`; this.emit("RECERT_DEMARREE", { dossierId: id, processId }); return processId; }
  closeEventProcess(id: string, processId: string) { this.emit("EVENEMENT_CLOTURE", { dossierId: id, processId }); }
  process(id: string, pid: string) { return this.d(id).processes.get(pid); }
  processTrail(id: string, pid: string) { return this.events.filter((e: any) => e.dossierId === id && e.processId === pid); }
  attachDocument(id: string, s: string, doc: any) { this.emit("DOCUMENT_RECU", { dossierId: id, sectionId: s, doc }); }
  expireDocument(id: string, docId: string) { this.emit("DOCUMENT_EXPIRE", { dossierId: id, docId }); }
  advanceMonths(n: number) { this.clock.months += n; }
  advanceDays(n: number) { this.clock.days += n; }
  openRecertification(id: string) { this.emit("RECERTIFICATION_OUVERTE", { dossierId: id }); }
  onDOSSIER_CREE(ev: any) {
    const sections = new Map();
    for (const s of ev.sections) sections.set(s.id, { id: s.id, label: s.label, state: "EN_PREPARATION", validator: s.validator, relay: s.relay, preparers: new Set(), docs: [], visa: { status: "AUCUN", assignee: null, reminders: 0, derogation: null, mention: "" } });
    sections.set(FINAL, { id: FINAL, label: "Validation finale", state: "EN_PREPARATION", validator: ev.finalValidator, relay: null, preparers: new Set(), docs: [], visa: { status: "AUCUN", assignee: null, reminders: 0, derogation: null, mention: "" } });
    this.dossiers.set(ev.dossierId, { id: ev.dossierId, state: "EN_PREPARATION", sections, finalValidator: ev.finalValidator, personId: ev.personId ?? null, tasks: [], alerts: [], incidents: [], screeningAlerts: [], processes: new Map(), restrictions: null, readOnly: false, reminderCount: 0, lastActivityDay: this.clock.days, diligencesStarted: false });
  }
  onCHAMP_MODIFIE(ev: any) {
    const d = this.d(ev.dossierId);
    const sec = d.sections.get(ev.sectionId);
    d.diligencesStarted = true;
    sec.preparers.add(ev.actor);
    d.sections.get(FINAL).preparers.add(ev.actor);
    if (sec.visa.status === "EN_ATTENTE" || sec.visa.status === "ACCORDE") {
      sec.visa = { ...sec.visa, status: "INVALIDE" };
      sec.state = "EN_PREPARATION";
      d.alerts.push({ to: sec.validator, type: "VISA_INVALIDE", sectionId: sec.id });
      const fin = d.sections.get(FINAL);
      if (fin.visa.status === "EN_ATTENTE") { fin.visa = { ...fin.visa, status: "INVALIDE" }; d.state = "EN_PREPARATION"; }
    }
  }
  onSECTION_SOUMISE(ev: any) {
    const sec = this.section(ev.dossierId, ev.sectionId);
    sec.state = "SOUMISE";
    const target = this.absents.has(sec.validator) ? (sec.relay ?? null) : sec.validator;
    sec.visa = { ...sec.visa, status: "EN_ATTENTE", assignee: target, reminders: 0 };
  }
  onVALIDATEUR_DEFINI(ev: any) { const sec = this.section(ev.dossierId, ev.sectionId); sec.validator = ev.validator; if (sec.visa.status === "EN_ATTENTE") sec.visa.assignee = ev.validator; }
  onVISA_ACCORDE(ev: any) {
    const d = this.d(ev.dossierId);
    const sec = d.sections.get(ev.sectionId);
    sec.visa = { ...sec.visa, status: "ACCORDE", derogation: ev.derogation ?? null, mention: ev.derogation ? "sous dérogation" : "" };
    sec.state = "VISEE";
    if (ev.sectionId !== FINAL) {
      const all = [...d.sections.values()].filter((s: any) => s.id !== FINAL);
      if (all.every((s: any) => s.visa.status === "ACCORDE")) {
        const fin = d.sections.get(FINAL);
        fin.visa = { ...fin.visa, status: "EN_ATTENTE", assignee: this.absents.has(fin.validator) ? (fin.relay ?? null) : fin.validator };
        d.state = "VALIDATION_FINALE";
      }
    } else { d.state = "ACTIF"; }
  }
  onVISA_REFUSE(ev: any) { const sec = this.section(ev.dossierId, ev.sectionId); sec.visa = { ...sec.visa, status: "REFUSE" }; sec.state = "EN_PREPARATION"; }
  onVISA_ANNULE(ev: any) { const sec = this.section(ev.dossierId, ev.sectionId); sec.visa = { ...sec.visa, status: "ANNULE" }; sec.state = "EN_PREPARATION"; }
  onINCIDENT_OPRISK(ev: any) { this.d(ev.dossierId).incidents.push({ type: "RISQUE_OPERATIONNEL", sectionId: ev.sectionId, motif: ev.motif }); }
  onVALIDATEUR_CHANGE(ev: any) { const sec = this.section(ev.dossierId, ev.sectionId); sec.validator = ev.next; if (sec.visa.status === "EN_ATTENTE") sec.visa.assignee = ev.next; }
  onVISA_RAPPEL(ev: any) { this.visa(ev.dossierId, ev.sectionId).reminders = ev.n; }
  onDOCUMENT_RECU(ev: any) { this.section(ev.dossierId, ev.sectionId).docs.push({ ...ev.doc, expired: false }); }
  onDOCUMENT_EXPIRE(ev: any) { const d = this.d(ev.dossierId); for (const sec of d.sections.values()) { const doc = sec.docs.find((x: any) => x.id === ev.docId); if (doc) { doc.expired = true; d.tasks.push({ type: "COLLECTE_DOCUMENT", ref: doc.id, sectionId: sec.id }); } } }
  onRECERTIFICATION_OUVERTE(ev: any) { const d = this.d(ev.dossierId); for (const sec of d.sections.values()) sec.state = "EN_PREPARATION"; d.state = "EN_PREPARATION"; }
  onALERTE_RATTACHEE(ev: any) { this.d(ev.dossierId).screeningAlerts.push(ev.alert); }
  onDOSSIER_SUSPENDU(ev: any) { const d = this.d(ev.dossierId); d.previousState = d.state; d.state = "SUSPENDU"; d.restrictions = ev.restrictions ?? null; }
  onDOSSIER_REJETE(ev: any) { const d = this.d(ev.dossierId); d.state = "REJETE"; if (d.personId) this.rejectedRegistry.set(d.personId, ev.motif); }
  onPROSPECT_RETOUR_DETECTE(ev: any) { this.d(ev.dossierId).alerts.push({ to: "CO", type: "PROSPECT_REFUSE_RETOUR", personId: ev.personId, motifInitial: ev.motifInitial }); }
  onRAPPEL_INACTIVITE_EMIS(ev: any) { const d = this.d(ev.dossierId); d.reminderCount = ev.n; d.alerts.push({ to: "RM", type: "RAPPEL_INACTIVITE", n: ev.n }); }
  onDOSSIER_ABANDONNE(ev: any) { const d = this.d(ev.dossierId); d.state = "ABANDONNE"; d.readOnly = true; }
  onDOSSIER_REACTIVE(ev: any) { const d = this.d(ev.dossierId); d.state = "EN_PREPARATION"; d.readOnly = false; d.reminderCount = 0; }
  onEFFACEMENT_LPD_REFUSE() { }
  onEFFACEMENT_LPD_ACCORDE() { }
  onCOC_RECU(ev: any) {
    const d = this.d(ev.dossierId);
    d.processes.set(ev.processId, { id: ev.processId, type: "EVENEMENT", status: "EN_COURS", absorbed: [] });
    for (const p of d.processes.values()) if (p.type === "RECERT" && p.status === "EN_COURS") { p.status = "EN_PAUSE"; p.pausedAtSeq = ev.seq; }
    for (const sid of ev.sections) { const sec = d.sections.get(sid); sec.state = "EN_PREPARATION"; if (sec.visa.status === "ACCORDE" || sec.visa.status === "EN_ATTENTE") sec.visa = { ...sec.visa, status: "INVALIDE" }; }
    if (ev.risk === "MAJEUR") { d.previousState = d.state; d.state = "SUSPENDU"; d.restrictions = this.cfg.suspensionRestrictions ?? { inflows: true, outflows: false }; d.alerts.push({ to: "MLRO", type: "COC_RISQUE_MAJEUR", detail: ev.detail }); }
    else { d.state = "EN_MISE_A_JOUR"; d.restrictions = null; }
  }
  onRECERT_DEMARREE(ev: any) { this.d(ev.dossierId).processes.set(ev.processId, { id: ev.processId, type: "RECERT", status: "EN_COURS", absorbed: [] }); }
  onEVENEMENT_CLOTURE(ev: any) {
    const d = this.d(ev.dossierId);
    const evt = d.processes.get(ev.processId);
    if (evt) evt.status = "CLOTURE";
    for (const p of d.processes.values()) {
      if (p.type === "RECERT" && p.status === "EN_PAUSE") {
        p.status = "EN_COURS";
        for (const sec of d.sections.values()) {
          const granted = this.events.find((x: any) => x.type === "VISA_ACCORDE" && x.dossierId === d.id && x.sectionId === sec.id && x.processId === ev.processId && x.seq > (p.pausedAtSeq ?? 0));
          if (granted) p.absorbed.push({ sectionId: sec.id, visaProcess: ev.processId, visaSeq: granted.seq });
        }
      }
    }
  }
  onVISA_TENTATIVE_REFUSEE() { }
  onVALIDATEUR_PARTI() { }
  onDEROGATION() { }
  setHabilitation(actor: string, expireJour: number) { this.habilitations.set(actor, expireJour); this.emit("HABILITATION_DEFINIE", { actor, expireJour }); }
  setScoreRisque(id: string, score: number) { this.d(id).scoreRisque = score; this.emit("SCORE_RISQUE_DEFINI", { dossierId: id, score }); }
  reconfirmSection(actor: string, id: string, s: string) { const sec = this.section(id, s); if (actor !== sec.validator) throw new Error(`R60 : la re-confirmation revient au validateur (${sec.validator})`); sec.reconfirmeLe = this.clock.days; this.emit("SECTION_RECONFIRMEE", { actor, dossierId: id, sectionId: s }); }
  refuseReconfirm(actor: string, id: string, s: string, motivation: string) { const sec = this.section(id, s); if (actor !== sec.validator) throw new Error("R60 : seul le validateur peut refuser"); if (!motivation) throw new Error("R60 : motivation exigée"); sec.visa.status = "INVALIDE"; sec.state = "EN_PREPARATION"; sec.visaAccordeLe = null; this.emit("SECTION_INVALIDEE_R60", { actor, dossierId: id, sectionId: s, motivation }); }
  accepterRoutageRelais(decideur: string, id: string, s: string) { const sec = this.section(id, s); if (!sec.relay) throw new Error(`R61 : aucun relais R4 déclaré pour ${sec.validator}`); const ancien = sec.visa.assignee ?? sec.validator; sec.visa.assignee = sec.relay; this.emit("ROUTAGE_RELAIS_DECIDE", { actor: decideur, dossierId: id, sectionId: s, ancien, relais: sec.relay }); }
  _fileVisas(v: string) { let n = 0; for (const d of this.dossiers.values()) for (const [, sx] of d.sections) if (sx.visa && sx.visa.status === "EN_ATTENTE" && ((sx.visa.assignee ?? sx.validator) === v)) n++; return n; }
  onHABILITATION_DEFINIE() { }
  onSCORE_RISQUE_DEFINI() { }
  onSECTION_RECONFIRMEE() { }
  onSECTION_INVALIDEE_R60() { }
  onROUTAGE_RELAIS_DECIDE() { }
  onGOULOT_SIGNALE() { }
  onROUTAGE_RELAIS_PROPOSE() { }
  onVISA_FINAL_PREMIER_SIGNATAIRE() { }
  onRECONFIRMATION_REQUISE_R60() { }
  recuseVisa(actor: string, id: string, s: string, motivation: string) {
    const sec = this.section(id, s);
    if (!sec.visa || sec.visa.status !== "EN_ATTENTE") throw new Error(`Aucun visa en attente sur ${s}`);
    const attendu = sec.visa.assignee ?? sec.validator;
    if (attendu && actor !== attendu) throw new Error(`R57 : seul le validateur assigné (${attendu}) peut se récuser`);
    if (!motivation) throw new Error("R57 : la récusation exige une motivation obligatoire");
    const k = id + "|" + s;
    if (!this.recusations.has(k)) this.recusations.set(k, new Set());
    this.recusations.get(k).add(actor);
    this.emit("RECUSATION_PRONONCEE", { actor, dossierId: id, sectionId: s, motivation });
    if (s === FINAL) { this.d(id).tasks.push({ type: "ESCALADE_RECUSATION_FINALE", dossierId: id, to: "process_owner" }); this.emit("ESCALADE_EMISE", { dossierId: id, sectionId: s, motif: "récusation sur la validation finale" }); }
  }
  onRECUSATION_PRONONCEE() { }
  onESCALADE_EMISE() { }
  static sha256Hex(msg: string) {
    const K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
    let H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const enc = unescape(encodeURIComponent(msg));
    const l = enc.length, bitLen = l * 8;
    const withOne = enc + String.fromCharCode(0x80);
    let padded = withOne;
    while ((padded.length % 64) !== 56) padded += String.fromCharCode(0);
    const bytes: number[] = [];
    for (let i = 0; i < padded.length; i++) bytes.push(padded.charCodeAt(i));
    for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);
    const rr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < bytes.length; off += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
      for (let i = 16; i < 64; i++) { const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3); const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10); w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0; }
      let [a, b2, cc, dd, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25); const ch = (e & f) ^ (~e & g); const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22); const mj = (a & b2) ^ (a & cc) ^ (b2 & cc); const t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (dd + t1) | 0; dd = cc; cc = b2; b2 = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b2) | 0, (H[2] + cc) | 0, (H[3] + dd) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  static canonEvent(ev: any) { const keys = Object.keys(ev).sort(); const o: any = {}; for (const k of keys) o[k] = ev[k]; return JSON.stringify(o); }
  exportSealed(actor: string, deSeq = 1, aSeq: number | null = null) {
    const evs = this.events.filter((e: any) => e.seq >= deSeq && (aSeq === null || e.seq <= aSeq));
    const canons: string[] = [];
    let h = "0".repeat(64);
    for (const e of evs) { const cnn = OliveWfEngine.canonEvent(e); canons.push(cnn); h = OliveWfEngine.sha256Hex(h + cnn); }
    const exp = { deSeq, aSeq: aSeq === null ? (evs.length ? evs[evs.length - 1].seq : 0) : aSeq, par: actor, evenements: canons, scelle: h };
    this.emit("EXPORT_SCELLE_EMIS", { actor, deSeq: exp.deSeq, aSeq: exp.aSeq, scelle: h, nb: canons.length });
    return exp;
  }
  static verifySealed(exp: any) { let h = "0".repeat(64); for (const cnn of exp.evenements) h = OliveWfEngine.sha256Hex(h + cnn); return h === exp.scelle; }
  onEXPORT_SCELLE_EMIS() { }
}
(OliveWfEngine as any).TENANT_RULE_TYPES = {
  minPreparateurs: "au moins N contributeurs distincts avant visa",
  sectionsPrealables: "une section n'est visable qu'après une autre",
  quatreYeuxRenforce: "le signataire n'a contribué à AUCUNE section du dossier",
  engagementSection: "pop-up d'engagement (R14) étendu à une section donnée",
  motifRefusMin: "longueur minimale de la motivation de refus (durcit R7)",
};

export function wfSemerDemo() {
  const e = new OliveWfEngine({ tenantConfig: { reminderMaxBeforeEscalade: 2, suspensionRestrictions: { inflows: true, outflows: false, notifyClient: false } } });
  e.createDossier("D-2026-001", { sections: [{ id: "IDENT", label: "Identification", validator: "I. Vernet (CO Senior)" }, { id: "SOF", label: "Origine des fonds", validator: "P. Meier (CO)" }, { id: "FISC", label: "Fiscalité", validator: "S. Zimmermann (CO)" }], finalValidator: "H. Brunner (Head PB)" });
  e.editField("J-P. Favre (RM)", "D-2026-001", "IDENT", "domicile");
  e.submitForVisa("D-2026-001", "IDENT");
  e.advanceDays(2);
  e.grantVisa("I. Vernet (CO Senior)", "D-2026-001", "IDENT");
  e.advanceDays(4);
  e.editField("J-P. Favre (RM)", "D-2026-001", "SOF", "SOW");
  e.submitForVisa("D-2026-001", "SOF");
  e.advanceDays(3);
  e.grantVisa("P. Meier (CO)", "D-2026-001", "SOF");
  e.advanceDays(5);
  e.editField("J-P. Favre (RM)", "D-2026-001", "FISC", "TIN");
  e.submitForVisa("D-2026-001", "FISC");
  e.advanceDays(2);
  e.refuseVisa("S. Zimmermann (CO)", "D-2026-001", "FISC", "auto-certification CRS manquante");
  e.advanceDays(6);
  e.editField("J-P. Favre (RM)", "D-2026-001", "FISC", "CRS");
  e.submitForVisa("D-2026-001", "FISC");
  e.advanceDays(2);
  e.grantVisa("S. Zimmermann (CO)", "D-2026-001", "FISC");
  e.createDossier("D-2026-002", { sections: [{ id: "IDENT", label: "Identification", validator: "I. Vernet (CO Senior)" }, { id: "SOF", label: "Origine des fonds", validator: "P. Meier (CO)" }], finalValidator: "H. Brunner (Head PB)" });
  e.editField("L. Morel (RM)", "D-2026-002", "IDENT", "settlor");
  e.editField("L. Morel (RM)", "D-2026-002", "SOF", "SOW");
  e.submitForVisa("D-2026-002", "SOF");
  e.createDossier("D-2026-003", { sections: [{ id: "IDENT", label: "Identification", validator: "I. Vernet (CO Senior)" }], finalValidator: "H. Brunner (Head PB)" });
  e.editField("J-P. Favre (RM)", "D-2026-003", "IDENT", "registre");
  e.submitForVisa("D-2026-003", "IDENT");
  e.advanceDays(1);
  e.grantVisa("I. Vernet (CO Senior)", "D-2026-003", "IDENT");
  return e;
}
export const WF_ENGINE = wfSemerDemo();
export const WF_TITULAIRES: any = { "D-2026-001": "Famille Keller", "D-2026-002": "Trust Aquila", "D-2026-003": "Holding Véga" };
export const WF_IDS: string[] = ["D-2026-001", "D-2026-002", "D-2026-003"];
export const WF_ACTEURS: string[] = ["I. Vernet (CO Senior)", "P. Meier (CO)", "S. Zimmermann (CO)", "H. Brunner (Head PB)", "J-P. Favre (RM)", "L. Morel (RM)", "M. Dubois (CO)"];
export const WF_INVARIANTS: any[] = [["R2", "Validateur nommé"], ["R7", "Refus motivé"], ["R9", "Pas de révocation"], ["R13", "4-yeux par section"], ["R14", "Engagement à la finale"], ["R49", "Journal append-only"]];
export const WF_TYPES_RT: any[] = [["minPreparateurs", "Contributeurs minimum avant visa", { n: 2 }], ["sectionsPrealables", "Séquencement : section visable après une autre", { section: "FISC", avant: "SOF" }], ["quatreYeuxRenforce", "4-yeux renforcé : signataire étranger à tout le dossier", {}], ["engagementSection", "Engagement (R14) étendu à une section", { section: "SOF" }], ["motifRefusMin", "Motivation de refus d'au moins N caractères", { n: 20 }]];
export const WF_VCOL: any = { ACCORDE: T.green, VISEE: T.green, EN_ATTENTE: T.gold, SOUMISE: T.gold, EN_PREPARATION: T.inkSoft, AUCUN: T.inkSoft, INVALIDE: T.red, REFUSE: T.red, ANNULE: T.red };
export function wfSections(d: any) { return Array.from(d.sections.values()); }
export function wfVisaDe(s: any) { return s.visa ? s.visa.status : "AUCUN"; }
export function WfPuce({ v }: { v: string }) { return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 11, fontSize: 11, fontWeight: 600, color: "#fff", background: WF_VCOL[v] || T.inkSoft }}>{v}</span>; }
export function WfBranche({ d }: { d: any }) {
  const secs: any[] = wfSections(d), fin = secs.find(s => s.id === "__FINAL__");
  return (
    <div style={{ display: "flex", alignItems: "center", margin: "8px 0 4px" }}>
      {secs.filter(s => s.id !== "__FINAL__").map(s => {
        const c = WF_VCOL[wfVisaDe(s) === "AUCUN" ? s.state : wfVisaDe(s)] || T.inkSoft;
        return (
          <React.Fragment key={s.id}>
            <div style={{ height: 3, width: 30, background: T.olive700 }} />
            <div title={s.label + " — " + s.state + "/" + wfVisaDe(s)} style={{ width: 24, height: 24, borderRadius: "0 60% 0 60%", transform: "rotate(45deg)", background: c, border: "2px solid #ffffffcc", boxShadow: "0 1px 2px #0002" }} />
          </React.Fragment>
        );
      })}
      <div style={{ height: 3, width: 30, background: T.olive700 }} />
      <div title={"Validation finale — " + (fin ? wfVisaDe(fin) : "AUCUN")} style={{ width: 15, height: 19, borderRadius: "50%", marginLeft: 4, background: fin && wfVisaDe(fin) !== "AUCUN" ? WF_VCOL[wfVisaDe(fin)] : T.olive900 }} />
    </div>
  );
}
export function wfRejoue(dossierId: string, n: number) {
  const evts = WF_ENGINE.audit().filter((ev: any) => ev.dossierId === dossierId);
  const e2 = new OliveWfEngine({ tenantConfig: { reminderMaxBeforeEscalade: 2, suspensionRestrictions: { inflows: true, outflows: false, notifyClient: false } } });
  evts.slice(0, n).forEach((ev: any) => { e2.events.push(ev); e2.apply(ev); });
  return { evts: evts.slice(0, n), total: evts.length, d: e2.d(dossierId) };
}
export function wfPreuve4Yeux() {
  const par: any = {};
  WF_ENGINE.audit().forEach((ev: any) => {
    if (!ev.dossierId || !ev.sectionId) return;
    const k = ev.dossierId + "·" + ev.sectionId;
    par[k] = par[k] || { dossier: ev.dossierId, section: ev.sectionId, preparateurs: new Set(), validateur: null };
    if (ev.type === "CHAMP_MODIFIE") par[k].preparateurs.add(ev.actor);
    if (ev.type === "VISA_ACCORDE") par[k].validateur = ev.actor;
  });
  return Object.values(par).filter((v: any) => v.validateur);
}
export function wfOliviaPropose() {
  const evts = WF_ENGINE.audit();
  const props: any[] = [];
  const parActeur: any = {};
  evts.filter((e: any) => e.type === "CHAMP_MODIFIE").forEach((e: any) => { const k = e.dossierId + "·" + e.actor; parActeur[k] = (parActeur[k] || new Set()).add(e.sectionId); });
  const multi: any = Object.entries(parActeur).find(([, v]: any) => v.size >= 3);
  if (multi) props.push({ type: "quatreYeuxRenforce", params: {}, justification: `${multi[0].split("·")[1]} a contribué à ${multi[1].size} sections de ${multi[0].split("·")[0]} — un signataire étranger au dossier renforce l'indépendance.` });
  const refusCRS = evts.find((e: any) => e.type === "VISA_REFUSE" && /CRS|manquante/i.test(e.motivation || ""));
  if (refusCRS) props.push({ type: "sectionsPrealables", params: { section: "FISC", avant: "SOF" }, justification: `Refus « ${refusCRS.motivation} » (${refusCRS.dossierId}) — séquencer Fiscalité après Origine des fonds.` });
  const motifs = evts.filter((e: any) => e.type === "VISA_REFUSE").map((e: any) => (e.motivation || "").length);
  if (motifs.length) props.push({ type: "motifRefusMin", params: { n: 20 }, justification: `Motivations de refus : ${Math.round(motifs.reduce((a: number, b: number) => a + b, 0) / motifs.length)} caractères en moyenne — plancher à 20.` });
  return props.filter(p => !WF_ENGINE.tenantRules.some((r: any) => r.type === p.type && r.actif));
}
