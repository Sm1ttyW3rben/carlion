# MOD 13 — Fahrzeugbörsen-Hub

> Modulspezifikation für die Integration mit mobile.de und AutoScout24.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_02_INVENTORY.md`, `MOD_01_CRM.md`, `MOD_03_SALES.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v2)

---

## 1. Zweck & Einordnung

Der Börsen-Hub verbindet Carlion mit den großen deutschen Fahrzeugbörsen mobile.de und AutoScout24. Er hat zwei Kernaufgaben:

1. **Import:** Bestehenden Fahrzeugbestand aus Börsen-Exporten ins Carlion-Inventar übernehmen (Datenmigration beim Onboarding)
2. **Sync:** Fahrzeuge aus dem Carlion-Inventar auf den Börsen veröffentlichen und Inserat-Performance tracken

**Händlersprache:** Börse = mobile.de / AutoScout24. Inserat = ein Fahrzeug das auf einer Börse steht.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 13 |
| Kategorie | Kritische Integrationen |
| Phase | **MVP** |
| Build-Reihenfolge | 5 (nach Sales) |
| Abhängigkeiten | Modul 02 (Inventar), Modul 01 (CRM), Modul 03 (Sales) |
| Abhängig davon | Modul 11 (Website) |

---

## 2. Kernkonzept — Zwei Betriebsmodi

### Modus 1: Datei-Import (MVP-Start, kein Partnervertrag nötig)

Der Händler exportiert seinen Bestand aus dem Börsen-Backend als CSV oder XML. Carlion parst die Datei und importiert die Fahrzeuge. Das ist der **primäre Migrationspfad** — der Händler hat seinen Bestand in 2 Minuten im System.

### Modus 2: API-Sync (MVP — wenn Partnervertrag steht)

Carlion verbindet sich direkt mit den Börsen-APIs. Outbound: Inserate erstellen/aktualisieren/deaktivieren. Inbound: Anfragen importieren, Performance abrufen.

**MVP-Scope:** Beides wird gebaut. Modus 2 erfordert einen Partnervertrag und ist hinter Feature-Flag steuerbar. Modus 1 funktioniert ab Tag 1.

---

## 3. Datenmodell

### Tabelle: `listing_connections`

Konfiguration der Börsen-Verbindung pro Tenant.

```
listing_connections:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  platform          text, not null
  
  -- Authentifizierung (AES-256 verschlüsselt gespeichert)
  api_key_encrypted text, nullable
  dealer_id         text, nullable (Händler-ID auf der Börse)
  
  -- Status
  connection_status text, not null, default 'disconnected'
                    -- disconnected | connected | draining | error
  last_sync_at      timestamptz, nullable
  last_error        text, nullable
  
  -- Meta
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  UNIQUE (tenant_id, platform)
  CHECK platform IN ('mobile_de', 'autoscout24')
  CHECK connection_status IN ('disconnected', 'connected', 'draining', 'error')

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

**Kein `auto_sync_enabled` und `sync_interval_minutes` im MVP.** Im MVP gibt es feste Cron-Intervalle (siehe Abschnitt 8). Konfigurierbare Sync-Settings sind Phase 2.

### Tabelle: `listings`

Ein Eintrag pro Fahrzeug pro Börse.

```
listings:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  vehicle_id        uuid, foreign key → vehicles, not null
  platform          text, not null
  
  -- Börsen-Referenz
  external_id       text, nullable (Inserat-ID auf der Börse)
  external_url      text, nullable
  
  -- Sync-Status
  sync_status       text, not null, default 'pending'
                    -- pending | synced | error | deactivated
  last_synced_at    timestamptz, nullable
  last_sync_error   text, nullable
  
  -- Performance
  views_total       integer, not null, default 0
  clicks_total      integer, not null, default 0
  inquiries_total   integer, not null, default 0
  last_performance_update timestamptz, nullable
  
  -- Meta
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  UNIQUE (tenant_id, vehicle_id, platform)
  CHECK platform IN ('mobile_de', 'autoscout24')
  CHECK sync_status IN ('pending', 'synced', 'error', 'deactivated')

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_listings_tenant ON listings(tenant_id)
  INDEX idx_listings_vehicle ON listings(tenant_id, vehicle_id)
  INDEX idx_listings_platform ON listings(tenant_id, platform)
  INDEX idx_listings_sync_pending ON listings(tenant_id, sync_status) WHERE sync_status = 'pending'
  INDEX idx_listings_external ON listings(tenant_id, platform, external_id) WHERE external_id IS NOT NULL
```

### Tabelle: `listing_inquiries`

Eingehende Anfragen von den Börsen.

```
listing_inquiries:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  listing_id        uuid, foreign key → listings, not null
  vehicle_id        uuid, foreign key → vehicles, not null
  
  -- Anfrage-Daten
  inquirer_name     text, nullable
  inquirer_email    text, nullable
  inquirer_phone    text, nullable
  message           text, nullable
  
  -- Verarbeitung
  processed         boolean, not null, default false
  contact_id        uuid, nullable, foreign key → contacts
  deal_id           uuid, nullable (kein FK — wie in CRM)
  processing_notes  text, nullable (z.B. "Bestehender Deal eines anderen Kontakts")
  
  -- Herkunft
  platform          text, not null
  external_inquiry_id text, nullable
  received_at       timestamptz, not null, default now()
  
  -- Meta
  created_at        timestamptz, default now()

  -- Constraints
  UNIQUE (tenant_id, platform, external_inquiry_id) WHERE external_inquiry_id IS NOT NULL
  CHECK platform IN ('mobile_de', 'autoscout24')

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_inquiries_tenant ON listing_inquiries(tenant_id, received_at DESC)
  INDEX idx_inquiries_unprocessed ON listing_inquiries(tenant_id) WHERE processed = false
  INDEX idx_inquiries_vehicle ON listing_inquiries(tenant_id, vehicle_id)
```

### Tabelle: `import_sessions`

Serverseitige Persistenz von Import-Parse-Ergebnissen. Verhindert Client-Manipulation.

```
import_sessions:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  platform          text, not null
  status            text, not null, default 'pending'
                    -- pending | confirmed | expired
  parsed_vehicles   jsonb, not null (vollständiges Parse-Ergebnis)
  parse_errors      jsonb, not null, default '[]'
  parse_warnings    jsonb, not null, default '[]'
  vehicle_count     integer, not null
  duplicate_count   integer, not null, default 0
  original_filename text, nullable
  created_at        timestamptz, default now()
  expires_at        timestamptz, not null (default: created_at + 1 hour)

  -- Constraints
  CHECK platform IN ('mobile_de', 'autoscout24')
  CHECK status IN ('pending', 'confirmed', 'expired')

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_import_sessions_tenant ON import_sessions(tenant_id, created_at DESC)
```

---

## 4. Designentscheidungen

### 4.1 Plattform-gescopter Import-Key

**Entscheidung:** `source_reference` in Inventory enthält die Plattform als Präfix: `"mobile_de:{external_id}"` oder `"autoscout24:{external_id}"`.

**Begründung:** mobile.de und AutoScout24 können theoretisch dieselbe numerische Inserat-ID verwenden. Ohne Plattform im Match-Key kann ein Import das falsche Fahrzeug aktualisieren.

**Konsequenz:** `inventoryService.bulkUpsertVehicles` matcht auf `(tenant_id, source='boersen_import', source_reference)` — wobei `source_reference` immer plattform-präfixiert ist. Der Unique Index in Inventory schützt gegen Duplikate.

### 4.2 Serverseitige Import-Session

**Entscheidung:** Parse-Ergebnisse werden serverseitig in `import_sessions` gespeichert. `confirmImport` akzeptiert nur eine `importSessionId`, keine Fahrzeugdaten vom Client.

**Begründung:** Wenn der Client nach Preview die Fahrzeugdaten zurücksendet, kann er Felder manipulieren (Preise, externe IDs, Plattformzuordnung). Das ist ein Integritätsrisiko. Die Import-Session ist die serverseitige Wahrheit.

**Flow:**
```
1. Upload + Parse → import_sessions Eintrag (parsed_vehicles als JSONB)
2. Frontend zeigt Preview aus der Session (über getImportSession)
3. confirmImport({ importSessionId }) → liest aus DB, nicht vom Client
4. Session status = 'confirmed'
5. Expired Sessions werden per Cleanup-Cron gelöscht
```

### 4.3 Connection-Drain vor Disconnect

**Entscheidung:** `removeConnection` löscht Credentials nicht sofort. Stattdessen:

```
1. connection_status = 'draining'
2. Outbox-Einträge: alle aktiven Listings remote deaktivieren
3. Cron verarbeitet Deaktivierungen
4. Wenn alle Listings remote deaktiviert: Credentials löschen, status = 'disconnected'
5. Timeout: nach 24h wird forciert disconnected (mit Warnung an Händler)
```

**Begründung:** Wenn Credentials vor der Remote-Deaktivierung gelöscht werden, bleiben Inserate auf der Börse live ("Ghost Listings"). Das ist für den Händler schlimmer als eine kurze Verzögerung beim Disconnect.

### 4.4 Keine konfigurierbaren Sync-Settings im MVP

**Entscheidung:** `auto_sync_enabled` und `sync_interval_minutes` existieren nicht im MVP-Schema. Im MVP gibt es feste Cron-Intervalle.

**Begründung:** Konfigurationsfelder die von keinem Runtime-Code gelesen werden sind Scheinkonfiguration. Phase 2: konfigurierbar.

### 4.5 Outbound-Updates via Reconciliation-Cron

**Entscheidung:** Änderungen an inserierten Fahrzeugen (Preis, Beschreibung, Fotos, Unpublish) werden nicht per Event erkannt, sondern per Reconciliation-Cron.

```
Cron: /api/jobs/listings-reconcile (alle 5 Minuten)
  Für jedes aktive Listing (sync_status = 'synced'):
  1. Fahrzeug aus Inventory laden
  2. Vergleich: vehicle.updated_at > listing.last_synced_at?
  3. Oder: vehicle.published = false?
  4. Wenn Änderung erkannt: Outbox-Eintrag 'update_listing' oder 'deactivate_listing'
  5. Listing.last_synced_at bleibt bis Outbox erfolgreich
```

**Begründung:** Ein Event-System ist im MVP nicht vorgesehen. Der Reconciliation-Cron ist einfacher, testbarer und braucht keine Infrastruktur-Erweiterung.

---

## 5. Datei-Import

### Unterstützte Formate

| Börse | Format | Encoding |
|-------|--------|----------|
| mobile.de | CSV (Semikolon-getrennt) | ISO-8859-1 |
| AutoScout24 | CSV oder XML | UTF-8 |

### Import-Flow (mit Import-Session)

```
Schritt 1: Datei hochladen
  Route: app/api/upload/boersen-import/route.ts (multipart)
  → Validierung: max 10 MB, CSV/XML
  → Format-Erkennung (Header/Root-Element)
  → Parsen via server/services/boersen-parser.ts
  → source_reference = "{platform}:{external_id}" pro Fahrzeug
  → Ergebnis in import_sessions speichern (parsed_vehicles als JSONB)
  → Response: { importSessionId, preview, errors, warnings }

Schritt 2: Preview (Frontend)
  → Frontend zeigt erste 10 Fahrzeuge
  → Duplikate markiert (Match auf source_reference in Inventory)
  → Parse-Fehler und Warnungen angezeigt
  → Händler kann die gesamte Session verwerfen oder bestätigen

Schritt 3: Import bestätigen
  → listings.confirmImport({ importSessionId })
  → Server liest parsed_vehicles aus import_sessions (NICHT vom Client)
  → inventoryService.bulkUpsertVehicles() aufrufen
  → Listings-Einträge pro Fahrzeug erstellen (sync_status: 'synced' bei Datei-Import)
  → Session status = 'confirmed'
  → Ergebnis: { imported, updated, errors }
```

### Parser-Service

```
server/services/boersen-parser.ts
  parseMobileDeExport(csvContent: string): ParseResult
  parseAutoScout24Export(content: string, format: 'csv' | 'xml'): ParseResult

type ParseResult = {
  platform: 'mobile_de' | 'autoscout24';
  vehicles: VehicleImportRow[];
  errors: ParseError[];
  warnings: ParseWarning[];
}

type VehicleImportRow = {
  source_reference: string;  // "{platform}:{external_id}"
  external_id: string;
  make: string;
  model: string;
  // ... alle mapbaren Felder
  unmapped_fields: Record<string, string>;
}
```

---

## 6. Outbound-Sync (Carlion → Börse)

### Wann wird ein Outbox-Eintrag erstellt?

- **Manuell:** Händler klickt "Auf Börse inserieren" → `listings.createListing`
- **Reconciliation-Cron:** Erkennt Änderungen an inserierten Fahrzeugen (Abschnitt 4.5)
- **Connection-Drain:** Alle aktiven Listings deaktivieren bei `removeConnection`

### Outbox-Einträge

```
service:   'boersen_sync'
action:    'create_listing' | 'update_listing' | 'deactivate_listing'
payload:   { listing_id, vehicle_id, platform, tenant_id }

Verarbeitung durch /api/jobs/process-outbox (jede Minute):
  1. Listing + Vehicle laden
  2. Vehicle-Daten auf Börsen-Format mappen
  3. API-Call an Börse (über Service-Client)
  4. Erfolg: listing.sync_status = 'synced', external_id + external_url setzen
  5. Fehler: Outbox-Retry (exponentieller Backoff)
```

### Service-Clients

```
server/services/mobile-de.ts
  createListing(dealerId, vehicleData): Promise<{ externalId, url }>
  updateListing(externalId, vehicleData): Promise<void>
  deactivateListing(externalId): Promise<void>
  getListingPerformance(externalId): Promise<{ views, clicks, inquiries }>
  getInquiries(dealerId, since): Promise<Inquiry[]>

server/services/autoscout24.ts
  (gleiche Struktur)
```

---

## 7. Inbound-Sync (Börse → Carlion)

### Anfragen-Import

**Dedizierter Cron:** `/api/jobs/listings-pull-inquiries` (alle 5 Minuten)

```
Für jeden Tenant mit aktiver Verbindung (connection_status = 'connected'):
  1. Anfragen abrufen (getInquiries, seit letztem Abruf)
  2. Deduplizierung: external_inquiry_id (Unique Index)
  3. listing_inquiries Eintrag erstellen

  4. Automatische Verarbeitung:
     a. CRM: createContactFromExternal() → Kontakt finden/erstellen
     b. Sales: createDealFromExternal()
        → Prüfe Rückgabe: existing_deal_different_contact?
        → Wenn ja: KEINEN Deal verknüpfen, nur CRM-Interest anlegen,
          processing_notes = "Bestehender Vorgang eines anderen Kontakts"
        → Wenn nein: deal_id setzen
     c. listing_inquiries.processed = true, contact_id + ggf. deal_id setzen
     d. CRM: addActivityForContact({ type: 'vehicle_interest', vehicle_id, deal_id })
```

**Fallback bei Fehler:** Inquiry bleibt `processed = false`. Händler kann manuell verarbeiten.

### Performance-Update

**Dedizierter Cron:** `/api/jobs/listings-pull-performance` (alle 2 Stunden)

```
Für jedes aktive Listing (sync_status = 'synced'):
  1. Performance abrufen (getListingPerformance)
  2. views_total, clicks_total, inquiries_total aktualisieren
  3. last_performance_update = now()
```

### Cron-Übersicht (Listings-spezifisch)

| Cron-Endpunkt | Intervall | Zweck |
|---------------|-----------|-------|
| `/api/jobs/process-outbox` | 1 Min | Outbound-Sync (shared mit anderen Modulen) |
| `/api/jobs/listings-reconcile` | 5 Min | Erkennt Änderungen an inserierten Fahrzeugen |
| `/api/jobs/listings-pull-inquiries` | 5 Min | Anfragen von Börsen abrufen |
| `/api/jobs/listings-pull-performance` | 2 Std | Performance-Daten abrufen |
| `/api/jobs/cleanup` | Täglich 03:00 | Expired Import-Sessions löschen |

---

## 8. API (tRPC Router)

Router: `listings` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen

```typescript
type ListingView = {
  id: string;
  vehicle: { id: string; make: string; model: string; asking_price: number | null; main_photo_url: string | null };
  platform: Platform;
  external_id: string | null;
  external_url: string | null;
  sync_status: SyncStatus;
  last_synced_at: string | null;
  last_sync_error: string | null;
  views_total: number;
  clicks_total: number;
  inquiries_total: number;
  created_at: string;
}

type InquiryView = {
  id: string;
  vehicle: { id: string; make: string; model: string; main_photo_url: string | null };
  platform: Platform;
  inquirer_name: string | null;
  inquirer_email: string | null;
  inquirer_phone: string | null;
  message: string | null;
  processed: boolean;
  processing_notes: string | null;
  contact: { id: string; display_name: string } | null;
  deal: { id: string; stage: string } | null;
  received_at: string;
}

type ConnectionView = {
  id: string;
  platform: Platform;
  dealer_id: string | null;
  connection_status: ConnectionStatus;  // disconnected | connected | draining | error
  last_sync_at: string | null;
  last_error: string | null;
  listings_count: number;
}

type ImportSessionView = {
  id: string;
  platform: Platform;
  status: 'pending' | 'confirmed' | 'expired';
  preview: VehicleImportRow[];  // erste 10
  total_count: number;
  duplicate_count: number;
  errors: ParseError[];
  warnings: ParseWarning[];
  created_at: string;
  expires_at: string;
}
```

### Procedures

```
listings.getConnections
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Output:   ConnectionView[]

listings.setupConnection
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { platform: Platform, api_key: string, dealer_id: string }
  Output:   ConnectionView
  Regeln:
    - API-Key AES-256 verschlüsselt speichern
    - Verbindung testen (API-Call)
    - Erfolg: connection_status = 'connected'
    - Fehler: connection_status = 'error', last_error setzen

listings.removeConnection
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { connectionId: string }
  Output:   ConnectionView
  Regeln:
    - Setzt connection_status = 'draining'
    - Erstellt Outbox-Einträge: alle aktiven Listings remote deaktivieren
    - Credentials werden NICHT sofort gelöscht (erst nach Drain)
    - Drain-Cron deaktiviert remote, dann: Credentials löschen, status = 'disconnected'
    - Timeout: 24h → forciert disconnected mit Warnung

listings.listListings
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    {
              cursor?: string,
              limit?: number (default 20, max 100),
              platform?: Platform,
              sync_status?: SyncStatus,
              vehicle_id?: string,
              sort_by?: 'created_at' | 'views_total' | 'inquiries_total',
              sort_order?: 'asc' | 'desc',
            }
  Output:   { items: ListingView[], nextCursor: string | null }
  Regeln:
    - Compound-Cursor: (sort_field_value, id)
    - Default: created_at DESC, id DESC

listings.createListing
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { vehicle_id: string, platform: Platform }
  Output:   ListingView
  Regeln:
    - Fahrzeug muss published sein
    - Kein bestehendes aktives Listing für Fahrzeug+Börse
    - Verbindung muss 'connected' sein
    - Erstellt Listing sync_status = 'pending'
    - Erstellt Outbox-Eintrag: 'create_listing'

listings.deactivateListing
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { listing_id: string }
  Output:   ListingView
  Regeln:
    - sync_status = 'deactivated' (lokal)
    - Outbox-Eintrag: 'deactivate_listing' (remote)

listings.syncNow
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { listing_id: string }
  Output:   ListingView
  Regeln:
    - Outbox-Eintrag mit next_attempt_at = now (sofort-Retry)

listings.uploadImportFile → KEIN tRPC. Dedizierter Route Handler.
  Route:    app/api/upload/boersen-import/route.ts
  Auth:     roleProcedure(["owner", "admin"])
  Input:    multipart/form-data (Datei)
  Output:   ImportSessionView
  Regeln:
    - Max 10 MB, CSV/XML
    - Parsen via boersen-parser Service
    - Ergebnis in import_sessions speichern (serverseitig!)
    - Response: Session-ID + Preview + Fehler/Warnungen

listings.getImportSession
  Type:     query
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { importSessionId: string }
  Output:   ImportSessionView
  Zweck:    Import-Preview nachladen (falls Frontend Session-Daten braucht)

listings.confirmImport
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { importSessionId: string }
  Output:   { imported: number, updated: number, errors: ImportError[] }
  Regeln:
    - Liest parsed_vehicles aus import_sessions (NICHT vom Client!)
    - Session muss status 'pending' und nicht expired sein
    - inventoryService.bulkUpsertVehicles() mit source='boersen_import'
    - source_reference = "{platform}:{external_id}" (plattform-gescopet)
    - Listings-Einträge pro importiertes Fahrzeug erstellen
    - Session status = 'confirmed'
    - Schreibt Audit-Log

listings.listInquiries
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    {
              cursor?: string,
              limit?: number (default 20, max 100),
              platform?: Platform,
              processed?: boolean,
              vehicle_id?: string,
            }
  Output:   { items: InquiryView[], nextCursor: string | null }
  Regeln:
    - Default-Sortierung: received_at DESC, id DESC
    - Compound-Cursor

listings.processInquiry
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { inquiry_id: string }
  Output:   { contact: ContactView, deal: DealView | null, notes: string | null }
  Regeln:
    - CRM: createContactFromExternal()
    - Sales: createDealFromExternal()
    - Prüft: existing_deal_different_contact?
      → Wenn ja: deal = null, nur CRM-Interest, notes = "Bestehender Vorgang eines anderen Kontakts"
      → Wenn nein: deal verknüpfen
    - inquiry.processed = true
    - Schreibt Audit-Log

listings.getStats
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { platform?: Platform }
  Output:   ListingsStats
            {
              total_listings: number,
              by_platform: { [platform]: number },
              by_sync_status: { [status]: number },
              total_views: number,
              total_clicks: number,
              total_inquiries: number,
              unprocessed_inquiries: number,
            }
```

---

## 9. AI-Tools (für AI-Assistent)

Datei: `modules/listings/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "get_listing_stats",
  description: "Börsen-Performance abrufen.",
  parameters: { platform?: Platform },
  execute: (params, ctx) => listingsService.getStats(params, ctx)
},
{
  name: "get_listing_for_vehicle",
  description: "Inserat-Status eines Fahrzeugs abrufen.",
  parameters: { vehicle_id: string },
  execute: (params, ctx) => listingsService.getListingsForVehicle(params.vehicle_id, ctx)
},
{
  name: "list_unprocessed_inquiries",
  description: "Unbearbeitete Börsen-Anfragen anzeigen.",
  parameters: {},
  execute: (params, ctx) => listingsService.listInquiries({ processed: false }, ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM)

```typescript
{
  name: "propose_create_listing",
  description: "Fahrzeug auf Börse inserieren vorschlagen.",
  parameters: { vehicle_id: string, platform: Platform },
  execute: (params, ctx) => aiCommandService.propose({
    module: "listings",
    action: "create_listing",
    proposed_changes: params,
    preview: () => createListingPreview(params, ctx),
    executeOnConfirm: () => listingsService.createListing(params, ctx)
  })
},
{
  name: "propose_process_inquiry",
  description: "Börsen-Anfrage verarbeiten vorschlagen.",
  parameters: { inquiry_id: string },
  execute: (params, ctx) => aiCommandService.propose({
    module: "listings",
    action: "process_inquiry",
    proposed_changes: params,
    preview: () => processInquiryPreview(params, ctx),
    executeOnConfirm: () => listingsService.processInquiry(params, ctx)
  })
}
```

---

## 10. Lese-Schnittstelle für andere Module

```typescript
// modules/listings/index.ts
export { getListingsForVehicle } from "./services/listings-service";
export { getUnprocessedInquiriesCount } from "./services/listings-service";
export type { ListingView, InquiryView, Platform, SyncStatus } from "./domain/types";
```

---

## 11. UI-Screens

### 11.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Börsen-Übersicht | `/boersen` | Verbindungsstatus, KPIs, unbearbeitete Anfragen |
| Inserate-Liste | `/boersen/inserate` | Alle Inserate mit Status, Performance |
| Anfragen-Liste | `/boersen/anfragen` | Eingehende Anfragen |
| Import | `/boersen/import` | Datei-Upload + Preview + Import |
| Verbindung einrichten | `/boersen/verbindung` | API-Key, Verbindungstest |

### 11.2 Komponenten

| Komponente | Zweck |
|------------|-------|
| `ConnectionStatusCard` | Verbindungsstatus pro Börse (mit Drain-Anzeige) |
| `ListingRow` | Inserat-Zeile mit Performance |
| `ListingSyncBadge` | Sync-Status-Badge |
| `InquiryCard` | Anfrage-Karte |
| `ImportWizard` | Upload → Preview → Bestätigung |
| `ImportPreviewTable` | Vorschau mit Duplikat-/Fehler-Markierung |
| `PerformanceBar` | Views/Klicks/Anfragen |
| `ListingsStatsBar` | KPI-Leiste |
| `UnprocessedInquiriesBanner` | "X neue Anfragen" — prominent |

---

## 12. Business Rules

### 12.1 Inserat-Voraussetzungen

- Fahrzeug muss `published = true` sein
- Verbindung muss `connection_status = 'connected'` haben
- Kein bestehendes aktives Listing für Fahrzeug+Börse

### 12.2 Automatische Deaktivierung

Reconciliation-Cron erkennt:
- Fahrzeug `published = false` → Listing deaktivieren
- Fahrzeug `deleted_at IS NOT NULL` → Listing deaktivieren
- Fahrzeug `status IN ('sold', 'delivered')` → Listing deaktivieren

### 12.3 Inquiry-Verarbeitung (Cross-Contact-Guard)

Automatische und manuelle Verarbeitung prüfen den Sales-Rückgabewert:
- `existing_deal_different_contact = true` → Kein Deal-Reuse, nur CRM-Interest + processing_notes
- `existing_deal_different_contact = false` → Deal verknüpfen

### 12.4 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Inserate/Anfragen ansehen | `owner`, `admin`, `manager`, `salesperson` |
| Inserat erstellen/deaktivieren | `owner`, `admin`, `manager`, `salesperson` |
| Anfragen verarbeiten | `owner`, `admin`, `manager`, `salesperson` |
| Verbindung einrichten/entfernen | `owner`, `admin` |
| Import ausführen | `owner`, `admin` |
| Statistiken sehen | `owner`, `admin`, `manager` |
| Verbindungsstatus sehen | `owner`, `admin`, `manager` |

---

## 13. MVP-Scope vs. Phase 2

### MVP — Wird gebaut

- [x] CSV/XML-Import mit serverseitiger Import-Session
- [x] Plattform-gescopter Import-Key
- [x] API-Verbindung einrichten (hinter Feature-Flag bis Partnervertrag)
- [x] Outbound-Sync via Outbox
- [x] Reconciliation-Cron für Fahrzeugänderungen
- [x] Inbound: Anfragen importieren (Cron-Pull)
- [x] Anfragen → CRM + Sales (mit Cross-Contact-Guard)
- [x] Performance-Zähler (aggregiert)
- [x] Connection-Drain bei Disconnect
- [x] AI-Tools (PROPOSE)

### Phase 2

- [ ] Konfigurierbare Sync-Intervalle
- [ ] Foto-Import aus Börsen-Export
- [ ] Performance-Zeitreihen
- [ ] Webhook-Inbound (Echtzeit-Anfragen)
- [ ] AI-Inserat-Optimierung
- [ ] Automatische Inserierung aller published Fahrzeuge

---

## 14. Technische Abhängigkeiten

### Interne

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Modul 02 (Inventar) | `bulkUpsertVehicles`, `getVehicleById` | Import, Reconciliation |
| Modul 01 (CRM) | `createContactFromExternal` | Anfrage → Kontakt |
| Modul 03 (Sales) | `createDealFromExternal` | Anfrage → Deal |
| Outbox (Architektur) | Async-Sync | Outbound, Drain |

### Externe

| Service | Zweck | Fallback |
|---------|-------|----------|
| mobile.de API | Sync, Anfragen, Performance | CSV-Import, Börsen-Backend |
| AutoScout24 API | Sync, Anfragen, Performance | CSV-Import, Börsen-Backend |

---

## 15. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 4 (Daten-Migration) |
| `01_ARCHITECTURE.md` | Abschnitt 8 (Outbox, Service-Clients) |
| `MOD_02_INVENTORY.md` | bulkUpsertVehicles, Published-Status, Reconciliation |
| `MOD_01_CRM.md` | createContactFromExternal |
| `MOD_03_SALES.md` | createDealFromExternal (mit Cross-Contact-Guard) |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 13 vollständig.
> Import: IMMER über serverseitige Import-Session — confirmImport bekommt nur importSessionId, KEINE Fahrzeugdaten vom Client.
> source_reference ist IMMER plattform-präfixiert: "{platform}:{external_id}".
> Outbound IMMER über Outbox. Kein synchroner Börsen-API-Call.
> Inquiry-Verarbeitung: Cross-Contact-Guard prüfen. Kein Deal-Reuse bei anderem Kontakt.
> removeConnection: Drain zuerst, Credentials löschen danach.
> Kein Event-System — Reconciliation-Cron für Fahrzeugänderungen.
> Separate Crons: Outbox, Reconcile, Pull-Inquiries, Pull-Performance.
