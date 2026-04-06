# CROSS — Onboarding (Registrierung bis Wow-Moment)

> Modulübergreifende Spezifikation für den Onboarding-Flow von der Registrierung bis zum funktionsfähigen System.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_34_DNA_ENGINE.md`, `MOD_02_INVENTORY.md`, `MOD_13_LISTINGS.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v1)

---

## 1. Zweck

Das Onboarding verteilt sich über Platform Foundation, DNA-Engine und Börsen-Import. Ohne ein übergreifendes Dokument fehlt der rote Faden. Dieses Dokument definiert:

- Den exakten Flow von der ersten Registrierungsseite bis zum funktionsfähigen Dashboard
- Welches Modul in welchem Schritt verantwortlich ist
- Was bei jedem Schritt in der DB passiert
- Was der Händler sieht und tut
- Wo Fehler aufgefangen werden

**Ziel:** Der Händler hat in unter 10 Minuten ein funktionsfähiges System mit Branding, Bestand und einer Website-Preview.

---

## 2. Onboarding-Phasen

```
Phase A: Registrierung (Platform Foundation)          ← ~1 Minute
    │
    ▼
Phase B: Branding (DNA-Engine, Modul 34)              ← ~3 Minuten
    │
    ▼
Phase C: Bestand importieren (Börsen-Hub, Modul 13)   ← ~2 Minuten
    │
    ▼
Phase D: Dashboard — Wow-Moment                        ← Sofort
```

**Phase A ist Pflicht.** Phase B und C sind geführt aber überspringbar — das System funktioniert mit Defaults. Der Wow-Moment ist: Händler sieht sein gebrandetes Dashboard mit seinen Fahrzeugen.

---

## 3. Phase A — Registrierung

**Verantwortlich:** Platform Foundation

### Screen: `/register`

**Eingabefelder:**
- E-Mail-Adresse (Pflicht)
- Passwort (Pflicht, min 8 Zeichen)
- Autohaus-Name (Pflicht → wird zu `tenants.name`)
- PLZ (Pflicht → für regionale Zuordnung, Phase 2: Marktdaten)

**Kein:** Kreditkarte, Plan-Auswahl, Firmendaten, Steuernummer. 30-Tage-Trial startet automatisch.

### Was passiert:

```
1. Supabase Auth: User erstellen (E-Mail + Passwort)
   → Auth-User existiert jetzt, aber noch ohne tenant_id in Claims

2. DB-Transaktion (Schritte 2-6 atomar):
   2. tenants INSERT:
      - name = Autohaus-Name
      - slug = auto-generiert aus Name (slugify, unique check)
      - plan = 'trial'
      - status = 'active'
      - trial_ends_at = now() + 30 Tage
      - branding = {} (leere Kompaktkopie)
      - settings = { language: 'de', timezone: 'Europe/Berlin', currency: 'EUR' }
   3. users INSERT:
      - id = Supabase Auth User ID
      - tenant_id = neuer Tenant
      - role = 'owner'
      - email, name
   4. tenant_branding INSERT (Default-Profil):
      - tenant_id = neuer Tenant
      - completeness = 'draft'
      - Alle Felder auf Defaults (Primary: #2563EB, Tone: professional, Formality: sie, ...)
   5. website_settings INSERT:
      - tenant_id = neuer Tenant
      - is_published = false

3. JWT Custom Claims (tenant_id, role):
   → Gesetzt über Supabase Auth Hook oder Token-Refresh
   → NICHT als manueller Schritt in der DB-Transaktion
   → Details: siehe 01_ARCHITECTURE.md Abschnitt 4
```

### Nach Registrierung:

→ Redirect zu `/onboarding/branding` (Phase B)

---

## 4. Phase B — Branding

**Verantwortlich:** DNA-Engine (Modul 34)

### Ablauf

Vollständig beschrieben in `MOD_34_DNA_ENGINE.md` Abschnitt 13. Hier die Kurzversion:

```
Schritt B1: Website-URL eingeben (optional)
├── URL → synchroner Crawl (max 25s) → Branding-Vorschlag
└── Keine URL → manueller Fallback

Schritt B2 (nach Crawl): Ergebnis anzeigen
└── Crawl fehlgeschlagen → manueller Fallback

Schritt B3 (manuell): Logo, Primärfarbe, Du/Sie, Kontaktdaten (Adresse, Telefon, E-Mail)

Schritt B4: Branding-Review mit Live-Preview
└── "Sieht gut aus" → Speichern

Schritt B5: Weiter zu Phase C
```

### Onboarding-Ziel Phase B:

`tenant_branding.completeness = 'branding_complete'`

Pflichtfelder für `branding_complete`: `primary_color`, `tone`, `formality`, `address`, `phone`, `email`. Alles andere hat Defaults.

### Überspringbar?

Ja — der Händler kann "Später einrichten" klicken. Profil bleibt `draft` mit Defaults. Alles funktioniert trotzdem, nur die Website kann nicht veröffentlicht werden.

---

## 5. Phase C — Bestand importieren

**Verantwortlich:** Börsen-Hub (Modul 13) + Inventar (Modul 02)

### Screen: `/onboarding/bestand`

**Drei Optionen:**

```
Option 1: Börsen-Export importieren (empfohlen)
├── Datei hochladen (CSV/XML von mobile.de oder AutoScout24)
├── Preview: "X Fahrzeuge erkannt, Y Duplikate"
├── Bestätigen → Import
└── Ergebnis: "X Fahrzeuge importiert"

Option 2: Erstes Fahrzeug manuell anlegen
├── VIN oder manuell
├── Schnellformular (Marke, Modell, Preis, 1 Foto)
└── Fahrzeug angelegt

Option 3: Später importieren
└── "Überspringen" → direkt zum Dashboard
```

**Option 1 nutzt den Import-Flow aus `MOD_13_LISTINGS.md` Abschnitt 5.** Der Onboarding-Screen ist eine vereinfachte Version des Import-Wizards — Upload, Preview, Bestätigen. Kein Spaltenmapping nötig (das passiert automatisch im Parser).

### Nach Phase C:

→ Redirect zu `/` (Dashboard) — Phase D

---

## 6. Phase D — Wow-Moment (Dashboard)

**Verantwortlich:** Platform Foundation (Shell/Layout)

### Was der Händler sieht:

```
┌─────────────────────────────────────────────────────────┐
│  Header: Logo (aus DNA) + Autohaus-Name                 │
├─────────────────────────────────────────────────────────┤
│  Willkommen, {user.name}!                               │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ 23 Fahrzeuge  │  │ 0 Anfragen   │  │ Website:     │  │
│  │ im Bestand    │  │ heute        │  │ nicht online │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                                                         │
│  Nächste Schritte:                                      │
│  ☐ Website veröffentlichen (→ /website)                 │
│  ☐ WhatsApp verbinden (→ /einstellungen/whatsapp)       │
│  ☐ Erstes Fahrzeug veröffentlichen (→ /fahrzeuge)       │
│  ☐ Team einladen (→ /einstellungen/team)                │
│                                                         │
│  [AI-Assistent Button unten rechts]                     │
└─────────────────────────────────────────────────────────┘
```

**Der Wow-Moment:** Das Dashboard ist nicht leer. Es zeigt den importierten Bestand (oder zumindest "0 Fahrzeuge — jetzt anlegen"), das Branding ist sichtbar (Logo, Farben), und die nächsten Schritte sind klar.

### Checkliste "Nächste Schritte"

Dynamisch basierend auf dem Systemzustand:

| Schritt | Bedingung für "erledigt" |
|---------|------------------------|
| Branding einrichten | `completeness >= 'branding_complete'` |
| Fahrzeuge importieren | mindestens 1 Fahrzeug existiert |
| Erstes Fahrzeug veröffentlichen | mindestens 1 Fahrzeug `published = true` |
| Website veröffentlichen | `website_settings.is_published = true` |
| WhatsApp verbinden | `whatsapp_connections.connection_status = 'connected'` |
| Team einladen | mindestens 2 Users im Tenant |

**Die Checkliste verschwindet** wenn alle Schritte erledigt sind. Sie ist ein Onboarding-Helfer, kein permanentes Dashboard-Element.

---

## 7. Fehlerbehandlung

| Phase | Fehlerfall | Verhalten |
|-------|-----------|-----------|
| A | Registrierung schlägt fehl | Fehlermeldung auf der Seite, User kann es erneut versuchen |
| A | Slug bereits vergeben | Auto-Suffix (-2, -3, ...) oder User-Eingabe |
| B | Crawl fehlgeschlagen | Hinweis + manueller Fallback (kein Blocker) |
| B | AI-Analyse fehlgeschlagen | Defaults + manueller Fallback |
| C | Import-Datei ungültig | Fehlermeldung, erneut hochladen |
| C | Import teilweise fehlgeschlagen | "X importiert, Y fehlerhaft" mit Fehlerdetails |
| D | Dashboard leer (alles übersprungen) | Checkliste zeigt alle offenen Schritte |

**Kein Schritt blockiert den nächsten.** Phase B und C können übersprungen werden. Das System funktioniert ab Phase A — nur mit Defaults und ohne Bestand.

---

## 8. Technische Orchestrierung

### Onboarding-State

Kein eigener Onboarding-State in der DB. Der Onboarding-Status wird aus dem Systemzustand abgeleitet:

```typescript
function getOnboardingState(tenant: Tenant, branding: TenantBranding, vehicleCount: number): OnboardingPhase {
  if (branding.completeness === 'draft' && vehicleCount === 0) return 'fresh';  // Phase B
  if (branding.completeness === 'draft') return 'branding_pending';             // Phase B (Bestand da, Branding nicht)
  if (vehicleCount === 0) return 'import_pending';                              // Phase C
  return 'complete';                                                             // Phase D
}
```

**Login-Redirect:** Wenn ein User sich einloggt und der Onboarding-State nicht `complete` ist, wird er zum entsprechenden Onboarding-Schritt weitergeleitet. Nicht zum Dashboard.

### Routing

```
/register              → Phase A (öffentlich)
/onboarding/branding   → Phase B (geschützt, nur nach Registrierung/Login)
/onboarding/bestand    → Phase C (geschützt)
/                      → Phase D / Dashboard (geschützt)
```

---

## 9. Metriken (intern)

| Metrik | Messung |
|--------|---------|
| Time to First Branding | Registrierung → `branding_complete` |
| Time to First Vehicle | Registrierung → erstes Fahrzeug im System |
| Time to Wow | Registrierung → Dashboard mit ≥1 Fahrzeug und Branding |
| Onboarding Completion Rate | % der Registrierungen die alle Phasen abschließen |
| Drop-off per Phase | Wo brechen Händler ab? |

**Kein Tracking-Code im MVP.** Diese Metriken werden aus DB-Timestamps abgeleitet (Tenant created_at, Branding updated_at, erstes Fahrzeug created_at).

---

## 10. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 2.2 (Zero Friction), Abschnitt 4 (Build-Reihenfolge, Daten-Migration) |
| `01_ARCHITECTURE.md` | Abschnitt 4 (Händler-Registrierung, JWT Claims) |
| `MOD_34_DNA_ENGINE.md` | Abschnitt 13 (Onboarding-Flow Phase B im Detail) |
| `MOD_13_LISTINGS.md` | Abschnitt 5 (Datei-Import für Phase C) |
| `MOD_02_INVENTORY.md` | bulkUpsertVehicles (Import-Schnittstelle) |

---

> **Hinweis für Claude Code:** Dieses Dokument definiert den Onboarding-Flow end-to-end.
> Phase A (Registrierung) erzeugt: Tenant + User + tenant_branding (draft) + website_settings (draft).
> Phase B (Branding) ist überspringbar — System funktioniert mit Defaults.
> Phase C (Import) ist überspringbar — leerer Bestand ist OK.
> Kein eigener Onboarding-State in der DB — abgeleitet aus Systemzustand.
> Login-Redirect: wenn Onboarding nicht complete → zum entsprechenden Schritt.
