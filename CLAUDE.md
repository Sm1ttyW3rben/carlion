# CLAUDE.md — Carlion

> AI-gesteuertes Betriebssystem für Autohändler.
> Lies diese Datei bei jedem Task. Sie ist dein Einstiegspunkt.

## Dokumenten-Hierarchie (bei Konflikten gewinnt oben)

1. `docs/00_VISION.md` — Was und Warum. Prinzipien, MVP-Scope.
2. `docs/01_ARCHITECTURE.md` — Wie. Tech Stack, Patterns, Regeln.
3. `docs/modules/MOD_XX_*.md` — Modul-Details.
4. `docs/CROSS_*.md` — Modulübergreifende Systeme.
5. **Diese Datei** — Kurzfassung. Bei Widerspruch verliert sie.

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
4. **AI-Aktionen brauchen Bestätigung.** Phase 1 = nur Stufe 1 (Assistent). Jede schreibende AI-Aktion durchläuft: Propose → Preview → Confirm → Execute → Log → Undo.
5. **Jedes MVP-Modul exponiert `ai-tools.ts`.** Kein Modul darf nur über UI/tRPC erreichbar sein. AI muss lesen und schreiben können.
6. **Modulgrenzen respektieren.** Imports nur über `index.ts`. Nie auf interne Dateien anderer Module zugreifen.
7. **Geschäftslogik in Services, nicht in Routern.** tRPC Router enthält Orchestrierung + Validation. Business-Logik lebt in `modules/<modul>/services/`.

### Integrationen & Public Delivery
8. **Externe Sends über Outbox/Worker.** E-Mail, WhatsApp und Börsen-Sync nie direkt aus Router senden. Immer über Outbox — außer user-getriggerte Sends (sofort, Outbox nur als Retry-Fallback). Details in `01_ARCHITECTURE.md` Abschnitt 8.
9. **Öffentliche Daten nur über Public Read Routes.** Website-/Fahrzeugdaten für Endkunden nur über `app/api/public/`. Keine Wiederverwendung normaler tenant-geschützter Query-Pfade.

### Produkt-Guardrails
10. **White-Label:** Kundensichtbare Outputs lesen Branding immer aus dem Tenant-Profil (Logo, Farben, Ton). Nie Carlion in kundensichtbaren Interfaces.
11. **Mobile-First:** Händler-UI ist mobile-first. Phase 1 = PWA-Shell. Kein nativer App-Ansatz.
12. **Kein `any`.** Wenn unvermeidbar: lokal kapseln und begründen.
13. **Nur MVP-Module bauen.** Keine Module außerhalb des MVP-Scope, es sei denn explizit beauftragt.

### Testing
14. **Cross-Tenant-Tests sind Pflicht.** Bei jeder tenant-spezifischen Ressource und jedem kritischen Datenzugriff existiert ein Test: "Tenant A sieht nie Daten von Tenant B."

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
