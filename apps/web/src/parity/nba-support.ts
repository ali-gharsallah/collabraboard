import { amlHash } from "./preonboarding-support";

// Source : docs/reference/olive-demo.html 21443-21484 — Next Best Action (moteur + email). Porté verbatim.

export const NBA_ACTIONS: any = {
GAIN: { icon: "📈", label: "Prise de profit / vente partielle", color: "green" },
LOSS: { icon: "📉", label: "Rebalancement défensif", color: "red" },
OPP: { icon: "✨", label: "Opportunité de placement structuré", color: "gold" },
IDLE: { icon: "💤", label: "Liquidités non investies", color: "amber" },
};
export function nbaSignalFor(client: any) {
var h = amlHash(client.id + "|nba", 100);
if (h < 20)
return { type: "GAIN", magnitude: 8 + (h % 15) };
if (h < 38)
return { type: "LOSS", magnitude: 5 + (h % 12) };
if (h < 58)
return { type: "OPP", magnitude: 0 };
if (h < 70)
return { type: "IDLE", magnitude: 10 + (h % 20) };
return null;
}
export function nbaEmailDraft(client: any, signal: any) {
var cfg = NBA_ACTIONS[signal.type];
var subject, body;
if (signal.type === "GAIN") {
subject = "Point sur votre portefeuille — opportunité de prise de profit";
body = "Cher/Chère " + client.name + ",\n\nVotre portefeuille affiche une performance favorable sur la période récente (+" + signal.magnitude + "% estimé sur les lignes concernées). Je vous propose un échange rapide pour évaluer une prise de profit partielle et sécuriser ces gains, tout en conservant votre exposition long terme.\n\nSeriez-vous disponible cette semaine pour un appel de 15 minutes ?\n\nBien cordialement,\n" + client.rm;
}
else if (signal.type === "LOSS") {
subject = "Point de vigilance sur votre portefeuille";
body = "Cher/Chère " + client.name + ",\n\nJ'ai identifié une exposition qui pourrait générer une perte latente d'environ " + signal.magnitude + "% dans le contexte de marché actuel. Je souhaiterais vous proposer un rebalancement défensif pour limiter ce risque.\n\nPuis-je vous appeler pour en discuter ?\n\nBien cordialement,\n" + client.rm;
}
else if (signal.type === "OPP") {
subject = "Une opportunité de placement qui pourrait vous intéresser";
body = "Cher/Chère " + client.name + ",\n\nCompte tenu de votre profil (" + client.segment + ", " + client.ddl + "), une opportunité de placement structuré correspondant à vos objectifs est actuellement disponible. Je serais ravi(e) de vous la présenter.\n\nAvez-vous 20 minutes cette semaine ?\n\nBien cordialement,\n" + client.rm;
}
else {
subject = "Optimisation de vos liquidités disponibles";
body = "Cher/Chère " + client.name + ",\n\nJ'ai constaté qu'une part significative de vos avoirs reste en liquidités non investies. Je vous propose d'échanger sur des solutions de placement à court terme adaptées à votre profil de risque.\n\nQuand seriez-vous disponible ?\n\nBien cordialement,\n" + client.rm;
}
return { subject: subject, body: body, cfg: cfg };
}
