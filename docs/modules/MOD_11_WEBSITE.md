# MOD 11 — Website Builder

> Modulspezifikation für die automatisch generierte Händler-Website.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_34_DNA_ENGINE.md`, `MOD_02_INVENTORY.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v1)

---

## 1. Zweck & Einordnung

Der Website Builder erzeugt automatisch eine vollständige, SEO-optimierte Händler-Website aus den Daten die bereits in Carlion existieren: Fahrzeugbestand aus Inventar, Branding aus DNA-Engine, Kontaktdaten aus dem Branding-Profil. Der Händler muss keine Website bauen, keine Texte schreiben, kein Design wählen — alles entsteht automatisch aus dem System.

**Kernprinzip (Vision Abschnitt 2.6):** White-Label by Default. Der Endkunde sieht die Marke des Autohauses, nicht Carlion.

**MVP-Einschränkung (Vision Abschnitt 4):** Nur Ebene 1: Auto-Sync aus Backend. Kein konversationelles Editing, keine autonome Optimierung.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 11 |
| Kategorie | Wachstum & Sichtbarkeit |
| Phase | **MVP** |
| Build-Reihenfolge | 6 (nach Börsen-Hub) |
| Abhängigkeiten | Platform Foundation, Modul 34 (DNA-Engine — Branding), Modul 02 (Inventar — Fahrzeuge) |
| Abhängig davon | — (Endpunkt der MVP-Kette vor WhatsApp) |

### Warum nach Börsen-Hub?

Die Website zeigt Fahrzeuge an die bereits im System und idealerweise schon auf Börsen inseriert sind. Nach Börsen-Hub steht der Bestand vollständig — die Website hat Inhalt ab dem ersten Aufruf.

---

## 2. Kernkonzept — Auto-Generierte Website

Die Website ist kein Baukasten den der Händler bedient. Sie ist ein **Live-Spiegel des Carlion-Backends:**

- Fahrzeugbestand ändert sich → Website aktualisiert sich
- Branding ändert sich → Website-Design aktualisiert sich
- Kontaktdaten ändern sich → Website-Footer aktualisiert sich

**Drei Ebenen (nur Ebene 1 im MVP):**

| Ebene | Beschreibung | Phase |
|-------|-------------|-------|
| 1 — Auto-Sync | Website generiert sich vollständig aus Backend-Daten. Händler kann Texte über Einstellungen anpassen. | **MVP** |
| 2 — Konversationelles Editing | Händler sagt dem AI-Assistenten "Ändere den Willkommenstext" oder "Füg eine Team-Seite hinzu" | Phase 2 |
| 3 — Autonome Optimierung | AI optimiert Texte, Bilder und Layout basierend auf Besucherdaten | Phase 3 |

---

## 3. Website-Struktur (MVP)

### Seiten

| Seite | Route (öffentlich) | Inhalt | Datenquelle |
|-------|--------------------|--------|-------------|
| Startseite | `/` | Hero-Banner, Highlight-Fahrzeuge, Kontaktbox, Öffnungszeiten | DNA-Branding + Inventar (featured) |
| Fahrzeugbestand | `/fahrzeuge` | Filterbares Grid aller veröffentlichten Fahrzeuge | Inventar (published) |
| Fahrzeug-Detail | `/fahrzeuge/[id]` | Einzelnes Fahrzeug: Galerie, Daten, Beschreibung, Kontaktformular | Inventar + DNA-Branding |
| Über uns | `/ueber-uns` | Autohaus-Beschreibung, Team (Phase 2), Standort | DNA-Branding (Geschäftsdaten) |
| Kontakt | `/kontakt` | Kontaktformular, Adresse, Karte, Öffnungszeiten, Anfahrt | DNA-Branding (Geschäftsdaten) |
| Impressum | `/impressum` | Rechtlich vorgeschrieben | DNA-Branding (imprint_data) |
| Datenschutz | `/datenschutz` | DSGVO-Pflichtseite | Template + Tenant-Daten |

### Kein Page-Builder im MVP

Es gibt keinen visuellen Editor, kein Drag & Drop, keine benutzerdefinierten Seiten. Die Website-Struktur ist fest. Anpassbar sind nur:
- Texte auf der Startseite (Willkommenstext, CTA)
- Über-uns-Text
- Welche Fahrzeuge als „Highlight" markiert werden (über `vehicles.featured`)

---

## 4. Datenmodell

### Tabelle: `website_settings`

Pro-Tenant-Einstellungen für die Website. Ergänzt das Branding-Profil um website-spezifische Inhalte.

```
website_settings:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, unique, not null
  
  -- Veröffentlichungsstatus
  is_published      boolean, not null, default false
  published_at      timestamptz, nullable
  
  -- Anpassbare Texte
  hero_headline     text, nullable (Hauptüberschrift Startseite)
  hero_subheadline  text, nullable
  hero_cta_text     text, nullable (Button-Text, z.B. "Bestand ansehen")
  about_text        text, nullable (Über-uns Text)
  
  -- Kontaktformular
  contact_form_enabled boolean, not null, default true
  contact_form_recipients text[], default '{}' (E-Mail-Adressen für Formular-Submissions)
  
  -- SEO
  meta_title        text, nullable (Override für <title>, sonst: "{tenants.name} - Gebrauchtwagen")
  meta_description  text, nullable (Override für meta description)
  
  -- Google
  google_analytics_id text, nullable (GA4 Measurement ID)
  
  -- Meta
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

### Tabelle: `website_contact_submissions`

Eingehende Kontaktformular-Submissions von der öffentlichen Website.

```
website_contact_submissions:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  
  -- Formulardaten
  name              text, not null
  email             text, not null
  phone             text, nullable
  message           text, not null
  vehicle_id        uuid, nullable, foreign key → vehicles (wenn vom Fahrzeug-Detail)
  
  -- Verarbeitung
  processed         boolean, not null, default false
  contact_id        uuid, nullable, foreign key → contacts (nach CRM-Zuordnung)
  
  -- Meta
  submitted_at      timestamptz, not null, default now()
  ip_address        text, nullable (für Rate-Limiting/Spam-Schutz)

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_submissions_tenant ON website_contact_submissions(tenant_id, submitted_at DESC)
  INDEX idx_submissions_unprocessed ON website_contact_submissions(tenant_id) WHERE processed = false
```

### Erstellung der Default-Settings

**Verantwortlich:** Platform Foundation. Bei Tenant-Erstellung wird `website_settings` mit `is_published = false` und Defaults erzeugt (gleiche Transaktion wie `tenant_branding`).

---

## 5. Designentscheidungen

### 5.1 SSR/ISR statt SPA

**Entscheidung:** Alle öffentlichen Website-Seiten werden Server-Side Rendered (SSR) oder per Incremental Static Regeneration (ISR) ausgeliefert. Kein Client-Side-Only Rendering.

**Begründung:** SEO ist für Händler-Websites geschäftskritisch. Google muss den Inhalt crawlen können. ISR gibt die Performance von statischen Seiten mit der Aktualität von dynamischen Daten.

**Revalidation:**
- Fahrzeugbestand: ISR mit 60s Revalidation (Preis/Status ändern sich häufig)
- Branding/Texte: ISR mit 300s Revalidation (ändert sich selten)
- On-Demand Revalidation: bei `inventory.publish`/`unpublish` und `website.updateSettings`

### 5.2 Kein separater Frontend-Build

**Entscheidung:** Die Händler-Website läuft im gleichen Next.js-Projekt wie das Dashboard. Tenant-Routing trennt die Kontexte.

**Begründung:** Zwei getrennte Projekte verdoppeln Build-Infrastruktur und Deployment-Komplexität. Next.js App Router mit Route Groups (`(portal)` für Website) ist sauberer.

**Routing:**
```
app/(portal)/[tenant_slug]/                    ← Startseite
app/(portal)/[tenant_slug]/fahrzeuge/          ← Bestandsliste
app/(portal)/[tenant_slug]/fahrzeuge/[id]/     ← Fahrzeug-Detail
app/(portal)/[tenant_slug]/ueber-uns/          ← Über uns
app/(portal)/[tenant_slug]/kontakt/            ← Kontaktformular
app/(portal)/[tenant_slug]/impressum/          ← Impressum
app/(portal)/[tenant_slug]/datenschutz/        ← Datenschutz
```

Phase 1: Subdomain-basiert (`autohaus-mueller.[produktname].de`). Next.js Middleware resolvert Subdomain → `tenant_slug`.

### 5.3 Theming über CSS Custom Properties

**Entscheidung:** Das Website-Theme wird komplett über CSS Custom Properties gesteuert die aus dem DNA-Branding-Profil generiert werden.

**Datenfluss:**
```
1. Public-Read-Route: /api/public/[slug]/branding → PublicBranding
2. Layout-Komponente: Branding → CSS Custom Properties
3. Alle Komponenten nutzen nur CSS Variables für Farben, Fonts, Radii
```

Das ist der gleiche Mechanismus der in `MOD_34_DNA_ENGINE.md` Abschnitt 10.1 beschrieben ist.

### 5.4 Kontaktformular-Submissions als eigene Tabelle

**Entscheidung:** Submissions landen erst in `website_contact_submissions`, dann werden sie in CRM verarbeitet (Kontakt erstellen + Activity).

**Begründung:** Das Formular ist öffentlich — es braucht Spam-Schutz, Rate-Limiting und eine Prüfschicht bevor Daten ins CRM fließen. Die Submission-Tabelle ist der Buffer.

### 5.5 Publish-Gate

**Entscheidung:** Die Website wird nur ausgeliefert wenn `website_settings.is_published = true` UND `tenant_branding.completeness = 'publish_ready'`.

**Begründung:** Analogie zu DNA-Engine Publish-Gate. Keine halbfertigen Websites öffentlich sichtbar.

**Fallback:** Wenn die URL aufgerufen wird aber die Website nicht veröffentlicht ist: freundliche "Coming Soon"-Seite mit Händlername und Kontaktdaten (aus tenants.name + tenant_branding, sofern vorhanden).

---

## 6. Öffentliche Website — Public Delivery

### Routes (öffentliche Seiten)

Die Website-Seiten selbst sind Next.js-Seiten unter `app/(portal)/[tenant_slug]/`. Sie rufen intern die Public-Read-Routes auf:

```
Daten-Quellen (Backend):
  /api/public/[tenant_slug]/branding    ← DNA-Branding (Farben, Logo, Kontaktdaten)
  /api/public/[tenant_slug]/vehicles    ← Veröffentlichte Fahrzeuge
  /api/public/[tenant_slug]/vehicles/[id]  ← Fahrzeug-Detail
  /api/public/[tenant_slug]/website     ← Website-Settings (Texte, SEO)
```

### Public-Read-Route für Website-Settings

```
app/api/public/[tenant_slug]/website/route.ts
```

```typescript
type PublicWebsiteSettings = {
  is_published: boolean;
  hero_headline: string | null;
  hero_subheadline: string | null;
  hero_cta_text: string | null;
  about_text: string | null;
  contact_form_enabled: boolean;
  meta_title: string | null;
  meta_description: string | null;
}
```

- **Service Role, read-only**
- **Nur wenn `is_published = true`** — sonst HTTP 404
- **Caching:** ISR, `max-age=300, stale-while-revalidate=600`

### Kontaktformular-Submission (öffentlicher Write-Pfad)

```
app/api/public/[tenant_slug]/contact/route.ts   ← POST
```

**Einziger öffentlicher Write-Pfad.** Regeln:
- Rate Limiting: max 5 Submissions pro IP pro Stunde
- Honeypot-Feld für Spam-Erkennung
- Validierung: name, email, message Pflicht
- Speichert in `website_contact_submissions`
- Schickt E-Mail-Benachrichtigung an `contact_form_recipients` (über Resend, via Outbox)
- Kein CAPTCHA im MVP (Phase 2: bei Spam-Problemen)

### SEO

- `<title>` und `<meta description>` pro Seite aus Website-Settings oder generiert
- Schema.org Markup: `AutoDealer`, `Vehicle` (auf Fahrzeug-Detail)
- `sitemap.xml` pro Tenant: alle veröffentlichten Fahrzeuge + statische Seiten
- `robots.txt` pro Tenant: erlaubt Crawling der öffentlichen Seiten
- Canonical URLs: `https://[tenant_slug].[domain]/fahrzeuge/[id]`
- Open Graph Tags für Social Sharing (Fahrzeug-Foto als og:image)

---

## 7. API (tRPC Router)

Router: `website` (registriert in `server/trpc/root.ts`)

### Procedures

```
website.getSettings
  Type:     query
  Auth:     protectedProcedure
  Input:    —
  Output:   WebsiteSettingsView
  Zweck:    Website-Einstellungen für den aktuellen Tenant laden

website.updateSettings
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    UpdateWebsiteSettingsInput
            {
              hero_headline?: string | null,
              hero_subheadline?: string | null,
              hero_cta_text?: string | null,
              about_text?: string | null,
              contact_form_enabled?: boolean,
              contact_form_recipients?: string[],
              meta_title?: string | null,
              meta_description?: string | null,
              google_analytics_id?: string | null,
            }
  Output:   WebsiteSettingsView
  Regeln:
    - Nur anpassbare Textfelder — kein is_published (eigene Mutation)
    - Triggert ISR On-Demand Revalidation
    - Schreibt Audit-Log

website.publish
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    —
  Output:   WebsiteSettingsView
  Regeln:
    - Prüft: tenant_branding.completeness = 'publish_ready'
    - Setzt is_published = true, published_at = now()
    - Triggert ISR Revalidation für alle Website-Seiten
    - Schreibt Audit-Log

website.unpublish
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    —
  Output:   WebsiteSettingsView
  Regeln:
    - Setzt is_published = false
    - Website zeigt "Coming Soon"-Seite
    - Schreibt Audit-Log

website.listSubmissions
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { cursor?: string, limit?: number, processed?: boolean }
  Output:   { items: SubmissionView[], nextCursor: string | null }

website.processSubmission
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { submissionId: string }
  Output:   { contact: ContactView, activity: ActivityView }
  Regeln:
    - CRM: createContactFromExternal({ source: 'website' })
    - CRM: addActivityForContact({ type: 'vehicle_interest' | 'note' })
    - Setzt processed = true, contact_id
    - Schreibt Audit-Log

website.getPreviewUrl
  Type:     query
  Auth:     roleProcedure(["owner", "admin"])
  Input:    —
  Output:   { url: string }
  Zweck:    Preview-URL für unveröffentlichte Website (mit temporärem Preview-Token)
```

---

## 8. AI-Tools (für AI-Assistent)

Datei: `modules/website-builder/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "get_website_status",
  description: "Website-Status abrufen. 
                Händler fragt z.B. 'Ist meine Website online?'",
  parameters: {},
  execute: (params, ctx) => websiteService.getSettings(ctx)
},
{
  name: "list_website_submissions",
  description: "Kontaktformular-Anfragen anzeigen.
                Händler fragt z.B. 'Hat jemand über die Website geschrieben?'",
  parameters: { processed?: boolean },
  execute: (params, ctx) => websiteService.listSubmissions(params, ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM)

```typescript
{
  name: "propose_website_publish",
  description: "Website veröffentlichen vorschlagen.
                Händler sagt z.B. 'Stell meine Website online'",
  parameters: {},
  execute: (params, ctx) => aiCommandService.propose({
    module: "website",
    action: "publish_website",
    proposed_changes: {},
    preview: () => websitePublishPreview(ctx),
    executeOnConfirm: () => websiteService.publish(ctx)
  })
},
{
  name: "propose_website_text_change",
  description: "Website-Text ändern vorschlagen.
                Händler sagt z.B. 'Ändere den Willkommenstext auf der Website'",
  parameters: {
    hero_headline?: string,
    hero_subheadline?: string,
    about_text?: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "website",
    action: "update_website_settings",
    proposed_changes: params,
    preview: () => textChangePreview(params, ctx),
    executeOnConfirm: () => websiteService.updateSettings(params, ctx)
  })
}
```

---

## 9. UI-Screens (Händler-Interface)

### 9.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Website-Übersicht | `/website` | Status, Preview-Link, KPIs, Submissions |
| Website-Einstellungen | `/website/einstellungen` | Texte, SEO, Kontaktformular, Google Analytics |
| Formular-Anfragen | `/website/anfragen` | Liste der Kontaktformular-Submissions |

### 9.2 Website-Übersicht — Hauptscreen

**Status-Banner:** Veröffentlicht / Nicht veröffentlicht (mit Publish-Button)

**Publish-Checkliste:** Wenn nicht veröffentlicht: zeigt was noch fehlt (`completeness` aus DNA-Engine):
- ✅ Branding-Profil vollständig
- ✅ Mindestens 1 Fahrzeug veröffentlicht
- ❌ Impressum fehlt → Link zu Einstellungen
- ❌ Öffnungszeiten fehlen → Link zu Einstellungen

**Preview:** "Website ansehen"-Button öffnet die öffentliche Website (oder Preview bei unveröffentlicht)

**KPIs:** Formular-Anfragen diese Woche, unbearbeitete Anfragen

### 9.3 Komponenten

| Komponente | Zweck |
|------------|-------|
| `WebsiteStatusBanner` | Veröffentlicht/Draft-Status mit Publish-Button |
| `PublishChecklist` | Was fehlt noch für Veröffentlichung |
| `WebsitePreviewFrame` | iFrame oder Link zur öffentlichen Website |
| `WebsiteSettingsForm` | Texte, SEO, Kontaktformular-Einstellungen |
| `SubmissionsList` | Liste der Formular-Anfragen |
| `SubmissionCard` | Einzelne Anfrage mit Verarbeitungs-Button |

---

## 10. Website-Komponenten (öffentliche Seite)

Die öffentliche Website nutzt eigene Komponenten die nur CSS Variables aus dem Branding lesen. Kein shadcn/ui — die Website hat ein eigenes, schlankes Komponentensystem.

| Komponente | Seite | Beschreibung |
|------------|-------|-------------|
| `WebsiteLayout` | Alle | Header (Logo, Nav), Footer (Kontakt, Impressum-Links) |
| `HeroBanner` | Startseite | Headline, Subheadline, CTA-Button, Hintergrundbild |
| `FeaturedVehicles` | Startseite | Grid mit Highlight-Fahrzeugen (vehicles.featured) |
| `ContactBox` | Startseite, Kontakt | Telefon, E-Mail, Adresse, Öffnungszeiten |
| `VehicleGrid` | Fahrzeuge | Filterbares Grid aller veröffentlichten Fahrzeuge |
| `VehicleFilter` | Fahrzeuge | Marke, Preis, Kraftstoff, Kilometerstand |
| `VehicleDetailPage` | Fahrzeug-Detail | Galerie, Daten-Tabelle, Beschreibung, Kontaktformular |
| `PhotoGallery` | Fahrzeug-Detail | Bildergalerie mit Swipe (Mobile) und Lightbox |
| `ContactForm` | Kontakt, Fahrzeug-Detail | Name, E-Mail, Telefon, Nachricht, Fahrzeug-Referenz |
| `MapEmbed` | Kontakt | Google Maps Embed (aus google_maps_url) |
| `OpeningHours` | Startseite, Kontakt | Wochentags-Tabelle |
| `ImprintPage` | Impressum | Generiert aus imprint_data |
| `PrivacyPage` | Datenschutz | Template mit Tenant-spezifischen Daten |

---

## 11. Business Rules

### 11.1 Publish-Voraussetzungen

Die Website kann nur veröffentlicht werden wenn:
- `tenant_branding.completeness = 'publish_ready'` (Logo, Impressum, Öffnungszeiten vorhanden)
- Mindestens 1 Fahrzeug im Inventar ist `published`

### 11.2 Automatische Aktualisierung

Änderungen im Backend propagieren automatisch auf die Website:
- Fahrzeug veröffentlicht/depubliziert → ISR Revalidation der Fahrzeugliste und ggf. Detail-Seite
- Branding geändert → ISR Revalidation aller Seiten
- Website-Texte geändert → ISR Revalidation der betroffenen Seite

### 11.3 Kontaktformular-Regeln

- Pflichtfelder: Name, E-Mail, Nachricht
- Rate Limiting: 5 Submissions pro IP pro Stunde
- Honeypot: verstecktes Feld, wenn ausgefüllt → Submission wird ignoriert
- E-Mail-Benachrichtigung an `contact_form_recipients` (Outbox → Resend)
- Verarbeitung: manuell durch Händler (→ CRM-Kontakt + Activity)

### 11.4 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Website-Status sehen | Alle authentifizierten Rollen |
| Website-Einstellungen ändern | `owner`, `admin` |
| Website veröffentlichen/depublizieren | `owner`, `admin` |
| Formular-Anfragen sehen/verarbeiten | `owner`, `admin`, `manager`, `salesperson` |

---

## 12. MVP-Scope vs. Phase 2

### MVP (Phase 1) — Wird gebaut

- [x] Automatisch generierte Website aus Backend-Daten
- [x] 7 feste Seiten (Start, Fahrzeuge, Detail, Über uns, Kontakt, Impressum, Datenschutz)
- [x] Branding-Theming über CSS Custom Properties
- [x] Fahrzeug-Grid mit Filtern auf der öffentlichen Seite
- [x] Kontaktformular mit Spam-Schutz und E-Mail-Benachrichtigung
- [x] SEO: SSR/ISR, Meta-Tags, Schema.org, Sitemap, robots.txt
- [x] Anpassbare Texte (Hero, Über uns, SEO)
- [x] Publish/Unpublish mit Publish-Gate
- [x] Preview für unveröffentlichte Websites
- [x] AI-Tools (Status, Publish, Textänderungen)
- [x] Subdomain-Routing (`autohaus-mueller.[domain].de`)

### Phase 2

- [ ] **Konversationelles Editing:** AI-Assistent ändert Website-Inhalte auf Anweisung
- [ ] **Custom Domains:** `www.autohaus-mueller.de` mit SSL
- [ ] **Zusätzliche Seiten:** Team, Werkstatt, Finanzierung (konfigurierbar)
- [ ] **Blog/News:** Einfache Content-Seiten
- [ ] **Analytics-Dashboard:** Besucherzahlen, beliebteste Fahrzeuge
- [ ] **A/B-Testing:** Verschiedene Hero-Texte testen
- [ ] **Autonome Optimierung:** AI optimiert basierend auf Besucherdaten
- [ ] **CAPTCHA:** Bei Spam-Problemen am Kontaktformular
- [ ] **Cookie-Banner:** Konfigurierbar

---

## 13. Technische Abhängigkeiten

### Interne

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Modul 34 (DNA-Engine) | Branding-Profil, Publish-Gate | Farben, Logo, Fonts, Kontaktdaten, completeness |
| Modul 02 (Inventar) | Fahrzeugdaten | Public-Read-Route für Fahrzeuge |
| Modul 01 (CRM) | createContactFromExternal | Kontaktformular → CRM-Kontakt |
| Resend (E-Mail) | Benachrichtigungen | Kontaktformular-Submissions |
| Outbox (Architektur) | Async E-Mail | Formular-Benachrichtigungen |

### Externe

| Service | Zweck | Fallback |
|---------|-------|----------|
| Google Maps Embed | Karte auf Kontaktseite | Statischer Link zu Google Maps |
| Resend | Kontaktformular-Benachrichtigung | Outbox-Retry |

---

## 14. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 2.6 (White-Label), Abschnitt 4 (Website Builder MVP-Scope) |
| `01_ARCHITECTURE.md` | Abschnitt 10 (Public Delivery, Tenant-Routing, SEO), Abschnitt 11 (PWA) |
| `MOD_34_DNA_ENGINE.md` | Branding-Profil, CSS Custom Properties, Publish-Gate (completeness) |
| `MOD_02_INVENTORY.md` | Public-Read-Route für Fahrzeuge |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 11 vollständig.
> Die Website generiert sich automatisch aus Backend-Daten — kein Page-Builder.
> Alle öffentlichen Seiten SSR/ISR — kein Client-Side-Only Rendering.
> Theming NUR über CSS Custom Properties aus DNA-Branding — keine hardcodierten Farben.
> Publish-Gate: tenant_branding.completeness = 'publish_ready' UND website_settings.is_published.
> Kontaktformular ist der EINZIGE öffentliche Write-Pfad — mit Rate-Limiting und Spam-Schutz.
> Kein separater Frontend-Build — gleiche Next.js App mit Route Group (portal).
