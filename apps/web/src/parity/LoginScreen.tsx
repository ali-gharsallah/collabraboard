import React, { useState } from "react";
import { T } from "./tokens";
import { OliveLogo } from "../components/OliveLogo";
import USERS from "../fixtures/USERS.json";

// Port PIXEL-FIDÈLE de l'écran de connexion réellement affiché en premier
// (docs/reference/olive-demo.html, lignes 44539–44578 — App, `if (!currentUser)`).
// Rien « dans l'esprit » : textes, tailles, couleurs, espacements repris verbatim.
// Données (USERS) = fixture extraite (§5), jamais retapées.
type User = {
  id: string; name: string; email: string; password: string; role: string; roleLabel: string;
  dept: string; avatar: string; color: string; permissions: string[]; visibility: string;
};
const users = USERS as User[];

const visaLabel = (v: string) =>
  v === "own_clients" ? "👤 Clients propres"
  : v === "all_clients" ? "👥 Tous clients"
  : v === "read_only" ? "👁 Lecture seule"
  : v === "admin" ? "⚙ Admin" : "📋 " + v;

export function LoginScreen({ onLogin }: { onLogin?: (u: User) => void }) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [demoSelected, setDemoSelected] = useState<string | null>(null);

  const handleLogin = () => {
    const user = users.find(u => u.email === loginEmail && u.password === loginPwd);
    if (user) onLogin?.(user);
    else setLoginError("Identifiants incorrects.");
  };
  const fillDemo = (u: User) => { setLoginEmail(u.email); setLoginPwd(u.password); setDemoSelected(u.id); setLoginError(""); };
  const depts = [...new Set(users.map(u => u.dept))];

  return (
    <div style={{ height: "100vh", background: T.cream, display: "flex", fontFamily: "'Plus Jakarta Sans',system-ui,sans-serif", overflow: "hidden" }}>
      {/* Panneau gauche — formulaire (420px, padding 36×44) */}
      <div style={{ width: 420, background: T.surface, display: "flex", flexDirection: "column", justifyContent: "flex-start", padding: "36px 44px", borderRight: `1px solid ${T.line}`, flexShrink: 0, overflowY: "auto", height: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <OliveLogo />
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: T.ink, marginBottom: 4 }}>Connexion</h1>
        <p style={{ fontSize: 12, color: T.inkSoft, marginBottom: 24 }}>Banque Olive Suisse — Plateforme O-Live</p>
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 5 }}>Email</div>
          <input type="email" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="prenom.nom@banque-olive.ch"
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${T.line}`, fontSize: 12, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink }}
            onFocus={e => (e.target.style.borderColor = T.olive600)} onBlur={e => (e.target.style.borderColor = T.line)} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600, marginBottom: 5 }}>Mot de passe</div>
          <div style={{ position: "relative" }}>
            <input type={showPwd ? "text" : "password"} value={loginPwd} onChange={e => { setLoginPwd(e.target.value); setLoginError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="••••••••"
              style={{ width: "100%", padding: "10px 36px 10px 12px", borderRadius: 8, border: `1.5px solid ${T.line}`, fontSize: 12, boxSizing: "border-box", outline: "none", background: T.cream, color: T.ink }}
              onFocus={e => (e.target.style.borderColor = T.olive600)} onBlur={e => (e.target.style.borderColor = T.line)} />
            <button onClick={() => setShowPwd(v => !v)} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: T.inkSoft }}>{showPwd ? "🙈" : "👁"}</button>
          </div>
        </div>
        {loginError && <div style={{ background: T.redSoft, border: `1px solid ${T.red}30`, borderRadius: 7, padding: "8px 11px", fontSize: 11, color: T.red, marginBottom: 12 }}>⚠ {loginError}</div>}
        <button onClick={handleLogin} style={{ width: "100%", padding: "12px", borderRadius: 9, border: "none", background: T.olive600, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 14 }}
          onMouseEnter={e => (e.currentTarget.style.background = T.olive700)} onMouseLeave={e => (e.currentTarget.style.background = T.olive600)}>Se connecter →</button>
        <div style={{ fontSize: 10, color: T.inkSoft, textAlign: "center" }}>🔐 MFA activé · Audit trail FINMA · Sessions sécurisées</div>
      </div>

      {/* Panneau droit — comptes de démonstration (padding 28×32) */}
      <div style={{ flex: 1, padding: "28px 32px", overflowY: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: T.olive700, textTransform: "uppercase", letterSpacing: 2, fontWeight: 700, marginBottom: 4 }}>Comptes de démonstration</div>
          <div style={{ fontSize: 12, color: T.inkMid }}>Cliquez pour pré-remplir. Mot de passe universel : <code style={{ background: T.oliveSoft, padding: "1px 6px", borderRadius: 4, fontSize: 11, color: T.olive700 }}>olive2026</code></div>
        </div>
        {depts.map(dept => (
          <div key={dept} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: T.inkSoft, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: T.line }} />
              {dept}
              <div style={{ flex: 1, height: 1, background: T.line }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 7 }}>
              {users.filter(u => u.dept === dept).map(u => (
                <div key={u.id} onClick={() => fillDemo(u)}
                  style={{ padding: "9px 12px", borderRadius: 9, border: `1.5px solid ${demoSelected === u.id ? u.color : T.line}`, background: demoSelected === u.id ? u.color + "12" : T.surface, cursor: "pointer" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = u.color; e.currentTarget.style.background = u.color + "10"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = demoSelected === u.id ? u.color : T.line; e.currentTarget.style.background = demoSelected === u.id ? u.color + "12" : T.surface; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: `linear-gradient(135deg,${u.color},${T.leaf})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>{u.avatar}</div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: T.ink }}>{u.name}</div>
                      <div style={{ fontSize: 9, fontWeight: 700, color: u.color, textTransform: "uppercase", letterSpacing: 0.3 }}>{u.roleLabel}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 8, color: T.inkSoft, marginBottom: 4 }}>{u.email}</div>
                  <span style={{ fontSize: 8, background: u.color + "15", color: u.color, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>{visaLabel(u.visibility)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
