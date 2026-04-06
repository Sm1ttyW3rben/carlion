# CROSS — Globale Suche & Filterlogik

> Modulübergreifende Spezifikation für die globale Suchfunktion.
> Referenzdokumente: `01_ARCHITECTURE.md`, `MOD_02_INVENTORY.md`, `MOD_01_CRM.md`, `MOD_03_SALES.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v1)

---

## 1. Zweck

Carlion hat eine **globale Suche** die von jedem Screen aus erreichbar ist. Der Händler tippt einen Suchbegriff und findet Fahrzeuge, Kontakte und Deals — ohne vorher wählen zu müssen wo er sucht.

Dieses Dokument definiert:
- Was durchsucht wird und welche Felder pro Entität
- Wie die Suche technisch funktioniert (kein externer Suchdienst im MVP)
- Wie Ergebnisse gruppiert und priorisiert werden
- Wie die UI aussieht

---

## 2. Suchbare Entitäten (MVP)

| Entität | Modul | Durchsuchte Felder | Beispiel-Query |
|---------|-------|-------------------|----------------|
| Fahrzeug | 02 | make, model, variant, vin, internal_number, license_plate | "BMW 320d", "WBA12345", "B-AB 1234" |
| Kontakt | 01 | first_name, last_name, company_name, email, phone, phone_mobile, whatsapp_number | "Müller", "0171-123", "max@" |
| Deal | 03 | Kontaktname (über Join), Fahrzeug make/model (über Join) | "Müller BMW" |

**Nicht durchsuchbar:** Nachrichten (WhatsApp), Inserate (Listings), Website-Submissions. Phase 2.

---

## 3. Technische Implementierung (MVP)

### Kein externer Suchdienst

Im MVP: PostgreSQL `ILIKE` und `tsvector` auf den relevanten Feldern. Kein Elasticsearch, kein Algolia, kein Typesense.

**Begründung:** Bei 20-200 Fahrzeugen, <1000 Kontakten und <500 Deals pro Tenant reicht PostgreSQL problemlos. Ein externer Suchdienst wäre Overengineering.

### Such-Strategie: Prefix-Match + Volltextsuche

```sql
-- Schnelle Prefix-Suche (für Typeahead, <3 Zeichen)
WHERE lower(last_name) LIKE lower($query) || '%'
   OR lower(first_name) LIKE lower($query) || '%'
   OR phone LIKE $query || '%'

-- Volltext (für >=3 Zeichen)
WHERE search_vector @@ plainto_tsquery('german', $query)
   OR lower(last_name) LIKE '%' || lower($query) || '%'
```

### `search_vector`-Spalten

Jede suchbare Tabelle bekommt eine `tsvector`-Spalte die bei Insert/Update automatisch aktualisiert wird:

```sql
-- vehicles
ALTER TABLE vehicles ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('german', 
      coalesce(make, '') || ' ' || 
      coalesce(model, '') || ' ' || 
      coalesce(variant, '') || ' ' ||
      coalesce(vin, '') || ' ' ||
      coalesce(internal_number, '') || ' ' ||
      coalesce(license_plate, '')
    )
  ) STORED;

CREATE INDEX idx_vehicles_search ON vehicles USING gin(search_vector);

-- contacts
ALTER TABLE contacts ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('german',
      coalesce(first_name, '') || ' ' ||
      coalesce(last_name, '') || ' ' ||
      coalesce(company_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(phone_mobile, '')
    )
  ) STORED;

CREATE INDEX idx_contacts_search ON contacts USING gin(search_vector);
```

**Deals:** Keine eigene `search_vector`-Spalte. Deals werden über Joins auf Kontakt und Fahrzeug durchsucht.

---

## 4. API

### tRPC Procedure

```
search.global
  Type:     query
  Auth:     protectedProcedure
  Input:    { query: string, limit?: number (default 5 pro Entität, max 20) }
  Output:   GlobalSearchResult
            {
              vehicles: VehicleSearchResult[],
              contacts: ContactSearchResult[],
              deals: DealSearchResult[],
            }
  Regeln:
    - Mindestens 2 Zeichen (darunter: leeres Ergebnis)
    - RLS filtert automatisch auf Tenant
    - deleted_at IS NULL auf allen Entitäten
    - Rollenbasiert: receptionist/viewer sehen keine Deals
    - Ergebnisse nach Relevanz sortiert (tsvector Rank oder Match-Position)
    - Timeout: max 500ms (Query-Abbruch bei Überschreitung)
```

### Ergebnis-Typen

```typescript
type VehicleSearchResult = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  asking_price_gross: number | null;
  status: VehicleStatus;
  main_photo_url: string | null;
}

type ContactSearchResult = {
  id: string;
  display_name: string;
  contact_type: ContactType;
  email: string | null;
  phone: string | null;
}

type DealSearchResult = {
  id: string;
  contact_name: string;
  vehicle_title: string;
  stage: DealStage;
  offered_price: number | null;
}
```

---

## 5. UI

### Globale Suchleiste

- **Position:** Im Header, auf jedem Dashboard-Screen sichtbar
- **Tastenkürzel:** `Cmd+K` / `Ctrl+K` öffnet Suchfeld fokussiert
- **Typeahead:** Ergebnisse erscheinen ab 2 Zeichen, aktualisieren sich bei jedem Tastendruck (debounced, 200ms)

### Ergebnis-Darstellung

```
┌─────────────────────────────────────────┐
│ 🔍 "BMW Müll..."                        │
├─────────────────────────────────────────┤
│ Fahrzeuge                               │
│   BMW 320d Sport Line — 29.900€ — ✓     │
│   BMW X3 xDrive — 45.000€ — Reserviert  │
├─────────────────────────────────────────┤
│ Kontakte                                │
│   Herr Max Müller — Interessent         │
│   Firma Müller GmbH — Partner           │
├─────────────────────────────────────────┤
│ Vorgänge                                │
│   Müller ↔ BMW 320d — Angebot           │
└─────────────────────────────────────────┘
```

**Klick auf Ergebnis:** Navigiert zur Detail-Seite der Entität.

**Leer-Zustand:** "Keine Ergebnisse für '{query}'" mit Vorschlag ("Versuche einen anderen Suchbegriff").

### Komponenten

| Komponente | Zweck |
|------------|-------|
| `GlobalSearchBar` | Input-Feld im Header |
| `SearchResultsDropdown` | Overlay mit gruppierten Ergebnissen |
| `SearchResultGroup` | Gruppe (Fahrzeuge, Kontakte, Vorgänge) |
| `SearchResultItem` | Einzelnes Ergebnis (Icon, Titel, Untertitel) |
| `SearchEmptyState` | Keine Ergebnisse |

---

## 6. AI-Integration

Der AI-Assistent nutzt die globale Suche nicht direkt — er hat eigene, präzisere Tools pro Modul (`list_vehicles`, `search_contacts`, etc.). Die globale Suche ist ein UI-Feature für den Händler, nicht ein AI-Tool.

**Begründung:** Die AI braucht typisierte Filter und strukturierte Rückgaben. Die globale Suche ist ein unscharfer Freitext-Einstieg. Beides hat verschiedene Anforderungen.

---

## 7. Performance-Ziele

| Metrik | Ziel |
|--------|------|
| Time to First Result | < 200ms |
| Max Query Duration | 500ms (danach Abbruch) |
| Typeahead Debounce | 200ms |
| Max Ergebnisse | 5 pro Entität (15 gesamt im Dropdown) |

---

## 8. MVP-Scope vs. Phase 2

### MVP

- [x] Globale Suche über Fahrzeuge, Kontakte, Deals
- [x] PostgreSQL tsvector + ILIKE
- [x] Typeahead im Header (Cmd+K)
- [x] Gruppierte Ergebnisse mit Navigation

### Phase 2

- [ ] WhatsApp-Nachrichten durchsuchen
- [ ] Inserate durchsuchen
- [ ] Aktivitäten/Notizen durchsuchen
- [ ] Suchhistorie (letzte Suchen)
- [ ] Externer Suchdienst (bei Skalierung auf große Tenants)
- [ ] Fuzzy-Match (Tippfehler-Toleranz)

---

## 9. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `MOD_02_INVENTORY.md` | Suchfelder für Fahrzeuge |
| `MOD_01_CRM.md` | Suchfelder für Kontakte |
| `MOD_03_SALES.md` | Such-Joins für Deals |

---

> **Hinweis für Claude Code:** Dieses Dokument definiert die globale Suche.
> Kein externer Suchdienst im MVP — PostgreSQL tsvector reicht.
> search_vector als STORED generated column + GIN Index.
> Mindestens 2 Zeichen, max 500ms, RLS-gefiltert.
> AI-Assistent nutzt eigene Tools, nicht die globale Suche.
