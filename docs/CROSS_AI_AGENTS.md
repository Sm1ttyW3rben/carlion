# CROSS — AI-Agent-Architektur

> Modulübergreifende Spezifikation für den AI-Assistenten, das Tool-System, den Command-Service und Prompt-Architektur.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, alle `MOD_*`-Dateien
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v1)

---

## 1. Zweck

Dieses Dokument definiert die technische Architektur des AI-Assistenten und aller AI-gestützten Funktionen in Carlion. Es ist die Referenz für:

- Den persistenten Chat-Assistenten (das zentrale Interface der Vision)
- Das Tool-System (wie die AI auf Modul-Funktionen zugreift)
- Den AI-Command-Service (`aiCommandService.propose()` — referenziert von jedem Modul)
- Die System-Prompt-Architektur (wie Tenant-Kontext in AI-Calls fließt)
- Token-Budgets und Modellwahl
- AI-Event-Logging und Rollback

**Jedes Modul mit AI-Tools setzt dieses Dokument voraus.**

---

## 2. AI-Assistent (Persistentes Chat-Panel)

### Frontend

- **Persistentes Panel:** Sidebar auf Desktop, Bottom Sheet auf Mobile
- **Erreichbar von jedem Screen** über festen Button (unten rechts Mobile, rechte Seite Desktop)
- **Chat-Verlauf:** Pro User pro Session, persistiert in DB
- **Streaming:** Token für Token angezeigt (Claude API Streaming)
- **Screen-Kontext:** Das Panel weiß auf welchem Screen der User ist und welches Objekt ausgewählt ist (z.B. "User ist auf /fahrzeuge/abc-123" → AI kennt dieses Fahrzeug)

### Backend

**tRPC Router:** `assistant` (registriert in `server/trpc/root.ts`)

```
assistant.sendMessage
  Type:     mutation
  Auth:     protectedProcedure
  Input:    {
              message: string,
              context?: {
                screen: string,            // z.B. '/fahrzeuge/abc-123'
                selected_entity_type?: string,  // 'vehicle' | 'contact' | 'deal'
                selected_entity_id?: string,
              }
            }
  Output:   Stream<AssistantResponse>
  Regeln:
    - Streaming-Response (Server-Sent Events oder tRPC Subscription)
    - Claude API mit Tool-Use: AI entscheidet welche Tools aufgerufen werden
    - Lesende Tools: sofort ausgeführt, Ergebnis in Antwort eingebettet
    - Schreibende Tools: PROPOSE-Response, Frontend zeigt Confirm-UI

assistant.getHistory
  Type:     query
  Auth:     protectedProcedure
  Input:    { cursor?: string, limit?: number (default 50) }
  Output:   { items: AssistantMessage[], nextCursor: string | null }

assistant.confirmAction
  Type:     mutation
  Auth:     protectedProcedure
  Input:    { commandId: string, confirmToken: string }
  Output:   ActionResult
  Regeln:
    - Validiert Confirm-Token (einmalig, max 5 Min alt)
    - Führt die vorgeschlagene Aktion aus
    - Schreibt Rollback-Snapshot + AI-Event-Log
    - Gibt Ergebnis zurück (mit Undo-Option)

assistant.undoAction
  Type:     mutation
  Auth:     protectedProcedure
  Input:    { commandId: string }
  Output:   ActionResult
  Regeln:
    - Wendet Rollback-Snapshot an
    - Externe Seiteneffekte: best-effort Compensation
    - Markiert Command als rolled_back
```

### Datenmodell: `assistant_messages`

```
assistant_messages:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  user_id           uuid, foreign key → users, not null
  role              text, not null (user | assistant)
  content           text, not null
  tool_calls        jsonb, nullable (welche Tools aufgerufen wurden)
  tool_results      jsonb, nullable (Ergebnisse der Tool-Aufrufe)
  context           jsonb, nullable (Screen, ausgewähltes Objekt)
  created_at        timestamptz, default now()

  -- RLS
  Policy: tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
  -- Zusätzlich: user_id = auth.uid() (User sieht nur eigene Nachrichten)

  -- Indizes
  INDEX idx_assistant_messages ON assistant_messages(tenant_id, user_id, created_at DESC)
```

---

## 3. Tool-System

### Tool-Aggregation

Alle Modul-Tools werden in `server/trpc/ai-tools.ts` zusammengeführt:

```typescript
// server/trpc/ai-tools.ts
import { dnaTools } from "@/modules/dna-engine/ai-tools";
import { inventoryTools } from "@/modules/inventory/ai-tools";
import { crmTools } from "@/modules/crm/ai-tools";
import { salesTools } from "@/modules/sales/ai-tools";
import { listingsTools } from "@/modules/listings/ai-tools";
import { websiteTools } from "@/modules/website-builder/ai-tools";
import { whatsappTools } from "@/modules/whatsapp/ai-tools";

export const allTools = [
  ...dnaTools,
  ...inventoryTools,
  ...crmTools,
  ...salesTools,
  ...listingsTools,
  ...websiteTools,
  ...whatsappTools,
];
```

### Tool-Definition

Jedes Tool hat diese Struktur:

```typescript
type AiTool = {
  name: string;                    // eindeutig über alle Module
  description: string;             // für Claude: wann dieses Tool nutzen
  parameters: Record<string, any>; // Zod-Schema für Parameter
  execute: (params: any, ctx: TenantContext) => Promise<any>;
  type: 'read' | 'write';         // read = sofort ausführen, write = PROPOSE-Flow
}
```

### Tool-Namenskonvention

| Typ | Prefix | Beispiel |
|-----|--------|---------|
| Lesend | `get_*`, `list_*`, `search_*` | `list_vehicles`, `get_deal_details` |
| Schreibend | `propose_*` | `propose_vehicle_create`, `propose_deal_stage_change` |

**Schreibende Tools heißen immer `propose_*`.** Das macht für Claude klar dass das Ergebnis ein Vorschlag ist, nicht eine sofortige Mutation.

### Tool-Routing

Claude entscheidet basierend auf der User-Nachricht welche Tools aufgerufen werden. Der System-Prompt enthält die Tool-Beschreibungen. Claude kann mehrere Tools in einer Antwort aufrufen (z.B. erst `list_vehicles` dann `propose_deal_create`).

**Rollenfilter:** Nicht jeder User sieht alle Tools. Tools werden basierend auf `ctx.role` gefiltert:

```typescript
function getToolsForRole(role: UserRole): AiTool[] {
  return allTools.filter(tool => {
    // Beispiel: Sales-Tools nur für Rollen die Sales sehen dürfen
    if (tool.name.startsWith('propose_deal_') || tool.name.startsWith('list_deals')) {
      return ['owner', 'admin', 'manager', 'salesperson'].includes(role);
    }
    // WhatsApp-Tools nur für berechtigte Rollen
    if (tool.name.includes('whatsapp')) {
      return ['owner', 'admin', 'manager', 'salesperson'].includes(role);
    }
    // Default: alle Rollen
    return true;
  });
}
```

---

## 4. AI-Command-Service (`aiCommandService`)

Der Command-Service ist das Herzstück des PROPOSE→CONFIRM-Flows. Er wird von **jedem schreibenden AI-Tool** aufgerufen und garantiert dass keine AI-Mutation ohne explizite Bestätigung ausgeführt wird.

### Pfad

```
shared/services/ai-command-service.ts
```

### Interface

```typescript
type ProposeInput = {
  module: string;                          // 'inventory', 'crm', 'sales', ...
  action: string;                          // 'create_vehicle', 'move_to_stage', ...
  proposed_changes: Record<string, any>;   // was soll sich ändern
  preview: () => Promise<PreviewData>;     // Dry-Run: zeigt was passieren würde
  executeOnConfirm: () => Promise<any>;    // wird erst nach Bestätigung aufgerufen
}

type ProposeResult = {
  commandId: string;                       // UUID des AI-Action-Commands
  preview: PreviewData;                    // Vorschau-Daten für Frontend
  confirmToken: string;                    // Token für Bestätigung (5 Min gültig)
  expiresAt: string;                       // Wann Token abläuft
}

type PreviewData = {
  summary: string;                         // "BMW 320d wird als verkauft markiert"
  changes: Change[];                       // Liste der Einzeländerungen
  warnings: string[];                      // z.B. "Inserate werden deaktiviert"
  reversible: boolean;                     // Kann diese Aktion rückgängig gemacht werden?
}

type Change = {
  field: string;                           // z.B. "Status"
  from: string | null;                     // z.B. "Verfügbar"
  to: string;                              // z.B. "Verkauft"
}
```

### Flow

```
1. AI-Tool ruft aiCommandService.propose(input) auf

2. propose() erstellt:
   ├── ai_action_commands INSERT:
   │   tenant_id, user_id, assistant_message_id,
   │   action_type, target_module, proposed_changes,
   │   confirm_token (crypto-random), confirm_expires (+5 Min),
   │   status: 'proposed'
   └── Ruft input.preview() auf → Preview-Daten

3. propose() gibt ProposeResult zurück
   → AI-Assistent zeigt im Chat:
   "Soll ich den BMW 320d auf 'Verkauft' setzen?"
   [Preview der Änderungen]
   [Bestätigen] [Abbrechen]

4. User klickt [Bestätigen]
   → Frontend ruft assistant.confirmAction({ commandId, confirmToken })

5. confirmAction() prüft:
   ├── Command existiert und gehört zum User/Tenant
   ├── Status ist 'proposed' (nicht schon ausgeführt/abgelaufen)
   ├── confirmToken stimmt überein
   ├── confirm_expires > now()
   └── Alles ok → weiter

6. confirmAction() führt aus:
   ├── Rollback-Snapshot erstellen (Zustand VOR der Änderung)
   ├── input.executeOnConfirm() aufrufen → eigentliche Mutation
   ├── ai_action_commands UPDATE: status = 'executed', executed_at = now()
   ├── ai_event_log INSERT: Modul, Action, Summary, Token-Verbrauch
   └── Response mit Ergebnis + Undo-Option

7. Optional: User klickt [Rückgängig]
   → assistant.undoAction({ commandId })
   ├── Rollback-Snapshot anwenden (DB-Änderungen zurücksetzen)
   ├── Externe Seiteneffekte: best-effort (z.B. Inserat reaktivieren)
   ├── ai_action_commands UPDATE: status = 'rolled_back'
   └── User wird informiert was rückgängig gemacht wurde und was nicht
```

### Datenmodell: `ai_action_commands`

Definiert in `01_ARCHITECTURE.md` Abschnitt 6. Hier die vollständige Referenz:

```
ai_action_commands:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  user_id           uuid, foreign key → users, not null
  assistant_message_id uuid, nullable (Bezug zur Chat-Nachricht)
  action_type       text, not null
  target_module     text, not null
  proposed_changes  jsonb, not null
  confirm_token     text, unique, nullable
  confirm_expires   timestamptz, nullable
  status            text, not null, default 'proposed'
                    -- proposed | confirmed | executed | rolled_back | expired | cancelled
  rollback_data     jsonb, nullable (verschlüsselt, AES-256)
  external_effects  jsonb, nullable
  executed_at       timestamptz, nullable
  created_at        timestamptz, default now()

  -- Constraints
  CHECK status IN ('proposed', 'confirmed', 'executed', 'rolled_back', 'expired', 'cancelled')

  -- RLS
  Policy: tenant_id = (auth.jwt() ->> 'tenant_id')::uuid

  -- Indizes
  INDEX idx_commands_tenant_user ON ai_action_commands(tenant_id, user_id, created_at DESC)
  INDEX idx_commands_pending ON ai_action_commands(status, confirm_expires)
    WHERE status = 'proposed'
```

### Expiration-Cron

```
/api/jobs/cleanup (täglich 03:00, shared):
  UPDATE ai_action_commands
  SET status = 'expired'
  WHERE status = 'proposed' AND confirm_expires < now()
```

### Rollback-Regeln

| Seiteneffekt-Typ | Rollback-Verhalten |
|-------------------|--------------------|
| DB-Änderung (intern) | Vollständig reversibel über Snapshot |
| Fahrzeug-Status/Published | Reversibel (Inventory-Export aufrufen) |
| CRM-Kontakt-Typ | Reversibel |
| E-Mail gesendet | Nicht reversibel — User wird informiert |
| WhatsApp gesendet | Nicht reversibel — User wird informiert |
| Börsen-Inserat aktualisiert | Best-effort Compensation (Outbox) |

**Rollback-Daten:** Verschlüsselt gespeichert (AES-256), weil sie PII enthalten können. Retention: 30 Tage, dann gelöscht.

---

## 5. System-Prompt-Architektur

Jeder AI-Call hat einen System-Prompt der aus Bausteinen zusammengesetzt wird. Die Bausteine sind standardisiert und werden vom AI-Client (`shared/lib/ai.ts`) automatisch zusammengebaut.

### Baustein-Reihenfolge

```
┌─────────────────────────────────────────────────┐
│ 1. Basis-Rolle                                  │
│    "Du bist der AI-Assistent von {tenant.name}."│
│    "Du hilfst dem Autohändler sein Geschäft zu   │
│    führen."                                      │
├─────────────────────────────────────────────────┤
│ 2. Tenant-Kontext (aus DNA-Engine + tenants)    │
│    Tonalität: {dna.tone}                        │
│    Anrede: {dna.formality} (Du/Sie)             │
│    Händlertyp: {dna.dealership_type}            │
│    Beschreibungsstil: {dna.description_style}   │
│    Sprache: Deutsch                             │
├─────────────────────────────────────────────────┤
│ 3. Verhaltensregeln                             │
│    - Verwende Händlersprache (Fahrzeug, nicht    │
│      Asset; Interessent, nicht Lead)             │
│    - Erfinde keine Daten — nur DB-Fakten        │
│    - Keine rechtlichen Aussagen                 │
│    - Bei Unsicherheit: nachfragen               │
│    - Schreibende Aktionen immer vorschlagen,    │
│      nie direkt ausführen                        │
├─────────────────────────────────────────────────┤
│ 4. Screen-Kontext (dynamisch)                   │
│    "Der User ist auf: {screen}"                 │
│    "Ausgewählt: {entity_type} {entity_summary}" │
├─────────────────────────────────────────────────┤
│ 5. Chat-Verlauf (letzte N Nachrichten)          │
│    Komprimiert wenn >60% des Token-Budgets      │
├─────────────────────────────────────────────────┤
│ 6. Verfügbare Tools                             │
│    (automatisch aus Tool-Definitionen generiert) │
└─────────────────────────────────────────────────┘
```

### Baustein-Laden

```typescript
// shared/lib/ai.ts
async function buildSystemPrompt(ctx: TenantContext, screenContext?: ScreenContext): Promise<string> {
  const tenant = ctx.tenant;  // aus tRPC Context
  const branding = await getBrandingForTenant(ctx);  // DNA-Export
  
  return [
    buildBaseRole(tenant.name),
    buildTenantContext(branding),
    buildBehaviorRules(),
    screenContext ? buildScreenContext(screenContext) : '',
  ].filter(Boolean).join('\n\n');
}
```

### Prompt für spezifische Aufgaben (nicht Chat)

Einige AI-Funktionen haben eigene Prompts die nicht über den Assistenten laufen (z.B. Fahrzeugbeschreibung, Branding-Analyse). Diese nutzen trotzdem Baustein 1-3, aber ersetzen Baustein 4-6 durch eine aufgabenspezifische Instruktion.

**Beispiel Fahrzeugbeschreibung:**
```
Bausteine 1-3 (Basis + Tenant + Verhalten)
+
Aufgaben-Instruktion: "Schreibe einen Inserat-Titel und eine Beschreibung..."
+
Fahrzeugdaten: {vehicle_data}
+
Output-Format: JSON
```

Die vollständigen Prompts pro Aufgabe sind in den jeweiligen Modulspezifikationen definiert (z.B. `MOD_02_INVENTORY.md` Abschnitt 8, `MOD_34_DNA_ENGINE.md` Abschnitt 6).

---

## 6. AI-Client (`shared/lib/ai.ts`)

### Verantwortlichkeiten

- **Einziger Einstiegspunkt** für alle AI-Calls. Kein Modul importiert die Anthropic SDK direkt.
- System-Prompt zusammenbauen (Abschnitt 5)
- Modell auswählen (Abschnitt 7)
- Token-Budget erzwingen (Abschnitt 8)
- Streaming unterstützen (für Chat-Assistent)
- Logging: Modul, Action, Token-Verbrauch, Dauer → `ai_event_log`
- Fehlerbehandlung: Timeout, Rate Limit, API-Fehler → saubere Fehlermeldung, kein Absturz

### Interface

```typescript
// shared/lib/ai.ts
export async function callAI(input: {
  module: string;               // z.B. 'inventory', 'assistant'
  action: string;               // z.B. 'generate_description', 'chat'
  systemPrompt?: string;        // Override, sonst auto-generiert
  userMessage: string;
  tools?: AiTool[];             // Tool-Definitionen für Tool-Use
  maxInputTokens?: number;      // Override Token-Budget
  maxOutputTokens?: number;
  model?: 'sonnet' | 'opus';   // Default: sonnet
  stream?: boolean;             // Default: false
}, ctx: TenantContext): Promise<AiResponse>

export async function streamAI(input: /* gleich */, ctx: TenantContext): AsyncIterable<AiStreamChunk>
```

### Logging

Jeder AI-Call schreibt in `ai_event_log`:

```
ai_event_log:
  module: input.module
  action: input.action
  summary: auto-generiert (z.B. "Fahrzeugbeschreibung generiert für BMW 320d")
  status: success | failed
  token_usage: Anthropic-Response.usage.total_tokens
  duration_ms: Gesamtdauer
  -- KEIN Input/Output gespeichert (PII-Risiko)
```

---

## 7. Modellwahl

| Modell | Intern | Wann verwenden |
|--------|--------|----------------|
| Claude Sonnet 4 | `claude-sonnet-4-20250514` | 90% der Aufgaben: Chat, Beschreibungen, Analyse, Branding |
| Claude Opus 4 | `claude-opus-4-20250514` | Nur für komplexe Analysen, BI-Reports, mehrstufige Reasoning |

**Entscheidung pro Use Case, nicht pro Modul:**

| Use Case | Modell |
|----------|--------|
| AI-Assistent Chat | Sonnet |
| Fahrzeugbeschreibung | Sonnet |
| Branding-Analyse (DNA) | Sonnet |
| Alt-Text für Fotos | Sonnet |
| Website-Texte | Sonnet |
| WhatsApp-Antwortvorschlag | Sonnet |
| Business Intelligence Reports | Opus (Phase 2) |
| Komplexe Pipeline-Analyse | Opus (Phase 2) |

---

## 8. Token-Budgets

| Use Case | Max Input | Max Output | Modell |
|----------|-----------|------------|--------|
| AI-Assistent Chat | 8.000 | 512 | Sonnet |
| Fahrzeugbeschreibung | 4.000 | 2.000 | Sonnet |
| Branding-Analyse | 4.000 | 1.000 | Sonnet |
| Alt-Text (Foto) | 2.000 | 256 | Sonnet |
| Website-Text | 4.000 | 1.000 | Sonnet |
| WhatsApp-Vorschlag | 4.000 | 512 | Sonnet |
| CRM-Zusammenfassung | 4.000 | 512 | Sonnet |

### Context-Komprimierung

Wenn der Chat-Verlauf >60% des Input-Budgets belegt:
1. Älteste Nachrichten werden zusammengefasst (nicht entfernt)
2. Zusammenfassung durch Claude: "Bisheriges Gespräch: Der Händler hat nach BMWs gefragt und einen Preisvorschlag für den 320d bekommen."
3. Zusammenfassung + letzte 5 Nachrichten als neuer Kontext

---

## 9. AI-Grenzen (technisch erzwungen)

Diese Grenzen gelten in **jeder** AI-Stufe (Assistent, Kopilot, Autopilot):

1. AI sieht nur Daten des eigenen Tenants (`tenant_id` im Context)
2. AI-Outputs werden nie für Modell-Training genutzt
3. Kein PII in Logs (`ai_event_log` speichert `summary`, nicht Input/Output)
4. Bei Unsicherheit: AI fragt nach statt zu handeln
5. Halluzinations-Prävention: Fahrzeugdaten, Preise, rechtliche Aussagen **immer** aus DB, nie aus AI-Training
6. AI kann keine Daten endgültig löschen (nur Soft-Delete-Vorschlag)
7. AI kann keine Zahlungen auslösen
8. AI kann keine Nutzer entfernen oder Rollen ändern
9. AI kann keine Verträge unterschreiben
10. AI kann keine externen APIs mit Kosten >5€ aufrufen ohne Bestätigung

---

## 10. MVP-Scope

### Phase 1 — Wird gebaut

- [x] AI-Assistent (Chat-Panel) mit Tool-Zugriff und Streaming
- [x] AI-Command-Service (PROPOSE → CONFIRM → EXECUTE → UNDO)
- [x] System-Prompt-Architektur mit Tenant-Kontext aus DNA
- [x] Tool-Aggregation über alle MVP-Module
- [x] Rollenbasierte Tool-Filterung
- [x] AI-Fahrzeugbeschreibungen (Modul 02)
- [x] AI-Branding-Analyse (Modul 34)
- [x] AI-Website-Texte (Modul 11)
- [x] AI-WhatsApp-Antwortvorschlag (Modul 17)
- [x] AI-Event-Logging
- [x] Rollback/Undo für AI-Aktionen
- [x] Token-Budget-Erzwingung

### Phase 2

- [ ] AI-Tages-Briefing (Zusammenfassung der wichtigsten Ereignisse morgens)
- [ ] AI-Preisempfehlung (Modul 22)
- [ ] AI-Lead-Scoring (CRM)
- [ ] AI-Verlustprävention (Sales)
- [ ] AI-WhatsApp-Autopilot
- [ ] Stufe 2 (Kopilot) und Stufe 3 (Autopilot)

---

## 11. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 1 (AI als Betriebssystem), Abschnitt 5 (AI-Stufen) |
| `01_ARCHITECTURE.md` | Abschnitt 6 (AI-Integration, Aktionsprotokoll, Token-Budgets) |
| `MOD_34_DNA_ENGINE.md` | System-Prompt Baustein 2 (Tenant-Kontext), AI-Branding-Tools |
| `MOD_02_INVENTORY.md` | Fahrzeugbeschreibungs-Prompt, Inventory-AI-Tools |
| `MOD_01_CRM.md` | CRM-AI-Tools |
| `MOD_03_SALES.md` | Sales-AI-Tools |
| `MOD_13_LISTINGS.md` | Listings-AI-Tools |
| `MOD_11_WEBSITE.md` | Website-AI-Tools |
| `MOD_17_WHATSAPP.md` | WhatsApp-AI-Tools |

---

> **Hinweis für Claude Code:** Dieses Dokument definiert die AI-Infrastruktur.
> JEDER AI-Call geht über shared/lib/ai.ts — nie direkt Anthropic SDK im Modul.
> JEDE schreibende AI-Aktion geht über aiCommandService.propose() — nie direkte Mutation.
> Rollback-Daten sind AES-256 verschlüsselt (PII-Risiko).
> Token-Budgets sind Obergrenzen — AI-Client erzwingt sie.
> Kein PII in ai_event_log — nur summary.
