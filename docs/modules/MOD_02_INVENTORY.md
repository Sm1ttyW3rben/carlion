# MOD 02 — Fahrzeugverwaltung & Inventar

> Modulspezifikation für das zentrale Datenobjekt „Fahrzeug".
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_34_DNA_ENGINE.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v2)

---

## 1. Zweck & Einordnung

Die Fahrzeugverwaltung ist das Herz von Carlion. Ohne Fahrzeuge gibt es kein Geschäft — kein Inserat, keinen Deal, keine Website. Dieses Modul verwaltet den gesamten Lebenszyklus eines Fahrzeugs im Autohaus: vom Ankauf oder Import über die Aufbereitung und Vermarktung bis zum Verkauf und zur Übergabe.

**Zentrale Rolle:** Fahrzeuge sind das Datenobjekt auf das alle anderen Module aufbauen. CRM verknüpft Interessenten mit Fahrzeugen, Sales erzeugt Deals auf Fahrzeugen, Börsen-Hub publiziert Fahrzeuge, Website zeigt Fahrzeuge an, AI-Assistent beantwortet Fragen zu Fahrzeugen.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 02 |
| Kategorie | Kerngeschäft |
| Phase | **MVP** |
| Build-Reihenfolge | 2 (nach DNA-Engine) |
| Abhängigkeiten | Platform Foundation, DNA-Engine (für AI-Fahrzeugbeschreibungen) |
| Abhängig davon | Modul 01 (CRM), Modul 03 (Sales), Modul 13 (Börsen-Hub), Modul 11 (Website), Modul 06 (Ankauf, Phase 2) |

---

## 2. Kernkonzept — Der Fahrzeug-Lebenszyklus

Jedes Fahrzeug durchläuft im Autohaus einen klaren Lebenszyklus. Carlion bildet diesen vollständig ab:

```
Ankauf / Import                    ← Fahrzeug entsteht im System
    │
    ▼
Aufbereitung (optional)            ← Vorbereitung für Verkauf
    │
    ▼
Verfügbar                          ← Bereit für Vermarktung
    │
    ├── Veröffentlicht (Börsen/Website)
    ├── Reserviert (für Interessent)
    │
    ▼
Verkauft                           ← Deal abgeschlossen
    │
    ▼
Übergeben                          ← Fahrzeug an Käufer übergeben
    │
    ▼
Archiviert                         ← Nicht mehr im aktiven Bestand
```

### Status-Enum

| Status | Bedeutung | UI-Label | Publishable |
|--------|-----------|----------|-------------|
| `draft` | Angelegt, Daten unvollständig | Entwurf | Nein |
| `in_preparation` | In Aufbereitung (Werkstatt, Fotos, Reinigung) | In Aufbereitung | Nein |
| `available` | Verkaufsbereit, inserierbar | Verfügbar | Ja |
| `reserved` | Für einen Interessenten reserviert | Reserviert | Ja |
| `sold` | Verkauft, noch nicht übergeben | Verkauft | Nein |
| `delivered` | An Käufer übergeben | Übergeben | Nein |
| `archived` | Aus aktivem Bestand entfernt | Archiviert | Nein |

**`published` ist unabhängig von Status.** Ein Fahrzeug kann `available` sein ohne veröffentlicht zu sein (z.B. noch keine Fotos). `published` wird über dedizierte `publish`/`unpublish`-Mutations gesteuert, nicht über Status-Wechsel. Siehe Abschnitt 5 und 12.2.

**Statusübergänge:** Nicht jeder Übergang ist erlaubt. Siehe Abschnitt 12.1.

---

## 3. Datenmodell

### Tabelle: `vehicles`

```
vehicles:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  
  -- Identifikation
  vin               text, nullable (Fahrgestellnummer, 17 Zeichen)
  internal_number   text, nullable (interne Fahrzeugnummer des Händlers)
  license_plate     text, nullable (aktuelles Kennzeichen)
  
  -- Stammdaten (aus VIN-Dekodierung oder manuell)
  make              text, not null (Marke: BMW, Mercedes, VW, ...)
  model             text, not null (Modell: 320d, C-Klasse, Golf, ...)
  variant           text, nullable (Variante: Sport Line, AMG, GTI, ...)
  model_year        integer, nullable (Modelljahr)
  first_registration date, nullable (Erstzulassung)
  
  -- Technische Daten
  body_type         text, nullable (Limousine, Kombi, SUV, Cabrio, ...)
  fuel_type         text, nullable (Benzin, Diesel, Elektro, Hybrid, Plug-in-Hybrid, ...)
  transmission      text, nullable (Schaltgetriebe, Automatik)
  drive_type        text, nullable (Frontantrieb, Hinterradantrieb, Allrad)
  engine_size_ccm   integer, nullable (Hubraum in ccm)
  power_kw          integer, nullable (Leistung in kW)
  power_ps          integer, nullable (Leistung in PS — gespeichert, nicht berechnet)
  doors             integer, nullable
  seats             integer, nullable
  color_exterior    text, nullable (Außenfarbe)
  color_interior    text, nullable (Innenfarbe)
  emission_class    text, nullable (Euro 6, Euro 6d, ...)
  co2_emissions     integer, nullable (g/km)
  fuel_consumption  jsonb, nullable ({ combined, urban, highway } in l/100km)
  electric_range_km integer, nullable (nur E/Hybrid)
  battery_capacity_kwh numeric, nullable (nur E/Hybrid)
  
  -- Zustand
  mileage_km        integer, nullable (Kilometerstand)
  condition         text, nullable (Neuwagen, Jahreswagen, Gebrauchtwagen, Vorführwagen)
  previous_owners   integer, nullable
  hu_valid_until    date, nullable (TÜV/HU gültig bis)
  accident_free     boolean, nullable
  non_smoker        boolean, nullable
  
  -- Ausstattung
  equipment         text[], default '{}' (Liste von Ausstattungs-Features)
  equipment_codes   text[], default '{}' (Hersteller-Ausstattungscodes, aus VIN)
  
  -- Preise & Kosten
  purchase_price_net   numeric(10,2), nullable (Einkaufspreis netto)
  asking_price_gross   numeric(10,2), nullable (Verkaufspreis brutto)
  minimum_price_gross  numeric(10,2), nullable (Mindestpreis brutto, nicht öffentlich)
  tax_type          text, not null, default 'margin'
                    -- margin = Differenzbesteuerung
                    -- regular = Regelbesteuerung (19% MwSt)
  
  -- Beschreibung
  title             text, nullable (Inserat-Titel)
  description       text, nullable (Inserat-Beschreibung, ggf. AI-generiert)
  internal_notes    text, nullable (interne Notizen, nie öffentlich)
  
  -- Status & Lebenszyklus
  status            text, not null, default 'draft'
  published         boolean, not null, default false
  featured          boolean, not null, default false (Highlight-Fahrzeug)
  reserved_for_contact_id  uuid, nullable, foreign key → contacts
  reserved_at       timestamptz, nullable
  sold_at           timestamptz, nullable
  delivered_at      timestamptz, nullable
  
  -- Standzeit (siehe 4.2)
  in_stock_since    date, nullable (Datum seit wann im Bestand)
  -- days_in_stock wird NICHT gespeichert — Query-Time-Berechnung
  
  -- Herkunft
  source            text, not null, default 'manual'
                    -- manual | boersen_import | trade_in | purchase
  source_reference  text, nullable (z.B. mobile.de Inserat-ID)
  
  -- Meta
  created_by        uuid, nullable, foreign key → users
  created_at        timestamptz, default now()
  updated_at        timestamptz
  deleted_at        timestamptz, nullable (Soft Delete)
  
  -- Constraints
  CHECK status IN ('draft', 'in_preparation', 'available', 
                   'reserved', 'sold', 'delivered', 'archived')
  CHECK tax_type IN ('margin', 'regular')
  CHECK source IN ('manual', 'boersen_import', 'trade_in', 'purchase')
  CHECK vin IS NULL OR length(vin) = 17
  CHECK asking_price_gross IS NULL OR asking_price_gross >= 0
  CHECK mileage_km IS NULL OR mileage_km >= 0
  -- published nur wenn Status es erlaubt
  CHECK NOT (published = true AND status NOT IN ('available', 'reserved'))
  
  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  
  -- Indizes
  INDEX idx_vehicles_tenant ON vehicles(tenant_id)
  INDEX idx_vehicles_tenant_status ON vehicles(tenant_id, status)
  INDEX idx_vehicles_tenant_created ON vehicles(tenant_id, created_at DESC)
  INDEX idx_vehicles_vin ON vehicles(tenant_id, vin) WHERE vin IS NOT NULL
  INDEX idx_vehicles_make_model ON vehicles(tenant_id, make, model)
  INDEX idx_vehicles_published ON vehicles(tenant_id) WHERE published = true AND deleted_at IS NULL
  INDEX idx_vehicles_in_stock ON vehicles(tenant_id, in_stock_since) WHERE status IN ('available', 'reserved')
  
  -- Import-Idempotenz
  UNIQUE INDEX idx_vehicles_source_ref ON vehicles(tenant_id, source, source_reference) 
    WHERE source_reference IS NOT NULL
```

### `power_ps` — gespeichert, nicht berechnet

**Entscheidung:** `power_ps` wird gespeichert, nicht aus `power_kw` berechnet. Grund: DAT liefert beide Werte; bei manuellem Anlegen setzt der Service `power_ps = ROUND(power_kw * 1.35962)` wenn nur `power_kw` gegeben wird (und umgekehrt). Beide Felder sind unabhängig editierbar, weil Börsen-Exporte teils nur PS, teils nur kW liefern.

### Fahrzeugfotos

Fotos werden über die `files`-Tabelle aus `01_ARCHITECTURE.md` verwaltet. Keine eigene Foto-Tabelle.

```
files (für Fahrzeugfotos):
  entity_type = 'vehicle'
  entity_id   = vehicle.id
  kind        = 'photo' | 'thumbnail_list' | 'thumbnail_detail'
  position    = Reihenfolge (1 = Hauptbild, 2+ = weitere)
  is_public   = true (wenn Fahrzeug published)
  alt_text    = AI-generiert (z.B. "BMW 320d Sport Line, Mineralgrau, Frontansicht")
```

**Foto-Regeln:**
- Originale in `vehicles/{tenant_id}/{vehicle_id}/{file_id}.{ext}` (privat)
- Thumbnails in `vehicles-public/{tenant_id}/{vehicle_id}/{file_id}-{size}.webp` (öffentlich, wenn published)
- Maximal 30 Fotos pro Fahrzeug
- Reihenfolge per Drag & Drop (aktualisiert `files.position`)
- Hauptbild = Position 1 (wird in Listen, Karten, Inseraten angezeigt)
- Wenn Fahrzeug unpublished wird: öffentliche Derivate werden gelöscht, Originale bleiben
- AI-generierte Alt-Texte: beim Upload automatisch via Claude API. Bei AI-Fehler: Upload erfolgreich, `alt_text = NULL`, kann später generiert werden

### VIN-Dekodierung

Wenn eine VIN eingegeben wird, wird sie über den DAT-Service-Client (`server/services/dat.ts`) dekodiert. Die Dekodierung befüllt automatisch Felder die der Händler sonst manuell eingeben müsste.

**DAT-Dekodierung befüllt:**
- `make`, `model`, `variant`
- `body_type`, `fuel_type`, `transmission`, `drive_type`
- `engine_size_ccm`, `power_kw`, `power_ps`
- `doors`, `seats`
- `emission_class`, `co2_emissions`, `fuel_consumption`
- `equipment_codes` (die dann auf lesbare `equipment`-Labels gemappt werden)

**Regeln:**
- VIN-Dekodierung ist optional — Fahrzeug kann komplett manuell angelegt werden
- DAT-Ergebnisse überschreiben nur leere Felder, nie manuell gesetzte Werte
- Wenn DAT nicht erreichbar: Fahrzeug wird ohne Dekodierung gespeichert, VIN-Dekodierung wird über Outbox nachgeholt (siehe `01_ARCHITECTURE.md` Abschnitt 8: „DAT (VIN) → Fahrzeug kann manuell angelegt werden, VIN-Dekodierung wird über Outbox nachgeholt")
- DAT-Response wird gecacht (pro VIN, 30 Tage) um redundante API-Calls zu vermeiden

---

## 4. Designentscheidungen

### 4.1 Flaches Schema statt Normalisierung

**Entscheidung:** Alle Fahrzeugdaten leben in einer einzelnen `vehicles`-Tabelle. Keine separate `vehicle_technical_data`-, `vehicle_pricing`- oder `vehicle_equipment`-Tabelle.

**Begründung:** Der Händler denkt in Fahrzeugen, nicht in normalisierten Relationen. Ein Fahrzeug wird immer komplett geladen und angezeigt. Die Spaltenanzahl ist hoch (~50), aber die Tabelle hat realistische Größen (20-200 Fahrzeuge pro Tenant). Performance ist kein Problem, Einfachheit ist ein Gewinn. Die JSONB-Felder (`fuel_consumption`, `equipment`) fangen variable Strukturen auf.

### 4.2 Standzeit als Query-Time-Berechnung

**Entscheidung:** `days_in_stock` wird **nicht** in der Datenbank gespeichert. Es wird zur Query-Zeit berechnet.

**Begründung:** PostgreSQL erlaubt keine volatilen Funktionen (wie `current_date`) in `GENERATED ALWAYS AS ... STORED` Spalten. Eine STORED generated column mit `current_date` würde die Migration blockieren.

**Implementierung:**
```sql
-- In Queries: berechnetes Feld
SELECT *,
  CASE WHEN in_stock_since IS NOT NULL AND status IN ('available', 'reserved')
  THEN (current_date - in_stock_since)
  ELSE NULL END AS days_in_stock
FROM vehicles
WHERE tenant_id = $1;
```

**Sortierung/Filterung:** Der Index `idx_vehicles_in_stock` auf `(tenant_id, in_stock_since)` macht Sortierung nach Standzeit performant — die DB sortiert nach `in_stock_since`, was äquivalent zu Standzeit-Sortierung ist.

**Drizzle:** Das berechnete Feld wird als `sql<number>` in Drizzle-Queries definiert und im View-Typ als reguläres Feld exponiert.

### 4.3 Preismodell: Differenzbesteuerung als Default

**Entscheidung:** `tax_type` ist Default `margin` (Differenzbesteuerung), nicht `regular`.

**Begründung:** 80%+ der Gebrauchtwagen bei Einzelhändlern laufen unter Differenzbesteuerung (§ 25a UStG). Der Händler muss sich nur aktiv entscheiden wenn das Fahrzeug regelbesteuert ist.

### 4.4 Equipment als Array, nicht als Join-Tabelle

**Entscheidung:** `equipment` ist ein `text[]` Array, kein `vehicle_equipment`-Join auf eine Ausstattungstabelle.

**Begründung:** Equipment-Listen sind heterogen, werden nie einzeln abgefragt und müssen beim Börsen-Export als Freitext geliefert werden. Phase 2 kann eine kuratierte Ausstattungsliste als Referenz ergänzen.

### 4.5 Status und Published sind getrennte Achsen

**Entscheidung:** Status-Änderungen und Publish-Änderungen laufen über **separate Mutations**. `inventory.update` darf weder `status` noch `published` ändern.

**Begründung:** Status-Wechsel haben Seiteneffekte (Timestamps, Reservierungs-Reset, Deal-Benachrichtigung). Publish hat andere Seiteneffekte (Foto-Derivate, Cache-Invalidierung, Börsen-Sync). Wenn beides über einen generischen `update`-Patch läuft, werden diese Seiteneffekte fast sicher inkonsistent implementiert.

**Konsequenz:**
- `inventory.updateStatus` → Status ändern (mit Übergangsregeln)
- `inventory.publish` → Veröffentlichen (mit Publish-Regeln-Prüfung)
- `inventory.unpublish` → Depublizieren (mit Derivate-Cleanup)
- `inventory.update` → Nur Stamm-/Preis-/Beschreibungsdaten ändern (kein `status`, kein `published`)
- DB-Constraint `CHECK NOT (published = true AND status NOT IN ('available', 'reserved'))` fängt Inkonsistenzen als letzte Schutzschicht ab

### 4.6 Reserved ist öffentlich nicht sichtbar (MVP)

**Entscheidung:** Reservierte Fahrzeuge werden auf Website/Börse als „Verfügbar" angezeigt, nicht als „Reserviert". Im MVP keine Konfigurationsoption dafür.

**Begründung:** Ob ein Händler Reservierungen öffentlich zeigen will, ist geschäftspolitisch. Im MVP vermeiden wir die Entscheidung und zeigen reservierte Fahrzeuge einfach weiter als verfügbar. Phase 2: konfigurierbar.

**Konsequenz für Public API:** `status`-Feld im `PublicVehicle`-Typ gibt immer `'available'` zurück wenn das Fahrzeug published ist.

### 4.7 Kein `vehicle_history`-Tracking im MVP

**Entscheidung:** Status-Übergänge werden über `audit_log` nachvollzogen, nicht über eine eigene Tabelle.

---

## 5. API (tRPC Router)

Router: `inventory` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen

```typescript
// DB-Entity — 1:1 Abbild der vehicles-Tabelle
type VehicleRecord = { /* alle DB-Spalten */ }

// API-View für Rollen mit Preiszugriff (owner, admin, manager)
type VehicleView = {
  id: string;
  make: string;
  model: string;
  // ... alle Felder
  purchase_price_net: number | null;    // nur für berechtigte Rollen
  minimum_price_gross: number | null;   // nur für berechtigte Rollen
  margin: number | null;                // berechnet, nur für berechtigte Rollen
  days_in_stock: number | null;         // Query-Time-berechnet
  photos: FileReference[];              // aufgelöste Foto-URLs
}

// API-View für Rollen ohne Preiszugriff (salesperson, receptionist, viewer)
type VehicleViewRestricted = Omit<VehicleView, 
  'purchase_price_net' | 'minimum_price_gross' | 'margin'>

// Kompakte Ansicht für Listen
type VehicleListItem = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  asking_price_gross: number | null;
  status: VehicleStatus;
  published: boolean;
  days_in_stock: number | null;
  mileage_km: number | null;
  fuel_type: string | null;
  first_registration: string | null;
  main_photo_url: string | null;       // Position 1 Thumbnail
  featured: boolean;
  created_at: string;
  // Kein purchase_price_net, kein minimum_price_gross, keine Marge
  // → Manager/Owner sehen diese über getById, nicht in Listen
}

// Öffentlich — siehe Abschnitt 6
type PublicVehicle = { /* reduzierter Typ */ }
```

**Regel:** `inventory.getById` prüft die Rolle des aufrufenden Users und gibt `VehicleView` (mit Preisen) oder `VehicleViewRestricted` (ohne Preise) zurück. Das Frontend hat zwei Komponenten: `VehiclePriceSection` (nur sichtbar wenn Rolle berechtigt) und `VehicleDetailBase` (immer sichtbar).

### Procedures

```
inventory.list
  Type:     query
  Auth:     protectedProcedure
  Input:    VehicleListInput
            {
              cursor?: string,
              limit?: number (default 20, max 100),
              status?: VehicleStatus | VehicleStatus[],
              search?: string (sucht in make, model, variant, vin, 
                       internal_number, license_plate),
              make?: string,
              model?: string,
              fuel_type?: string,
              price_min?: number,
              price_max?: number,
              mileage_min?: number,
              mileage_max?: number,
              year_min?: number,
              year_max?: number,
              sort_by?: 'created_at' | 'asking_price_gross' | 
                        'in_stock_since' | 'mileage_km' | 'make',
              sort_order?: 'asc' | 'desc',
            }
  Output:   { items: VehicleListItem[], nextCursor: string | null }
  Regeln:
    - Cursor ist Compound: (sort_field_value, id) für deterministische Pagination
    - Default-Sortierung: created_at DESC, id DESC
    - Kein totalCount (Performance bei Cursor-Pagination)
    - deleted_at IS NULL implizit (Archiv nur über separaten Filter)

inventory.getById
  Type:     query
  Auth:     protectedProcedure
  Input:    { id: string }
  Output:   VehicleView | VehicleViewRestricted (rollenabhängig)
  Zweck:    Einzelnes Fahrzeug mit allen Details und Fotos
  Regeln:
    - Prüft ctx.role: owner/admin/manager → VehicleView (mit Preisen)
    - Alle anderen Rollen → VehicleViewRestricted (ohne Einkaufspreis/Marge)
    - Enthält aufgelöste Foto-URLs (aus files-Tabelle)
    - Enthält KEINE verknüpften Deals oder Kontakte (Modulgrenze!)
    - Verknüpfte Deals/Kontakte: Frontend lädt separat über CRM/Sales-APIs

inventory.create
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    CreateVehicleInput
            {
              vin?: string,
              make: string,
              model: string,
              variant?: string,
              // ... alle editierbaren Stamm-/Preis-/Beschreibungsfelder
              // Ausgenommen: id, tenant_id, status, published, days_in_stock,
              //   created_at, updated_at, deleted_at, created_by,
              //   reserved_for_contact_id, reserved_at, sold_at, delivered_at
            }
  Output:   VehicleView
  Regeln:
    - Wenn VIN angegeben: DAT-Dekodierung anstoßen (synchron, Fallback: ohne)
    - DAT-Ergebnisse überschreiben nur NULL-Felder im Input
    - Status immer: 'draft' (nicht im Input steuerbar)
    - published immer: false (nicht im Input steuerbar)
    - in_stock_since default: heute
    - created_by = ctx.userId
    - Schreibt Audit-Log

inventory.update
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    UpdateVehicleInput
            {
              id: string,
              // Nur Stamm-/Preis-/Beschreibungsfelder, alle optional
              // AUSGESCHLOSSEN: status, published, featured, 
              //   reserved_for_contact_id, reserved_at, sold_at, delivered_at,
              //   tenant_id, source, source_reference, created_by, 
              //   created_at, deleted_at
            }
  Output:   VehicleView | VehicleViewRestricted
  Regeln:
    - KEIN Status-Patch, KEIN Publish-Patch (eigene Mutations)
    - Wenn VIN geändert: neue DAT-Dekodierung anstoßen
    - Wenn asking_price geändert: Audit-Log mit altem + neuem Preis
    - Aktualisiert updated_at

inventory.updateStatus
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { id: string, status: VehicleStatus, reserved_for_contact_id?: string }
  Output:   VehicleView
  Regeln:
    - Statusübergänge validieren (12.1)
    - Bei 'reserved': reserved_for_contact_id Pflicht, Contact muss im Tenant existieren
    - Bei Wechsel weg von 'reserved': reserved_for_contact_id = null, reserved_at = null
    - Bei 'sold': sold_at = now()
    - Bei 'delivered': delivered_at = now()
    - Wenn neuer Status nicht publishable UND Fahrzeug ist published: 
      automatisch unpublish (Derivate löschen, Cache invalidieren)
    - Schreibt Audit-Log

inventory.publish
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { id: string }
  Output:   VehicleView
  Zweck:    Fahrzeug veröffentlichen
  Regeln:
    - Publish-Regeln prüfen (12.2): Status, Pflichtfelder, Fotos
    - Setzt published = true
    - Generiert öffentliche Foto-Derivate (falls noch nicht vorhanden)
    - Triggert ISR-Revalidation für Public-Route
    - Schreibt Audit-Log

inventory.unpublish
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { id: string }
  Output:   VehicleView
  Zweck:    Fahrzeug depublizieren
  Regeln:
    - Setzt published = false
    - Löscht öffentliche Foto-Derivate
    - Triggert ISR-Revalidation
    - Schreibt Audit-Log

inventory.archive
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   VehicleView
  Regeln:
    - Setzt deleted_at + status 'archived'
    - Unpublish automatisch (gleiche Logik wie inventory.unpublish)
    - Verknüpfte offene Deals werden benachrichtigt (falls vorhanden)
    - Schreibt Audit-Log

inventory.restore
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   VehicleView
  Zweck:    Archiviertes Fahrzeug wiederherstellen (deleted_at = null, status 'draft')

inventory.uploadPhotos → KEIN tRPC. Dedizierter Route Handler.
  Route:    app/api/upload/vehicle-photos/route.ts
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"]) — Auth-Check im Handler
  Input:    multipart/form-data (vehicleId + Dateien)
  Output:   FileReference[]
  Regeln:
    - Max 30 Fotos pro Fahrzeug (inkl. bestehende)
    - Validierung: JPEG, PNG, WebP, max 10 MB pro Bild, MIME-Type serverseitig
    - Thumbnails automatisch generiert (200x150, 800x600)
    - Alt-Text automatisch via AI (nicht blockierend — bei AI-Fehler: alt_text = NULL)
    - Position = nächste freie Position
    - files-Einträge erstellen
    - Wenn Fahrzeug published: öffentliche Derivate sofort generieren

inventory.reorderPhotos
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { vehicleId: string, photoIds: string[] (geordnet) }
  Output:   FileReference[]

inventory.deletePhoto
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { vehicleId: string, photoId: string }
  Output:   void
  Regeln:
    - Soft Delete (files.deleted_at)
    - Öffentliche Derivate sofort löschen
    - Wenn letztes Foto gelöscht und Fahrzeug published: Warnung an Frontend (Publish-Regel verletzt)

inventory.generateDescription
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { vehicleId: string }
  Output:   { title: string, description: string }
  Regeln:
    - Liest Fahrzeugdaten + DNA-Branding (tone, formality, description_style)
    - Ergebnis wird NICHT automatisch gespeichert
    - Frontend zeigt Vorschau → Händler übernimmt via inventory.update

inventory.decodeVin
  Type:     mutation
  Auth:     protectedProcedure
  Input:    { vin: string }
  Output:   VinDecodingResult
  Regeln:
    - Über DAT-Service-Client
    - Cached pro VIN (30 Tage)
    - Bei DAT-Fehler: leeres Ergebnis, kein Abbruch

inventory.getStats
  Type:     query
  Auth:     protectedProcedure
  Input:    —
  Output:   InventoryStats
            {
              total: number,
              by_status: { [status]: number },
              avg_days_in_stock: number,
              avg_asking_price: number,
              total_stock_value: number,
              langsteher_count: number (Standzeit > 90 Tage),
            }
```

---

## 6. Öffentlicher Fahrzeug-Zugriff (Public Delivery)

### Routes

```
app/api/public/[tenant_slug]/vehicles/route.ts        ← Liste (published)
app/api/public/[tenant_slug]/vehicles/[id]/route.ts   ← Einzelnes Fahrzeug
```

### Regeln

- **Service Role** (kein JWT)
- **Strikt read-only**
- **Nur published Fahrzeuge** (`published = true` AND `deleted_at IS NULL`)
- **Reduzierter Response:**

```typescript
type PublicVehicle = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  first_registration: string | null;
  mileage_km: number | null;
  fuel_type: string | null;
  transmission: string | null;
  power_kw: number | null;
  power_ps: number | null;
  color_exterior: string | null;
  body_type: string | null;
  condition: string | null;
  asking_price_gross: number | null;
  tax_type: string;  // für MwSt-Hinweis
  title: string | null;
  description: string | null;
  equipment: string[];
  hu_valid_until: string | null;
  accident_free: boolean | null;
  photos: { url: string; alt_text: string | null; position: number }[];
  featured: boolean;
  // Kein status-Feld — öffentlich sind alle Fahrzeuge „verfügbar"
}
```

- **Nicht enthalten:** `status`, `purchase_price_net`, `minimum_price_gross`, `internal_notes`, `internal_number`, `source`, `source_reference`, `created_by`, `in_stock_since`, `days_in_stock`, `reserved_for_contact_id`
- **Caching:** ISR mit `max-age=60, stale-while-revalidate=300`
- **Pagination:** `?cursor=...&limit=20` (max 50)
- **Filter:** `?make=BMW&fuel_type=Diesel&price_max=30000`
- **Sortierung:** `?sort=price_asc` | `price_desc` | `newest` | `mileage_asc`

---

## 7. AI-Tools (für AI-Assistent)

Datei: `modules/inventory/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "list_vehicles",
  description: "Fahrzeuge im Bestand auflisten und filtern. 
                Händler fragt z.B. 'Zeig mir alle verfügbaren BMWs' 
                oder 'Welche Diesel haben wir?'",
  parameters: {
    status?: VehicleStatus | VehicleStatus[],
    make?: string,
    model?: string,
    fuel_type?: string,
    price_min?: number,
    price_max?: number,
    limit?: number
  },
  execute: (params, ctx) => inventoryService.list(params, ctx)
},
{
  name: "get_vehicle_details",
  description: "Details eines bestimmten Fahrzeugs abrufen. 
                Händler fragt z.B. 'Was kostet der schwarze Golf?'",
  parameters: {
    id?: string,
    search?: string
  },
  execute: (params, ctx) => inventoryService.getByIdOrSearch(params, ctx)
},
{
  name: "get_inventory_stats",
  description: "Bestandskennzahlen abrufen. 
                Händler fragt z.B. 'Wie viele Autos haben wir?' 
                oder 'Was ist die durchschnittliche Standzeit?'",
  parameters: {},
  execute: (params, ctx) => inventoryService.getStats(ctx)
},
{
  name: "generate_vehicle_description",
  description: "AI-Beschreibung für ein Fahrzeug generieren.
                Gibt Vorschlag zurück, speichert nicht.",
  parameters: { vehicle_id: string },
  execute: (params, ctx) => inventoryService.generateDescription(params.vehicle_id, ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM Flow)

```typescript
{
  name: "propose_vehicle_create",
  description: "Neues Fahrzeug anlegen vorschlagen.",
  parameters: { make: string, model: string, /* ... */ },
  execute: (params, ctx) => aiCommandService.propose({
    module: "inventory",
    action: "create_vehicle",
    proposed_changes: params,
    preview: () => vehicleCreatePreview(params),
    executeOnConfirm: () => inventoryService.create(params, ctx)
  })
},
{
  name: "propose_vehicle_status_change",
  description: "Fahrzeugstatus ändern vorschlagen. 
                Händler sagt z.B. 'Der BMW ist verkauft'",
  parameters: { vehicle_id: string, status: VehicleStatus, reserved_for_contact_id?: string },
  execute: (params, ctx) => aiCommandService.propose({
    module: "inventory",
    action: "update_vehicle_status",
    proposed_changes: params,
    preview: () => statusChangePreview(params, ctx),
    executeOnConfirm: () => inventoryService.updateStatus(params, ctx)
  })
},
{
  name: "propose_vehicle_price_change",
  description: "Fahrzeugpreis ändern vorschlagen.",
  parameters: { vehicle_id: string, asking_price_gross: number },
  execute: (params, ctx) => aiCommandService.propose({
    module: "inventory",
    action: "update_vehicle_price",
    proposed_changes: params,
    preview: () => priceChangePreview(params, ctx),
    executeOnConfirm: () => inventoryService.update(
      { id: params.vehicle_id, asking_price_gross: params.asking_price_gross }, ctx
    )
  })
},
{
  name: "propose_vehicle_publish",
  description: "Fahrzeug veröffentlichen vorschlagen.
                Händler sagt z.B. 'Stell den Golf online'",
  parameters: { vehicle_id: string },
  execute: (params, ctx) => aiCommandService.propose({
    module: "inventory",
    action: "publish_vehicle",
    proposed_changes: params,
    preview: () => publishPreview(params, ctx),
    executeOnConfirm: () => inventoryService.publish(params.vehicle_id, ctx)
  })
}
```

---

## 8. AI-Fahrzeugbeschreibungen

### Beschreibungs-Prompt

```
System: Du schreibst Fahrzeuganzeigen für {tenants.name}.
Ton: {dna.tone}. Anrede: {dna.formality}. Stil: {dna.description_style}.
Sprache: Deutsch.

Fahrzeugdaten:
{vehicle_data}

Aufgabe:
1. Schreibe einen Inserat-Titel (max 80 Zeichen).
   Format: "{Marke} {Modell} {Variante} | {Highlight 1} | {Highlight 2}"
2. Schreibe eine Inserat-Beschreibung (150-300 Wörter).
   - Beginne mit dem stärksten Verkaufsargument
   - Erwähne die wichtigsten Ausstattungs-Highlights
   - Nenne Zustand und Wartungshistorie wenn verfügbar
   - Schließe mit einem Call-to-Action passend zum Ton
   - Keine erfundenen Daten — nur was in vehicle_data steht
   - Keine rechtlichen Aussagen (Garantie, Gewährleistung)

Output-Format: JSON
{ "title": "...", "description": "..." }
```

**Modell:** `claude-sonnet-4-20250514`
**Token-Budget:** Input 4.000 / Output 2.000
**AI-Client:** Über `shared/lib/ai.ts`
**Halluzinations-Prävention:** Nur Fahrzeugdaten aus der DB, nie aus AI-Training.

---

## 9. Daten-Import (Börsen-Export)

### Verantwortung

Der Import-Parser und Börsen-Sync liegt in Modul 13 (Börsen-Hub). Das Inventar-Modul stellt einen **Service-Export** bereit — kein tRPC-Endpunkt.

### Import-Schnittstelle

```typescript
// modules/inventory/index.ts
export { bulkUpsertVehicles } from "./services/inventory-service";
```

```
inventoryService.bulkUpsertVehicles
  Aufruf:   Direkt aus Modul 13 Service-Layer (serverseitig, nicht über tRPC)
  Input:    BulkUpsertInput
            {
              vehicles: CreateOrUpdateVehicleInput[],
              source: 'boersen_import',
            }
  Output:   { created: number, updated: number, errors: ImportError[] }
  Regeln:
    - Match auf (tenant_id, source, source_reference) via Unique Index
    - Existierendes Fahrzeug mit gleicher source_reference: Update (nur leere Felder oder explizit geänderte)
    - Neues Fahrzeug: Create mit status 'draft'
    - Validierung pro Fahrzeug, Fehler brechen nicht den Gesamtimport ab
    - Idempotent: gleicher Import zweimal erzeugt keine Duplikate (Unique Index)
    - Schreibt Audit-Log pro Fahrzeug
    - Kontext (tenant_id) wird vom aufrufenden Modul 13 Service durchgereicht
```

**Warum kein tRPC?** Die Architektur definiert `publicProcedure`, `protectedProcedure` und `roleProcedure`. Eine `internalProcedure` gibt es nicht. Modul-zu-Modul-Kommunikation läuft über Service-Exports (siehe `01_ARCHITECTURE.md` Modulgrenze-Regel).

---

## 10. Lese-Schnittstelle für andere Module

```typescript
// modules/inventory/index.ts — öffentliche Exports
export { getVehicleById, getVehiclesForTenant } from "./services/inventory-service";
export { getPublicVehiclesForSlug } from "./services/inventory-service";
export { bulkUpsertVehicles } from "./services/inventory-service";
export { markVehicleAsSold } from "./services/inventory-service";
// → Setzt status = 'sold', sold_at = now(), unpublishes automatisch
// → Prüft: Fahrzeug muss 'available' oder 'reserved' sein
// → Aufgerufen von Sales-Modul bei Deal-Won
export { releaseVehicleReservation } from "./services/inventory-service";
// → Setzt status = 'available', reserved_for_contact_id = null
// → Nur wenn Fahrzeug aktuell 'reserved' ist
// → Aufgerufen von Sales-Modul bei Deal-Lost
export type { VehicleRecord, VehicleView, VehicleViewRestricted, VehicleListItem, PublicVehicle, VehicleStatus } from "./domain/types";
export type { CreateVehicleInput, UpdateVehicleInput } from "./domain/validators";
```

**Module dürfen nicht direkt auf `vehicles`-Tabelle zugreifen.** Immer über Inventory-Service-Exports:
- **CRM (Modul 01):** Liest verknüpfte Fahrzeuge für Kontakt-Detail-Ansicht (nur VehicleListItem, keine Preise)
- **Sales (Modul 03):** Liest Fahrzeugdaten für Deal-Erstellung, prüft Verfügbarkeit
- **Börsen-Hub (Modul 13):** Liest Fahrzeuge für Inserat-Erstellung, schreibt via `bulkUpsertVehicles`
- **Website (Modul 11):** Liest über Public-Read-Route

---

## 11. UI-Screens (Händler-Interface)

### 11.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Bestandsliste | `/fahrzeuge` | Filterbares Grid/Liste aller Fahrzeuge |
| Fahrzeug anlegen | `/fahrzeuge/neu` | Formular (mit VIN-Quick-Fill) |
| Fahrzeug-Detail | `/fahrzeuge/[id]` | Alle Daten, Fotos, Aktionen. Deals/Kontakte über separate Tabs via CRM/Sales-APIs |
| Fahrzeug bearbeiten | `/fahrzeuge/[id]/bearbeiten` | Edit-Formular |

### 11.2 Bestandsliste — Detailspezifikation

**Ansichtsmodi:**
- **Karten-Ansicht** (Default Mobile): Foto + Marke/Modell + Preis + Status-Badge + Standzeit
- **Tabellen-Ansicht** (Default Desktop): Kompakte Zeilen mit sortieren/filtern

**Filter (Sidebar/Sheet):**
- Status (Multi-Select)
- Veröffentlicht (Ja/Nein)
- Marke, Modell (Dropdown, Typeahead)
- Preis (Range Slider)
- Kilometerstand (Range Slider)
- Kraftstoff (Multi-Select)
- Baujahr (Range)
- Standzeit (< 30 Tage, 30-60, 60-90, > 90)

**Quick-Actions pro Fahrzeug:**
- Status ändern (→ `updateStatus`)
- Veröffentlichen / Depublizieren (→ `publish` / `unpublish`)
- Preis ändern
- Beschreibung generieren
- Archivieren

**Langsteher-Warnung:** Fahrzeuge mit Standzeit > 90 Tage werden visuell markiert.

### 11.3 Fahrzeug anlegen — Flow

```
Schritt 1: VIN oder manuell?
├── VIN eingeben → DAT-Dekodierung → Felder vorausgefüllt → Schritt 2
└── Ohne VIN → leeres Formular → Schritt 2

Schritt 2: Stammdaten
├── Marke, Modell, Variante (Pflicht: Marke + Modell)
├── Erstzulassung, Kilometerstand
├── Kraftstoff, Getriebe, Leistung
└── Weiter

Schritt 3: Preis & Zustand
├── Verkaufspreis brutto
├── Einkaufspreis netto (optional, nur für berechtigte Rollen sichtbar)
├── Besteuerungsart (Default: Differenz)
├── Zustand, TÜV, Unfallfreiheit
└── Weiter

Schritt 4: Fotos & Beschreibung
├── Fotos hochladen (Drag & Drop oder Kamera)
├── Beschreibung: manuell schreiben ODER AI generieren
└── Zwei Buttons:
    ├── "Als Entwurf speichern" → inventory.create (status: draft)
    └── "Speichern & veröffentlichen" → inventory.create + inventory.updateStatus(available) + inventory.publish
        (nur aktiv wenn Publish-Regeln erfüllt: Preis > 0, min 1 Foto)
```

**"Speichern & veröffentlichen"** ist ein Frontend-Convenience — es ruft drei Mutations sequentiell auf: `create` → `updateStatus('available')` → `publish`. Bei Fehler in einem Schritt: vorherige Schritte bleiben bestehen, User sieht klare Fehlermeldung was fehlt.

### 11.4 Komponenten

| Komponente | Zweck |
|------------|-------|
| `VehicleCard` | Fahrzeugkarte für Grid-Ansicht |
| `VehicleRow` | Kompakte Zeile für Tabellen-Ansicht |
| `VehicleStatusBadge` | Farbiges Status-Badge |
| `VehiclePublishBadge` | Veröffentlicht/Entwurf-Badge |
| `VehicleForm` | Mehrstufiges Anlage-/Edit-Formular |
| `VinInput` | VIN-Eingabefeld mit DAT-Dekodierungs-Button |
| `PhotoUploader` | Multi-Upload mit Drag & Drop, Kamera-Integration |
| `PhotoGallery` | Sortierbare Galerie mit Drag & Drop |
| `PriceDisplay` | Preisanzeige mit MwSt-Hinweis je nach tax_type |
| `PriceSection` | Einkaufspreis + Marge (nur berechtigte Rollen) |
| `DaysInStockBadge` | Standzeit-Anzeige mit farbiger Warnung |
| `EquipmentEditor` | Tag-basierter Editor für Ausstattungsliste |
| `VehicleFilterPanel` | Sidebar/Sheet mit allen Filtern |
| `InventoryStatsBar` | KPI-Leiste |

---

## 12. Business Rules

### 12.1 Statusübergänge

```
Von \ Nach         draft  in_prep  avail  reserved  sold  delivered  archived
draft               —      ✓        ✓       —        —       —         ✓
in_preparation      ✓      —        ✓       —        —       —         ✓
available           —      ✓        —       ✓        ✓       —         ✓
reserved            —      —        ✓       —        ✓       —         ✓
sold                —      —        —       —        —       ✓         ✓
delivered           —      —        —       —        —       —         ✓
archived            ✓      —        —       —        —       —         —
```

**Erzwingung:** Im `inventory-service.ts`, validiert vor jeder Statusänderung. Ungültige Übergänge → `TRPCError BAD_REQUEST`.

**Seiteneffekte bei Statuswechsel:**
- Wechsel zu nicht-publishable Status (sold, delivered, archived) → automatisch `unpublish`
- Wechsel zu `reserved` → `reserved_for_contact_id` Pflicht, `reserved_at = now()`
- Wechsel weg von `reserved` → `reserved_for_contact_id = null`, `reserved_at = null`
- Wechsel zu `sold` → `sold_at = now()`
- Wechsel zu `delivered` → `delivered_at = now()`

### 12.2 Publish-Regeln

Ein Fahrzeug kann nur veröffentlicht werden (`inventory.publish`) wenn:
- Status ist `available` oder `reserved`
- `make` und `model` sind gesetzt
- `asking_price_gross` ist gesetzt und > 0
- Mindestens 1 Foto vorhanden

**DB-Constraint:** `CHECK NOT (published = true AND status NOT IN ('available', 'reserved'))` — letzte Schutzschicht.

### 12.3 Reservierungsregeln

- Reservierung erfolgt über `inventory.updateStatus({ status: 'reserved', reserved_for_contact_id })`
- `reserved_for_contact_id` Pflicht, Contact muss im Tenant existieren (Same-Tenant-Prüfung im Service)
- Kein automatisches Ablaufdatum (Phase 2: konfigurierbar)
- Aufheben: `updateStatus({ status: 'available' })` → setzt Contact-Referenz automatisch zurück

### 12.4 Preisregeln

- `asking_price_gross` ist der öffentlich sichtbare Preis
- `purchase_price_net` ist nie öffentlich (nicht in Public API, nicht in `VehicleViewRestricted`)
- `minimum_price_gross` ist nie öffentlich
- Marge berechnet im Service-Layer:
  - Differenzbesteuerung: `asking_price_gross - purchase_price_net`
  - Regelbesteuerung: `(asking_price_gross / 1.19) - purchase_price_net`
- Preisänderungen: Audit-Log mit altem + neuem Wert

### 12.5 Soft Delete

- `archive` setzt `deleted_at` und `status = 'archived'`
- Archivierte Fahrzeuge: nicht in Standard-Liste, nur über Filter „Archiv"
- `restore` setzt `deleted_at = null` und `status = 'draft'`

### 12.6 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Bestand ansehen | Alle authentifizierten Rollen |
| Fahrzeug anlegen/bearbeiten | `owner`, `admin`, `manager`, `salesperson` |
| Einkaufspreis/Marge sehen | `owner`, `admin`, `manager` |
| Fahrzeug veröffentlichen/depublizieren | `owner`, `admin`, `manager`, `salesperson` |
| Fahrzeug archivieren/wiederherstellen | `owner`, `admin`, `manager` |
| Fotos hochladen/sortieren/löschen | `owner`, `admin`, `manager`, `salesperson` |

---

## 13. MVP-Scope vs. Phase 2

### MVP (Phase 1) — Wird gebaut

- [x] Fahrzeug anlegen (manuell + VIN-Dekodierung)
- [x] Fahrzeug bearbeiten (Stamm-/Preis-/Beschreibungsdaten)
- [x] Dedizierte Status-Mutations (updateStatus) mit Übergangsregeln
- [x] Dedizierte Publish/Unpublish-Mutations
- [x] Bestandsliste mit Filtern, Suche und Sortierung
- [x] Fahrzeugfotos hochladen, sortieren, löschen (dedizierter Upload-Handler)
- [x] AI-Fahrzeugbeschreibungen generieren
- [x] Standzeit als Query-Time-Berechnung mit Index
- [x] Reservierung für Kontakte (Same-Tenant-geprüft)
- [x] Public-Read-Route für Website/Börsen
- [x] AI-Tools für Assistent (Lesen + schreibende PROPOSE-Tools)
- [x] Import-Service-Export für Börsen-Hub (idempotent via Unique Index)
- [x] VIN-Dekodierung über DAT API
- [x] Rollenbasierte Preis-/Margen-Sichtbarkeit (View vs. ViewRestricted)
- [x] Dashboard-KPIs

### Phase 2 — Nicht bauen bis beauftragt

- [ ] **AI-Vision:** Automatische Fahrzeugerkennung aus Fotos
- [ ] **Zustandsbewertung:** Strukturierte Checkliste für Fahrzeugzustand
- [ ] **Fotodienst-Integration:** Automatischer Bilderimport von externen Diensten
- [ ] **AI-Preisempfehlung:** Marktpreisanalyse und Preisvorschläge (Modul 22)
- [ ] **Standzeit-Eskalation:** Automatische Aktionen bei langer Standzeit
- [ ] **Reserved öffentlich konfigurierbar:** Händler wählt ob Reservierung auf Website/Börse sichtbar
- [ ] **Batch-Operationen:** Mehrere Fahrzeuge gleichzeitig bearbeiten
- [ ] **Export:** Bestandsliste als CSV/Excel exportieren
- [ ] **Duplikaterkennung:** Warnung bei ähnlichen VINs

---

## 14. Technische Abhängigkeiten

### Interne Abhängigkeiten

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Platform Foundation | Auth, Tenants, RLS | Tenant-Kontext, Rollen-Checks |
| DNA-Engine (Modul 34) | Branding-Profil | Tonalität und Stil für AI-Beschreibungen |
| Supabase Storage | File Storage | Fahrzeugfotos |
| `files`-Tabelle | File Storage (Architektur) | Foto-Metadaten |
| AI-Client (`shared/lib/ai.ts`) | AI-Integration | Beschreibungen, Alt-Texte |
| AI-Command-Service | AI-Integration (Architektur) | PROPOSE→CONFIRM-Flow |
| `audit_log` | Platform Foundation | Status-/Preis-Änderungen |

### Externe Abhängigkeiten

| Service | Zweck | Fallback |
|---------|-------|----------|
| DAT API | VIN-Dekodierung | Manuelles Ausfüllen, Outbox-Retry |
| Claude API | Beschreibungen, Alt-Texte | Manuelles Schreiben (Upload nicht blockiert) |

---

## 15. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 3.1 (Händlersprache), Abschnitt 4 (Build-Reihenfolge) |
| `01_ARCHITECTURE.md` | Abschnitt 3 (RLS, Soft Delete), Abschnitt 5 (tRPC, Pagination), Abschnitt 6 (AI-Aktionsprotokoll), Abschnitt 7 (File Storage), Abschnitt 8 (DAT, Outbox) |
| `MOD_34_DNA_ENGINE.md` | Konsument für AI-Beschreibungsstil |
| `MOD_01_CRM.md` | Kontakt-Verknüpfungen (Reservierung, Fahrzeug-Interessen) |
| `MOD_03_SALES.md` | Deals referenzieren Fahrzeuge |
| `MOD_13_LISTINGS.md` | Börsen-Sync via bulkUpsertVehicles |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 02 vollständig.
> Status-Änderungen NUR über inventory.updateStatus (nicht über inventory.update).
> Publish/Unpublish NUR über dedizierte Mutations (nicht über inventory.update).
> inventory.update darf weder status noch published ändern.
> Kein AI-Tool darf direkt mutieren — immer über aiCommandService.propose().
> Öffentliche Fahrzeugdaten über Public-Read-Route, nicht über tRPC.
> Einkaufspreise und Margen: nur VehicleView (owner/admin/manager), nie in VehicleViewRestricted oder PublicVehicle.
> Import: Service-Export bulkUpsertVehicles, kein tRPC-Endpunkt. Idempotent via Unique Index.
> days_in_stock: Query-Time-Berechnung, nicht in DB gespeichert.
