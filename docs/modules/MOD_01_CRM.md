# MOD 01 — CRM & Kundenmanagement

> Modulspezifikation für das Kontakt- und Kundenmanagement.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_02_INVENTORY.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v2)

---

## 1. Zweck & Einordnung

Das CRM verwaltet alle Personen mit denen ein Autohaus in Kontakt steht: Interessenten, Käufer, Verkäufer (Inzahlungnahme), Werkstattkunden und Geschäftspartner. Es ist die zentrale Kontaktdatenbank auf die Sales, WhatsApp, E-Mail und der AI-Assistent zugreifen.

**Wichtig:** Carlion nennt diese Personen „Kontakte", nicht „Leads". Ein Kontakt wird erst durch eine konkrete Fahrzeuganfrage zum Interessenten — und durch das Sales-Modul (Modul 03) zum Deal. Das CRM selbst ist eine Kontaktdatenbank mit Interaktionshistorie, kein Pipeline-Tool.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 01 |
| Kategorie | Kerngeschäft |
| Phase | **MVP** |
| Build-Reihenfolge | 3 (nach Inventar) |
| Abhängigkeiten | Platform Foundation, Modul 02 (Inventar — Fahrzeugverknüpfung) |
| Abhängig davon | Modul 03 (Sales), Modul 17 (WhatsApp), Modul 09 (Chatbot, Phase 2), Modul 19 (E-Mail, Phase 2) |

### Warum nach Inventar?

Kontakte gewinnen Kontext durch Fahrzeuge: „Herr Müller interessiert sich für den schwarzen Golf" ist wertvoller als „Herr Müller hat angerufen". Das Inventar muss existieren bevor das CRM Fahrzeug-Verknüpfungen anlegen kann.

---

## 2. Kernkonzept — Der Kontakt-Lebenszyklus

Ein Kontakt in Carlion ist jede Person oder Firma die mit dem Autohaus interagiert. Der Lebenszyklus ist bewusst einfach:

```
Erstellt                         ← Manuell, Import, WhatsApp, Börse, Website
    │
    ▼
Aktiv                            ← Hat Interaktionen innerhalb der letzten 30 Tage
    │
    ▼
Inaktiv                          ← Keine Interaktion seit > 30 Tagen (berechnet)
    │
    ▼
Archiviert                       ← Manuell archiviert (Soft Delete)
```

**Aktiv/Inaktiv ist kein gespeicherter Zustand.** Es gibt kein `is_active`-Feld. Inaktivität wird zur Query-Zeit aus `last_interaction_at` berechnet: `last_interaction_at IS NULL OR last_interaction_at < now() - interval '30 days'`. Das verhindert Drift zwischen gespeichertem Flag und tatsächlicher Aktivität.

### Kontakt-Typ

| Typ | Bedeutung | UI-Label |
|-----|-----------|----------|
| `customer` | Bestandskunde (hat gekauft) | Kunde |
| `prospect` | Interessent (hat angefragt, noch kein Kauf) | Interessent |
| `seller` | Verkäufer/Inzahlungnahme | Verkäufer |
| `partner` | Geschäftspartner (Händler, Werkstatt, Versicherung) | Partner |
| `other` | Sonstige | Sonstig |

**Typ-Wechsel:** Wenn ein Interessent kauft, wird er zum Kunden. Das passiert automatisch wenn ein Deal in Modul 03 abgeschlossen wird. Manuelle Änderung ist auch möglich.

---

## 3. Datenmodell

### Tabelle: `contacts`

```
contacts:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  
  -- Identität
  salutation        text, nullable (Herr, Frau, Divers, Firma)
  first_name        text, nullable
  last_name         text, nullable
  company_name      text, nullable (bei Firmenkunden/Partnern)
  
  -- Kontaktdaten
  email             text, nullable
  phone             text, nullable (Hauptnummer)
  phone_mobile      text, nullable
  whatsapp_number   text, nullable (für WhatsApp-Zuordnung)
  
  -- Adresse
  street            text, nullable
  zip_code          text, nullable
  city              text, nullable
  country           text, not null, default 'DE'
  
  -- Klassifikation
  contact_type      text, not null, default 'prospect'
  source            text, not null, default 'manual'
  tags              text[], default '{}'
  
  -- Zuordnung
  assigned_to       uuid, nullable, foreign key → users (zuständiger Mitarbeiter)
  
  -- Kommunikationspräferenzen
  preferred_channel text, nullable (whatsapp, email, phone, sms)
  language          text, not null, default 'de'
  
  -- Notizen & Kontext
  notes             text, nullable (interne Freitext-Notizen)
  
  -- DSGVO
  gdpr_consent_at   timestamptz, nullable
  gdpr_consent_source text, nullable (form, verbal, import, website)
  marketing_consent boolean, not null, default false
  
  -- Interaktion (kein is_active — berechnet aus last_interaction_at)
  last_interaction_at timestamptz, nullable
  
  -- Meta
  created_by        uuid, nullable, foreign key → users
  created_at        timestamptz, default now()
  updated_at        timestamptz
  deleted_at        timestamptz, nullable (Soft Delete)

  -- Constraints
  CHECK (last_name IS NOT NULL OR company_name IS NOT NULL)
    -- Mindestens Name ODER Firmenname muss gesetzt sein
  CHECK contact_type IN ('customer', 'prospect', 'seller', 'partner', 'other')
  CHECK source IN ('manual', 'csv_import', 'whatsapp', 'mobile_de', 'autoscout24', 
                   'website', 'phone', 'walk_in', 'referral', 'meta_ads')

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_contacts_tenant ON contacts(tenant_id)
  INDEX idx_contacts_tenant_type ON contacts(tenant_id, contact_type)
  INDEX idx_contacts_tenant_created ON contacts(tenant_id, created_at DESC)
  INDEX idx_contacts_tenant_name ON contacts(tenant_id, last_name, first_name)
  INDEX idx_contacts_email ON contacts(tenant_id, lower(email)) WHERE email IS NOT NULL
  INDEX idx_contacts_phone ON contacts(tenant_id, phone) WHERE phone IS NOT NULL
  INDEX idx_contacts_phone_mobile ON contacts(tenant_id, phone_mobile) WHERE phone_mobile IS NOT NULL
  INDEX idx_contacts_whatsapp ON contacts(tenant_id, whatsapp_number) WHERE whatsapp_number IS NOT NULL
  INDEX idx_contacts_assigned ON contacts(tenant_id, assigned_to) WHERE assigned_to IS NOT NULL
  INDEX idx_contacts_interaction ON contacts(tenant_id, last_interaction_at DESC NULLS LAST)
```

### Tabelle: `contact_vehicle_interests`

Verknüpft Kontakte mit Fahrzeugen an denen sie Interesse gezeigt haben. Keine Ownership — nur Interesse.

```
contact_vehicle_interests:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  contact_id        uuid, foreign key → contacts, not null
  vehicle_id        uuid, foreign key → vehicles, not null
  interest_type     text, not null, default 'inquiry'
  notes             text, nullable
  created_at        timestamptz, default now()
  
  -- Constraints
  UNIQUE (tenant_id, contact_id, vehicle_id)
  CHECK interest_type IN ('inquiry', 'test_drive', 'offer_requested', 'general')
  
  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_cvi_contact ON contact_vehicle_interests(tenant_id, contact_id)
  INDEX idx_cvi_vehicle ON contact_vehicle_interests(tenant_id, vehicle_id)
```

### Tabelle: `contact_activities`

Interaktionshistorie: jede Kommunikation, jeder Kontaktpunkt.

```
contact_activities:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  contact_id        uuid, foreign key → contacts, not null
  
  -- Aktivität
  activity_type     text, not null
  title             text, nullable
  description       text, nullable
  
  -- Verknüpfungen (optional)
  vehicle_id        uuid, nullable, foreign key → vehicles
  deal_id           uuid, nullable (kein FK im CRM-Schema — wird erst durch Modul 03 als FK definiert)
  message_id        uuid, nullable (Referenz auf WhatsApp/E-Mail-Nachricht)
  
  -- Wer & Wann
  performed_by      uuid, nullable, foreign key → users (null = System/AI/extern)
  performed_at      timestamptz, not null, default now()
  created_at        timestamptz, default now()

  -- Constraints
  CHECK activity_type IN ('note', 'call', 'email_in', 'email_out', 
    'whatsapp_in', 'whatsapp_out', 'visit', 'test_drive', 'offer_sent', 
    'deal_created', 'deal_won', 'deal_lost', 'vehicle_interest', 
    'type_change', 'assignment_change')

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_activities_contact ON contact_activities(tenant_id, contact_id, performed_at DESC)
  INDEX idx_activities_vehicle ON contact_activities(tenant_id, vehicle_id) WHERE vehicle_id IS NOT NULL
  INDEX idx_activities_type ON contact_activities(tenant_id, activity_type, performed_at DESC)
```

### Sales-Abhängigkeit: `deal_id`

**Entscheidung:** `deal_id` wird als `uuid, nullable` ohne FK-Constraint im CRM-Schema angelegt. Wenn Modul 03 (Sales) gebaut wird, wird der FK per Migration ergänzt. Bis dahin bleibt das Feld NULL.

**Konsequenz:** Das CRM zeigt keine Deal-Informationen bis Modul 03 existiert. `open_deals_count` und Deal-Tabs im Detail-Screen werden erst durch Modul 03 aktiviert. Das Frontend prüft per Feature-Flag ob Sales verfügbar ist.

---

## 4. Designentscheidungen

### 4.1 Kontakt ≠ Lead

**Entscheidung:** Das CRM hat kein Lead-Scoring, keine Pipeline-Stufen und keine automatische Qualifizierung im MVP. Pipeline lebt in Sales (Modul 03).

### 4.2 Kein `is_active`-Feld

**Entscheidung:** Aktivität wird ausschließlich aus `last_interaction_at` zur Query-Zeit berechnet. Kein gespeichertes Flag.

**Begründung:** Ein persistiertes `is_active` driftet zwangsläufig gegenüber `last_interaction_at`. Ein Cron-Job zur Synchronisierung ist Overengineering für den MVP. Die Query-Time-Berechnung ist einfach, konsistent und indexiert (via `idx_contacts_interaction`).

**Filter-Implementierung:**
```sql
-- Aktive Kontakte (Interaktion in den letzten 30 Tagen)
WHERE last_interaction_at >= now() - interval '30 days'

-- Inaktive Kontakte
WHERE last_interaction_at IS NULL OR last_interaction_at < now() - interval '30 days'
```

### 4.3 Personen UND Firmen als Kontakte

**Entscheidung:** `CHECK (last_name IS NOT NULL OR company_name IS NOT NULL)` — mindestens eines von beiden muss gesetzt sein.

**Begründung:** WhatsApp-Kontakte haben anfangs oft nur eine Nummer und keinen Namen. Börsen-Kontakte haben Name + E-Mail. Firmenkontakte (Partner, Zulieferer) haben `company_name` aber manchmal keinen Ansprechpartner. Ein einzelnes Pflichtfeld (`last_name`) funktioniert nicht für alle Quellen.

**Display-Name-Logik:**
```
Wenn last_name gesetzt: "{salutation} {first_name} {last_name}"
Wenn nur company_name: "{company_name}"
Fallback (sollte nie passieren dank CHECK): "Unbekannt"
```

### 4.4 Duplikat-Erkennung: kanalübergreifend

**Entscheidung:** Duplikat-Check matcht auf alle Kontaktkanäle, nicht nur email/phone.

**Match-Regeln (Exact-Match, normalisiert):**
1. `email` (case-insensitive, via `lower(email)`)
2. `phone` (normalisiert: nur Ziffern, mit Ländervorwahl)
3. `phone_mobile` (normalisiert)
4. `whatsapp_number` (normalisiert)

**Normalisierung im Service-Layer:** Vor jedem Match und vor jedem Speichern werden Telefonnummern normalisiert: Leerzeichen/Bindestriche entfernen, +49-Prefix sicherstellen wenn deutsche Nummer. E-Mails auf lowercase. Das passiert im CRM-Service, nicht in der DB.

**Match-Logik:** Ein neuer Kontakt ist ein Duplikat wenn **irgendein** normalisierter Kanal (email, phone, phone_mobile, whatsapp_number) mit einem bestehenden Kontakt im selben Tenant übereinstimmt.

**Kein DB-Unique-Index auf Kontaktkanälen** — weil ein Kontakt mehrere Kanäle hat und die Normalisierung im Service liegt. Schutz ist auf Anwendungsebene mit Transaktions-Safety: SELECT FOR UPDATE vor Create.

### 4.5 Tags als Array

**Entscheidung:** `tags` ist ein `text[]` Array, kein Join. Gleiche Begründung wie Equipment bei Inventory.

### 4.6 Activity-Typen sind semantisch differenziert

**Entscheidung:** Statt eines generischen `status_change` gibt es spezifische Typen:
- `type_change` — Kontakttyp geändert (z.B. Interessent → Kunde)
- `assignment_change` — Zuständigkeit geändert

**Begründung:** Eine Timeline die nur "Status geändert" zeigt ist wenig aussagekräftig. Spezifische Typen ermöglichen bessere Filterung und spätere Auswertung.

---

## 5. API (tRPC Router)

Router: `crm` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen

```typescript
// DB-Entity
type ContactRecord = { /* alle DB-Spalten */ }

// API-View für Rollen mit vollem Zugriff (owner, admin, manager)
type ContactView = {
  id: string;
  display_name: string;  // berechnet
  salutation: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  whatsapp_number: string | null;
  // ... alle Kontaktdaten
  notes: string | null;              // interne Notizen — nur für berechtigte Rollen
  gdpr_consent_at: string | null;    // DSGVO — nur für berechtigte Rollen
  gdpr_consent_source: string | null;
  marketing_consent: boolean;
  assigned_to_user: { id: string; name: string } | null;
  vehicle_interests: VehicleInterestView[];
  recent_activities: ActivityView[];  // letzte 5
  contact_type: ContactType;
  tags: string[];
  is_inactive: boolean;              // berechnet aus last_interaction_at
  last_interaction_at: string | null;
  created_at: string;
}

// API-View für eingeschränkte Rollen (salesperson, receptionist)
type ContactViewRestricted = Omit<ContactView, 
  'notes' | 'gdpr_consent_at' | 'gdpr_consent_source'>

// Kompakte Ansicht für Listen
type ContactListItem = {
  id: string;
  display_name: string;
  contact_type: ContactType;
  email: string | null;
  phone: string | null;
  assigned_to_user: { id: string; name: string } | null;
  tags: string[];
  is_inactive: boolean;
  last_interaction_at: string | null;
  created_at: string;
}
```

**Regel:** `crm.getById` prüft `ctx.role`: owner/admin/manager → `ContactView`, salesperson/receptionist → `ContactViewRestricted`. `viewer` sieht nur `ContactListItem`-Level.

### Procedures

```
crm.list
  Type:     query
  Auth:     protectedProcedure
  Input:    ContactListInput
            {
              cursor?: string,
              limit?: number (default 20, max 100),
              search?: string (sucht in first_name, last_name, email, 
                       phone, phone_mobile, whatsapp_number, company_name),
              contact_type?: ContactType | ContactType[],
              source?: ContactSource | ContactSource[],
              tags?: string[] (Kontakt muss ALLE haben),
              assigned_to?: string (user_id),
              is_inactive?: boolean,
              vehicle_id?: string (alle Kontakte mit Interesse an diesem Fahrzeug),
              sort_by?: 'created_at' | 'last_name' | 'last_interaction_at',
              sort_order?: 'asc' | 'desc',
            }
  Output:   { items: ContactListItem[], nextCursor: string | null }
  Regeln:
    - Cursor ist Compound: (sort_field_value, id) — deterministisch
    - Default-Sortierung: created_at DESC, id DESC
    - is_inactive berechnet zur Query-Zeit aus last_interaction_at
    - vehicle_id filtert über contact_vehicle_interests Join
    - deleted_at IS NULL implizit
    - Kein totalCount (Cursor-Pagination)

crm.getById
  Type:     query
  Auth:     protectedProcedure
  Input:    { id: string }
  Output:   ContactView | ContactViewRestricted (rollenabhängig)
  Regeln:
    - owner/admin/manager → ContactView (mit Notizen, DSGVO)
    - salesperson/receptionist → ContactViewRestricted
    - viewer → TRPCError FORBIDDEN (nur Listenzugriff)
    - Enthält KEINE Deal-Informationen (bis Modul 03 existiert)

crm.create
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson", "receptionist"])
  Input:    CreateContactInput
            {
              salutation?: string,
              first_name?: string,
              last_name?: string,        // ODER company_name — mind. 1
              company_name?: string,
              email?: string,
              phone?: string,
              phone_mobile?: string,
              whatsapp_number?: string,
              street?: string,
              zip_code?: string,
              city?: string,
              country?: string,
              contact_type?: ContactType (default: 'prospect'),
              source?: ContactSource (default: 'manual'),
              tags?: string[],
              preferred_channel?: string,
              notes?: string,
              gdpr_consent_at?: string,
              gdpr_consent_source?: string,
              marketing_consent?: boolean,
            }
  Output:   ContactView
  Regeln:
    - Validierung: last_name OR company_name Pflicht
    - Duplikat-Check: normalisierter Match auf email/phone/phone_mobile/whatsapp_number
    - Bei Duplikat: TRPCError CONFLICT mit ID des bestehenden Kontakts
    - assigned_to wird NICHT bei Create gesetzt — nur über crm.assignContact
    - Wenn assigned_to nicht vorhanden: bleibt NULL (kein Auto-Assign an Ersteller)
    - Schreibt Audit-Log
    - Erstellt Activity: activity_type = 'type_change', title = 'Kontakt erstellt'

crm.update
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson", "receptionist"])
  Input:    UpdateContactInput
            {
              id: string,
              salutation?: string | null,
              first_name?: string | null,
              last_name?: string | null,
              company_name?: string | null,
              email?: string | null,
              phone?: string | null,
              phone_mobile?: string | null,
              whatsapp_number?: string | null,
              street?: string | null,
              zip_code?: string | null,
              city?: string | null,
              country?: string,
              contact_type?: ContactType,
              tags?: string[],
              preferred_channel?: string | null,
              notes?: string | null,
              language?: string,
              gdpr_consent_at?: string | null,
              gdpr_consent_source?: string | null,
              marketing_consent?: boolean,
            }
  Output:   ContactView | ContactViewRestricted
  Regeln:
    - AUSGESCHLOSSEN: assigned_to (nur über crm.assignContact), 
      source, created_by, created_at, deleted_at
    - Validierung: last_name OR company_name muss weiterhin erfüllt sein
    - Duplikat-Check bei Änderung von email/phone/phone_mobile/whatsapp_number
    - Bei Typ-Wechsel: Activity 'type_change' erstellen
    - DSGVO-Felder sind aktualisierbar (Consent nachträglich einholen/widerrufen)
    - Schreibt Audit-Log

crm.archive
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   ContactView
  Regeln:
    - Soft Delete (deleted_at = now())
    - Offene Deals: NICHT automatisch geschlossen — Warnung an Frontend
    - Schreibt Audit-Log

crm.restore
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { id: string }
  Output:   ContactView

crm.addVehicleInterest
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { contactId: string, vehicleId: string, interestType?: InterestType, notes?: string }
  Output:   VehicleInterestView
  Regeln:
    - Prüft ob Fahrzeug existiert und im Tenant ist (Same-Tenant via Inventory-Export)
    - Erstellt Activity: 'vehicle_interest'
    - Aktualisiert contact.last_interaction_at

crm.removeVehicleInterest
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { contactId: string, vehicleId: string }
  Output:   void

crm.addActivity
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson", "receptionist"])
  Input:    CreateActivityInput
            {
              contactId: string,
              activity_type: ActivityType,
              title?: string,
              description?: string,
              vehicle_id?: string,
              performed_at?: string (default: now),
            }
  Output:   ActivityView
  Regeln:
    - Aktualisiert contact.last_interaction_at
    - deal_id und message_id sind NICHT im tRPC-Input — nur über Service-Export

crm.getActivities
  Type:     query
  Auth:     protectedProcedure
  Input:    { contactId: string, cursor?: string, limit?: number (default 20) }
  Output:   { items: ActivityView[], nextCursor: string | null }
  Regeln:
    - Sortierung: performed_at DESC, id DESC (deterministisch)

crm.assignContact
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { contactId: string, assignToUserId: string | null }
  Output:   ContactView
  Regeln:
    - null = Zuordnung aufheben
    - Prüft ob User im selben Tenant ist
    - Erstellt Activity: 'assignment_change'
    - Schreibt Audit-Log

crm.importContacts
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    ImportContactsInput
            {
              contacts: CreateContactInput[],
              skip_duplicates: boolean (default true),
            }
  Output:   { created: number, skipped: number, errors: ImportError[] }
  Regeln:
    - Alle importierten Kontakte: source = 'csv_import'
    - Validierung pro Kontakt (last_name OR company_name)
    - Duplikat-Check kanalübergreifend (normalisiert)
    - skip_duplicates = true: überspringen, nicht abbrechen
    - Max 500 Kontakte pro Import
    - DSGVO: gdpr_consent_at = null bei Import (Händler muss aktiv markieren)
    - Schreibt Audit-Log (Gesamt-Import)

crm.getStats
  Type:     query
  Auth:     protectedProcedure
  Input:    —
  Output:   CrmStats
            {
              total_contacts: number,
              by_type: { [type]: number },
              by_source: { [source]: number },
              new_this_month: number,
              unassigned: number,
              inactive_count: number,
            }
```

---

## 6. AI-Tools (für AI-Assistent)

Datei: `modules/crm/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "search_contacts",
  description: "Kontakte suchen. Händler fragt z.B. 'Wer hat sich für den Golf interessiert?'",
  parameters: {
    search?: string,
    contact_type?: ContactType,
    tags?: string[],
    vehicle_id?: string  // filtert über contact_vehicle_interests
  },
  execute: (params, ctx) => crmService.list(params, ctx)
},
{
  name: "get_contact_details",
  description: "Details eines Kontakts abrufen.",
  parameters: {
    id?: string,
    search?: string
  },
  execute: (params, ctx) => crmService.getByIdOrSearch(params, ctx)
},
{
  name: "get_crm_stats",
  description: "CRM-Kennzahlen abrufen.",
  parameters: {},
  execute: (params, ctx) => crmService.getStats(ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM Flow)

```typescript
{
  name: "propose_contact_create",
  description: "Neuen Kontakt anlegen vorschlagen.",
  parameters: {
    first_name?: string,
    last_name?: string,
    company_name?: string,
    phone?: string,
    email?: string,
    notes?: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "crm",
    action: "create_contact",
    proposed_changes: params,
    preview: () => contactCreatePreview(params),
    executeOnConfirm: () => crmService.create(params, ctx)
  })
  // Wenn Händler auch Fahrzeug-Interesse erwähnt:
  // AI-Assistent ruft nach bestätigtem Create einen zweiten propose_add_vehicle_interest auf
},
{
  name: "propose_add_note",
  description: "Notiz zu einem Kontakt hinzufügen vorschlagen.",
  parameters: {
    contact_id: string,
    title: string,
    description?: string,
    activity_type?: ActivityType  // default: 'note'
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "crm",
    action: "add_activity",
    proposed_changes: params,
    preview: () => activityPreview(params, ctx),
    executeOnConfirm: () => crmService.addActivity(params, ctx)
  })
},
{
  name: "propose_assign_contact",
  description: "Kontakt einem Mitarbeiter zuweisen vorschlagen.",
  parameters: {
    contact_id: string,
    assign_to_user_name: string
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "crm",
    action: "assign_contact",
    proposed_changes: params,
    preview: () => assignPreview(params, ctx),
    executeOnConfirm: () => crmService.assignContact(params, ctx)
  })
},
{
  name: "propose_add_vehicle_interest",
  description: "Fahrzeug-Interesse für einen Kontakt hinzufügen.
                Händler sagt z.B. 'Herr Müller interessiert sich für den BMW'",
  parameters: {
    contact_id: string,
    vehicle_id: string,
    interest_type?: InterestType
  },
  execute: (params, ctx) => aiCommandService.propose({
    module: "crm",
    action: "add_vehicle_interest",
    proposed_changes: params,
    preview: () => vehicleInterestPreview(params, ctx),
    executeOnConfirm: () => crmService.addVehicleInterest(params, ctx)
  })
}
```

---

## 7. Kontakt-Erstellung aus anderen Modulen

### Service-Exports für externe Module

```typescript
// modules/crm/index.ts — öffentliche Exports
export { getContactById, findContactByPhone, findContactByPhoneMobile, findContactByEmail, findContactByWhatsApp } from "./services/crm-service";
export { createContactFromExternal } from "./services/crm-service";
export { addActivityForContact } from "./services/crm-service";
export { markContactAsCustomer } from "./services/crm-service";
// → Setzt contact_type = 'customer', erstellt Activity 'type_change'
// → Aufgerufen von Sales-Modul bei Deal-Won
export type { ContactRecord, ContactView, ContactViewRestricted, ContactListItem, ContactType } from "./domain/types";
```

### `createContactFromExternal`

Dedizierter Service-Export für WhatsApp, Börsen und Website. Nicht identisch mit `crm.create` — hat erweiterte Parameter:

```typescript
createContactFromExternal(input: {
  // Kontakt-Felder wie bei Create
  source: ContactSource,  // z.B. 'whatsapp', 'mobile_de'
  // Optional: sofort Activity erstellen
  initial_activity?: {
    activity_type: ActivityType,
    title: string,
    description?: string,
    vehicle_id?: string,
    message_id?: string,  // für WhatsApp-Nachrichten
  }
}, ctx: TenantContext): Promise<{ contact: ContactRecord, created: boolean }>
```

**Rückgabe `created: boolean`:** Wenn ein bestehender Kontakt per Duplikat-Match gefunden wird, wird dieser zurückgegeben (`created: false`). Kein Fehler — das aufrufende Modul entscheidet was passiert.

### `addActivityForContact`

Erweiterter Service-Export mit `deal_id` und `message_id` — Felder die in der tRPC-Mutation nicht exponiert sind:

```typescript
addActivityForContact(input: {
  contactId: string,
  activity_type: ActivityType,
  title?: string,
  description?: string,
  vehicle_id?: string,
  deal_id?: string,      // nur über Service-Export, nicht über tRPC
  message_id?: string,   // nur über Service-Export, nicht über tRPC
  performed_by?: string,
}, ctx: TenantContext): Promise<ActivityRecord>
```

### WhatsApp (Modul 17)

1. Eingehende Nachricht → `findContactByWhatsApp(number)`
2. Kein Match → `createContactFromExternal({ whatsapp_number, source: 'whatsapp', initial_activity: { activity_type: 'whatsapp_in', message_id } })`
3. Match → `addActivityForContact({ activity_type: 'whatsapp_in', message_id })`

### Börsen-Anfragen (Modul 13)

1. Parser extrahiert Name, E-Mail, Telefon, Fahrzeug-Referenz
2. `createContactFromExternal({ source: 'mobile_de', initial_activity: { activity_type: 'vehicle_interest', vehicle_id } })`
3. Bei `created: false`: trotzdem Activity + Vehicle-Interest erstellen

### Website-Formular (Modul 11)

`createContactFromExternal({ source: 'website', initial_activity: { activity_type: 'vehicle_interest' | 'note' } })`

---

## 8. Daten-Import (CSV/Excel/vCard)

### Import-Flow

```
Schritt 1: Datei hochladen (CSV, XLSX oder VCF)
Schritt 2: Spaltenmapping (nur CSV/XLSX — automatische Erkennung + manuell korrigierbar)
Schritt 3: Preview (erste 10 Zeilen, Duplikate und Fehler markiert)
Schritt 4: Import ausführen → crm.importContacts
```

### Import-Regeln

- Max 500 Kontakte pro Import
- Alle: `source = 'csv_import'`
- Duplikat-Check: kanalübergreifend, normalisiert (Abschnitt 4.4)
- `skip_duplicates = true`: Duplikate überspringen
- DSGVO: `gdpr_consent_at = null` — Händler muss aktiv markieren
- Idempotenz: kein DB-Unique-Index (weil CSV-Kontakte keine stabile ID haben). Schutz über Duplikat-Check auf Kanälen. Zweimal importieren überspringt Duplikate.

---

## 9. UI-Screens (Händler-Interface)

### 9.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Kontaktliste | `/kontakte` | Filterbares Grid/Liste aller Kontakte |
| Kontakt anlegen | `/kontakte/neu` | Formular |
| Kontakt-Detail | `/kontakte/[id]` | Alle Daten, Timeline, Fahrzeug-Interessen. Deals-Tab erst mit Modul 03 |
| Kontakt bearbeiten | `/kontakte/[id]/bearbeiten` | Edit-Formular |
| Import | `/kontakte/import` | Upload + Mapping + Preview |

### 9.2 Kontaktliste

**Ansichtsmodi:** Karten (Mobile Default), Tabelle (Desktop Default)

**Filter:** Typ, Quelle, Tags, Zuständiger, Aktiv/Inaktiv, Fahrzeug-Interesse

**Suche:** Volltextsuche über Name, E-Mail, Telefon, Firma. Typeahead ab 2 Zeichen.

**Quick-Actions:** Anrufen, WhatsApp, Notiz hinzufügen, Deal erstellen (→ Modul 03, erst verfügbar wenn Sales gebaut)

### 9.3 Kontakt-Detail

**Header:** Name/Firma, Typ-Badge, Kontaktdaten (klickbar), Tags, Zuständiger

**Timeline (Hauptbereich):** Chronologisch, paginiert. Quick-Add Notiz am oberen Rand.

**Sidebar (Desktop) / Tabs (Mobile):**
- Fahrzeug-Interessen
- Deals (erst mit Modul 03 — Tab wird per Feature-Flag eingeblendet)
- Kontaktdaten & Adresse
- DSGVO-Status (nur owner/admin/manager)
- Interne Notizen (nur owner/admin/manager)

### 9.4 Komponenten

| Komponente | Zweck |
|------------|-------|
| `ContactCard` | Kontaktkarte für Grid-Ansicht |
| `ContactRow` | Kompakte Zeile für Tabellen-Ansicht |
| `ContactTypeBadge` | Farbiges Typ-Badge |
| `ContactForm` | Anlage-/Edit-Formular |
| `ActivityTimeline` | Chronologische Aktivitätsliste |
| `ActivityItem` | Einzelne Aktivität |
| `QuickNoteInput` | Eingabefeld für schnelle Notiz |
| `VehicleInterestList` | Verknüpfte Fahrzeuge |
| `ContactFilterPanel` | Sidebar/Sheet mit Filtern |
| `ImportWizard` | Mehrstufiger Import-Flow |
| `ContactSearch` | Globale Kontaktsuche mit Typeahead |
| `CrmStatsBar` | KPI-Leiste |
| `GdprConsentSection` | DSGVO-Status (nur berechtigte Rollen) |

---

## 10. Business Rules

### 10.1 Pflichtfelder

- `last_name` ODER `company_name` — mindestens eins muss gesetzt sein
- DB-Constraint erzwingt das
- Alle anderen Felder sind optional

### 10.2 Duplikat-Handling

- Bei Create, Update (Kanaländerung), Import und externer Erstellung
- Kanalübergreifender Exact-Match (normalisiert): email, phone, phone_mobile, whatsapp_number
- Bei Match über tRPC: `TRPCError CONFLICT` mit ID des bestehenden Kontakts
- Bei Match über Service-Export: bestehenden Kontakt zurückgeben (`created: false`)
- Kein unscharfes Matching im MVP
- Schutz: `SELECT ... FOR UPDATE` im Service vor Create (Transaktions-Safety)

### 10.3 `last_interaction_at` aktualisieren

Jedes dieser Events aktualisiert `last_interaction_at`:
- Neue Activity erstellt
- WhatsApp-Nachricht empfangen/gesendet
- E-Mail empfangen/gesendet (Phase 2)
- Deal erstellt oder Status geändert (Modul 03)
- Fahrzeug-Interesse hinzugefügt

**Nicht:** Profil aufrufen, Admin-Änderungen an Kontaktdaten, Tag-Änderungen.

### 10.4 DSGVO-Regeln

- Kontakte ohne `gdpr_consent_at` können angelegt werden (berechtigtes Interesse)
- Marketing-Kommunikation nur bei `marketing_consent = true`
- DSGVO-Felder sind über `crm.update` aktualisierbar (Consent nachträglich einholen/widerrufen)
- Soft Delete über `archive`. Endgültige Löschung: Phase 2 (DSGVO-Lösch-Workflow)
- DSGVO-Export: Phase 2

### 10.5 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Kontaktliste sehen | Alle authentifizierten Rollen |
| Kontakt-Detail sehen (voll, inkl. Notizen/DSGVO) | `owner`, `admin`, `manager` |
| Kontakt-Detail sehen (eingeschränkt) | `salesperson`, `receptionist` |
| Kontakt anlegen/bearbeiten | `owner`, `admin`, `manager`, `salesperson`, `receptionist` |
| Kontakt archivieren | `owner`, `admin`, `manager` |
| Kontakt zuweisen | `owner`, `admin`, `manager` |
| Kontakte importieren | `owner`, `admin` |

---

## 11. MVP-Scope vs. Phase 2

### MVP (Phase 1) — Wird gebaut

- [x] Kontakt anlegen, bearbeiten, archivieren (Personen + Firmen)
- [x] Kontaktliste mit Filtern, Suche, Sortierung
- [x] Kontakt-Detail mit Timeline (rollenbasiert)
- [x] Aktivitäten/Notizen hinzufügen
- [x] Fahrzeug-Interessen verknüpfen
- [x] Kontakt-Zuweisung (nur Manager+)
- [x] CSV/Excel/vCard-Import mit kanalübergreifendem Duplikat-Check
- [x] Kanalübergreifende Duplikat-Erkennung (normalisiert)
- [x] AI-Tools (Lesen + PROPOSE-Tools)
- [x] Service-Exports für WhatsApp, Börsen, Website
- [x] DSGVO-Basisfelder (updatable, nachträglich einholbar)
- [x] Dashboard-KPIs
- [x] Rollenbasierte View-Typen (ContactView / ContactViewRestricted)

### Phase 2

- [ ] AI-Lead-Scoring
- [ ] Automatische Aufgabenerstellung
- [ ] Duplikat-Merge mit Kaskadenlogik
- [ ] DSGVO-Lösch-Workflow + Export
- [ ] Kontakt-Segmente (gespeicherte Filtersets)
- [ ] Automatische Inaktivitäts-Archivierung
- [ ] Erweiterte Consent-Verwaltung

---

## 12. Technische Abhängigkeiten

### Interne

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Platform Foundation | Auth, Tenants, RLS | Tenant-Kontext, Rollen-Checks |
| Modul 02 (Inventar) | Fahrzeug-Verknüpfungen | `contact_vehicle_interests.vehicle_id` |
| AI-Command-Service | AI-Integration | PROPOSE→CONFIRM-Flow |
| `audit_log` | Platform Foundation | Alle Schreiboperationen |

### Externe

Keine direkten externen Service-Abhängigkeiten im CRM-MVP.

---

## 13. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 3.1 (Händlersprache), Abschnitt 4 (Daten-Migration) |
| `01_ARCHITECTURE.md` | Abschnitt 3 (RLS), Abschnitt 5 (tRPC, Pagination), Abschnitt 8 (WhatsApp Inbound) |
| `MOD_02_INVENTORY.md` | Fahrzeug-Verknüpfungen |
| `MOD_03_SALES.md` | Deal-Referenzen in Activities, Typ-Wechsel bei Deal-Abschluss |
| `MOD_17_WHATSAPP.md` | Kontakt-Zuordnung bei Nachrichten |
| `CROSS_SECURITY.md` | DSGVO |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 01 vollständig.
> Kontakte sind Personen UND Firmen (last_name OR company_name).
> Kein is_active-Feld — Aktivität wird aus last_interaction_at berechnet.
> assigned_to NICHT über crm.update änderbar — nur über crm.assignContact.
> deal_id und message_id in Activities: nur über Service-Exports, nicht über tRPC.
> Duplikat-Check: kanalübergreifend (email, phone, phone_mobile, whatsapp_number), normalisiert.
> DSGVO-Felder sind über crm.update aktualisierbar.
> CRM zeigt keine Deal-Daten bis Modul 03 existiert (Feature-Flag).
