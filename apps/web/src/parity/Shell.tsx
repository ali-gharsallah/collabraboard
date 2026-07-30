import React, { useState } from "react";
import { T } from "./tokens";
import { OliveLogo } from "../components/OliveLogo";
import { LoginScreen } from "./LoginScreen";
import { ClientsScreen } from "./ClientsScreen";
import { KycListScreen } from "./KycListScreen";
import { KycDetailScreen } from "./KycDetailScreen";
import { PersonsScreen } from "./PersonsScreen";
import { AccountReviewScreen } from "./AccountReviewScreen";
import { CocScreen } from "./CocScreen";
import { OffboardingScreen } from "./OffboardingScreen";
import { ProspectToContactScreen } from "./ProspectToContactScreen";
import { PreOnboardingScreen } from "./PreOnboardingScreen";
import { TasksScreen } from "./TasksScreen";
import { ContactReportScreen } from "./ContactReportScreen";
import { PmsScreen } from "./PmsScreen";
import { ProspectionScreen } from "./ProspectionScreen";
import { FxScreen } from "./FxScreen";
import { ExecutiveDashboardScreen } from "./ExecutiveDashboardScreen";
import { MobileBankingScreen } from "./MobileBankingScreen";
import { CustodyTAScreen } from "./CustodyTAScreen";
import { OILScreen } from "./OILScreen";
import { WfEngineScreen } from "./WfEngineScreen";
import { WorkflowManagementScreen } from "./WorkflowManagementScreen";
import { SwiftLabScreen } from "./SwiftLabScreen";
import { RegWatchScreen } from "./RegWatchScreen";
import { CorroborationScreen } from "./CorroborationScreen";
import { OctopulseScreen } from "./OctopulseScreen";
import { SettlementScreen } from "./SettlementScreen";
import { RegistreLbaScreen } from "./RegistreLbaScreen";
import { FormationsScreen } from "./FormationsScreen";
import { LegalScreen } from "./LegalScreen";
import { TransfersScreen } from "./TransfersScreen";
import { ApiDocScreen } from "./ApiDocScreen";
import { IntegrationsScreen } from "./IntegrationsScreen";
import { CrossBorderScreen } from "./CrossBorderScreen";
import { AmlWorkspaceScreen } from "./AmlWorkspaceScreen";
import { InvestScreen } from "./InvestScreen";
import { AmlEncyclopediaScreen } from "./AmlEncyclopediaScreen";
import { clientById, kycsByClientId } from "./components-data";
import NAV from "../fixtures/NAV.json";
import SCREEN_LABEL from "../fixtures/SCREEN_LABEL.json";
import NAV_MODULE_MAP from "../fixtures/NAV_MODULE_MAP.json";
import I18N from "../fixtures/I18N.json";
import DS_STATS from "../fixtures/DS_STATS.json";

// Coquille applicative — PORT VERBATIM de App (docs/reference/olive-demo.html 44459–44800) :
// login → sidebar (groupes accordéon, décor « branche », pied FINMA/CDB20/LBA/LSFin, rôles/
// licences) + header sticky (titre SCREEN_LABEL, date fr-CH, Stats, notifications, utilisateur)
// + routing par état `screen`. Câblé sur les fixtures. ClientsScreen/KycListScreen branchés ;
// les autres écrans → Placeholder ; KycDetailScreen (§ Annexe D) = prochaine étape.
type User = { id: string; name: string; roleLabel: string; role: string; avatar: string; color: string; permissions: string[] };
const nav = NAV as any[];
const SL = SCREEN_LABEL as Record<string, string>;
const MM = NAV_MODULE_MAP as Record<string, string>;
const I18 = I18N as Record<string, Record<string, string>>;
const isModuleLicensed = (_mod: string) => true; // tenant standard : tous modules licenciés

const Placeholder = ({ title, desc }: { title: string; desc: string }) => (
  <div style={{ background: T.surface, borderRadius: 14, padding: 48, border: `1px solid ${T.line}`, textAlign: "center" }}>
    <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.25 }}>🌿</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: T.ink, marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: 13, color: T.inkSoft, maxWidth: 440, margin: "0 auto", lineHeight: 1.6 }}>{desc}</div>
  </div>);

export function Shell() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [lang, setLang] = useState("FR");
  const [screen, setScreen] = useState("home");
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [openMode, setOpenMode] = useState<"client" | "kyc">("client");
  const [navCollapsed, setNavCollapsed] = useState(typeof window !== "undefined" && window.innerWidth < 900);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ g_clients: true });
  const [statsOpen, setStatsOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 760;

  const tr = (label: string) => lang === "FR" ? label : (I18[lang]?.[label] || label);
  const toggleGroup = (id: string) => setOpenGroups(g => ({ ...g, [id]: !g[id] }));
  const goTo = (id: string) => { setScreen(id); setSelectedClient(null); };
  const logout = () => { setCurrentUser(null); };

  if (!currentUser) return <LoginScreen onLogin={u => setCurrentUser(u as User)} />;

  const ds = DS_STATS as any;
  const headerTitle = selectedClient ? (openMode === "client" ? "Fiche client" : "Dossier KYC") : (SL[screen] || screen);

  const navItemStyle = (active: boolean, sub = false): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 11, padding: sub ? "9px 12px 9px 34px" : "10px 12px",
    borderRadius: 9, border: "none", cursor: "pointer", textAlign: "left", width: "100%",
    background: active ? T.oliveSoft : "transparent", color: active ? T.olive700 : T.inkMid,
    fontSize: 13, fontWeight: active ? 700 : 500, transition: "all 0.15s",
  });

  const renderScreen = () => {
    if (selectedClient) {
      if (openMode === "kyc") {
        const ks = kycsByClientId[selectedClient.id] || [];
        return <KycDetailScreen client={selectedClient} kyc={ks[ks.length - 1]} onBack={() => setSelectedClient(null)} user={currentUser} />;
      }
      return <Placeholder title="Fiche client — golden record"
        desc={`Écran ClientFileScreen — portage de parité à venir. Client sélectionné : ${selectedClient.name}.`} />;
    }
    switch (screen) {
      case "clients": return <ClientsScreen onOpen={c => { setSelectedClient(c); setOpenMode("client"); }} />;
      case "kyc": return <KycListScreen onOpen={(k: any) => { setSelectedClient(clientById[k.clientId] || { id: k.clientId, name: k.clientName }); setOpenMode("kyc"); }} />;
      case "persons": return <PersonsScreen />;
      case "review": return <AccountReviewScreen user={currentUser} />;
      case "coc": return <CocScreen user={currentUser} />;
      case "offboarding": return <OffboardingScreen user={currentUser} />;
      case "prospect_contact": return <ProspectToContactScreen user={currentUser} goTo={goTo} />;
      case "prospect_test": return <PreOnboardingScreen user={currentUser} goTo={goTo} />;
      case "tasks": return <TasksScreen user={currentUser} />;
      case "contactreports": return <ContactReportScreen user={currentUser} />;
      case "pms": return <PmsScreen user={currentUser} />;
      case "prospection": return <ProspectionScreen user={currentUser} />;
      case "fx": return <FxScreen user={currentUser} />;
      case "execdash": return <ExecutiveDashboardScreen user={currentUser} go={goTo} />;
      case "mobile": return <MobileBankingScreen user={currentUser} />;
      case "custody": return <CustodyTAScreen />;
      case "oil": return <OILScreen go={goTo} />;
      case "wfengine": return <WfEngineScreen go={goTo} />;
      case "wfmanagement": return <WorkflowManagementScreen user={currentUser} />;
      case "wfdesigner": return <WorkflowManagementScreen user={currentUser} />;
      case "swiftlab": return <SwiftLabScreen user={currentUser} />;
      case "regwatch": return <RegWatchScreen />;
      case "corrob": return <CorroborationScreen user={currentUser} />;
      case "opprisk": return <OctopulseScreen user={currentUser} />;
      case "settlement": return <SettlementScreen user={currentUser} />;
      case "registre": return <RegistreLbaScreen user={currentUser} />;
      case "formations": return <FormationsScreen user={currentUser} />;
      case "legal": return <LegalScreen user={currentUser} />;
      case "transferts": return <TransfersScreen user={currentUser} />;
      case "apidoc": return <ApiDocScreen user={currentUser} />;
      case "integrations": return <IntegrationsScreen />;
      case "crossborder": return <CrossBorderScreen user={currentUser} />;
      case "aml": return <AmlWorkspaceScreen />;
      case "invest": return <InvestScreen />;
      case "amlcat": return <AmlEncyclopediaScreen user={currentUser} />;
      default: return <Placeholder title={SL[screen] || screen} desc="Écran non encore porté en parité — au programme des vagues suivantes (§6). La navigation, la coquille et les 2 premiers écrans métier sont fonctionnels." />;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: T.cream, fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", display: "flex" }}>
      <style>{`@keyframes pulse{0%{opacity:0.4}50%{opacity:0.1}100%{opacity:0.4}}`}</style>

      {/* SIDEBAR */}
      <aside style={{ width: navCollapsed ? 64 : 248, background: T.surface, borderRight: `1px solid ${T.line}`, padding: navCollapsed ? "14px 8px" : "22px 14px", display: "flex", flexDirection: "column", flexShrink: 0, height: "100vh", overflowY: "auto", overflowX: "hidden", transition: "width 0.22s ease, padding 0.22s ease" }}>
        {!navCollapsed && <div style={{ display: "flex", gap: 3, justifyContent: "center", margin: "8px 0 4px" }}>
          {["FR", "EN", "DE", "IT"].map(l => <button key={l} onClick={() => setLang(l)} style={{ padding: "4px 8px", borderRadius: 7, border: `1px solid ${lang === l ? T.olive600 : T.line}`, background: lang === l ? T.oliveSoft : "transparent", color: lang === l ? T.olive700 : T.inkSoft, fontSize: 9, fontWeight: 800, cursor: "pointer" }}>{l}</button>)}
        </div>}
        <button onClick={() => setNavCollapsed(v => !v)} title={navCollapsed ? "Déployer le menu" : "Réduire le menu"} style={{ alignSelf: navCollapsed ? "center" : "flex-end", width: 26, height: 26, borderRadius: 8, border: `1px solid ${T.line}`, background: T.cream, color: T.inkMid, fontSize: 12, cursor: "pointer", marginBottom: navCollapsed ? 10 : 2, flexShrink: 0, lineHeight: 1 }}>{navCollapsed ? "»" : "«"}</button>
        {navCollapsed
          ? <div title="O-Live — Client Lifecycle Intelligence" style={{ width: 36, height: 36, borderRadius: 10, margin: "0 auto", background: `linear-gradient(150deg,${T.olive700},${T.olive500})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>🌿</div>
          : <OliveLogo />}
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 6 }}>
          {nav.map(node => {
            if (node.rolesOnly && (!currentUser || node.rolesOnly.indexOf(currentUser.role) < 0)) return null;
            if (MM[node.id] && !isModuleLicensed(MM[node.id])) return null;
            if (node.type === "item") {
              const active = screen === node.id && !selectedClient;
              return <button key={node.id} onClick={() => goTo(node.id)} title={node.label} style={{ ...navItemStyle(active), justifyContent: navCollapsed ? "center" : undefined, padding: navCollapsed ? "9px 0" : undefined }}>
                <span style={{ fontSize: 14, width: 20, textAlign: navCollapsed ? "center" : undefined }}>{node.icon}</span>
                {!navCollapsed && <span style={{ flex: 1 }}>{tr(node.label)}</span>}
              </button>;
            }
            const open = openGroups[node.id];
            const childActive = node.children.some((c: any) => c.id === screen) && !selectedClient;
            return <div key={node.id}>
              <button onClick={() => { if (navCollapsed) { setNavCollapsed(false); if (!open) toggleGroup(node.id); } else toggleGroup(node.id); }} title={node.label} style={{ ...navItemStyle(false), color: childActive ? T.olive700 : T.ink, fontWeight: 700, justifyContent: navCollapsed ? "center" : undefined, padding: navCollapsed ? "9px 0" : undefined }}>
                <span style={{ fontSize: 14, width: 20, textAlign: navCollapsed ? "center" : undefined }}>{node.icon}</span>
                {!navCollapsed && <span style={{ flex: 1, textTransform: "uppercase", letterSpacing: 0.5, fontSize: 11 }}>{tr(node.label)}</span>}
                {!navCollapsed && <span style={{ fontSize: 10, color: T.inkSoft, transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>}
              </button>
              {navCollapsed && node.children.some((c: any) => c.id === screen) && <div style={{ width: 5, height: 5, borderRadius: "50%", background: T.olive600, margin: "2px auto 4px" }} />}
              {open && !navCollapsed && <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2, marginBottom: 4, position: "relative" }}>
                <div style={{ position: "absolute", left: 21, top: 4, bottom: 8, width: 2, background: T.sage, borderRadius: 2 }} />
                <div style={{ position: "absolute", left: 17, top: "35%", width: 10, height: 10, borderRadius: "50%", background: T.gold, opacity: 0.7, transform: "scale(0.7)" }} />
                <div style={{ position: "absolute", left: 17, top: "65%", width: 10, height: 10, borderRadius: "50%", background: T.leaf, opacity: 0.6, transform: "scale(0.6)" }} />
                {node.children.filter((c: any) => !(MM[c.id] && !isModuleLicensed(MM[c.id])) && !(c.rolesOnly && (!currentUser || c.rolesOnly.indexOf(currentUser.role) < 0))).map((c: any) => {
                  if (c.type === "head") return <div key={c.label} style={{ fontSize: 9, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.6, padding: "9px 10px 2px 40px", zIndex: 1 }}>{tr(c.label)}</div>;
                  const active = screen === c.id && !selectedClient;
                  return <button key={c.id} onClick={() => goTo(c.id)} style={navItemStyle(active, true)}>
                    <span style={{ fontSize: 13, width: 18, zIndex: 1 }}>{c.icon}</span>
                    <span style={{ flex: 1 }}>{tr(c.label)}</span>
                  </button>;
                })}
              </div>}
            </div>;
          })}
        </nav>
        {/* pied de sidebar */}
        {navCollapsed
          ? <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span title="Systèmes opérationnels" style={{ width: 8, height: 8, borderRadius: "50%", background: T.green, display: "block" }} />
            <div title={`${currentUser.name} — ${currentUser.roleLabel} (cliquer pour se déconnecter)`} onClick={logout} style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${currentUser.color},${T.leaf})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer" }}>{currentUser.avatar}</div>
          </div>
          : <div style={{ marginTop: "auto", padding: 12, background: T.oliveSoft, borderRadius: 11 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg,${currentUser.color},${T.leaf})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{currentUser.avatar}</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{currentUser.name}</div>
                <div style={{ fontSize: 9, color: currentUser.color, fontWeight: 700 }}>{currentUser.roleLabel}</div>
              </div>
            </div>
            <button onClick={logout} style={{ width: "100%", padding: "5px", borderRadius: 6, border: `1px solid ${T.line}`, background: T.surface, fontSize: 10, color: T.inkMid, cursor: "pointer", marginBottom: 8 }}>Déconnexion</button>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.green }} />
              <span style={{ fontSize: 10, color: T.green, fontWeight: 600 }}>Systèmes opérationnels</span>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>{["FINMA", "CDB 20", "LBA", "LSFin"].map(tag => <span key={tag} style={{ fontSize: 8, color: T.olive700, background: T.surface, padding: "1px 5px", borderRadius: 3, fontFamily: "monospace", fontWeight: 700, border: `1px solid ${T.sage}` }}>{tag}</span>)}</div>
          </div>}
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, overflow: "auto", height: "100vh" }}>
        <header style={{ padding: isMobile ? "9px 12px" : "16px 26px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.line}`, background: T.surface, position: "sticky", top: 0, zIndex: 50, gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: isMobile ? 14 : 18, fontWeight: 800, color: T.ink, letterSpacing: -0.4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{headerTitle}</div>
            {!isMobile && <div style={{ fontSize: 11, color: T.inkSoft }}>mercredi, 29 juillet 2026</div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setStatsOpen(o => !o)} title="Statistiques du portefeuille" style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 9, border: `1px solid ${ds.overdueReviews > 0 ? T.red + "55" : T.line}`, background: statsOpen ? T.oliveSoft : T.surface, color: ds.overdueReviews > 0 ? T.red : T.inkMid, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                📊 Stats{ds.overdueReviews > 0 && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, display: "inline-block" }} />}
              </button>
              {statsOpen && <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: 38, right: 0, width: 250, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 44px rgba(10,15,8,0.20)", zIndex: 200, padding: "14px 16px" }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>Portefeuille — vue globale</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: T.inkMid }}>Clients</span><span style={{ fontSize: 13, fontWeight: 800, color: T.olive700 }}>{ds.totalClients}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: T.inkMid }}>KYC actifs</span><span style={{ fontSize: 13, fontWeight: 800, color: T.amber }}>{ds.inProgressKycs}</span></div>
                  {ds.overdueReviews > 0 && <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ fontSize: 12, color: T.inkMid }}>En retard</span><span style={{ fontSize: 13, fontWeight: 800, color: T.red }}>⚠ {ds.overdueReviews}</span></div>}
                </div>
                <div style={{ fontSize: 9.5, color: T.inkSoft, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.lineSoft}` }}>Vue détaillée : Dashboard Exécutif.</div>
              </div>}
            </div>
            <div style={{ position: "relative" }}>
              <div onClick={() => setNotifOpen(o => !o)} style={{ position: "relative", cursor: "pointer" }}><span style={{ fontSize: 17 }}>🔔</span></div>
              {notifOpen && <div style={{ position: "absolute", top: 32, right: 0, width: 346, background: T.surface, border: `1px solid ${T.line}`, borderRadius: 12, boxShadow: "0 14px 44px rgba(10,15,8,0.20)", zIndex: 200 }}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${T.line}`, fontSize: 13, fontWeight: 800, color: T.ink }}>Notifications</div>
                <div style={{ padding: "26px 14px", textAlign: "center", fontSize: 12, color: T.inkSoft }}>Aucune tâche en attente 🎉</div>
              </div>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 12, borderLeft: `1px solid ${T.line}` }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg,${currentUser.color},${T.leaf})`, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11 }}>{currentUser.avatar}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink }}>{currentUser.name}</div>
                <div style={{ fontSize: 10, color: T.inkSoft }}>{currentUser.roleLabel}</div>
              </div>
            </div>
          </div>
        </header>
        <div style={{ padding: isMobile ? "12px 10px" : 26 }}>{renderScreen()}</div>
      </main>
    </div>);
}
