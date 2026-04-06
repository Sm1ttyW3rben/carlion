# MOD 34 — DNA-Engine & Design Intelligence

> Modulspezifikation für das Plattform-Fundament „DNA-Engine".
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v3)

---

## 1. Zweck & Einordnung

Die DNA-Engine ist das unsichtbare Fundament das alle kundensichtbaren Outputs von Carlion steuert. Sie erzeugt und verwaltet die **digitale Identität** jedes Händlers — Farben, Typografie, Tonalität, Formulierungsstil — und stellt diese Daten jedem Modul zur Verfügung das kundensichtbare Inhalte erzeugt.

**Metapher:** Die DNA-Engine ist das „Branding-Gehirn" von Carlion. Der Händler gibt im Onboarding seine Website-URL ein — die Engine extrahiert daraus alles was nötig ist und generiert den Rest per AI. Ab diesem Moment sind alle Outputs (Website, E-Mails, Inserate, Chatbot-Antworten, PDFs) automatisch im Look & Ton des Händlers.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 34 |
| Kategorie | Plattform-Fundament |
| Phase | **MVP** |
| Build-Reihenfolge | 1 (erstes Modul nach Platform Foundation) |
| Abhängigkeiten | Platform Foundation (Auth, Tenants, RLS) |
| Abhängig davon | Modul 11 (Website Builder), Modul 13 (Börsen-Hub), Modul 17 (WhatsApp), Modul 19 (E-Mail), Modul 09 (Chatbot), AI-Assistent |

### Warum so früh?

Die DNA-Engine wird als erstes Modul gebaut weil:
- Das Branding-Profil ist ein Pflichtfeld für Website-Generierung (Modul 11)
- Jeder AI-generierte Text braucht Tonalität und Anredeform aus dem Branding-Profil
- Das Onboarding führt direkt in die DNA-Engine — ohne sie gibt es keinen „Wow-Moment"
- Alle späteren Module sind Consumer der DNA-Daten, keines produziert sie

---

## 2. Kernkonzept — Das Branding-Profil

Jeder Tenant hat genau ein Branding-Profil. Dieses Profil wird im Onboarding erzeugt und kann danach jederzeit bearbeitet werden. Es besteht aus drei Säulen:

### 2.1 Visuelle Identität

| Feld | Typ | Quelle | Pflicht-Stufe |
|------|-----|--------|---------------|
| `logo_file_id` | uuid (FK → files) | Website-Crawl oder manueller Upload | publish_ready |
| `favicon_file_id` | uuid (FK → files) | Generiert aus Logo | publish_ready (auto) |
| `primary_color` | string (Hex) | Website-Crawl oder manuell | Ja |
| `secondary_color` | string (Hex) | AI-generiert aus Primary oder manuell | Ja |
| `accent_color` | string (Hex) | AI-generiert oder manuell | Nein |
| `background_color` | string (Hex) | Default `#FFFFFF`, anpassbar | Ja |
| `text_color` | string (Hex) | Default `#1A1A1A`, anpassbar | Ja |
| `font_heading` | string | Kuratierte Pairing-Liste | Ja |
| `font_body` | string | Kuratierte Pairing-Liste | Ja |
| `border_radius` | enum: `none` / `sm` / `md` / `lg` / `full` | AI-Vorschlag, anpassbar | Ja |
| `button_style` | enum: `solid` / `outline` / `ghost` | AI-Vorschlag, anpassbar | Ja |

**Logo und Favicon referenzieren immer `files.id`.** Keine direkten URLs in `tenant_branding`. Siehe Abschnitt 5.5 (Asset-Pipeline) für den vollständigen Ingest-Flow.

**Farbpaletten-Generierung:** Aus `primary_color` werden automatisch abgeleitet:
- `primary_50` bis `primary_950` (Tailwind-Skala, 11 Stufen)
- `secondary_50` bis `secondary_950`
- Kontrastfarben für Text auf Primary/Secondary (WCAG AA konform)

### 2.2 Kommunikations-Identität

| Feld | Typ | Quelle | Pflicht |
|------|-----|--------|---------|
| `tone` | enum: `professional` / `friendly` / `premium` / `casual` | AI-Vorschlag aus Website-Analyse | Ja |
| `formality` | enum: `du` / `sie` | AI-Vorschlag oder Händler-Eingabe | Ja |
| `dealership_type` | enum: `einzelhaendler` / `autohaus` / `mehrmarkenhaendler` / `premiumhaendler` | AI-Erkennung oder manuell | Ja |
| `tagline` | string, nullable | Website-Crawl oder AI-generiert | Nein |
| `welcome_message` | text | AI-generiert, anpassbar | Nein |
| `email_signature` | text | AI-generiert aus Profil-Daten | Nein |
| `description_style` | enum: `factual` / `emotional` / `balanced` | AI-Vorschlag, anpassbar | Ja |

**Kein `dealership_name` in dieser Tabelle.** Der kanonische Händlername ist `tenants.name` (gesetzt bei Registrierung). Alle Module und AI-Prompts lesen den Händlernamen aus `tenants.name`. Siehe Abschnitt 3.1 für die Source-of-Truth-Regel.

### 2.3 Geschäftsdaten

| Feld | Typ | Quelle | Pflicht-Stufe |
|------|-----|--------|---------------|
| `address` | object (Straße, PLZ, Ort) | Website-Crawl oder manuell | branding_complete |
| `phone` | string | Website-Crawl oder manuell | branding_complete |
| `email` | string | Website-Crawl oder manuell | branding_complete |
| `opening_hours` | jsonb (Wochentag → Zeiten) | Website-Crawl oder manuell | publish_ready |
| `website_url` | string, nullable | Eingabe im Onboarding | — |
| `google_maps_url` | string, nullable | Generiert aus Adresse | — |
| `imprint_data` | jsonb (Geschäftsführer, HRB, USt-ID) | Manuell (Einstellungen) | publish_ready |

**Pflicht-Stufen:** Nicht jedes Feld muss im Onboarding ausgefüllt werden. Siehe Abschnitt 12.2 (Completeness-Modell).

---

## 3. Designentscheidungen

### 3.1 Source of Truth für den Händlernamen

**Entscheidung:** Der kanonische Händlername lebt ausschließlich in `tenants.name`. Es gibt kein separates `dealership_name`-Feld in `tenant_branding`.

**Begründung:** Drei Stellen für denselben Wert (`tenants.name`, `tenant_branding.dealership_name`, `tenants.branding`-Kompaktkopie) erzeugen zwangsläufig Drift. Ein Fundament-Modul darf dieses Problem nicht schaffen.

**Konsequenz für Konsumenten:** AI-Prompts, E-Mail-Templates und Website lesen den Händlernamen über `tenants.name` (verfügbar im tRPC-Context als `ctx.tenantName`). Die `tenants.branding`-Kompaktkopie enthält den Namen nicht — er kommt direkt aus `tenants`.

### 3.2 Kompaktkopie `tenants.branding`

**Was rein darf:** `primary_color`, `tone`, `formality`, `description_style`, `logo_public_url` (abgeleitete öffentliche URL aus `files`).

**Synchronisierung:** Jede Mutation auf `tenant_branding` aktualisiert `tenants.branding` in derselben Transaktion. Kein eventual-consistency, keine separate Sync-Logik.

**Was nicht rein darf:** Händlername (lebt in `tenants.name`), Geschäftsdaten (zu groß, zu veränderlich), Meta-Felder.

### 3.3 Impressum: kein Crawl-Ziel

**Entscheidung:** Der MVP-Crawl lädt ausschließlich die Startseite. Kein zweiter Fetch auf Impressum oder andere Unterseiten.

**Begründung:** „Nur Startseite" und „Impressum-Link parsen" widersprechen sich. Impressum-Daten (Geschäftsführer, HRB, USt-ID) sind rechtlich sensibel und zu komplex für automatische Extraktion. Fehlerhafte Auto-Extraktion wäre schlimmer als manuelles Eintippen.

**Konsequenz:** `imprint_data` wird ausschließlich manuell in den Branding-Einstellungen erfasst. Es ist Pflicht für `publish_ready`, nicht für `branding_complete`. Die Website kann ohne Impressum nicht veröffentlicht werden — aber das Onboarding wird nicht damit blockiert.

### 3.4 Keine Google Fonts API als Laufzeit-Abhängigkeit

**Entscheidung:** Fonts werden im MVP selbst gehostet (Self-Hosted Google Fonts). Keine Laufzeit-Anfragen an Google-Server.

**Begründung:** Die kuratierte Font-Liste hat 5 Pairings. Diese Fonts werden beim Build heruntergeladen und als statische Assets ausgeliefert. Das eliminiert eine externe Abhängigkeit, verbessert Performance und vermeidet DSGVO-Diskussionen um Google-Server-Kontakt.

**Konsequenz:** `font_heading` und `font_body` akzeptieren nur Werte aus der kuratierten Enum-Liste. Kein Freitext. Validierung auf DB- und Zod-Ebene.

### 3.5 SVG-Logos: nicht im MVP

**Entscheidung:** Im MVP werden nur PNG, JPG und WebP als Logo-Formate akzeptiert. Kein SVG-Upload.

**Begründung:** SVG-Sanitization ist sicherheitskritisch (eingebettetes JavaScript, externe Referenzen, CSS-Injection). Für ein Fundament-Modul ist das Risiko-Nutzen-Verhältnis falsch. 95%+ der Händler-Logos sind Rasterbilder.

**Konsequenz:** Phase 2 kann SVG-Support mit dedizierter Sanitization-Library (z.B. DOMPurify) ergänzen. Bis dahin werden SVGs im Upload mit klarer Fehlermeldung abgelehnt.

---

## 4. Datenmodell

### Tabelle: `tenant_branding`

```
tenant_branding:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, unique, not null
  
  -- Visuelle Identität
  logo_file_id      uuid, foreign key → files, nullable
  favicon_file_id   uuid, foreign key → files, nullable
  primary_color     text, not null, default '#2563EB'
  secondary_color   text, not null, default '#1E40AF'
  accent_color      text, nullable
  background_color  text, not null, default '#FFFFFF'
  text_color        text, not null, default '#1A1A1A'
  color_palette     jsonb, not null, default '{}'
  font_heading      text, not null, default 'Inter'
  font_body         text, not null, default 'Inter'
  border_radius     text, not null, default 'md'
  button_style      text, not null, default 'solid'
  
  -- Kommunikations-Identität (kein dealership_name — siehe 3.1)
  tone              text, not null, default 'professional'
  formality         text, not null, default 'sie'
  dealership_type   text, not null, default 'einzelhaendler'
  tagline           text, nullable
  welcome_message   text, nullable
  email_signature   text, nullable
  description_style text, not null, default 'balanced'
  
  -- Geschäftsdaten
  address           jsonb, nullable
  phone             text, nullable
  email             text, nullable
  opening_hours     jsonb, nullable
  website_url       text, nullable
  google_maps_url   text, nullable
  imprint_data      jsonb, nullable
  
  -- Completeness (siehe 12.2)
  completeness      text, not null, default 'draft'
                    -- enum: draft | branding_complete | publish_ready
  
  -- Meta
  onboarding_source text, nullable (url die gecrawlt wurde)
  generation_log    jsonb, nullable (was AI generiert hat, was manuell war)
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  CHECK font_heading IN ('Inter', 'Nunito', 'Playfair Display', 'Poppins')
  CHECK font_body IN ('Inter', 'Open Sans', 'Lato', 'Nunito Sans')
  CHECK tone IN ('professional', 'friendly', 'premium', 'casual')
  CHECK formality IN ('du', 'sie')
  CHECK border_radius IN ('none', 'sm', 'md', 'lg', 'full')
  CHECK button_style IN ('solid', 'outline', 'ghost')
  CHECK completeness IN ('draft', 'branding_complete', 'publish_ready')
  CHECK primary_color ~ '^#[0-9a-fA-F]{6}$'
  CHECK secondary_color ~ '^#[0-9a-fA-F]{6}$'

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_tenant_branding_tenant ON tenant_branding(tenant_id)  -- unique constraint reicht
```

### Tabelle: `dna_crawl_results`

Speichert die Ergebnisse des Website-Crawls für Nachvollziehbarkeit.

```
dna_crawl_results:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  source_url        text, not null
  status            text, not null, default 'pending'
                    -- enum: pending | crawling | analyzing | completed | failed
  raw_html          text, nullable
  extracted_data    jsonb, nullable
    -- {
    --   logo_candidates: [{ url, width, height, confidence }],
    --   colors_found: [{ hex, frequency, context }],
    --   texts: { tagline, about, meta_description },
    --   contact: { phone, email, address },
    --   opening_hours: [...],
    --   tone_signals: [{ text, classification }]
    -- }
  ai_analysis       jsonb, nullable
    -- {
    --   suggested_tone: "professional",
    --   suggested_formality: "sie",
    --   suggested_type: "autohaus",
    --   confidence_scores: { tone: 0.85, formality: 0.92 },
    --   reasoning: "..."
    -- }
  error_message     text, nullable
  duration_ms       integer, nullable
  started_at        timestamptz, nullable
  completed_at      timestamptz, nullable
  applied_at        timestamptz, nullable
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  CHECK status IN ('pending', 'crawling', 'analyzing', 'completed', 'failed')

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_crawl_tenant ON dna_crawl_results(tenant_id)
  INDEX idx_crawl_status ON dna_crawl_results(tenant_id, status)
  
  -- Concurrency-Schutz: max 1 aktiver Crawl pro Tenant
  UNIQUE INDEX idx_crawl_active_per_tenant ON dna_crawl_results(tenant_id)
    WHERE status IN ('pending', 'crawling', 'analyzing')

  -- Retention: raw_html wird nach 30 Tagen auf NULL gesetzt (Cron-Job)
```

### Erstellung des Default-Profils

**Verantwortlich:** Platform Foundation (Registrierungsflow).

Bei der Tenant-Erstellung wird automatisch ein `tenant_branding`-Eintrag mit Status `draft` und allen Defaults erzeugt. Das passiert in derselben Transaktion wie die Tenant-Erstellung. Die DNA-Engine setzt voraus dass `tenant_branding` existiert — sie erzeugt es nie selbst.

---

## 5. Website-Crawl — Technische Spezifikation

### 5.1 Ausführungsmodell

**Entscheidung: Synchroner Crawl innerhalb der Mutation mit hartem Timeout.**

```
Frontend                     Backend (startCrawl mutation)
   │                              │
   ├── startCrawl({ url }) ──────►│
   │                              ├── URL validieren
   │                              ├── dna_crawl_results erstellen (status: crawling)
   │                              ├── HTML fetchen (timeout: 8s)
   │                              ├── Daten extrahieren (~200ms)
   │                              ├── AI-Analyse aufrufen (timeout: 10s)
   │                              ├── Status → completed, Ergebnis speichern
   │                              │   ODER: Fehler → Status: failed
   │◄── { crawlId, result } ──────┤
   │                              │
```

**Begründung gegen asynchron:** Ein asynchroner Crawl braucht einen expliziten Executor (Cron, Queue, Edge Function). Auf Vercel ist das nicht trivial und für einen Vorgang der in 90% der Fälle unter 15 Sekunden dauert, ist synchron die einfachere und zuverlässigere Lösung. Das Frontend zeigt während der Wartezeit eine animierte Vorschau.

**Timeout-Kaskade:**
- HTTP-Fetch der Website: 8 Sekunden
- AI-Analyse: 10 Sekunden
- Gesamter Request: 25 Sekunden (Vercel Function Timeout bei Pro: 60s)
- Wenn ein Teilschritt fehlschlägt: Die bis dahin extrahierten Daten werden gespeichert, fehlende Teile auf Defaults gesetzt, Status = `completed` (mit `error_message` für den fehlgeschlagenen Teilschritt)

**Konsequenz:** `dna.getCrawlStatus` wird **nicht** benötigt. Die Mutation `dna.startCrawl` gibt das Ergebnis direkt zurück. Das Frontend braucht kein Polling.

**Fallback bei komplettem Timeout (>25s):** Status = `failed`, Händler wird auf manuelle Eingabe weitergeleitet.

### 5.2 Crawl-Ablauf

```
1. INPUT: URL (z.B. "www.autohaus-mueller.de")
   └── URL normalisieren (https:// ergänzen, trailing slash entfernen)

2. FETCH: HTML der Startseite laden
   └── Über dedizierten Service-Client: server/services/website-crawler.ts
   └── User-Agent: "Carlion-Bot/1.0"
   └── Timeout: 8 Sekunden
   └── Redirect-Following: max 3 Hops
   └── Nur Startseite — kein Deep-Crawl, kein Impressum

3. EXTRACT: Strukturierte Daten aus HTML parsen
   ├── Logo: <img> in Header/Nav, <link rel="icon">, 
   │         Open Graph Image, Schema.org logo
   ├── Farben: Inline-Styles, CSS Custom Properties, 
   │           häufigste Hintergrund-/Textfarben
   ├── Texte: <title>, meta description, H1, About-Texte
   ├── Kontakt: tel:-Links, mailto:-Links, Schema.org
   ├── Öffnungszeiten: Schema.org OpeningHoursSpecification,
   │                    strukturierte Texte parsen
   └── Social: Links zu Facebook, Instagram, Google Maps

4. INGEST LOGO (wenn gefunden): → Asset-Pipeline (Abschnitt 5.5)
   └── Logo-Kandidat herunterladen, validieren, in Storage speichern

5. ANALYZE (AI): Claude API analysiert extrahierte Daten
   └── Über shared/lib/ai.ts (nicht direkte SDK-Nutzung)
   └── Details in Abschnitt 6

6. RESULT: Branding-Vorschlag zusammenstellen
   └── Jedes Feld markiert mit Quelle: "crawled" | "ai_generated" | "default"
```

### 5.3 Service-Client-Regel

**Der Website-Crawl-HTTP-Fetch läuft über einen dedizierten Service-Client** in `server/services/website-crawler.ts`. Kein direkter `fetch()`-Aufruf im Modul-Service. Der Client kapselt: URL-Normalisierung, Timeout, Redirect-Handling, User-Agent, Fehler-Transformation. Das folgt der Architektur-Regel aus `01_ARCHITECTURE.md` Abschnitt 8.

### 5.4 Crawl-Einschränkungen (MVP)

- Nur die Startseite wird gecrawlt (kein Unterseiten-Crawling, kein Impressum)
- Kein JavaScript-Rendering (nur statisches HTML). Reicht für 80%+ der Händler-Websites
- Keine Login-geschützten Seiten
- robots.txt wird respektiert
- Max 1 aktiver Crawl pro Tenant (erzwungen per DB-Check auf `status: crawling`)
- Crawl-Ergebnis wird einmal gespeichert — kein periodisches Re-Crawling in Phase 1
- `raw_html` wird gespeichert, nach 30 Tagen per Cleanup-Cron auf NULL gesetzt

### 5.5 Asset-Pipeline (Logo-Ingestion)

Jedes Logo — ob vom Crawl gefunden oder manuell hochgeladen — durchläuft denselben Pipeline-Pfad. Keine externen URLs werden direkt in `tenant_branding` gespeichert.

```
1. QUELLE
   ├── Crawl: Logo-URL aus HTML extrahiert
   │   └── Download über website-crawler Service-Client
   │   └── Timeout: 5 Sekunden, max 5 MB
   └── Upload: Händler lädt Datei direkt hoch

2. VALIDIERUNG (serverseitig, vor Storage)
   ├── Format: PNG, JPG, WebP (kein SVG im MVP — siehe 3.5)
   ├── MIME-Type: serverseitig prüfen (Extension nicht vertrauen)
   ├── Größe: Min 100x100px, Max 5 MB
   ├── Bildinhalt: Mindestvalidierung (ist es ein valides Bild?)
   └── Bei Fehler: Logo-Feld bleibt NULL, Händler wird zum Upload aufgefordert

3. VERARBEITUNG
   ├── Thumbnail generieren: 200x200 (für Dashboard/Previews)
   ├── Original beibehalten (für hochauflösende Nutzung)
   └── Konvertierung zu WebP für öffentliche Nutzung

4. STORAGE (Supabase Storage)
   ├── Pfad: branding/{tenant_id}/logo.{ext}
   ├── Pfad: branding/{tenant_id}/logo-thumb.webp
   └── Öffentlich lesbar (Branding-Assets sind öffentlich laut Architektur)

5. METADATEN (files-Tabelle)
   ├── Eintrag in files mit:
   │   entity_type: 'branding'
   │   entity_id: tenant_branding.id
   │   kind: 'logo' | 'logo_thumbnail'
   │   is_public: true
   │   processing_status: 'processed'
   └── tenant_branding.logo_file_id → files.id (Original)

6. FAVICON
   ├── Automatisch generiert aus Logo (resize auf 32x32 + 192x192)
   ├── Eigener files-Eintrag mit kind: 'favicon'
   └── tenant_branding.favicon_file_id → files.id
```

**Crawl-Logo-Regel:** Wenn der Crawl ein Logo findet, wird es heruntergeladen und durch die Pipeline geschleust. Die externe URL wird nirgends dauerhaft gespeichert. Wenn der Download fehlschlägt: `logo_file_id` bleibt NULL, Händler wird im Review-Schritt zum Upload aufgefordert.

### 5.6 Fehlerbehandlung Crawl

| Fehlerfall | Verhalten |
|------------|-----------|
| URL nicht erreichbar (Timeout, DNS-Fehler) | Status: `failed`, Hinweis an UI, Händler nutzt manuellen Fallback |
| robots.txt blockiert | Gleich wie „nicht erreichbar" |
| HTML geladen, aber kein Logo | Branding ohne Logo generieren, Händler zum Upload auffordern |
| HTML geladen, keine Farben extrahierbar | Default-Palette, Händler kann Primärfarbe manuell wählen |
| Logo-Download fehlgeschlagen | Branding ohne Logo, Upload-Aufforderung |
| AI-Analyse fehlgeschlagen | Crawl-Daten nutzen (Farben, Kontakt), AI-Felder auf Defaults |
| Gesamter Request-Timeout (>25s) | Status: `failed`, manueller Fallback |

**Prinzip:** Kein Crawl-Fehler blockiert das Onboarding. Jeder Teilfehler reduziert den Output, stoppt aber nicht den Flow.

---

## 6. AI-Analyse — Prompt-Architektur

### Analyse-Prompt (nach Crawl)

```
System: Du bist ein Branding-Analyst für Autohäuser. 
Analysiere die extrahierte Website-Daten und erstelle ein Branding-Profil.

Kontext:
- Zielgruppe: Deutsche Autokäufer
- Branche: Automotive / Autohandel
- Land: Deutschland

Eingabe:
{extracted_data}

Aufgabe:
1. Bestimme die Tonalität: professional, friendly, premium, casual.
   Begründe anhand konkreter Textstellen.
2. Bestimme die Anredeform: "du" oder "sie".
   Suche nach direkten Hinweisen in den Texten.
3. Klassifiziere den Händlertyp: einzelhaendler, autohaus, 
   mehrmarkenhaendler, premiumhaendler.
4. Schlage eine Farbpalette vor: secondary_color und accent_color 
   passend zur primary_color {primary_color}.
5. Wähle ein Font-Pairing passend zur Tonalität.
   Erlaubte Heading-Fonts: Inter, Nunito, Playfair Display, Poppins.
   Erlaubte Body-Fonts: Inter, Open Sans, Lato, Nunito Sans.
6. Extrahiere oder generiere eine Tagline (max. 8 Worte).
7. Generiere eine kurze Willkommensnachricht (2-3 Sätze) im Ton des Händlers.

Output-Format: JSON
{
  "tone": "...",
  "tone_reasoning": "...",
  "formality": "...",
  "formality_reasoning": "...",
  "dealership_type": "...",
  "secondary_color": "#......",
  "accent_color": "#......",
  "font_heading": "...",
  "font_body": "...",
  "tagline": "...",
  "welcome_message": "...",
  "confidence": {
    "tone": 0.0-1.0,
    "formality": 0.0-1.0,
    "type": 0.0-1.0
  }
}
```

**Modell:** `claude-sonnet-4-20250514` (schnell, ausreichend für diese Aufgabe)
**Token-Budget:** Input 4.000 / Output 1.000
**AI-Client:** Über `shared/lib/ai.ts` — kein direkter Anthropic-SDK-Import im Modul
**Fallback bei AI-Fehler:** Alle AI-Felder auf Defaults, Crawl-Daten (Farben, Kontakt) trotzdem nutzen

---

## 7. API (tRPC Router)

Router: `dna` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen (Entity / View / Public DTO)

Drei getrennte Typen verhindern Drift zwischen DB-Modell, interner API und öffentlichem Output:

```typescript
// DB-Entity — 1:1 Abbild der tenant_branding-Tabelle
type TenantBrandingRecord = {
  id: string;
  tenant_id: string;
  logo_file_id: string | null;      // FK → files
  favicon_file_id: string | null;    // FK → files
  primary_color: string;
  // ... alle DB-Spalten exakt wie im Schema
  completeness: 'draft' | 'branding_complete' | 'publish_ready';
  created_at: string;
  updated_at: string;
}

// API-View — wird von dna.getBranding und allen update-Mutations zurückgegeben
// Enthält aufgelöste URLs statt File-IDs, plus tenants.name
type TenantBrandingView = {
  id: string;
  tenant_name: string;               // aus tenants.name
  logo_url: string | null;           // aufgelöste Public URL aus files/storage
  favicon_url: string | null;        // aufgelöste Public URL aus files/storage
  primary_color: string;
  // ... alle für Frontend relevanten Felder
  completeness: 'draft' | 'branding_complete' | 'publish_ready';
}

// Public DTO — wird von der Public-Read-Route zurückgegeben (Abschnitt 8)
// Reduziert, keine internen Felder, keine IDs
type PublicBranding = { /* siehe Abschnitt 8 */ }
```

**Regel:** Mutations geben `TenantBrandingView` zurück, nicht `TenantBrandingRecord`. Das Frontend arbeitet nie mit File-IDs. Der Service-Layer übersetzt Record → View beim Lesen.

### Procedures

```
dna.getBranding
  Type:     query
  Auth:     protectedProcedure
  Input:    — (tenant_id aus Context)
  Output:   TenantBrandingView (mit aufgelösten File-URLs und tenant_name)
  Zweck:    Aktuelles Branding-Profil laden

dna.updateVisualIdentity
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    UpdateVisualIdentityInput
            {
              primary_color?: string (Hex, validiert),
              secondary_color?: string (Hex, validiert),
              accent_color?: string | null,
              background_color?: string (Hex, validiert),
              text_color?: string (Hex, validiert),
              font_heading?: FontHeadingEnum,
              font_body?: FontBodyEnum,
              border_radius?: BorderRadiusEnum,
              button_style?: ButtonStyleEnum,
            }
  Output:   TenantBrandingView
  Regeln:   
    - Nur visuelle Felder patchbar — keine Meta-/Geschäftsfelder
    - Generiert Farbpalette neu wenn primary/secondary geändert
    - Aktualisiert tenants.branding Kompaktkopie (gleiche Transaktion)
    - Aktualisiert completeness wenn nötig
    - Schreibt Audit-Log

dna.updateCommunicationIdentity
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    UpdateCommunicationInput
            {
              tone?: ToneEnum,
              formality?: FormalityEnum,
              dealership_type?: DealershipTypeEnum,
              description_style?: DescriptionStyleEnum,
              tagline?: string | null,
              welcome_message?: string | null,
              email_signature?: string | null,
            }
  Output:   TenantBrandingView
  Regeln:
    - Nur Kommunikationsfelder patchbar
    - Aktualisiert tenants.branding Kompaktkopie (gleiche Transaktion)
    - Schreibt Audit-Log

dna.updateBusinessData
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    UpdateBusinessDataInput
            {
              address?: AddressSchema | null,
              phone?: string | null,
              email?: string (E-Mail-validiert) | null,
              opening_hours?: OpeningHoursSchema | null,
              google_maps_url?: string | null,
              imprint_data?: ImprintSchema | null,
            }
  Output:   TenantBrandingView
  Regeln:
    - Nur Geschäftsdaten patchbar
    - Aktualisiert completeness (prüft ob publish_ready erreichbar)
    - Schreibt Audit-Log

dna.uploadLogo → KEIN tRPC. Dedizierter Route Handler.
  Route:    app/api/upload/branding-logo/route.ts
  Auth:     roleProcedure(["owner", "admin"]) — Auth-Check im Route Handler
  Input:    multipart/form-data (Datei)
  Output:   { logoFileId: string, faviconFileId: string, logoUrl: string, faviconUrl: string }
  Zweck:    Logo hochladen, validieren, verarbeiten, Favicon generieren
  Regeln:
    - Dedizierter Next.js Route Handler (tRPC kann kein multipart)
    - Durchläuft Asset-Pipeline (5.5)
    - Aktualisiert tenant_branding.logo_file_id + favicon_file_id
    - Aktualisiert tenants.branding.logo_public_url (gleiche Transaktion)
    - Aktualisiert completeness
    - Altes Logo wird soft-deleted (files.deleted_at)
    - Schreibt Audit-Log

dna.startCrawl
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { url: string }
  Output:   DnaCrawlResult (vollständiges Ergebnis, synchron)
  Zweck:    Website crawlen, analysieren, Branding-Vorschlag generieren
  Regeln:
    - URL-Validierung (gültige URL, nicht localhost, nicht Carlion-Domain)
    - Max 1 aktiver Crawl pro Tenant (DB-Check)
    - Synchrone Ausführung (siehe 5.1)
    - Gibt Ergebnis direkt zurück (kein Polling)

dna.applyCrawlResult
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    ApplyCrawlResultInput
            {
              crawlId: string,
              visual_overrides?: UpdateVisualIdentityInput,
              communication_overrides?: UpdateCommunicationInput,
              business_overrides?: UpdateBusinessDataInput,
            }
  Output:   TenantBrandingView
  Zweck:    Crawl-Ergebnis als Branding übernehmen (mit optionalen Anpassungen)
  Regeln:
    - Crawl muss status "completed" haben
    - Crawl darf nicht bereits applied sein (applied_at = null)
    - Overrides nutzen dieselben typisierten Input-Schemas wie die Update-Mutations
    - Schreibt generation_log (was AI, was Override, was Default)
    - Setzt crawl applied_at
    - Aktualisiert completeness
    - Aktualisiert tenants.branding Kompaktkopie (gleiche Transaktion)
    - Wenn Crawl Logo ingestiert hat: tenants.branding.logo_public_url aktualisieren

dna.regenerateTexts
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { fields: ("welcome_message" | "email_signature" | "tagline")[] }
  Output:   { [field]: string }  (Vorschläge, nicht gespeichert)
  Zweck:    Einzelne AI-Texte neu generieren mit aktuellem Branding-Profil
  Regeln:
    - Nutzt aktuelles Branding-Profil + tenants.name als Kontext
    - Ergebnis wird NICHT automatisch gespeichert
    - Frontend zeigt Vorschau → Händler übernimmt via updateCommunicationIdentity
```

### Entfernt: `dna.getPublicBranding`

Öffentlicher Branding-Zugriff läuft **nicht** über tRPC. Siehe Abschnitt 8.

---

## 8. Öffentlicher Branding-Zugriff (Public Delivery)

### Architektur-Konformität

Laut `01_ARCHITECTURE.md` Abschnitt 10 werden öffentliche Daten über dedizierte API-Routen ausgeliefert die mit Service Role arbeiten, strikt read-only und strikt begrenzt sind. DNA-Branding folgt diesem Pattern.

### Route

```
app/api/public/[tenant_slug]/branding/route.ts
```

### Regeln

- **Kein tRPC.** Dedizierte Next.js Route Handler.
- **Service Role.** Kein JWT vorhanden (anonymer Zugriff), daher Service Role für DB-Zugriff.
- **Strikt read-only.** Kein Write-Pfad, keine Mutation.
- **Reduzierter Response.** Nur Felder die für öffentliche Darstellung nötig sind:

```typescript
type PublicBranding = {
  // Aus tenants
  name: string;              // tenants.name
  slug: string;              // tenants.slug
  
  // Aus tenant_branding
  primary_color: string;
  secondary_color: string;
  accent_color: string | null;
  background_color: string;
  text_color: string;
  color_palette: ColorPalette;
  font_heading: string;
  font_body: string;
  border_radius: string;
  button_style: string;
  tone: string;
  formality: string;
  tagline: string | null;
  
  // Aufgelöste URLs
  logo_url: string | null;   // Public URL aus Supabase Storage
  favicon_url: string | null;
  
  // Geschäftsdaten (nur wenn vorhanden)
  address: Address | null;
  phone: string | null;
  email: string | null;
  opening_hours: OpeningHours | null;
  google_maps_url: string | null;
}
```

- **Nicht enthalten:** `imprint_data` (wird separat über Website-Modul ausgeliefert), `generation_log`, `onboarding_source`, `completeness`, Meta-Felder, interne IDs.
- **Caching:** Vercel ISR mit `Cache-Control: public, max-age=300, stale-while-revalidate=600`
- **Rate Limiting:** Schutz vor Scraping (analog zu anderen Public Routes)
- **Tenant-Validierung:** Slug muss existieren UND Tenant muss aktiv sein
- **Publish-Gate:** Route liefert nur Daten wenn `completeness = 'publish_ready'`. Bei `draft` oder `branding_complete`: HTTP 404. Das verhindert dass unvollständige oder ungeprüfte Branding-Daten öffentlich sichtbar werden bevor der Händler sein Profil bewusst veröffentlicht hat.

---

## 9. AI-Tools (für AI-Assistent)

Datei: `modules/dna-engine/ai-tools.ts`

### Lesende Tools (kein Confirm nötig)

```typescript
{
  name: "get_branding",
  description: "Branding-Profil des Autohauses abrufen: 
                Farben, Logo, Tonalität, Kontaktdaten",
  parameters: {},
  execute: (params, ctx) => dnaService.getBranding(ctx)
},
{
  name: "regenerate_branding_text",
  description: "Einen AI-generierten Branding-Text neu generieren. 
                Händler sagt z.B. 'Generier mir eine neue Tagline'. 
                Gibt einen Vorschlag zurück, ändert nichts.",
  parameters: {
    field: "welcome_message" | "email_signature" | "tagline"
  },
  execute: (params, ctx) => dnaService.regenerateText(params.field, ctx)
  // Lesend: gibt Textvorschlag zurück, speichert nicht
}
```

### Schreibende Tools (PROPOSE → CONFIRM Flow)

Schreibende AI-Tools geben **keine direkte Mutation** aus. Sie erzeugen einen AI-Action-Command (siehe `01_ARCHITECTURE.md` Abschnitt 6: AI-Aktionsprotokoll) der dem Händler als Vorschlag mit Preview angezeigt wird. Erst nach expliziter Bestätigung (Button-Klick, Confirm-Token) wird die Mutation ausgeführt.

```typescript
{
  name: "propose_branding_color_change",
  description: "Farbänderung vorschlagen. 
                Händler sagt z.B. 'Mach die Hauptfarbe blauer'.
                Erzeugt einen Vorschlag den der Händler bestätigen muss.",
  parameters: {
    primary_color?: string,
    secondary_color?: string,
    accent_color?: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "dna",
    action: "update_visual_identity",
    proposed_changes: params,
    preview: () => colorPalettePreview(params),  // Dry-Run: zeigt neue Palette
    executeOnConfirm: () => dnaService.updateVisualIdentity(params, ctx)
  })
  // Gibt PROPOSE-Response zurück, keine Mutation
}
```

```typescript
{
  name: "propose_branding_tone_change",
  description: "Tonalität oder Anredeform ändern vorschlagen. 
                Händler sagt z.B. 'Wir wollen unsere Kunden duzen'.
                Erzeugt einen Vorschlag den der Händler bestätigen muss.",
  parameters: {
    tone?: ToneEnum,
    formality?: FormalityEnum
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "dna",
    action: "update_communication_identity",
    proposed_changes: params,
    preview: () => toneChangePreview(params, ctx),
    executeOnConfirm: () => dnaService.updateCommunicationIdentity(params, ctx)
  })
  // Gibt PROPOSE-Response zurück, keine Mutation
}
```

### AI-Command-Flow (Referenz)

Alle schreibenden AI-Tools nutzen den globalen `aiCommandService.propose()` aus `01_ARCHITECTURE.md`:

```
1. PROPOSE  → Tool gibt proposed_changes + Preview zurück
2. PREVIEW  → Frontend zeigt was sich ändern würde
3. CONFIRM  → Händler klickt Bestätigen (Confirm-Token, 5 Min gültig)
4. EXECUTE  → Rollback-Snapshot → Mutation → AI-Event-Log
5. RESULT   → Händler sieht Ergebnis + Undo-Button
```

**Kein AI-Tool darf `dnaService.update*()` direkt aufrufen.** Der Pfad ist immer: `propose()` → Confirm-Token → `execute()`. Das wird strukturell durch den `aiCommandService` erzwungen, nicht durch Kommentare im Code.

---

## 10. Branding-Konsumenten — Wie Module die DNA nutzen

Die DNA-Engine ist ein reiner Daten-Provider. Sie stellt das Branding-Profil bereit — andere Module konsumieren es.

### Lese-Schnittstelle für andere Module

Module lesen DNA-Daten über den öffentlichen Export der DNA-Engine:

```typescript
// modules/dna-engine/index.ts — öffentliche Exports
export { getBrandingForTenant } from "./services/dna-service";
export { getPublicBrandingForSlug } from "./services/dna-service";
export type { TenantBrandingRecord, TenantBrandingView, PublicBranding, ColorPalette } from "./domain/types";
```

**Module dürfen nicht direkt auf `tenant_branding`-Tabelle zugreifen.** Immer über die DNA-Service-Exports. Das folgt der Modulgrenze-Regel aus `01_ARCHITECTURE.md`.

### 10.1 Website Builder (Modul 11)

**Konsumiert:** Gesamtes Branding-Profil via Public-Read-Route
**Wie:** CSS Custom Properties werden aus dem Branding-Profil generiert und als Theme in die Website injiziert.

```css
/* Generiert aus tenant_branding */
:root {
  --brand-primary: #2563EB;
  --brand-primary-50: #EFF6FF;
  /* ... Palette-Stufen ... */
  --brand-secondary: #1E40AF;
  --brand-accent: #F59E0B;
  --brand-bg: #FFFFFF;
  --brand-text: #1A1A1A;
  --brand-radius: 0.375rem;    /* md */
  --font-heading: 'Inter', sans-serif;
  --font-body: 'Inter', sans-serif;
}
```

### 10.2 AI-Assistent & AI-Texte (modulübergreifend)

**Konsumiert:** `tone`, `formality`, `dealership_type`, `description_style` (aus `tenant_branding`) + `name` (aus `tenants`)
**Wie:** Injiziert in den System-Prompt jedes AI-Calls (siehe `01_ARCHITECTURE.md` Abschnitt 6).

```
System-Prompt Baustein aus DNA:
"Du sprichst im Stil von {tenants.name}, einem {dealership_type}.
 Tonalität: {tone}. Anrede: {formality === 'du' ? 'Du-Form' : 'Sie-Form'}.
 Fahrzeugbeschreibungen: {description_style}."
```

### 10.3 E-Mail-Automation (Modul 19, Phase 2)

**Konsumiert:** Logo (aufgelöste URL aus `files`), Farben, Email-Signatur, `tenants.name`
**Wie:** E-Mail-Templates rendern Header (Logo + Farbe), Footer (Signatur + Kontaktdaten), Textton.

### 10.4 Fahrzeugbörsen-Hub (Modul 13)

**Konsumiert:** `description_style`, `tone`, `formality`, `tenants.name`
**Wie:** AI-Fahrzeugbeschreibungen für Inserate nutzen den DNA-Stil.

### 10.5 WhatsApp / Chatbot (Module 17, 09)

**Konsumiert:** `tone`, `formality`, `tenants.name`, `welcome_message`
**Wie:** Chatbot-Antworten und AI-WhatsApp-Vorschläge nutzen Tonalität und Anredeform.

### Konsumenten-Regeln

> 1. Kein Modul darf Branding-Werte hardcoden oder eigene Defaults definieren.
> 2. Kein Modul darf `tenant_branding` direkt aus der DB lesen — immer über DNA-Service-Exports.
> 3. Jeder kundensichtbare Output liest Branding aus DNA-Engine, Händlernamen aus `tenants.name`.
> 4. Wenn ein Modul ein Branding-Feld braucht das noch nicht existiert: DNA-Engine erweitern, nicht im Modul lösen.

---

## 11. Farbpaletten-Generierung

### Algorithmus

Aus einer einzigen `primary_color` wird eine vollständige 11-Stufen-Palette generiert (50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950 — analog Tailwind).

**Methode:** HSL-basierte Interpolation.

```
Eingabe: primary_color = #2563EB

1. In HSL konvertieren: H=217, S=90%, L=53%

2. Palette generieren:
   50:  H, S-40%, L=97%    → sehr helles Blau
   100: H, S-30%, L=93%
   200: H, S-20%, L=86%
   300: H, S-10%, L=72%
   400: H, S-5%,  L=62%
   500: H, S,     L=53%    → Primary (Eingabe)
   600: H, S,     L=44%
   700: H, S,     L=36%
   800: H, S-5%,  L=28%
   900: H, S-10%, L=20%
   950: H, S-15%, L=14%    → fast Schwarz

3. Kontrastfarben berechnen:
   - on_primary: Weiß (#FFF) wenn Primary L < 55%, sonst Schwarz (#1A1A1A)
   - on_secondary: analog
   - Validierung: WCAG AA Kontrast ≥ 4.5:1
```

**Implementierung:** Reine TypeScript-Funktion in `modules/dna-engine/domain/color-palette.ts`. Keine AI nötig. Wird bei jeder Änderung von `primary_color` oder `secondary_color` neu berechnet. Gleicher Code Client + Server (shared via Domain-Layer).

### Font-Pairing

MVP: Kuratierte Liste von 5 bewährten Font-Pairings (self-hosted, keine Google-API). Fonts werden beim Build heruntergeladen und als statische Assets ausgeliefert.

| Tonalität | Heading | Body |
|-----------|---------|------|
| `professional` | Inter | Inter |
| `friendly` | Nunito | Open Sans |
| `premium` | Playfair Display | Lato |
| `casual` | Poppins | Nunito Sans |
| Default | Inter | Inter |

**Validierung:** `font_heading` und `font_body` sind Enums, kein Freitext. DB-Constraints und Zod-Schemas erzwingen gültige Werte.

Phase 2: Erweiterung der kuratierten Liste, ggf. Custom Font Upload.

---

## 12. Business Rules

### 12.1 Unveränderliche Regeln

1. **Branding-Profil ist Pflicht.** Kein Tenant kann ohne `tenant_branding`-Eintrag existieren. Platform Foundation erzeugt einen Default-Eintrag bei Registrierung. DNA-Engine verfeinert ihn.

2. **Keine leeren kundensichtbaren Outputs.** Jedes Feld hat einen Default. Wenn Crawl fehlschlägt, wenn AI fehlschlägt — es gibt immer einen funktionierenden Fallback.

3. **Händler hat immer das letzte Wort.** Kein AI-generierter Wert wird ohne Bestätigung des Händlers aktiv. Im Onboarding: Review-Schritt. In Einstellungen: explizit speichern. Über AI-Assistent: Confirm-Flow.

4. **Ein Branding-Profil pro Tenant.** Kein A/B-Testing, keine Varianten in Phase 1.

5. **Änderungen propagieren sofort.** Wenn der Händler die Primärfarbe ändert, sehen alle Konsumenten (Website, E-Mails etc.) die neue Farbe beim nächsten Laden. Cache-Invalidierung über ISR Revalidation.

6. **Logo-Validierung.** Akzeptierte Formate: PNG, JPG, WebP (kein SVG im MVP). Min 100x100px, Max 5 MB. MIME-Type serverseitig geprüft.

7. **Händlername lebt in `tenants.name`.** Nicht in `tenant_branding`. Kein Duplikat, kein Sync-Problem.

8. **Keine externen Asset-URLs.** Logos und Favicons leben immer in Supabase Storage mit `files`-Eintrag. Keine gecrawlten URLs direkt referenzieren.

9. **Kompaktkopie-Sync ist Pflicht bei jeder Mutation.** Jede Mutation die `tenant_branding`-Felder ändert die in `tenants.branding` gespiegelt sind (`primary_color`, `tone`, `formality`, `description_style`, `logo_public_url`) muss die Kompaktkopie in derselben DB-Transaktion aktualisieren. Das gilt für: `updateVisualIdentity`, `updateCommunicationIdentity`, `applyCrawlResult`, `uploadLogo` (Route Handler). Kein eventual-consistency, kein separater Sync-Job.

### 12.2 Completeness-Modell

Nicht jedes Feld muss sofort ausgefüllt sein. Drei Stufen definieren was wann nötig ist:

| Stufe | Bedeutung | Pflichtfelder |
|-------|-----------|---------------|
| `draft` | Profil existiert, Defaults stehen | (automatisch bei Registrierung) |
| `branding_complete` | Visuelles Branding steht, Modul ist nutzbar | `primary_color`, `tone`, `formality`, `address`, `phone`, `email` |
| `publish_ready` | Website kann veröffentlicht werden | Alles aus `branding_complete` + `opening_hours`, `imprint_data`, `logo_file_id` |

**Berechnung:** `completeness` wird bei jeder Mutation automatisch neu berechnet. Die Logik liegt im DNA-Service, nicht in der DB.

**Konsumenten-Verhalten:**
- Onboarding-Ziel: `branding_complete`
- Website-Builder prüft vor Publish: `completeness === 'publish_ready'`
- Alle anderen Module funktionieren ab `draft` (mit Defaults)
- Fehlende Felder für `publish_ready` werden dem Händler als Checkliste in den Einstellungen angezeigt

### 12.3 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Branding ansehen | Alle authentifizierten Rollen |
| Branding bearbeiten | `owner`, `admin` |
| Website-Crawl starten | `owner`, `admin` |
| AI-Texte regenerieren | `owner`, `admin` |
| Logo hochladen | `owner`, `admin` |

---

## 13. Onboarding-Flow (MVP)

Der Onboarding-Flow ist der erste Berührungspunkt des Händlers mit Carlion nach der Registrierung. Der Flow ist so gebaut dass der Händler in unter 3 Minuten ein `branding_complete`-Profil hat.

**Vorbedingung:** Platform Foundation hat `tenant_branding` mit Status `draft` und Defaults erzeugt.

### Flow-Schritte

```
Schritt 1: Website-URL eingeben (optional)
├── URL eingegeben → Crawl starten (synchron, max 25s), weiter zu Schritt 2
└── Keine URL → Direkt zu Schritt 3 (manuell)

Schritt 2: Crawl-Ergebnis anzeigen
├── Crawl erfolgreich → AI-Vorschläge anzeigen, weiter zu Schritt 4 (Review)
└── Crawl fehlgeschlagen → Hinweis + weiter zu Schritt 3

Schritt 3: Manuelle Eingabe (Fallback / kein Website)
├── Logo hochladen (→ Asset-Pipeline)
├── Primärfarbe wählen (Color Picker)
├── Du/Sie wählen
├── Kontaktdaten: Adresse, Telefon, E-Mail (nötig für branding_complete)
└── Weiter zu Schritt 4

Schritt 4: Branding-Review
├── Live-Preview zeigt: Beispiel-Fahrzeugkarte, Beispiel-E-Mail
├── Händler kann jeden Wert anpassen
├── "Sieht gut aus" → Save-Pfad:
│   ├── Nach Crawl: applyCrawlResult (enthält alle Overrides)
│   └── Nach manuell: updateVisualIdentity + updateCommunicationIdentity + updateBusinessData
└── Weiter zu Schritt 5

Schritt 5: Fertig — Redirect zum Dashboard
└── Branding-Profil ist aktiv (mindestens branding_complete), alle Module nutzen es
```

**Onboarding-Ziel:** `branding_complete`. Nicht `publish_ready`. Impressum, Öffnungszeiten und andere publish-relevante Daten werden später in den Einstellungen vervollständigt. Das Onboarding soll schnell und motivierend sein — keine Formularhölle.

### UX-Prinzipien für den Onboarding-Flow

- **Progressiver Aufbau:** Jeder Schritt zeigt sofort visuelles Feedback. Kein leerer Screen.
- **Wartezeit nutzen:** Während des Crawls zeigt die UI eine animierte Vorschau die sich Stück für Stück mit echten Daten füllt (Logo erscheint, Farbe füllt sich ein, Name wird eingeblendet).
- **Smart Defaults:** Alles hat einen sinnvollen Default. Der Händler kann theoretisch jeden Schritt mit einem Klick bestätigen.
- **Mobile-First:** Der gesamte Flow funktioniert auf dem Handy. Color Picker ist touch-optimiert.

---

## 14. UI-Screens (Händler-Interface)

### 14.1 Onboarding-Screens

Unter Route-Group `(auth)` — Teil des Registrierungsflows.

| Screen | Route | Inhalt |
|--------|-------|--------|
| Website-URL | `/onboarding/branding` | URL-Eingabefeld, „Überspringen"-Option |
| Crawl-Fortschritt | `/onboarding/branding` (gleiche Seite, Loading-State) | Animierte Vorschau die sich füllt |
| Manuelle Eingabe | `/onboarding/branding` (Fallback-State) | Logo-Upload, Color Picker, Du/Sie, Kontaktdaten |
| Branding-Review | `/onboarding/branding/review` | Live-Preview mit Edit-Möglichkeit pro Feld |

### 14.2 Einstellungen-Screen

Unter Route-Group `(dashboard)`.

| Screen | Route | Inhalt |
|--------|-------|--------|
| Branding-Einstellungen | `/einstellungen/branding` | Alle Branding-Felder editierbar, Live-Preview, Completeness-Checkliste |

### 14.3 Komponenten

| Komponente | Zweck |
|------------|-------|
| `BrandingPreview` | Zeigt Mini-Preview (Fahrzeugkarte + Button) im aktuellen Branding |
| `ColorPicker` | Touch-optimierter Color Picker mit Hex-Eingabe |
| `LogoUploader` | Drag & Drop oder Kamera-Upload für Logo (→ Asset-Pipeline) |
| `ToneSelector` | 4 Tonalitäts-Optionen als Card-Auswahl mit Textbeispiel |
| `FormalityToggle` | Du/Sie Toggle mit Live-Preview der Anredeform |
| `FontPreview` | Zeigt Heading + Body Font als Textbeispiel |
| `CrawlProgressAnimation` | Animierte Vorschau während Website gecrawlt wird |
| `CompletenessChecklist` | Zeigt fehlende Felder für nächste Completeness-Stufe |

---

## 15. MVP-Scope vs. Phase 2

### MVP (Phase 1) — Wird gebaut

- [x] Onboarding-Flow mit synchronem Website-Crawl
- [x] AI-Analyse der gecrawlten Daten (Tonalität, Farben, Fonts)
- [x] Branding-Profil speichern und bearbeiten (typisierte Patch-Schemas)
- [x] Farbpaletten-Generierung aus Primärfarbe
- [x] Font-Pairing aus kuratierter, self-hosted Liste
- [x] Logo-Upload mit vollständiger Asset-Pipeline (Validierung → Storage → files)
- [x] Logo-Ingestion aus Crawl (Download → Validierung → Storage → files)
- [x] Live-Preview im Onboarding und Einstellungen
- [x] Public-Read-Route für Website-Branding (architekturkonform)
- [x] AI-Tools für Assistent (Lesen + schreibende PROPOSE-Tools)
- [x] CSS Custom Properties Generierung für Website Builder
- [x] Manuelle Eingabe als Fallback (kein Website → trotzdem Branding)
- [x] Completeness-Modell (draft → branding_complete → publish_ready)
- [x] Öffentliche Lese-Schnittstelle für andere Module (DNA-Service-Exports)

### Phase 2 — Nicht bauen bis beauftragt

- [ ] **DIS-Scoring (Design Intelligence Score):** Automatische Bewertung der Branding-Qualität
- [ ] **Kontinuierliche Optimierung:** AI überwacht Branding-Konsistenz über alle Outputs
- [ ] **Periodisches Re-Crawling:** Website regelmäßig crawlen, Änderungen vorschlagen
- [ ] **Deep-Crawl:** Unterseiten, Impressum, Team-Seite crawlen
- [ ] **JavaScript-Rendering:** Headless Browser für dynamische Websites
- [ ] **SVG-Logo-Support:** Mit dedizierter Sanitization (DOMPurify)
- [ ] **Mehrere Branding-Varianten:** A/B-Testing für Website
- [ ] **Marken-Styleguide-Export:** PDF-Export des Branding-Profils
- [ ] **Branding-Templates:** Vordefinierte Brandings als Startpunkt
- [ ] **Custom Font Upload:** Eigene Schriftarten hochladen
- [ ] **Erweiterte Impressum-Verwaltung:** Automatische rechtliche Prüfung
- [ ] **Social Media Branding:** Profilbilder, Header-Bilder automatisch generieren

---

## 16. Technische Abhängigkeiten

### Interne Abhängigkeiten

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Platform Foundation | Auth, Tenants, RLS | Tenant-Kontext, User-Authentifizierung, Default-Profil-Erstellung |
| Supabase Storage | File Storage | Logo-Upload, Favicon-Speicherung |
| `files`-Tabelle | File Storage (Architektur) | Metadaten für alle Branding-Assets |
| AI-Client (`shared/lib/ai.ts`) | AI-Integration | Claude API für Analyse und Textgenerierung |
| `tenants`-Tabelle | Basis-Schema | Händlername (`tenants.name`), Kompaktkopie (`tenants.branding`) |
| AI-Command-Service | AI-Integration (Architektur) | PROPOSE→CONFIRM-Flow für schreibende AI-Tools |

### Externe Abhängigkeiten

| Service | Zweck | Fallback |
|---------|-------|----------|
| Claude API (Anthropic) | Website-Analyse, Textgenerierung | Default-Werte, manueller Modus |

### Keine weiteren externen Abhängigkeiten

- Kein Google Fonts API (Fonts sind self-hosted)
- Kein Headless Browser (statischer HTML-Fetch reicht)
- Website-Crawl über dedizierten Service-Client (`server/services/website-crawler.ts`)

---

## 17. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 2.6 (White-Label by Default), Abschnitt 4 (Build-Reihenfolge) |
| `01_ARCHITECTURE.md` | Abschnitt 3 (Basis-Tabellen: `tenants`), Abschnitt 6 (AI-Aktionsprotokoll, System-Prompts), Abschnitt 7 (File Storage: `files`-Tabelle, Branding-Bucket), Abschnitt 8 (Service-Client-Regel), Abschnitt 10 (Public Delivery Model) |
| `MOD_11_WEBSITE_BUILDER.md` | Primärer Konsument des Branding-Profils, prüft `publish_ready` |
| `CROSS_ONBOARDING.md` | Onboarding-Flow aus Gesamtsicht, DNA-Engine ist Teilschritt |
| `CROSS_AI_AGENTS.md` | AI-Command-Service, System-Prompt-Baustein aus DNA-Daten |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 34 vollständig.
> Für technische Patterns (tRPC, RLS, Drizzle): siehe `01_ARCHITECTURE.md`.
> Für den Gesamtkontext: siehe `00_VISION.md`.
> Baue nur den MVP-Scope. Phase-2-Features sind dokumentiert aber nicht zu implementieren.
> Kein AI-Tool darf direkt mutieren — immer über aiCommandService.propose().
> Keine externen Asset-URLs in tenant_branding — immer Asset-Pipeline → files.
> Öffentliches Branding über Public-Read-Route, nicht über tRPC publicProcedure.
