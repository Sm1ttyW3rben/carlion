# Carlion — Technische Architektur

> Diese Datei definiert WIE gebaut wird.
> Sie wird in **jeder** Claude Code Session zusammen mit `00_VISION.md` geladen.
> Alle technischen Entscheidungen, Patterns und Regeln die modulübergreifend gelten.
>
> Letzte Aktualisierung: April 2026
> Status: Bestätigt

---

## 1. Tech Stack

| Bereich | Technologie | Zweck |
|---------|------------|-------|
| Framework | Next.js 15 (App Router) | Fullstack: UI + API in einer Codebase |
| Sprache | TypeScript (strict mode) | Durchgehend — kein JavaScript |
| UI Components | shadcn/ui + Radix Primitives | Zugängliche, anpassbare Komponenten |
| Styling | Tailwind CSS 4 | Utility-First, CSS-Variablen für White-Label Theming |
| Datenbank | Supabase (PostgreSQL 15) | DB + Auth + RLS + Storage + Realtime |
| ORM | Drizzle ORM | Type-safe Datenbankzugriff, SQL-nah |
| API | tRPC v11 | Type-safe API zwischen Frontend und Backend |
| AI | Claude API (Anthropic) | Alle AI-Funktionen: Assistent, Texte, Analyse |
| Hosting | Vercel (EU-Region) | Zero-Config Deployment für Next.js |
| E-Mail | Resend | Transaktionale E-Mails, gebrandet |
| WhatsApp | 360dialog | WhatsApp Business API (Phase 1: Inbox) |
| Zahlungen | Stripe | SaaS-Billing, Subscriptions |
| VIN-Dekodierung | DAT API | Fahrzeugdaten aus Fahrgestellnummer |
| Telefonie | Twilio | Voice-Modul (Phase 2) |
| e-Signatur | Skribble | Digitale Unterschriften (Phase 2) |

### Versionierung
- Node.js: 20 LTS
- pnpm als Package Manager (nicht npm, nicht yarn)
- Alle Dependencies: latest stable zum Projektstart, dann gelockt via pnpm-lock.yaml

---

## 2. Projekt-Struktur

### Ordnerstruktur

```
Carlion/
├── src/
│   ├── app/                         ← Next.js App Router (Seiten & Layouts)
│   │   ├── (auth)/                  ← Login, Register (öffentlich)
│   │   ├── (dashboard)/             ← Händler-Interface (geschützt)
│   │   │   ├── fahrzeuge/
│   │   │   ├── kontakte/
│   │   │   ├── verkauf/
│   │   │   ├── boersen/
│   │   │   ├── website/
│   │   │   ├── nachrichten/         ← WhatsApp Unified Inbox
│   │   │   └── einstellungen/
│   │   ├── (portal)/                ← Kundenportal (Phase 2)
│   │   └── api/
│   │       └── trpc/[trpc]/         ← tRPC API Handler
│   │
│   ├── modules/                     ← Feature-Module (Kernlogik)
│   │   ├── crm/
│   │   │   ├── api/
│   │   │   │   └── router.ts        ← tRPC Router
│   │   │   ├── components/          ← UI-Komponenten nur für CRM
│   │   │   ├── db/
│   │   │   │   ├── schema.ts        ← Drizzle Schema
│   │   │   │   └── queries.ts       ← Wiederverwendbare Queries
│   │   │   ├── domain/
│   │   │   │   ├── types.ts         ← TypeScript Types
│   │   │   │   ├── validators.ts    ← Zod Schemas
│   │   │   │   └── constants.ts
│   │   │   ├── hooks/               ← React Hooks
│   │   │   ├── services/
│   │   │   │   └── crm-service.ts   ← Business-Logik
│   │   │   ├── ai-tools.ts          ← Tools für AI-Assistent
│   │   │   └── index.ts             ← Öffentliche Exports
│   │   ├── inventory/
│   │   ├── sales/
│   │   ├── listings/
│   │   ├── website-builder/
│   │   ├── whatsapp/
│   │   └── dna-engine/
│   │
│   ├── shared/                      ← Modulübergreifender, fachlich neutraler Code
│   │   ├── components/              ← Layout, Navigation, AI-Panel
│   │   ├── hooks/                   ← useAuth, useTenant
│   │   ├── lib/                     ← Utilities
│   │   │   ├── supabase.ts          ← Supabase Client
│   │   │   ├── ai.ts               ← Claude API Client
│   │   │   └── utils.ts
│   │   ├── types/                   ← Globale Types (Tenant, User)
│   │   └── config/                  ← App-Konfiguration
│   │
│   └── server/                      ← Server-only Code
│       ├── db/
│       │   ├── index.ts             ← Drizzle Client
│       │   ├── config.ts            ← Drizzle Config
│       │   └── schema.ts            ← Aggregiert alle Modul-Schemas
│       ├── trpc/
│       │   ├── context.ts           ← Request Context (User, Tenant, DB)
│       │   ├── trpc.ts              ← Procedures (public, protected, role)
│       │   ├── root.ts              ← Root Router (aggregiert Module)
│       │   └── ai-tools.ts          ← Aggregiert alle Modul AI-Tools
│       └── services/                ← Externe Service-Clients
│           ├── resend.ts
│           ├── stripe.ts
│           ├── dat.ts
│           └── threesixty.ts        ← 360dialog
│
├── supabase/
│   ├── migrations/                  ← SQL Migrations (RLS Policies etc.)
│   └── seed.ts                      ← Demo-Daten für Entwicklung
│
├── docs/                            ← Spezifikations-Dateien
│   ├── 00_VISION.md
│   ├── 01_ARCHITECTURE.md
│   └── modules/
│       ├── MOD_01_CRM.md
│       └── ...
│
├── CLAUDE.md                        ← Root Claude Code Anweisungen
└── package.json
```

### Namenskonventionen

| Was | Konvention | Beispiel |
|-----|-----------|---------|
| Ordner | kebab-case | website-builder, dna-engine |
| Alle Dateien | kebab-case | vehicle-card.tsx, crm-service.ts |
| DB-Tabellen | snake_case | vehicle_listings, crm_contacts |
| DB-Spalten | snake_case | tenant_id, created_at |
| TypeScript Types | PascalCase | Vehicle, CrmContact, DealStage |
| tRPC Router | camelCase | vehicle.create, crm.getContactById |
| Env Variables | SCREAMING_SNAKE | SUPABASE_URL, ANTHROPIC_API_KEY |

### Modulgrenze-Regel (unveränderlich)

Module dürfen nicht direkt auf interne Dateien anderer Module zugreifen. Kommunikation zwischen Modulen nur über:
- Öffentliche Exports (`index.ts`)
- Gemeinsame Basistypen in `shared/`
- tRPC API-Aufrufe

```
// ✅ erlaubt
import { createContact } from "@/modules/crm"

// ❌ nicht erlaubt
import { internalMapper } from "@/modules/crm/services/internal-mapper"
```

### shared/ Regel

Etwas darf nur in `shared/` wenn es mindestens 2–3 Module nutzen UND es fachlich neutral ist. Sobald etwas fachlich klingt (CRM-Helfer, Fahrzeug-Mapping), gehört es ins Modul.

### Routing (Phase 1)

- Deutsche URLs für das Händler-Interface: /fahrzeuge, /kontakte, /verkauf
- Englische Pfade für API: /api/trpc/[trpc]
- Route Groups für Auth-Scoping: (auth), (dashboard), (portal)
- Trennung: Code = Englisch, URL = Deutsch

Wenn Internationalisierung kommt (Phase 3), werden URLs über Route-Keys + Locale-Mapping abstrahiert. Bis dahin: deutsche URLs direkt im App Router.

---

## 3. Datenbank & Multi-Tenancy

### Grundregeln (unveränderlich)

1. Jede tenant-spezifische Geschäftstabelle enthält `tenant_id`. Globale Referenz- und Systemtabellen (Fahrzeugmarken, Länder, Plan-Definitionen) sind explizit ausgenommen.

2. Jeder reguläre Anwendungszugriff auf tenant-spezifische Daten wird durch Row-Level Security (RLS) erzwungen. Zusätzliche Rechte innerhalb eines Tenants werden über Rollen geregelt.

3. Es gibt keinen regulären Anwendungspfad der Tenant-Isolation umgeht. Privilegierte Systemzugriffe (Migrationen, Service-Role, interne Wartung) sind separat, strikt eingeschränkt und niemals Teil normaler Tenant-Requests.

### Tenant-Hierarchie

```
Plattform (= Supabase-Instanz)
  └── Organisation (Gruppe)    ← optional, Phase 2
        └── Tenant (Standort)  ← immer vorhanden
              └── User
```

Phase 1: Nur Tenant + User. Kein Organisation-Layer.
`org_id` wird im Schema angelegt aber nullable gelassen — Phase 2 braucht keinen DB-Umbau.

### RLS-Pattern

Jede tenant-spezifische Tabelle bekommt dieses Policy-Muster:

```sql
-- Lesen: nur eigener Tenant
CREATE POLICY "tenant_isolation_select" ON [tabelle]
  FOR SELECT
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Schreiben: nur eigener Tenant
CREATE POLICY "tenant_isolation_insert" ON [tabelle]
  FOR INSERT
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Update: nur eigener Tenant
CREATE POLICY "tenant_isolation_update" ON [tabelle]
  FOR UPDATE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Delete: nur eigener Tenant
CREATE POLICY "tenant_isolation_delete" ON [tabelle]
  FOR DELETE
  USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
```

### Service Role Regeln

- Supabase Service Role Key umgeht RLS bewusst
- Darf **niemals** im Client (Browser) verwendet werden
- Nur in klar begrenzten Backend-Kontexten: Migrationen, Seed-Daten, System-Jobs
- Keine normalen Request-Handler dürfen Service Role nutzen
- `SUPABASE_SERVICE_ROLE_KEY` nur in serverseitigen Environment Variables

### RLS-Durchleitung mit Drizzle (kritisch)

Das ist die wichtigste technische Entscheidung der gesamten Architektur. RLS-Policies greifen nur wenn die DB-Session die JWT-Claims kennt. Es gibt zwei Wege:

**Option A: Supabase Client mit User-JWT (empfohlen für Phase 1)**
```
// Für jeden Request: Supabase Client mit dem User-JWT initialisieren
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${userJWT}` } }
});
```
Drizzle verbindet sich über diesen authentifizierten Client. RLS greift automatisch weil die DB-Session den User kennt.

**Option B: SET LOCAL pro Transaktion**
```sql
-- Am Anfang jeder DB-Transaktion:
SET LOCAL request.jwt.claims = '{"tenant_id": "..."}';
```
Funktioniert mit direkter Drizzle-PostgreSQL-Verbindung, erfordert aber manuelle Claim-Injection in jeder Transaktion.

**Entscheidung: Option A.** Supabase Client als Datenbankzugriff für alle regulären Requests. Drizzle wird über den Supabase-Client-Adapter betrieben, nicht über eine separate PostgreSQL-Direktverbindung. Das garantiert dass RLS bei jedem regulären Datenzugriff greift.

**Validierung (vor dem ersten Modul):**
Ein technischer Spike muss beweisen:
1. Drizzle + Supabase Client mit User-JWT → RLS filtert korrekt
2. Tenant A sieht keine Daten von Tenant B
3. Service Role Zugriff (für System-Jobs) funktioniert separat
4. Performance ist akzeptabel (<50ms Overhead pro Query)

Dieser Spike ist **Blocker** für den Modulbau. Ohne bewiesene RLS-Durchleitung wird kein Modul-Code geschrieben.

### Basis-Tabellen (existieren vor jedem Modul)

```
tenants:
  id                uuid, primary key
  name              text, not null
  slug              text, unique
  org_id            uuid, nullable (Phase 2)
  plan              enum: free | trial | starter | professional
  status            enum: active | trial | suspended | cancelled
  branding          jsonb (Logo-URL, Farben, Domain — aus DNA-Engine)
  settings          jsonb (Sprache, Zeitzone, Währung)
  created_at        timestamptz, default now()
  updated_at        timestamptz
  trial_ends_at     timestamptz, nullable

users:
  id                uuid, primary key (= Supabase Auth User ID)
  tenant_id         uuid, foreign key → tenants
  email             text, not null
  name              text
  role              enum: owner | admin | manager | salesperson |
                          mechanic | receptionist | viewer
  settings          jsonb (Notification-Präferenzen)
  created_at        timestamptz, default now()
  updated_at        timestamptz
  last_login_at     timestamptz

ai_event_log:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants
  user_id           uuid, nullable (null = System/AI autonom)
  module            text (crm, inventory, sales, ...)
  action            text (create_contact, update_vehicle, ...)
  summary           text (kurze Beschreibung, kein PII)
  status            enum: success | failed | pending | rolled_back
  rollback_data     jsonb, nullable (Snapshot für Undo)
  token_usage       integer, nullable (AI Token-Verbrauch)
  duration_ms       integer, nullable
  created_at        timestamptz, default now()

  Regeln:
    - input/result werden NICHT gespeichert (PII-Risiko)
    - Stattdessen: summary als anonymisierte Kurzbeschreibung
    - Retention: 12 Monate, danach automatisch gelöscht

audit_log:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants
  actor_id          uuid, nullable (null wenn actor_type = system; 
                    bei actor_type = ai: user_id der die AI ausgelöst hat,
                    bei actor_type = user: der handelnde User)
  actor_type        enum: user | ai | system
  action            text (login, role_change, data_delete, ...)
  resource_type     text (tenant, user, vehicle, ...)
  resource_id       uuid
  ip_address        text, nullable
  created_at        timestamptz, default now()

  Regeln:
    - Append-only, niemals ändern oder löschen
    - Retention: 7 Jahre (gesetzliche Aufbewahrungspflicht)
    - Getrennt von ai_event_log (andere Anforderungen)
```

### User-Tenant-Zuordnung

Phase 1: Ein User gehört zu genau einem Tenant (`users.tenant_id`).
Phase 2: Erweiterung auf `user_tenants` Join-Tabelle für Multi-Tenant-Zugehörigkeit (Mitarbeiter arbeitet an mehreren Standorten, Gruppenleitung). JWT-Claims und Session-Logik müssen dann angepasst werden.

### Index-Strategie

Jede tenant-spezifische Tabelle braucht mindestens:
- Index auf `tenant_id`
- Composite Index auf häufige Filter: `(tenant_id, created_at)`, `(tenant_id, status)`
- Weitere Composite Indexes je nach Modul-Queries

### Drizzle-Konventionen

- Jede Modul-Schema-Datei exportiert ihre Tabellen
- `server/db/schema.ts` aggregiert alle Modul-Schemas
- Relationen werden explizit definiert (Drizzle relations API)
- Timestamps: `created_at` und `updated_at` auf jeder Tabelle
- Soft Delete: `deleted_at` (nullable timestamptz) auf fachlichen Primärdaten (Kontakte, Fahrzeuge, Deals). Nicht auf: Event Logs, Audit Logs, Join-Tabellen, technische Tabellen
- UUIDs als Primary Keys (nicht auto-increment integers)
- Migrationen: Drizzle Kit für Schema, `supabase/migrations/` für RLS-Policies (Drizzle kennt kein RLS)

### Seed-Daten

`supabase/seed.ts` erstellt:
- 2 Demo-Tenants (für Cross-Tenant-Isolationstests)
- Tenant A: 20 Fahrzeuge, 50 Kontakte, 10 Deals, 1 Owner + 2 Mitarbeiter
- Tenant B: 5 Fahrzeuge, 10 Kontakte, 3 Deals, 1 Owner
- Realistische deutsche Daten (Namen, Adressen, Fahrzeugmodelle)

---

## 4. Authentication & Authorization

### Auth-Provider: Supabase Auth

Supabase Auth verwaltet alle User-Identitäten. Kein eigenes Auth-System.

### Auth-Flows (Phase 1)

**Händler-Registrierung:**
1. E-Mail + Passwort + Autohaus-Name + PLZ
2. Supabase erstellt User
3. Backend erstellt Tenant + verknüpft User als owner
4. Redirect zum Onboarding (DNA-Engine)
5. Kein Kreditkarte, kein Plan-Auswahl → 30-Tage-Trial automatisch

**Händler-Login:**
1. E-Mail + Passwort
2. Supabase Auth gibt JWT zurück
3. JWT enthält Custom Claims: tenant_id, role
4. Frontend speichert Session, Supabase Client refresht automatisch

**Team-Mitglied einladen:**
1. Owner/Admin gibt E-Mail ein
2. System generiert Einladungs-Token (enthält tenant_id + zugewiesene Rolle)
3. Mitglied klickt Link, setzt Passwort
4. Backend verknüpft User mit dem Tenant aus dem Token
5. Einladung ist an genau einen Tenant gebunden — kein falscher Tenant möglich

### JWT Custom Claims

```
{
  sub: "user-uuid",
  tenant_id: "tenant-uuid",
  role: "salesperson",
  org_id: null                ← Phase 2
}
```

Gesetzt über Supabase Auth Hook (Database Function bei Token-Refresh).

**Wichtig:** JWT Claims sind eine performante Kopie, nicht die Quelle der Wahrheit. Die Datenbank ist die Quelle. Bei sicherheitskritischen Operationen (Billing, User-Management, Tenant-Einstellungen) erfolgt eine zusätzliche serverseitige Validierung gegen die DB.

### Token-Konfiguration

- Access Token Expiry: 15 Minuten
- Refresh Token Expiry: 7 Tage
- Refresh Token Rotation: ja
- Session-Verwaltung: Supabase Auth Client (automatisch)

### Session-Regeln

- Bei Logout: Session sofort invalidieren
- Bei Rollenänderung: Token Refresh erzwingen (neuer JWT mit aktueller Rolle)
- Bei Tenant suspended/cancelled: Zugriff blockieren, User auf Info-Seite leiten
- Bei User gesperrt: Session sofort beenden

### Rollen & Berechtigungen

Phase 1: RLS sichert Tenant-Isolation. Rollen-Checks auf Anwendungsebene via tRPC Middleware. Bei kritischen Operationen kann zusätzlich RLS-basierte Autorisierung ergänzt werden.

| Rolle | Beschreibung | Kann |
|-------|-------------|------|
| owner | Inhaber, erstellt bei Registrierung | Alles inkl. Billing und Tenant-Einstellungen |
| admin | Vom Owner ernannt | Alles außer Billing und Tenant-Löschung |
| manager | Teamleiter | Alle Module, sieht Team-Daten |
| salesperson | Verkäufer | CRM, Inventar, Verkauf — kein Billing |
| mechanic | Werkstatt-Mitarbeiter | Nur Werkstatt-Modul (Phase 2) |
| receptionist | Empfang | CRM lesen, Termine — keine Preise/Margen |
| viewer | Nur Lesezugriff | Nur lesen, kein Schreibzugriff |

Das Rollenmodell ist bewusst einfach gehalten. Erweiterung zu granularem Permission-/Capability-System in Phase 2 möglich.

### tRPC Auth Middleware

Definiert in `server/trpc/trpc.ts`:

```
publicProcedure      → kein Login nötig (Registrierung, Public API)
protectedProcedure   → User eingeloggt, tenant_id + role im Context
roleProcedure(roles) → User eingeloggt + role muss in roles-Array sein
```

Beispiel:
```
const ownerProcedure = roleProcedure(["owner"]);
const managerProcedure = roleProcedure(["owner", "admin", "manager"]);
```

### Auth-Sicherheit

- Rate Limiting auf Login-Endpunkte (Supabase built-in + ggf. eigenes Limiting)
- Einladungs-Tokens: einmalig verwendbar, 7 Tage gültig, tenant-gebunden
- Service Role Key: nur serverseitig, nie im Client (siehe Abschnitt 3)

### Was NICHT gebaut wird in Phase 1

- Kein OAuth/Social Login
- Kein SSO/SAML (Phase 3, Enterprise)
- Kein Magic Link Login für Händler (nur Kundenportal Phase 2)
- Keine Zwei-Faktor-Authentifizierung (Phase 2)
- Kein Multi-Tenant-User (Phase 2 über user_tenants Join-Tabelle)

---

## 5. API-Patterns (tRPC)

### Router-Struktur

Jedes Modul hat genau einen tRPC Router in `modules/<modul>/api/router.ts`. Alle Modul-Router werden in `server/trpc/root.ts` zusammengeführt:

```
export const appRouter = createRouter({
  crm: crmRouter,
  inventory: inventoryRouter,
  sales: salesRouter,
  listings: listingsRouter,
  website: websiteRouter,
  whatsapp: whatsappRouter,
  dna: dnaRouter,
  assistant: assistantRouter,
});
```

### Procedure-Typen

Definiert in `server/trpc/trpc.ts`:

```
publicProcedure      → kein Login nötig
protectedProcedure   → eingeloggt, ctx enthält userId, tenantId, role
roleProcedure(roles) → eingeloggt + role muss matchen
```

Jede Procedure hat automatisch Zugriff auf:
- `ctx.userId` — aus JWT
- `ctx.tenantId` — aus JWT
- `ctx.role` — aus JWT
- `ctx.db` — Drizzle Client

**Wichtig:** Tenant-Isolation wird primär durch RLS erzwungen. Router und Services müssen trotzdem tenant-sicher implementiert werden — RLS ist eine zusätzliche Schutzschicht, kein Freifahrtschein für unsaubere Queries.

### Naming-Konvention

```
[modul].[aktion]

Standard-Verben:
  .list              → Collection laden (mit Filter/Pagination)
  .getById           → Einzelne Ressource
  .create            → Anlegen
  .update            → Aktualisieren
  .archive           → Soft Delete

Spezifische Aktionen:
  .moveToStage       → Deal in Pipeline verschieben
  .assignOwner       → Zuständigen Mitarbeiter zuweisen
  .publishListing    → Inserat veröffentlichen

Regeln:
  - Konsistent pro Modul (immer .getById, nicht mal .get mal .getById)
  - Keine generischen Namen (handleData, processItem)
```

### Input-Validierung

Jede Procedure validiert Input mit Zod. Schemas liegen im Modul unter `domain/validators.ts` und werden zwischen Router und Frontend geteilt.

```
inventory.create = protectedProcedure
  .input(createVehicleSchema)
  .mutation(async ({ ctx, input }) => {
    return inventoryService.create(input, ctx);
  });
```

### Service-Layer

Router enthält Orchestrierung, Auth und Input-Validation. Geschäftslogik liegt in Modul-Services (`services/`), nicht direkt im Router. Router-Dateien bleiben schlank.

### Pagination

Cursor-based auf allen list-Endpoints:

```
Input:  { cursor?: string, limit?: number (default: 20, max: 100) }
Output: { items: T[], nextCursor: string | null }
```

Kein Offset-Pagination. Deterministische Sortierung Pflicht: `created_at DESC, id DESC`.

### Error-Handling

Procedures geben direkt den fachlichen Rückgabewert zurück. Fehler werden über `TRPCError` geworfen. Kein manuelles `{ data, error }` Envelope.

```
NOT_FOUND           → Ressource nicht gefunden (oder nicht im Tenant —
                      niemals verraten dass sie in anderem Tenant existiert)
BAD_REQUEST         → Input-Validierung fehlgeschlagen
UNAUTHORIZED        → Nicht eingeloggt
FORBIDDEN           → Eingeloggt aber falsche Rolle
CONFLICT            → Duplikat oder State-Konflikt
INTERNAL_SERVER_ERROR → Unerwarteter Fehler
```

Fehler-Codes sind stabil und englisch. User-facing Texte werden im Frontend oder einer Error-Mapping-Schicht lokalisiert.

### Externe API Calls

Alle externen Services werden über Service-Clients in `server/services/` angesprochen. Modul-Services dürfen diese Clients verwenden, rufen aber nie direkt `fetch` oder fremde SDKs auf.

Kritische externe oder finanzrelevante Mutations müssen idempotent entworfen werden (Börsen-Sync, WhatsApp senden, Stripe Billing).

---

## 6. AI-Integration

### AI-Provider: Claude API (Anthropic)

Alle AI-Funktionen laufen über die Claude API. Kein anderer Provider, kein eigenes Modell, kein lokales ML.

### Modell-Strategie

- Standard: `claude-sonnet-4-20250514` (schnell, günstig, 90% der Aufgaben)
- Komplex: `claude-opus-4-20250514` (nur für komplexe Analysen, BI Reports)
- Entscheidung pro Use Case, nicht pro Modul

### AI-Client

Zentraler Client in `shared/lib/ai.ts`:
- Anthropic SDK
- Tenant-Context wird automatisch injiziert (tenant_id, branding, settings)
- Kein Modul importiert die Anthropic SDK direkt
- Jeder AI-Call loggt: Modul, Action, Token-Verbrauch, Dauer

### System-Prompt-Architektur

Jeder AI-Call hat einen System-Prompt aus Bausteinen:

```
1. Basis-Rolle (gleich für alle):
   "Du bist der AI-Assistent von {tenant.name}."

2. Tenant-Kontext (dynamisch aus DB):
   Branding: {dna.communication_tone}
   Sprache: {tenant.settings.language}
   Anrede: {dna.voice.formality} (Du/Sie)

3. Modul-Kontext (je nach Aufgabe):
   CRM: aktuelle Kontaktdaten, letzte Interaktionen
   Inventory: Fahrzeugdetails, Marktpreise

4. Aufgaben-Instruktion:
   Was genau soll die AI tun?

5. Output-Format:
   Strukturiertes JSON wenn maschinell weiterverarbeitet.
   Natürliche Sprache wenn User-facing.
```

### AI-Assistent (Persistentes Chat-Panel)

Der AI-Assistent ist das zentrale Interface (siehe `00_VISION.md`).

**Frontend:**
- Persistentes Panel (Sidebar Desktop / Bottom Sheet Mobile)
- Erreichbar von jedem Screen via Button
- Chat-Verlauf pro User pro Session
- Streaming-Response (Token für Token anzeigen)

**Backend:**
- Eigener tRPC Router: `assistant.sendMessage`
- Context enthält: aktueller Screen, ausgewähltes Objekt, User-Rolle
- AI entscheidet welches Modul-Tool aufgerufen wird

**Tool-System:**
- AI-Assistent hat Zugriff auf Modul-Tools
- Tools sind Funktionen die der AI-Agent aufrufen kann
- Alle Modul-Tools werden in `server/trpc/ai-tools.ts` aggregiert

### Tool-Definition Pattern

Jedes Modul exponiert Tools in `modules/<modul>/ai-tools.ts`:

```
export const inventoryTools = [
  {
    name: "list_vehicles",
    description: "Alle Fahrzeuge des Händlers auflisten",
    parameters: { status?: "available" | "sold", limit?: number },
    execute: (params, ctx) => inventoryService.list(params, ctx)
  },
];
```

### AI-Aktionsprotokoll (Phase 1: Stufe 1 — Assistent)

Jede schreibende AI-Aktion durchläuft diesen Flow. Keine Ausnahme.

```
1. PROPOSE  → AI erkennt Absicht und schlägt Aktion vor
               "Soll ich den BMW 320d auf 'Verkauft' setzen?"

2. PREVIEW  → AI zeigt was sich ändern würde (Dry Run)
               Zeigt: betroffene Daten, erwartetes Ergebnis
               Keine DB-Änderung in diesem Schritt

3. CONFIRM  → User bestätigt explizit (Button-Klick, nicht Chat)
               Confirm-Token wird generiert (einmalig, 5 Min gültig)
               Ohne Bestätigung: keine Ausführung

4. EXECUTE  → Aktion wird ausgeführt mit Confirm-Token
               Rollback-Snapshot wird VOR der Änderung geschrieben
               Änderung wird durchgeführt
               AI-Event-Log-Eintrag wird geschrieben

5. RESULT   → User sieht Ergebnis + Undo-Button
               "BMW 320d ist jetzt als verkauft markiert. 
                Inserate auf mobile.de deaktiviert. [Rückgängig]"

6. UNDO     → Optional: User klickt Rückgängig
               Rollback-Snapshot wird angewendet
               Externe Seiteneffekte: best-effort Compensation
               (z.B. Inserat reaktivieren, aber gesendete E-Mail 
               kann nicht zurückgeholt werden)
```

**Technische Umsetzung:**
```
ai_action_commands:
  id                uuid, primary key
  tenant_id         uuid
  user_id           uuid
  assistant_message_id  uuid (Bezug zur Chat-Nachricht)
  action_type       text (update_vehicle_status, create_offer, ...)
  target_module     text (inventory, crm, sales, ...)
  proposed_changes  jsonb (was soll sich ändern — Preview-Daten)
  confirm_token     text, unique, nullable
  confirm_expires   timestamptz, nullable
  status            enum: proposed | confirmed | executed | 
                          rolled_back | expired | cancelled
  rollback_data     jsonb, nullable (Snapshot VOR Ausführung)
  external_effects  jsonb, nullable (gesendete E-Mails, Börsen-Updates)
  executed_at       timestamptz, nullable
  created_at        timestamptz
```

**Rollback-Regeln:**
- Interne DB-Änderungen: vollständig reversibel über Snapshot
- Externe Seiteneffekte (E-Mail gesendet, WhatsApp gesendet, Börsen-Inserat aktualisiert): best-effort Compensation, kein garantiertes Undo
- User wird informiert welche Teile rückgängig gemacht werden können und welche nicht
- Rollback-Daten Retention: 30 Tage, dann gelöscht
- PII in Rollback-Daten: verschlüsselt gespeichert (AES-256), Zugriff nur durch den Tenant-Owner

**Rein lesende Aktionen (Queries, Zusammenfassungen, Analysen) brauchen kein Confirm — sie verändern keine Daten.**

### AI-Grenzen (technisch erzwungen)

- AI sieht nur Daten des eigenen Tenants (tenant_id im Context)
- AI-Outputs werden nie für Modell-Training genutzt
- Kein PII in Logs (AI Event Log speichert summary, nicht Input/Output)
- Bei Unsicherheit: AI fragt nach statt zu handeln
- Halluzinations-Prävention: Fahrzeugdaten, Preise, rechtliche Aussagen immer aus DB, nie aus AI-Training

### Token-Budget

| Use Case | Max Input | Max Output |
|----------|-----------|------------|
| AI-Assistent Chat | 8.000 | 512 |
| Fahrzeugbeschreibung | 4.000 | 2.000 |
| Lead-Zusammenfassung | 4.000 | 512 |
| Business-Analyse | 12.000 | 4.000 |

Context-Komprimierung: wenn Kontext >60% des Budgets belegt, werden älteste Einträge zusammengefasst statt entfernt.

### MVP-Scope

Phase 1: AI-Assistent (Chat-Panel) mit Tool-Zugriff, AI-Fahrzeugbeschreibungen, AI-Website-Texte, AI-Branding im Onboarding.
Phase 2: AI-WhatsApp-Antworten, AI-Tages-Briefing, AI-Preisempfehlung, AI-Lead-Scoring.

---

## 7. File Storage

### Provider: Supabase Storage

Alle Dateien in Supabase Storage (S3-kompatibel, EU-Region).

### Bucket-Struktur

```
vehicles/           → Fahrzeugfotos (Originale, privat)
  {tenant_id}/{vehicle_id}/{asset_id}.{ext}

vehicles-public/    → Veröffentlichte Derivate (WebP, Thumbnails)
  {tenant_id}/{vehicle_id}/{asset_id}-{size}.webp

documents/          → Kaufverträge, PDFs, Rechnungen (immer privat)
  {tenant_id}/{document_id}/{asset_id}.{ext}

branding/           → Logo, Favicon
  {tenant_id}/logo.{ext}
  {tenant_id}/favicon.{ext}
```

### Zugriffs-Regeln

- Originale Uploads (`vehicles/`, `documents/`): immer privat, Zugriff nur über signed URLs
- Veröffentlichte Derivate (`vehicles-public/`): öffentlich lesbar, aber nur für aktive Listings. Wird Fahrzeug deaktiviert → Derivate gelöscht
- Branding-Assets: öffentlich lesbar (werden in Website, E-Mails etc. eingebettet)
- RLS auf Storage: Tenant-Isolation über Pfad-basierte Policies (`tenant_id` im Pfad)

### DB-Metadaten (Pflicht)

Storage allein reicht nicht. Jede Datei hat einen Eintrag in einer DB-Tabelle:

```
files:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants
  entity_type       text (vehicle, document, branding)
  entity_id         uuid (vehicle_id, document_id etc.)
  storage_path      text (Pfad in Supabase Storage)
  original_name     text (Original-Dateiname vom Upload)
  mime_type         text
  size_bytes        integer
  width             integer, nullable (nur Bilder)
  height            integer, nullable
  kind              text (photo, thumbnail, contract, logo)
  position          integer, nullable (Reihenfolge bei Fahrzeugfotos)
  is_public         boolean, default false
  alt_text          text, nullable (AI-generiert für Fahrzeugfotos)
  processing_status enum: pending | processed | failed
  created_at        timestamptz
  deleted_at        timestamptz, nullable
```

### Datei-Validierung (serverseitig)

- Max. 10 MB pro Bild, 20 MB pro Dokument
- Erlaubte Formate Bilder: JPEG, PNG, WebP
- Erlaubte Formate Dokumente: PDF
- MIME-Type serverseitig prüfen (Extension nicht vertrauen)
- Dateinamen werden durch UUID ersetzt (keine User-kontrollierten Pfade)

### Bild-Verarbeitung

- Automatische Konvertierung zu WebP für Website
- Thumbnail-Generierung: 200x150 (Liste), 800x600 (Detail)
- Verarbeitung: Supabase Edge Function oder Next.js Image Optimization
- Originale bleiben unverändert erhalten

### MVP-Scope

Phase 1: Fahrzeugfotos (manueller Upload) + Branding-Assets (Logo, Favicon)
Phase 2: Dokumente (Verträge, PDFs) + Fotodienst-Integration

---

## 8. Externe Services — Integrations-Pattern

### Grundregel

Externe APIs werden ausschließlich über dedizierte Service-Clients in `server/services/` angesprochen. Modul-Services dürfen diese Clients verwenden, rufen aber nie direkt `fetch` oder fremde SDKs auf.

### Client-Struktur

Jeder Client in `server/services/` hat:
- Konfiguration aus Environment Variables
- Typisierte Request/Response (Zod-validiert)
- Error-Transformation (externer Fehler → interner Error Code)
- Timeout (Default: 10 Sekunden)
- Logging (Request-Dauer, Status, keine sensiblen Payloads)
- Retry nur wenn idempotent und sicher

### Queue / Outbox-Pattern

Für asynchrone oder fehlbare externe Calls:

```
outbox:
  id                uuid, primary key
  tenant_id         uuid
  service           text (resend, threesixty, dat)
  action            text (send_email, send_whatsapp)
  payload           jsonb
  status            enum: pending | processing | sent | failed
  attempts          integer, default 0
  max_attempts      integer, default 3
  next_attempt_at   timestamptz
  created_at        timestamptz
  processed_at      timestamptz, nullable
  error_message     text, nullable
```

Wann Outbox verwenden:
- **Automatisierte** E-Mails (Flows, Trigger) → Outbox
- **Automatisierte** WhatsApp (Erinnerungen, Follow-ups) → Outbox
- Börsen-Sync (mobile.de, AutoScout24) → Outbox
- Stripe → direkt (synchron, blockierend bei Fehler)
- DAT VIN-Decode → direkt (synchron, Fallback auf manuell)

Wann **sofort senden** (kein Outbox):
- **User-getriggerte** WhatsApp-Nachricht (Händler klickt "Senden") → direkter API-Call an 360dialog, kein Cron-Delay. Bei Fehler: Outbox als Fallback für Retry.
- **User-getriggerte** E-Mail (Händler sendet Angebot) → direkter API-Call an Resend. Bei Fehler: Outbox als Fallback.

**Regel:** Wenn ein Mensch auf "Senden" klickt, darf die Nachricht nicht in einer Queue warten. Sofort senden, Outbox nur als Retry-Mechanismus bei Fehler.

### Worker-Runtime (Outbox-Verarbeitung)

Die Outbox verarbeitet automatisierte Sends, Retries und Bulk-Operationen.

**Phase 1: Vercel Cron Jobs**
```
vercel.json:
  crons:
    - path: "/api/jobs/process-outbox"
      schedule: "* * * * *"          ← jede Minute
    - path: "/api/jobs/cleanup"
      schedule: "0 3 * * *"          ← täglich 03:00
```

Ablauf pro Cron-Run:
1. Lese alle Outbox-Einträge mit `status: pending` und `next_attempt_at <= now()`
2. Verarbeite jeden Eintrag (sende E-Mail, WhatsApp, Sync)
3. Bei Erfolg: `status: sent`, `processed_at: now()`
4. Bei Fehler: `attempts++`, `next_attempt_at: now() + backoff`, `error_message`
5. Bei `attempts >= max_attempts`: `status: failed` → Alert an Tenant-Owner

**Backoff-Strategie:** Exponentiell — 1 Min, 5 Min, 30 Min.

**Dead Letter:** Einträge mit `status: failed` bleiben in der Tabelle. Händler sieht im Dashboard "2 Nachrichten konnten nicht gesendet werden" mit Retry-Button.

**Idempotency:** Jeder Outbox-Eintrag hat eine UUID. Service-Clients nutzen diese als Idempotency-Key bei externen APIs um Doppel-Sends zu verhindern.

**Phase 2 (bei Skalierung):** Migration auf inngest.com oder Trigger.dev für komplexere Job-Orchestrierung.

### Webhook-Handling

Eingehende Webhooks:

```
app/api/webhooks/
  stripe/route.ts       ← Billing Events (Phase 1)
  threesixty/route.ts   ← WhatsApp Inbound Nachrichten (Phase 1)
```

Regeln für alle Webhooks:
- Signatur-Validierung Pflicht (jeder Provider hat eigenes Secret)
- Idempotente Verarbeitung (Event-ID speichern, Duplikate ignorieren)
- Webhook-Events werden in `webhook_log` Tabelle gespeichert
- Verarbeitung ist asynchron: Webhook speichert Event, Worker verarbeitet
- Bei Fehler: Retry durch den Provider (Stripe/360dialog retrien automatisch)

**WhatsApp Inbound (360dialog Webhook):**
1. Webhook empfängt Nachricht
2. Signatur validieren
3. Absender-Nummer → CRM-Kontakt suchen (oder neuen anlegen)
4. Nachricht in `messages` Tabelle speichern (tenant_id aus Kontakt)
5. Supabase Realtime → Frontend zeigt Nachricht sofort in Unified Inbox
6. Wenn kein Kontakt gefunden: als "Unbekannt" anlegen, Händler benachrichtigen

### Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=              ← nur serverseitig!

# AI
ANTHROPIC_API_KEY=

# E-Mail
RESEND_API_KEY=

# WhatsApp
THREESIXTY_API_KEY=
THREESIXTY_PARTNER_ID=

# Zahlungen
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=

# VIN
DAT_API_KEY=
DAT_API_URL=
```

**Env-Validation:** Beim App-Start werden alle Environment Variables mit Zod validiert. App startet nicht wenn eine Variable fehlt oder falsch formatiert ist.

### Fehlerbehandlung bei externen Services

| Service | Nicht erreichbar → |
|---------|-------------------|
| DAT (VIN) | Fahrzeug kann manuell angelegt werden, VIN-Dekodierung wird über Outbox nachgeholt |
| 360dialog | WhatsApp-Nachrichten werden in Outbox gequeued |
| Resend | E-Mails werden in Outbox gequeued |
| Stripe | Billing-Aktionen blockiert mit User-Hinweis |

Keine stillen Fehler. User wird immer informiert wenn ein externer Service ein Feature einschränkt.

### MVP-Scope

Phase 1: Anthropic (AI), Resend (E-Mail), 360dialog (WhatsApp), Stripe (Billing), DAT (VIN)
Phase 2: Twilio (Voice), Skribble (e-Signatur), Google APIs

---

## 9. Coding-Konventionen

### TypeScript

- `strict: true` (keine Ausnahmen)
- `any` vermeiden. Wenn unvermeidbar: lokal kapseln und begründen
- Zod für alle externen Inputs (API, Forms, External Services)
- `type` und `interface` bewusst nach Anwendungsfall — keine dogmatische Bevorzugung
- Für Zod-inferte Typen: immer `type` (natürlicher)
- Exhaustive switch-case: `never`-Check bei Discriminated Unions und Enums

### Testing

- Framework: Vitest
- Unit Tests für: Services, Validators, Utils
- Integration Tests für: tRPC Router (mit Test-DB)
- E2E Tests für: Login, Registrierung, Fahrzeug anlegen (kritische Flows)
- **Kritischer Test:** "Tenant A sieht nie Daten von Tenant B" — dieser Test existiert für jede tenant-spezifische Ressource und jeden kritischen Datenzugriff
- Seed-Daten: 2 Demo-Tenants damit Cross-Tenant-Tests möglich sind

### Git-Konventionen

- Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Branch-Naming: `feat/mod01-contact-list`, `fix/rls-policy-vehicles`
- Sprache: Englisch (Commits, PRs, Code-Kommentare)
- Kein Force-Push auf main

### Error-Handling

- Nie try/catch ohne sinnvolle Fehlerbehandlung
- Externe Fehler → interne Error Codes (über Service-Clients)
- Unexpected Errors → loggen + generische Fehlermeldung an User
- Expected Errors → spezifische `TRPCError` mit Code

### Performance

- Kein N+1 Query Problem: immer mit Relations laden oder batchen
- Bilder: immer optimiert (WebP, Thumbnails)
- API-Responses: nur Felder liefern die der Client braucht
- Langsame oder geschäftskritische Queries: mit EXPLAIN ANALYZE untersuchen

### Kommentare

- Kein "was" kommentieren (der Code sagt was)
- Nur "warum" kommentieren (wenn nicht offensichtlich)
- TODO-Kommentare: immer mit Kontext und Ticket-Nummer
- Keine auskommentierten Code-Blöcke

### Accessibility

- Alle interaktiven Elemente: keyboard-navigierbar
- Alle Bilder: alt-Text (AI-generiert für Fahrzeugfotos, manuell prüfbar)
- Farben: WCAG AA Kontrast-Minimum
- HTML lang-Attribut: richtet sich nach aktiver Locale (`de` in Phase 1)

---

## 10. Public Delivery Model

### Problem

Die Händler-Website (Modul 11) und Fahrzeug-Inserate müssen öffentlich erreichbar sein — ohne Login, ohne JWT, ohne RLS. Gleichzeitig liegen alle Daten in tenant-isolierten Tabellen hinter RLS. Ohne ein sauberes Modell wird das in Service-Role-Hacks enden.

### Lösung: Public Read Views

Öffentlich sichtbare Daten werden über dedizierte API-Routen ausgeliefert die mit Service Role arbeiten, aber strikt read-only und strikt begrenzt sind.

```
app/api/public/
  [tenant_slug]/
    website/route.ts      ← Website-Daten (Seiten, Sektionen)
    vehicles/route.ts     ← Veröffentlichte Fahrzeuge
    branding/route.ts     ← Logo, Farben, Name
```

**Regeln:**
- Public Routes nutzen Service Role (RLS-Bypass), weil es keinen eingeloggten User gibt
- Public Routes sind **ausschließlich lesend** — kein einziger Write-Pfad
- Public Routes liefern nur Daten die explizit als `published: true` markiert sind
- Kein Zugriff auf: Kontakte, Deals, interne Notizen, Preiskalkulationen, Mitarbeiterdaten
- Caching: Vercel ISR (Incremental Static Regeneration) mit Revalidation bei Datenänderung
- Rate Limiting auf Public Routes (Schutz vor Scraping)

### Tenant-Routing für Websites

Phase 1: Subdomain-basiert
```
autohaus-mueller.[produktname].de → tenant_slug: "autohaus-mueller"
```

Phase 2: Custom Domains
```
www.autohaus-mueller.de → Custom Domain Mapping in Vercel
SSL: automatisch über Vercel (Let's Encrypt)
DNS: Händler setzt CNAME auf cname.[produktname].de
```

### SEO

- Jede öffentliche Seite: Server-Side Rendered (SSR) oder ISR
- Meta-Tags, Schema.org Markup, Sitemap.xml: pro Tenant generiert
- Kein Client-Side-Only Rendering für öffentliche Seiten

---

## 11. PWA & Mobile-Strategie

### Grundentscheidung

Das Händler-Interface ist eine Progressive Web App (PWA). Kein nativer App Store, kein separates Mobile-Projekt.

### Phase 1: PWA-Shell

```
Minimum für MVP:
- Web App Manifest (name, icons, theme_color aus Branding)
- Service Worker für App Shell Caching (Navigation, UI-Komponenten)
- "Zum Homescreen hinzufügen" Prompt
- Responsive Design für alle Screens (Mobile-First)
- Touch-optimierte Interaktionen (min. 44px Tap Targets)
```

**Was Phase 1 NICHT hat:** Offline-Datenzugriff, Background Sync, Push Notifications.

### Phase 2: Offline-Fähigkeit

Die 3–5 kritischsten mobilen Workflows werden offline-fähig gemacht:

```
Kritische Offline-Flows (zu validieren mit Beta-Händlern):
1. Fahrzeugbestand ansehen (gecachte Liste)
2. Kontaktdaten eines Kunden ansehen (gecachtes Profil)
3. Neue Notiz/Aufgabe erstellen (Offline Queue, Sync bei Reconnect)
4. Fotos aufnehmen und hochladen (Queue, Upload bei Reconnect)
5. Tages-Briefing lesen (morgens gecacht)
```

**Technisch:**
- IndexedDB für lokale Datencache
- Background Sync API für queued Writes
- Konfliktauflösung: Last-Write-Wins (einfachste Strategie für Phase 2)
- Push Notifications via Web Push API

### Performance-Budget

```
Lighthouse Ziele (Mobile):
  Performance:     > 80
  First Contentful Paint: < 2s
  Time to Interactive:    < 4s
  Bundle Size (initial):  < 200 KB (gzipped)
```

Diese Budgets werden vor Feature-Expansion als Baseline gemessen.

---

## 12. Verwandte Dokumente

| Datei | Inhalt |
|-------|--------|
| `00_VISION.md` | Was und Warum: Vision, Prinzipien, Zielgruppe, MVP-Scope |
| `MOD_XX_*.md` | Detailspezifikation pro Modul |
| `CROSS_*.md` | Modulübergreifende Systeme |
| `CLAUDE.md` | Root Claude Code Anweisungen (Kurzversion dieser Datei) |

---

> **Hinweis für Claude Code:** Diese Datei definiert WIE gebaut wird.
> Für WAS und WARUM: siehe `00_VISION.md`.
> Für Modul-Details: siehe jeweilige `MOD_XX`-Datei.
> Bei Widersprüchen zwischen Modul-Spec und dieser Datei: diese Datei gewinnt.
