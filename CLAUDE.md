# CLAUDE.md — Carlion

> AI-gesteuertes Betriebssystem für Autohändler.
> Lies diese Datei bei jedem Task. Sie ist dein Einstiegspunkt.

## Dokumenten-Hierarchie (bei Konflikten gewinnt oben)

1. `docs/00_VISION.md` — Was und Warum. Prinzipien, MVP-Scope.
2. `docs/01_ARCHITECTURE.md` — Wie. Tech Stack, Patterns, Regeln.
3. `docs/modules/MOD_XX_*.md` — Modul-Details (Datenmodell, API, AI-Tools, Business Rules).
4. `docs/CROSS_*.md` — Modulübergreifende Systeme (AI-Agents, Onboarding, Search).
5. **Diese Datei** — Kurzfassung der Regeln. Bei Widerspruch verliert sie.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript strict
- **UI:** shadcn/ui + Tailwind CSS 4
- **DB:** Supabase (PostgreSQL 15 + Auth + RLS + Storage + Realtime)
- **ORM:** Drizzle ORM
- **API:** tRPC v11
- **AI:** Claude API (Anthropic)
- **Hosting:** Vercel (EU-Region)
- **Package Manager:** pnpm

## Unverletzbare Regeln

### Tenant-Isolation & Datenzugriff
1. **RLS ist Primärschutz.** Jede tenant-spezifische Tabelle hat `tenant_id`. Isolation wird auf DB-Ebene erzwungen.
2. **Nur der freigegebene RLS-Datenzugriffspfad.** Reguläre Requests nutzen den Supabase Client mit User-JWT (siehe `01_ARCHITECTURE.md` Abschnitt 3). Kein separater Direct-DB-Client im Modulcode. Der RLS-Spike ist Blocker — ohne bestandenen Spike kein Modulbau.
3. **Service Role nur für System-Jobs und Public Read Routes.** Kein Service Role in normalen tenant-authentifizierten Request-Handlern. Ausnahmen nur für Migrationen, Seed-Daten, Cron-Jobs und dedizierte Public Read Routes (`app/api/public/`).

### AI & Modulgrenzen
4. **AI-Aktionen brauchen Bestätigung.** Phase 1 = nur Stufe 1 (Assistent). Jede schreibende AI-Aktion durchläuft: Propose → Preview → Confirm → Execute → Log → Undo. Implementiert über `aiCommandService.propose()` (siehe `CROSS_AI_AGENTS.md`).
5. **Jedes MVP-Modul exponiert `ai-tools.ts`.** Kein Modul darf nur über UI/tRPC erreichbar sein. Schreibende Tools heißen `propose_*` und rufen nie direkt Service-Mutations auf.
6. **Modulgrenzen respektieren.** Imports nur über `index.ts`. Nie auf interne Dateien anderer Module zugreifen. Cross-Module-Writes nur über benannte Service-Exports (`markVehicleAsSold`, `markContactAsCustomer`, `createContactFromExternal`, `addActivityForContact`, `bulkUpsertVehicles` etc.).
7. **Geschäftslogik in Services, nicht in Routern.** tRPC Router enthält Orchestrierung + Validation. Business-Logik lebt in `modules/<modul>/services/`.

### Status, Publish & Lifecycle
8. **Status-Änderungen über dedizierte Mutations.** `inventory.update` darf weder `status` noch `published` ändern — dafür gibt es `updateStatus`, `publish`, `unpublish`. `sales.update` darf `stage` nicht ändern — dafür gibt es `moveToStage`. Kein generischer Patch für Lifecycle-Felder.
9. **Rollenbasierte DTOs.** Nie eine einzelne Entity an alle Rollen ausliefern. Getrennte Typen: `*Record` (DB), `*View` (API, mit aufgelösten Relationen), `*ViewRestricted` (ohne sensible Felder), `*ListItem` (kompakt), `Public*` (öffentlich). Einkaufspreise/Margen nie an `salesperson`/`receptionist`/`viewer`.

### Integrationen & Public Delivery
10. **Externe Sends über Outbox/Worker.** E-Mail, WhatsApp und Börsen-Sync nie direkt aus Router senden. Immer über Outbox — außer user-getriggerte Sends (sofort, Outbox nur als Retry-Fallback). Details in `01_ARCHITECTURE.md` Abschnitt 8.
11. **Öffentliche Daten nur über Public Read Routes.** Website-/Fahrzeugdaten für Endkunden nur über `app/api/public/`. Read-only, Service Role. Öffentliche Write-Pfade (z.B. Kontaktformular) unter `app/api/forms/`, NICHT unter `app/api/public/`.
12. **Webhooks architekturkonform.** Signatur validieren → `webhook_log` INSERT → HTTP 200 sofort → Verarbeitung asynchron (Fast-Path + Cron-Fallback). Siehe WhatsApp-Modul als Referenz.
13. **File-Uploads über dedizierte Route Handler.** tRPC kann kein multipart. Logo-Upload, Fahrzeugfotos, Börsen-Import: jeweils eigener Route Handler unter `app/api/upload/`. Alle Dateien über `files`-Tabelle referenzieren, keine direkten URLs in Fachtabellen.
14. **Import-Idempotenz.** Börsen-Import: Partial Unique Index auf `(tenant_id, source, source_reference)`. Import-Sessions serverseitig (kein Client-Trust). Kontakt-Duplikat-Check kanalübergreifend (email, phone, phone_mobile, whatsapp_number), normalisiert.

### Produkt-Guardrails
15. **White-Label:** Kundensichtbare Outputs lesen Branding immer aus dem Tenant-Profil (Logo, Farben, Ton). Nie Carlion in kundensichtbaren Interfaces. Händlername kommt aus `tenants.name`, nicht aus `tenant_branding`.
16. **Mobile-First:** Händler-UI ist mobile-first. Phase 1 = PWA-Shell. Kein nativer App-Ansatz.
17. **Kein `any`.** Wenn unvermeidbar: lokal kapseln und begründen.
18. **Nur MVP-Module bauen.** Keine Module außerhalb des MVP-Scope, es sei denn explizit beauftragt.
19. **Berechnete Felder nicht speichern wenn volatil.** `days_in_stock` und `days_in_current_stage` als Query-Time-Expression, nicht als STORED generated column (PostgreSQL erlaubt kein `current_date` in generated columns). `is_active` auf Kontakten: nicht speichern, aus `last_interaction_at` berechnen.
20. **Kein Event-System im MVP.** Modulübergreifende Konsistenz über Reconciliation-Crons (Listings, Website) statt Events. Einfacher, testbarer, keine Infrastruktur-Erweiterung nötig.

### Testing
21. **Cross-Tenant-Tests sind Pflicht.** Bei jeder tenant-spezifischen Ressource und jedem kritischen Datenzugriff existiert ein Test: "Tenant A sieht nie Daten von Tenant B."

### API & Daten
22. **Cursor-Pagination, kein Offset.** Alle Listen-Endpoints nutzen Compound-Cursor `(sort_field_value, id)`. Kein `totalCount`, kein Offset. Standard: 20 Items, Max: 100.
23. **JWT Custom Claims über Auth Hook.** `tenant_id` und `role` im JWT werden über Supabase Auth Hook oder Token-Refresh gesetzt — nie manuell im Modulcode oder in einer DB-Transaktion.

## MVP-Scope (nur diese Module)

| Reihenfolge | Modul |
|:-----------:|-------|
| 0 | Platform Foundation (Auth, Tenant, RLS, Layout) |
| 1 | DNA-Engine (Onboarding + Branding) |
| 2 | Fahrzeugverwaltung & Inventar |
| 3 | CRM & Kundenmanagement |
| 4 | Verkauf & Lead-Pipeline |
| 5 | Fahrzeugbörsen-Hub |
| 6 | Website Builder (nur Auto-Sync) |
| 7 | WhatsApp Integration (nur Inbox + manuell) |

## Namenskonventionen

- Dateien: `kebab-case` (alles)
- DB-Tabellen/Spalten: `snake_case`
- TypeScript Types: `PascalCase`
- tRPC Router: `camelCase`
- Commits: Conventional Commits (`feat:`, `fix:`, `refactor:`)
- Sprache Code: **Englisch**
- Sprache UI: **Deutsch**
- URLs Händler-Interface: **Deutsch** (/fahrzeuge, /kontakte)
- URLs API: **Englisch** (/api/trpc/[trpc])

## Händler-Vokabular (für UI-Labels und AI-Texte)

| Verwende | Nicht verwenden |
|----------|----------------|
| Interessent, Anfrage | Lead, Prospect |
| Fahrzeug, Wagen | Asset, Inventory Item |
| Angebot | Proposal, Quote |
| Abschluss, Verkauf | Deal Conversion |
| Bestand | Inventar, Stock |
| Börse | Marketplace |
| Inserat | Listing |
| Standzeit | Days in Stock |
| Inzahlungnahme | Trade-in |
| Übergabe | Handover |
| TÜV, HU | Vehicle Inspection |

## Befehle

```bash
pnpm dev          # Lokaler Dev-Server
pnpm build        # Production Build
pnpm test         # Vitest
pnpm lint         # ESLint
pnpm db:generate  # Drizzle Schema → Migration generieren
pnpm db:push      # Schema direkt pushen — NUR lokal/Spike, nie Production
pnpm db:migrate   # Reviewte Migration ausführen
pnpm db:seed      # Demo-Daten laden
```
