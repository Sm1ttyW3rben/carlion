# MOD 03 — Verkauf & Lead-Pipeline

> Modulspezifikation für den Verkaufsprozess und die Deal-Pipeline.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_01_CRM.md`, `MOD_02_INVENTORY.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v2)

---

## 1. Zweck & Einordnung

Das Sales-Modul bildet den Verkaufsprozess eines Autohauses ab: von der ersten konkreten Anfrage über Verhandlung und Angebot bis zum Abschluss oder Verlust. Es verknüpft Kontakte (aus CRM) mit Fahrzeugen (aus Inventar) zu **Deals** und führt diese durch eine feste Pipeline.

**Abgrenzung zu CRM:** Das CRM verwaltet Personen und ihre Interaktionshistorie. Sales verwaltet konkrete Verkaufsvorgänge. Ein Kontakt kann mehrere Deals haben. Ein Deal hat immer genau einen Kontakt und genau ein Fahrzeug.

**Händlersprache:** Ein Deal heißt in der UI „Verkaufsvorgang" oder „Vorgang". Die Pipeline-Stufen heißen „Phasen". Kein „Lead", kein „Opportunity", kein „Closed Won".

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 03 |
| Kategorie | Kerngeschäft |
| Phase | **MVP** |
| Build-Reihenfolge | 4 (nach CRM) |
| Abhängigkeiten | Platform Foundation, Modul 02 (Inventar), Modul 01 (CRM) |
| Abhängig davon | Modul 13 (Börsen-Hub — Deal-Erstellung aus Anfrage), Modul 04 (Finanzierung, Phase 2) |

---

## 2. Kernkonzept — Der Deal-Lebenszyklus

Ein Deal repräsentiert einen konkreten Verkaufsvorgang: ein Kontakt will ein bestimmtes Fahrzeug kaufen. Jeder Deal durchläuft feste Pipeline-Stufen:

```
Anfrage                            ← Deal entsteht (Kontakt + Fahrzeug)
    │
    ▼
Kontaktiert                        ← Händler hat geantwortet/angerufen
    │
    ▼
Besichtigung / Probefahrt          ← Termin vereinbart oder durchgeführt
    │
    ▼
Angebot                            ← Preisangebot erstellt/versendet
    │
    ▼
Verhandlung                        ← Preis-/Konditionsverhandlung
    │
    ├── Abschluss (gewonnen)       ← Kaufvertrag, Zahlung vereinbart
    │
    └── Verloren                   ← Absage, kein Interesse mehr
```

### Pipeline-Stufen (fest im MVP)

| Stufe | Reihenfolge | UI-Label | Typ |
|-------|:-----------:|----------|-----|
| `inquiry` | 1 | Anfrage | open |
| `contacted` | 2 | Kontaktiert | open |
| `viewing` | 3 | Besichtigung | open |
| `offer` | 4 | Angebot | open |
| `negotiation` | 5 | Verhandlung | open |
| `won` | — | Abschluss | closed_won |
| `lost` | — | Verloren | closed_lost |

**`won` und `lost` sind Terminal-Stufen.** Ausnahme: `lost` → `inquiry` (Deal wiederbeleben, mit Feld-Reset).

**Pipeline-Stufen sind im MVP fest** — keine Konfiguration, kein Umbenennen. Phase 2: konfigurierbar.

---

## 3. Datenmodell

### Tabelle: `deals`

```
deals:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  
  -- Kern-Verknüpfungen
  contact_id        uuid, foreign key → contacts, not null
  vehicle_id        uuid, foreign key → vehicles, not null
  assigned_to       uuid, nullable, foreign key → users (zuständiger Verkäufer)
  
  -- Pipeline
  stage             text, not null, default 'inquiry'
  stage_changed_at  timestamptz, not null, default now()
  
  -- Konditionen
  offered_price     numeric(10,2), nullable (angebotener Preis)
  final_price       numeric(10,2), nullable (Abschlusspreis, nur bei won)
  trade_in_vehicle  text, nullable (Freitext: Inzahlungnahme-Fahrzeug)
  trade_in_value    numeric(10,2), nullable
  financing_requested boolean, not null, default false
  financing_notes   text, nullable
  
  -- Ergebnis
  won_at            timestamptz, nullable
  lost_at           timestamptz, nullable
  lost_reason       text, nullable
  
  -- Notizen
  internal_notes    text, nullable
  
  -- Priorität
  priority          text, not null, default 'normal'
  
  -- Meta
  source            text, not null, default 'manual'
  created_by        uuid, nullable, foreign key → users
  created_at        timestamptz, default now()
  updated_at        timestamptz
  deleted_at        timestamptz, nullable (Soft Delete)

  -- Constraints
  CHECK stage IN ('inquiry', 'contacted', 'viewing', 'offer', 'negotiation', 'won', 'lost')
  CHECK priority IN ('low', 'normal', 'high', 'urgent')
  CHECK source IN ('manual', 'whatsapp', 'mobile_de', 'autoscout24', 'website', 'phone', 'walk_in')
  CHECK final_price IS NULL OR stage = 'won'
  CHECK lost_reason IS NULL OR stage = 'lost'
  CHECK offered_price IS NULL OR offered_price >= 0
  CHECK final_price IS NULL OR final_price >= 0
  CHECK trade_in_value IS NULL OR trade_in_value >= 0
  
  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_deals_tenant ON deals(tenant_id)
  INDEX idx_deals_tenant_stage ON deals(tenant_id, stage)
  INDEX idx_deals_tenant_created ON deals(tenant_id, created_at DESC)
  INDEX idx_deals_contact ON deals(tenant_id, contact_id)
  INDEX idx_deals_vehicle ON deals(tenant_id, vehicle_id)
  INDEX idx_deals_assigned ON deals(tenant_id, assigned_to) WHERE assigned_to IS NOT NULL
  INDEX idx_deals_open ON deals(tenant_id, stage) WHERE stage NOT IN ('won', 'lost') AND deleted_at IS NULL
  
  -- Max 1 offener Deal pro Fahrzeug (Partial Unique Index)
  UNIQUE INDEX idx_deals_vehicle_open ON deals(tenant_id, vehicle_id) 
    WHERE stage NOT IN ('won', 'lost') AND deleted_at IS NULL
```

### Prioritäts-Rangordnung

| Wert | Rang (für Sortierung) |
|------|:---------------------:|
| `urgent` | 4 (höchste) |
| `high` | 3 |
| `normal` | 2 |
| `low` | 1 (niedrigste) |

**Implementierung:** Im Service-Layer als Mapping, nicht als DB-Enum-Ordinal. Frontend und Board sortieren nach diesem Rang.

### Tabelle: `deal_stage_history`

```
deal_stage_history:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  deal_id           uuid, foreign key → deals, not null
  from_stage        text, nullable (null bei Erstellung)
  to_stage          text, not null
  changed_by        uuid, nullable, foreign key → users
  changed_at        timestamptz, not null, default now()
  duration_in_stage_hours integer, nullable
  notes             text, nullable

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_stage_history_deal ON deal_stage_history(tenant_id, deal_id, changed_at DESC)
```

---

## 4. Designentscheidungen

### 4.1 Ein Deal = ein Kontakt + ein Fahrzeug

Jeder Deal hat genau eine `contact_id` und genau eine `vehicle_id`. Keine Multi-Vehicle-Deals, keine Multi-Contact-Deals. Zwei Fahrzeuge = zwei Deals.

### 4.2 Max 1 offener Deal pro Fahrzeug

Erzwungen per Partial Unique Index. Wenn ein zweiter Kontakt sich für dasselbe Fahrzeug interessiert: als CRM-Fahrzeug-Interesse erfassen (`contact_vehicle_interests`), nicht als zweiter Deal.

### 4.3 Feste Pipeline im MVP

Die Pipeline-Stufen sind fest definiert. Keine Konfiguration. Phase 2: konfigurierbar.

### 4.4 Stage-History als eigene Tabelle

Jeder Pipeline-Übergang wird in `deal_stage_history` protokolliert. Verweildauer pro Stufe ist fachlich relevant (Pipeline-Analyse).

### 4.5 Inzahlungnahme als Freitext

`trade_in_vehicle` ist Freitext, kein FK auf `vehicles`. Modul 06 (Ankauf) existiert im MVP nicht.

### 4.6 Deal-Erstellung setzt Fahrzeug-Status nicht automatisch

Ein neuer Deal ändert den Fahrzeug-Status nicht. Reservierung bleibt eine bewusste Händler-Aktion im Inventory.

### 4.7 Fahrzeug-Zulässigkeit für Deals

**Entscheidung:** Ein Deal kann nur erstellt werden wenn das Fahrzeug in einem verkaufstauglichen Zustand ist.

**Zulässige Fahrzeug-Status für Deal-Erstellung:**
- `available` — Fahrzeug ist verkaufsbereit
- `reserved` — nur wenn für denselben Kontakt reserviert

**Nicht zulässig:** `draft`, `in_preparation`, `sold`, `delivered`, `archived`. Ein Deal auf einem bereits verkauften oder noch nicht aufbereiteten Fahrzeug ergibt fachlich keinen Sinn.

**Won-Validierung:** Bei `moveToStage('won')` wird zusätzlich geprüft ob das Fahrzeug noch `available` oder `reserved` (für denselben Kontakt) ist. Falls das Fahrzeug zwischenzeitlich verkauft wurde: `TRPCError CONFLICT`.

---

## 5. Cross-Module-Write-Exports

### Problem

Sales braucht Schreibzugriff auf CRM (Kontakt-Typ ändern, Activities erstellen) und Inventory (Fahrzeug-Status ändern). Diese Writes müssen als explizite, öffentliche Service-Exports definiert sein — kein interner Bypass.

### Benötigte Exports aus CRM (Modul 01)

```typescript
// modules/crm/index.ts — Write-Exports für Sales
export { markContactAsCustomer } from "./services/crm-service";
// → Setzt contact_type = 'customer', erstellt Activity 'type_change'

export { addActivityForContact } from "./services/crm-service";
// → Bereits definiert in CRM v2 — akzeptiert deal_id über Service-Export
```

### Benötigte Exports aus Inventory (Modul 02)

```typescript
// modules/inventory/index.ts — Write-Exports für Sales
export { markVehicleAsSold } from "./services/inventory-service";
// → Setzt status = 'sold', sold_at = now(), unpublished automatisch
// → Prüft: Fahrzeug muss 'available' oder 'reserved' sein
// → Wirft TRPCError wenn Fahrzeugstatus unzulässig

export { releaseVehicleReservation } from "./services/inventory-service";
// → Setzt status = 'available', reserved_for_contact_id = null
// → Nur wenn Fahrzeug aktuell 'reserved' ist
```

**Diese Exports müssen in den jeweiligen Modulspezifikationen ergänzt werden.** Sie sind dedizierte, benannte Funktionen — kein generischer `updateStatus`-Aufruf.

---

## 6. API (tRPC Router)

Router: `sales` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen

```typescript
type DealRecord = { /* alle DB-Spalten */ }

type DealView = {
  id: string;
  contact: { id: string; display_name: string; phone: string | null; email: string | null };
  vehicle: { id: string; make: string; model: string; variant: string | null; 
             asking_price_gross: number | null; main_photo_url: string | null };
  assigned_to_user: { id: string; name: string } | null;
  stage: DealStage;
  stage_changed_at: string;
  days_in_current_stage: number;  // Query-Time berechnet aus stage_changed_at
  offered_price: number | null;
  final_price: number | null;
  trade_in_vehicle: string | null;
  trade_in_value: number | null;
  financing_requested: boolean;
  financing_notes: string | null;
  won_at: string | null;
  lost_at: string | null;
  lost_reason: string | null;
  internal_notes: string | null;
  priority: DealPriority;
  source: string;
  stage_history: StageHistoryEntry[];
  created_at: string;
}

type DealListItem = {
  id: string;
  contact_name: string;
  contact_phone: string | null;
  vehicle_title: string;
  vehicle_main_photo_url: string | null;
  asking_price: number | null;
  offered_price: number | null;
  stage: DealStage;
  days_in_current_stage: number;
  priority: DealPriority;
  assigned_to_user: { id: string; name: string } | null;
  financing_requested: boolean;
  created_at: string;
}
```

### Procedures

```
sales.list
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    DealListInput
            {
              cursor?: string,
              limit?: number (default 20, max 100),
              stage?: DealStage | DealStage[],
              assigned_to?: string (user_id),
              contact_id?: string,
              vehicle_id?: string,
              priority?: DealPriority,
              is_open?: boolean,
              search?: string (Kontaktname, Fahrzeug make/model),
              sort_by?: 'created_at' | 'stage_changed_at' | 'offered_price',
              sort_order?: 'asc' | 'desc',
            }
  Output:   { items: DealListItem[], nextCursor: string | null }
  Regeln:
    - Compound-Cursor: (sort_field_value, id)
    - Default: created_at DESC, id DESC
    - deleted_at IS NULL implizit

sales.getById
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { id: string }
  Output:   DealView

sales.create
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    CreateDealInput
            {
              contact_id: string,
              vehicle_id: string,
              source?: DealSource (default: 'manual'),
              offered_price?: number,
              priority?: DealPriority,
              internal_notes?: string,
              financing_requested?: boolean,
              financing_notes?: string,
              trade_in_vehicle?: string,
              trade_in_value?: number,
            }
  Output:   DealView
  Regeln:
    - Prüft: Kontakt existiert und ist im Tenant
    - Prüft: Fahrzeug existiert und ist im Tenant
    - Prüft: Fahrzeug-Status ist 'available' ODER ('reserved' UND reserved_for_contact_id = contact_id)
    - Prüft: kein offener Deal für dieses Fahrzeug (Partial Unique Index)
    - Stage immer: 'inquiry'
    - assigned_to = ctx.userId (Ersteller ist zuständig)
    - Erstellt stage_history Eintrag (from: null, to: 'inquiry')
    - Erstellt CRM-Activity: addActivityForContact({ activity_type: 'deal_created', deal_id })
    - Schreibt Audit-Log

sales.update
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    UpdateDealInput
            {
              id: string,
              offered_price?: number | null,
              trade_in_vehicle?: string | null,
              trade_in_value?: number | null,
              financing_requested?: boolean,
              financing_notes?: string | null,
              internal_notes?: string | null,
              priority?: DealPriority,
            }
  Output:   DealView
  Regeln:
    - AUSGESCHLOSSEN: stage, contact_id, vehicle_id, assigned_to, source,
      final_price, won_at, lost_at, lost_reason, created_by, created_at, deleted_at
    - Schreibt Audit-Log

sales.moveToStage
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { id: string, stage: DealStage, notes?: string, lost_reason?: string, final_price?: number }
  Output:   DealView
  Regeln:
    - Übergangsregeln validieren (Abschnitt 10.1)
    - Berechnet duration_in_stage_hours für stage_history
    - Erstellt stage_history Eintrag
    - stage_changed_at = now()
    - Bei 'won': → Won-Flow (Abschnitt 7)
    - Bei 'lost': → Lost-Flow (Abschnitt 7)
    - Bei 'lost' → 'inquiry' (Reaktivierung): → Reopen-Flow (Abschnitt 7)
    - Bei allen offenen Übergängen: CRM-Activity
    - Schreibt Audit-Log

sales.assignDeal
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string, assignToUserId: string | null }
  Output:   DealView
  Regeln:
    - null = Zuordnung aufheben
    - Prüft ob User im selben Tenant ist
    - Schreibt Audit-Log

sales.archive
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   DealView
  Regeln:
    - Nur geschlossene Deals (won/lost) archivierbar
    - Soft Delete (deleted_at = now())
    - Schreibt Audit-Log

sales.restore
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   DealView
  Regeln:
    - Setzt deleted_at = null
    - Stage bleibt unverändert (won bleibt won, lost bleibt lost)
    - Prüft: wenn Deal won war, kein Konflikt mit Fahrzeug (Fahrzeug könnte zwischenzeitlich
      einen neuen Deal haben)
    - Erstellt stage_history Eintrag (from: stage, to: stage, notes: 'Wiederhergestellt')
    - Schreibt Audit-Log

sales.getStats
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { period?: 'month' | 'quarter' | 'year' (default: 'month') }
  Output:   SalesStats
            {
              total_deals: number,
              by_stage: { [stage]: number },
              open_deals: number,
              won_this_period: number,
              lost_this_period: number,
              conversion_rate: number,
              avg_days_to_close: number,
              total_revenue_this_period: number,
              avg_deal_value: number,
              pipeline_value: number,
            }

sales.getPipelineBoard
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { assigned_to?: string, limit_per_stage?: number (default 20, max 50) }
  Output:   PipelineBoard
            {
              stages: [
                {
                  stage: DealStage,
                  label: string,
                  deals: DealListItem[],
                  total_count: number,     // Gesamtzahl in dieser Stufe (auch wenn > limit)
                  total_value: number,
                }
              ]
            }
  Regeln:
    - Nur offene Stufen (inquiry...negotiation), nicht won/lost
    - Deals sortiert: priority-Rang DESC, created_at ASC
    - limit_per_stage begrenzt wie viele Deals pro Stufe geladen werden
    - total_count zeigt die Gesamtzahl (für "X weitere anzeigen"-Link)
    - "Weitere laden" → Frontend ruft sales.list mit stage-Filter auf
```

---

## 7. Seiteneffekte bei Lifecycle-Events

### Won-Flow (Abschluss)

```
Voraussetzung: final_price ist gesetzt

1. Fahrzeug-Validierung:
   - inventoryService.getVehicleById(vehicle_id)
   - Fahrzeug muss 'available' oder 'reserved' (für denselben Kontakt) sein
   - Wenn nicht: TRPCError CONFLICT — Won wird abgelehnt

2. Deal aktualisieren:
   - stage = 'won', won_at = now(), final_price speichern
   - stage_history Eintrag

3. Inventory-Seiteneffekt (synchron):
   - inventoryService.markVehicleAsSold(vehicle_id)
   - Bei Erfolg: Fahrzeug = sold + unpublished
   - Bei Fehler: Won-Mutation schlägt fehl (Gesamt-Rollback)
     → Begründung: Won ohne verkauftes Fahrzeug ist kein valider Geschäftszustand

4. CRM-Seiteneffekte (synchron, best-effort):
   - crmService.markContactAsCustomer(contact_id)
   - crmService.addActivityForContact({ activity_type: 'deal_won', deal_id })
   - Bei CRM-Fehler: Won bleibt bestehen, Fehler wird geloggt,
     Händler wird benachrichtigt "Kontakt-Typ konnte nicht aktualisiert werden"
     → Begründung: CRM-Typ-Wechsel ist nice-to-have, kein harter Geschäftszustand
```

**Warum Inventory blockierend, CRM nicht?** Ein gewonnener Deal ohne verkauftes Fahrzeug ist ein Geschäftsfehler (Fahrzeug wird weiter verkauft). Ein gewonnener Deal ohne Kontakt-Typ-Wechsel ist ein Kosmetikfehler (Kontakt wird später manuell umgestuft).

### Lost-Flow (Verlust)

```
Voraussetzung: lost_reason ist gesetzt

1. Deal aktualisieren:
   - stage = 'lost', lost_at = now(), lost_reason speichern
   - stage_history Eintrag

2. Reservierung prüfen und ggf. aufheben:
   - Wenn Fahrzeug aktuell 'reserved' UND reserved_for_contact_id = deal.contact_id:
     → inventoryService.releaseVehicleReservation(vehicle_id)
     → Fahrzeug wird 'available'
   - Wenn Fahrzeug nicht reserviert oder für anderen Kontakt reserviert: nichts tun

3. CRM-Activity:
   - crmService.addActivityForContact({ activity_type: 'deal_lost', deal_id })
```

### Reopen-Flow (lost → inquiry)

```
1. Deal aktualisieren:
   - stage = 'inquiry', stage_changed_at = now()
   - lost_at = NULL, lost_reason = NULL (Feld-Reset!)
   - stage_history Eintrag (from: 'lost', to: 'inquiry', notes: Pflicht)

2. Fahrzeug-Validierung:
   - Prüft: kein anderer offener Deal für dieses Fahrzeug
   - Wenn Fahrzeug zwischenzeitlich einen neuen offenen Deal hat: TRPCError CONFLICT

3. CRM-Activity:
   - addActivityForContact({ activity_type: 'deal_created', deal_id, notes: 'Vorgang wiederbelebt' })
```

---

## 8. Deal-Erstellung aus anderen Modulen

### Service-Exports

```typescript
// modules/sales/index.ts
export { createDealFromExternal, getOpenDealForVehicle, getDealsForContact, getOpenDealsCount } from "./services/sales-service";
export type { DealRecord, DealView, DealListItem, DealStage } from "./domain/types";
```

### `createDealFromExternal`

```typescript
createDealFromExternal(input: {
  contact_id: string,
  vehicle_id: string,
  source: DealSource,
  internal_notes?: string,
}, ctx: TenantContext): Promise<CreateDealFromExternalResult>

type CreateDealFromExternalResult = {
  deal: DealRecord | null,
  created: boolean,
  existing_deal_different_contact: boolean,
}
```

**Kritische Regel — kein Cross-Contact-Reuse:**
1. Prüft ob ein offener Deal für dieses Fahrzeug existiert
2. Wenn ja UND `contact_id` ist identisch → `{ deal: bestehender Deal, created: false, existing_deal_different_contact: false }`
3. Wenn ja UND `contact_id` ist ANDERS → `{ deal: null, created: false, existing_deal_different_contact: true }` — nur CRM-Fahrzeug-Interesse anlegen
4. Wenn kein offener Deal → `{ deal: neuer Deal, created: true, existing_deal_different_contact: false }`

**Begründung:** Ein bestehender Deal gehört zu Kontakt A. Wenn Kontakt B sich für dasselbe Fahrzeug meldet, darf er nicht den Deal von A „erben". Stattdessen: Interesse wird erfasst, Händler entscheidet manuell was passiert.

### Zuweisung externer Deals

**Entscheidung:** Extern erstellte Deals (WhatsApp, Börse, Website) werden mit `assigned_to = null` erstellt.

**Begründung:** `ctx.userId` passt nicht — das ist der System-User, nicht der zuständige Verkäufer. Der Händler oder Manager weist den Deal manuell zu. Unzugewiesene Deals werden im Dashboard prominent angezeigt.

### Flow: Börsen-Anfrage → Deal

```
1. Modul 13 empfängt Anfrage
2. CRM: createContactFromExternal() → Kontakt finden/erstellen
3. Sales: createDealFromExternal({ contact_id, vehicle_id, source: 'mobile_de' })
   → Wenn existing_deal_different_contact: nur CRM-Interest, kein Deal
4. CRM: addActivityForContact({ activity_type: 'vehicle_interest', deal_id, vehicle_id })
```

---

## 9. AI-Tools (für AI-Assistent)

Datei: `modules/sales/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "list_deals",
  description: "Verkaufsvorgänge auflisten.",
  parameters: {
    stage?: DealStage | DealStage[],
    is_open?: boolean,
    assigned_to_user_name?: string,
    contact_name?: string,
    vehicle_search?: string,
    limit?: number
  },
  execute: (params, ctx) => salesService.list(params, ctx)
},
{
  name: "get_deal_details",
  description: "Details eines Verkaufsvorgangs abrufen.",
  parameters: { id?: string, search?: string },
  execute: (params, ctx) => salesService.getByIdOrSearch(params, ctx)
},
{
  name: "get_sales_stats",
  description: "Verkaufskennzahlen abrufen.",
  parameters: { period?: 'month' | 'quarter' | 'year' },
  execute: (params, ctx) => salesService.getStats(params, ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM)

```typescript
{
  name: "propose_deal_create",
  description: "Neuen Verkaufsvorgang vorschlagen.",
  parameters: {
    contact_id: string,
    vehicle_id: string,
    offered_price?: number,
    internal_notes?: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "sales",
    action: "create_deal",
    proposed_changes: params,
    preview: () => dealCreatePreview(params, ctx),
    executeOnConfirm: () => salesService.create(params, ctx)
  })
},
{
  name: "propose_deal_stage_change",
  description: "Verkaufsvorgang in nächste Phase verschieben.",
  parameters: {
    id: string,
    stage: DealStage,
    notes?: string,
    lost_reason?: string,
    final_price?: number
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "sales",
    action: "move_to_stage",
    proposed_changes: params,
    preview: () => stageChangePreview(params, ctx),
    executeOnConfirm: () => salesService.moveToStage(params, ctx)
  })
},
{
  name: "propose_deal_update",
  description: "Konditionen eines Verkaufsvorgangs aktualisieren.",
  parameters: {
    id: string,
    offered_price?: number,
    priority?: DealPriority,
    financing_requested?: boolean,
    trade_in_vehicle?: string,
    trade_in_value?: number,
    internal_notes?: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "sales",
    action: "update_deal",
    proposed_changes: params,
    preview: () => dealUpdatePreview(params, ctx),
    executeOnConfirm: () => salesService.update(params, ctx)
  })
}
```

---

## 10. Business Rules

### 10.1 Stufenübergänge

```
Von \ Nach      inquiry  contacted  viewing  offer  negotiation  won  lost
inquiry           —        ✓          ✓        ✓       —          —    ✓
contacted         ✓        —          ✓        ✓       —          —    ✓
viewing           —        —          —        ✓       ✓          —    ✓
offer             —        —          —        —       ✓          ✓    ✓
negotiation       —        —          —        ✓       —          ✓    ✓
won               —        —          —        —       —          —    —
lost              ✓        —          —        —       —          —    —
```

**Vorwärtssprünge erlaubt.** `lost` → `inquiry` als Wiederbelebung (mit Feld-Reset, siehe Reopen-Flow).

### 10.2 Ein offener Deal pro Fahrzeug

Erzwungen per Partial Unique Index. Zweites Interesse → CRM-`contact_vehicle_interests`, nicht zweiter Deal.

### 10.3 Won-Pflichtfelder

`final_price` Pflicht bei `won`. DB-Constraint + Service-Check.

### 10.4 Lost-Pflichtfelder

`lost_reason` Pflicht bei `lost`. DB-Constraint + Service-Check.

### 10.5 Reopen-Feld-Reset

Bei `lost` → `inquiry`: `lost_at = NULL`, `lost_reason = NULL`. Notes für Begründung sind Pflicht.

### 10.6 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Deals ansehen | `owner`, `admin`, `manager`, `salesperson` |
| Deal anlegen | `owner`, `admin`, `manager`, `salesperson` |
| Deal bearbeiten | `owner`, `admin`, `manager`, `salesperson` |
| Deal-Stufe verschieben | `owner`, `admin`, `manager`, `salesperson` |
| Deal zuweisen | `owner`, `admin`, `manager` |
| Deal archivieren/wiederherstellen | `owner`, `admin`, `manager` |
| Sales-Statistiken | `owner`, `admin`, `manager` |

**`receptionist` und `viewer` haben keinen Sales-Zugriff.**

---

## 11. UI-Screens (Händler-Interface)

### 11.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Pipeline-Board | `/verkauf` | Kanban-Board mit offenen Deals |
| Deal-Liste | `/verkauf/liste` | Tabellarische Ansicht aller Deals |
| Deal anlegen | `/verkauf/neu` | Kontakt + Fahrzeug auswählen |
| Deal-Detail | `/verkauf/[id]` | Alle Daten, Stage-History, Aktionen |

### 11.2 Pipeline-Board

**Spalten:** inquiry, contacted, viewing, offer, negotiation. `won`/`lost` als Counter oben.

**Deal-Karten:** Kontaktname, Fahrzeug (Marke/Modell + Foto), angebotener Preis, Prioritäts-Badge, Tage in Stufe, zuständiger Verkäufer.

**Drag & Drop:** Deals zwischen Stufen verschieben → `moveToStage`. Bei `won`/`lost`: Modal für Pflichtfelder.

**Pro Stufe:** `limit_per_stage` Deals angezeigt, `total_count` als Badge. "X weitere" → Link zu `sales.list` mit Stage-Filter.

**Unzugewiesene Deals:** Visuell hervorgehoben (kein Avatar, roter Rand).

### 11.3 Deal anlegen — Flow

```
Schritt 1: Kontakt auswählen (Typeahead-Suche oder "Neu anlegen")
Schritt 2: Fahrzeug auswählen (Typeahead mit Foto + Prüfung auf offenen Deal)
Schritt 3: Konditionen (optional) → Speichern
```

### 11.4 Komponenten

| Komponente | Zweck |
|------------|-------|
| `PipelineBoard` | Kanban mit Drag & Drop |
| `PipelineColumn` | Stufen-Spalte |
| `DealCard` | Deal-Karte für Board |
| `DealRow` | Tabellenzeile |
| `DealStageBadge` | Stufen-Badge |
| `DealPriorityBadge` | Prioritäts-Badge |
| `DealForm` | Anlege-/Edit-Formular |
| `ContactPicker` | Kontakt-Suche |
| `VehiclePicker` | Fahrzeug-Suche mit Verfügbarkeitsprüfung |
| `StageChangeModal` | Modal für Won/Lost Pflichtfelder |
| `StageHistory` | Timeline der Übergänge |
| `WonLostCounter` | Gewonnen/Verloren-Counter |
| `UnassignedDealsBanner` | "X Vorgänge ohne Zuständigen" |

---

## 12. MVP-Scope vs. Phase 2

### MVP — Wird gebaut

- [x] Deal anlegen mit Fahrzeug-Zulässigkeitsprüfung
- [x] Deal bearbeiten (Konditionen, Priorität, Notizen)
- [x] Pipeline-Board (Kanban mit Drag & Drop, Pagination pro Stufe)
- [x] moveToStage mit Übergangsregeln
- [x] Won-Flow mit Inventory- und CRM-Seiteneffekten
- [x] Lost-Flow mit Reservierungs-Cleanup
- [x] Reopen-Flow (lost → inquiry mit Feld-Reset)
- [x] Stage-History mit Verweildauer
- [x] Deal-Zuweisung
- [x] Externe Deal-Erstellung (kein Cross-Contact-Reuse)
- [x] AI-Tools (PROPOSE)
- [x] KPIs (Abschlussrate, Pipeline-Wert)

### Phase 2

- [ ] AI-Priorisierung, Verlustprävention
- [ ] Konfigurierbare Pipeline
- [ ] Angebots-PDF
- [ ] Finanzierungsrechner (Modul 04)
- [ ] Inzahlungnahme-Bewertung (Modul 06)
- [ ] Multi-Deal pro Fahrzeug (konfigurierbar)

---

## 13. Technische Abhängigkeiten

### Interne

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Modul 02 (Inventar) | `markVehicleAsSold`, `releaseVehicleReservation`, `getVehicleById` | Won-/Lost-Flow, Fahrzeug-Validierung |
| Modul 01 (CRM) | `markContactAsCustomer`, `addActivityForContact`, `getContactById` | Won-Flow, Activities |
| AI-Command-Service | AI-Integration | PROPOSE→CONFIRM |
| `audit_log` | Platform Foundation | Alle Schreiboperationen |

### Externe

Keine.

---

## 14. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 3.1 (Händlersprache), Abschnitt 4 (Build-Reihenfolge) |
| `01_ARCHITECTURE.md` | Abschnitt 5 (tRPC: moveToStage, assignOwner), Abschnitt 6 (AI) |
| `MOD_01_CRM.md` | Kontakt-Verknüpfung, Write-Exports: markContactAsCustomer, addActivityForContact |
| `MOD_02_INVENTORY.md` | Fahrzeug-Verknüpfung, Write-Exports: markVehicleAsSold, releaseVehicleReservation |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 03 vollständig.
> Stage-Änderungen NUR über sales.moveToStage.
> sales.update darf stage, contact_id, vehicle_id, assigned_to NICHT ändern.
> Won blockiert wenn Fahrzeug nicht available/reserved — kein stilles Versagen.
> Lost hebt Reservierung auf wenn Fahrzeug für denselben Kontakt reserviert war.
> Reopen (lost→inquiry) setzt lost_at und lost_reason auf NULL.
> createDealFromExternal: KEIN Cross-Contact-Reuse. Verschiedener Kontakt → nur CRM-Interest.
> Externe Deals: assigned_to = null, Händler weist manuell zu.
> Cross-Module-Writes nur über benannte Service-Exports (markVehicleAsSold, markContactAsCustomer).
