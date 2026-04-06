# MOD 17 — WhatsApp Business Integration

> Modulspezifikation für die WhatsApp-Anbindung über 360dialog.
> Referenzdokumente: `00_VISION.md`, `01_ARCHITECTURE.md`, `MOD_01_CRM.md`
>
> Letzte Aktualisierung: April 2026
> Status: Review-Ready (v2)

---

## 1. Zweck & Einordnung

Das WhatsApp-Modul verbindet Carlion mit WhatsApp Business über den Provider 360dialog. Es hat im MVP eine einzige Kernaufgabe: **Unified Inbox** — alle WhatsApp-Nachrichten des Autohauses an einem Ort empfangen und manuell beantworten.

**MVP-Einschränkung (Vision Abschnitt 4):** Nur Unified Inbox + manuell antworten. Keine automatischen AI-Antworten, kein Outbound-Automation. Der AI-Assistent kann eine Antwort **vorschlagen** die der Händler bestätigt — das ist kein Auto-Reply, sondern ein PROPOSE-Flow.

### Einordnung im Produktsystem

| Aspekt | Wert |
|--------|------|
| Modul-Nr. | 17 |
| Kategorie | Kritische Integrationen |
| Phase | **MVP** |
| Build-Reihenfolge | 7 (letztes MVP-Modul) |
| Abhängigkeiten | Platform Foundation, Modul 01 (CRM — Kontakt-Zuordnung) |
| Abhängig davon | Modul 09 (AI-Chatbot, Phase 2), Modul 19 (E-Mail-Automation, Phase 2) |

---

## 2. Kernkonzept — Unified Inbox

Die Unified Inbox ist ein Chat-Interface das alle WhatsApp-Konversationen des Autohauses zeigt. Jede Konversation ist einem CRM-Kontakt zugeordnet.

### WhatsApp 24-Stunden-Regel

WhatsApp Business API erlaubt **freie Antworten nur innerhalb von 24 Stunden** nach der letzten eingehenden Nachricht des Kunden. Danach nur über genehmigte Message-Templates (Phase 2).

**MVP-Konsequenz:** Händler kann nur innerhalb des 24h-Fensters antworten. Abgelaufene Fenster werden in der UI markiert. Kein Template-Management im MVP.

---

## 3. Datenmodell

### Tabelle: `whatsapp_connections`

```
whatsapp_connections:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, unique, not null
  
  -- 360dialog Konfiguration
  phone_number_id   text, nullable (WhatsApp Business Phone Number ID — NULL nach Disconnect)
  display_phone     text, not null (z.B. "+49 170 1234567")
  waba_id           text, not null (WhatsApp Business Account ID)
  
  -- Status
  connection_status text, not null, default 'disconnected'
                    -- disconnected | connected | error
  last_error        text, nullable
  webhook_verified  boolean, not null, default false
  
  -- Meta
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  CHECK connection_status IN ('disconnected', 'connected', 'error')

  -- RLS (exakt nach 01_ARCHITECTURE.md Abschnitt 3)
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

### Tabelle: `whatsapp_conversations`

```
whatsapp_conversations:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  contact_id        uuid, foreign key → contacts, not null
  
  -- WhatsApp-Kontext
  remote_phone      text, not null (normalisiert, +49-Prefix)
  
  -- Status
  status            text, not null, default 'active'
                    -- active | archived
  unread_count      integer, not null, default 0
  last_message_at   timestamptz, nullable
  last_message_preview text, nullable (erste 100 Zeichen)
  
  -- 24h-Fenster
  reply_window_expires timestamptz, nullable
  
  -- Meta
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  UNIQUE (tenant_id, contact_id)
  UNIQUE (tenant_id, remote_phone)
  CHECK status IN ('active', 'archived')

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_conversations_tenant ON whatsapp_conversations(tenant_id, last_message_at DESC NULLS LAST)
  INDEX idx_conversations_contact ON whatsapp_conversations(tenant_id, contact_id)
  INDEX idx_conversations_phone ON whatsapp_conversations(tenant_id, remote_phone)
  INDEX idx_conversations_unread ON whatsapp_conversations(tenant_id) WHERE unread_count > 0
```

### Tabelle: `whatsapp_messages`

```
whatsapp_messages:
  id                uuid, primary key
  tenant_id         uuid, foreign key → tenants, not null
  conversation_id   uuid, foreign key → whatsapp_conversations, not null
  
  -- Inhalt
  direction         text, not null (inbound | outbound)
  message_type      text, not null, default 'text'
                    -- text | image | document | audio | video | location | contact | sticker | unknown
  body              text, nullable
  media_url         text, nullable (URL bei 360dialog, temporär)
  media_mime_type   text, nullable
  media_file_id     uuid, nullable, foreign key → files (heruntergeladenes Medium)
  
  -- WhatsApp-Referenz
  external_message_id text, nullable
  
  -- Status (nur outbound)
  send_status       text, nullable
                    -- sending | sent | delivered | read | failed
  send_error        text, nullable
  
  -- CRM-Verknüpfung
  activity_created  boolean, not null, default false
                    -- Wurde CRM-Activity für diese Nachricht erstellt?
  
  -- Absender
  sent_by           uuid, nullable, foreign key → users (null bei inbound)
  
  -- Meta
  timestamp         timestamptz, not null
  created_at        timestamptz, default now()
  updated_at        timestamptz

  -- Constraints
  CHECK direction IN ('inbound', 'outbound')
  CHECK message_type IN ('text', 'image', 'document', 'audio', 'video', 'location', 'contact', 'sticker', 'unknown')
  CHECK send_status IS NULL OR direction = 'outbound'
  
  -- Deduplizierung
  UNIQUE INDEX idx_messages_external ON whatsapp_messages(tenant_id, external_message_id)
    WHERE external_message_id IS NOT NULL

  -- RLS
  Policy "tenant_isolation_select" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_insert" WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_update" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
    WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
  Policy "tenant_isolation_delete" USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)

  -- Indizes
  INDEX idx_messages_conversation ON whatsapp_messages(tenant_id, conversation_id, timestamp DESC)
  INDEX idx_messages_pending_activity ON whatsapp_messages(tenant_id)
    WHERE activity_created = false AND send_status IN ('sent', 'delivered', 'read')
```

---

## 4. Designentscheidungen

### 4.1 Konversation als denormalisiertes Aggregat

`unread_count`, `last_message_at`, `last_message_preview` und `reply_window_expires` werden bei jeder Nachricht aktualisiert — in derselben Transaktion. Kein Query-Time-Aggregat. Schnelle Inbox-Queries für <200 Konversationen pro Tenant.

### 4.2 Medien-Downloads in Storage

Eingehende Medien werden von 360dialog heruntergeladen und in Supabase Storage gespeichert (`media_file_id` → `files`). 360dialog-URLs sind temporär (~30 Tage). Download passiert asynchron nach Nachrichteneingang. Bei Download-Fehler: `media_file_id = NULL`, `media_url` bleibt als Fallback.

**Storage-Pfad:** `whatsapp/{tenant_id}/{conversation_id}/{file_id}.{ext}` (privat)

### 4.3 User-getriggertes Senden: direkt, kein Outbox

Wenn der Händler "Senden" klickt: sofort an 360dialog. Kein Cron-Delay. Bei 360dialog-Fehler: `send_status = 'failed'`, Outbox-Eintrag als Retry-Fallback. Exakt nach `01_ARCHITECTURE.md` Abschnitt 8.

### 4.4 AI-Antwortvorschlag im MVP erlaubt

**Klarstellung:** Der AI-Assistent darf eine Antwort **vorschlagen** (`propose_whatsapp_reply`). Das ist ein PROPOSE-Flow — der Händler sieht den Vorschlag und bestätigt per Klick. Das ist kein Auto-Reply und keine automatische Antwort. Der Händler hat immer das letzte Wort.

**Was NICHT im MVP ist:** AI die ohne Bestätigung antwortet, AI die automatisch auf bestimmte Muster reagiert, AI-Chatbot-Logik.

### 4.5 Kontakt-Matching: Hierarchische Suche

**Entscheidung:** Bei eingehenden Nachrichten wird der Absender über eine Match-Hierarchie gesucht, nicht nur über `whatsapp_number`.

**Match-Reihenfolge (normalisierte Nummer):**
1. `contacts.whatsapp_number` — exakter Match
2. `contacts.phone_mobile` — exakter Match (normalisiert)
3. `contacts.phone` — exakter Match (normalisiert)

**Bei Match auf Stufe 2 oder 3:** `whatsapp_number` wird automatisch auf dem Kontakt gesetzt (der Kontakt hat jetzt eine bestätigte WhatsApp-Nummer).

**Kein Match auf allen Stufen:** Neuer Kontakt erstellen (siehe Abschnitt 5).

### 4.6 Webhook-Verarbeitung: architekturkonform

**Entscheidung:** WhatsApp-Webhooks folgen dem Architektur-Pattern aus `01_ARCHITECTURE.md` Abschnitt Webhook-Handling:

1. Signatur validieren
2. Event in `webhook_log` speichern
3. HTTP 200 sofort zurückgeben
4. Asynchrone Verarbeitung per Cron

**Pragmatische Erweiterung für Realtime:** Zusätzlich zum architekturkonformen Pfad wird ein "fast-path" versucht: nach dem Loggen wird die Verarbeitung direkt im selben Request angestoßen (Kontakt finden, Nachricht speichern, Realtime-Push). Wenn der Fast-Path fehlschlägt: kein Problem, der Cron holt es nach. Wenn der Fast-Path erfolgreich ist: der Cron findet nichts mehr zu tun.

```
Webhook-Request:
  1. Signatur validieren (bei Fehler: 401)
  2. webhook_log INSERT (idempotent per Event-ID)
  3. HTTP 200 sofort
  4. Fast-Path (best-effort, nicht blockierend):
     └── Versuche sofortige Verarbeitung
  5. Cron /api/jobs/process-whatsapp-webhooks (jede Minute):
     └── Verarbeitet alle webhook_log Einträge die noch nicht processed sind
```

**Warum beides?** Nur Cron = 1 Min Latenz für neue Nachrichten, schlechte Inbox-UX. Nur synchron = Architekturbruch und fragil. Beides = best-effort Realtime mit garantiertem Fallback.

### 4.7 CRM-Activity erst nach erfolgreichem Send

**Entscheidung:** Für ausgehende Nachrichten wird die CRM-Activity (`whatsapp_out`) erst erstellt wenn 360dialog den Send bestätigt hat (`send_status = 'sent'`). Nicht beim lokalen Speichern.

**Implementierung:** `activity_created`-Flag auf der Nachricht. Ein Cron oder der Status-Update-Webhook setzt `activity_created = true` nach Activity-Erstellung. Retry-Sends erzeugen keine doppelte Activity — der Flag verhindert das.

**Für eingehende Nachrichten:** CRM-Activity (`whatsapp_in`) wird im Fast-Path oder Cron sofort erstellt (eingehend = immer erfolgreich).

### 4.8 Disconnect mit hartem Inbound-Stop

**Entscheidung:** Bei `removeConnection`:

1. Webhook bei 360dialog deregistrieren (best-effort)
2. `phone_number_id` auf NULL setzen (verhindert Tenant-Mapping im Webhook)
3. `connection_status = 'disconnected'`
4. Konversationen bleiben (Archiv-Wert)

**Warum `phone_number_id = NULL`?** Selbst wenn 360dialog die Deregistrierung nicht sauber verarbeitet und weiter Webhooks sendet: das Tenant-Mapping findet keinen Match mehr. Nachrichten werden ignoriert.

### 4.9 `markAsRead`: nur lokal im MVP

**Entscheidung:** `markAsRead` setzt `unread_count = 0` auf der Konversation. Keine Read-Receipts an 360dialog (keine blauen Häkchen beim Kunden). Phase 2: optionale Read-Receipts.

**Begründung:** Read-Receipts sind ein kundensichtbarer Seiteneffekt. Im MVP wollen wir keine versteckten Nebenwirkungen.

---

## 5. Inbound-Flow (Nachrichteneingang)

### Webhook-Route

```
app/api/webhooks/threesixty/route.ts
```

### Ablauf

```
1. SIGNATUR VALIDIEREN
   ├── 360dialog Webhook Secret aus Environment
   ├── Ungültig → HTTP 401, Log
   └── Gültig → weiter

2. EVENT LOGGEN (architekturkonform)
   ├── webhook_log INSERT:
   │   event_id (von 360dialog), service: 'threesixty', payload (JSONB),
   │   processed: false, received_at: now()
   ├── Deduplizierung: event_id existiert schon → ignorieren (idempotent)
   └── HTTP 200 sofort zurückgeben

3. FAST-PATH (best-effort, nach Response)
   ├── Event-Typ erkennen: message | status_update | error
   │
   ├── MESSAGE:
   │   ├── Tenant identifizieren:
   │   │   whatsapp_connections WHERE phone_number_id = ? AND connection_status = 'connected'
   │   │   → Kein Match: ignorieren (Tenant disconnected oder unbekannt)
   │   │
   │   ├── Kontakt suchen (Match-Hierarchie, Abschnitt 4.5):
   │   │   1. findContactByWhatsApp(normalized_number)
   │   │   2. findContactByPhoneMobile(normalized_number)
   │   │   3. findContactByPhone(normalized_number)
   │   │   → Bei Match auf 2/3: whatsapp_number automatisch setzen
   │   │
   │   ├── Kein Match → Neuer Kontakt:
   │   │   crmService.createContactFromExternal({
   │   │     last_name: 'Unbekannt',
   │   │     whatsapp_number: normalized_number,
   │   │     source: 'whatsapp',
   │   │     contact_type: 'prospect'
   │   │   })
   │   │
   │   ├── Konversation suchen/erstellen:
   │   │   whatsapp_conversations WHERE remote_phone = normalized_number AND tenant_id = ?
   │   │   → Wenn archiviert: status = 'active' (Reaktivierung)
   │   │
   │   ├── Nachricht speichern (in Transaktion):
   │   │   ├── whatsapp_messages INSERT (direction: 'inbound', external_message_id, ...)
   │   │   ├── conversation UPDATE (last_message_at, preview, unread_count+1, reply_window_expires)
   │   │   └── CRM: addActivityForContact({ activity_type: 'whatsapp_in', message_id })
   │   │       (addActivityForContact aktualisiert last_interaction_at intern)
   │   │
   │   └── Supabase Realtime → Frontend zeigt Nachricht sofort
   │
   ├── STATUS_UPDATE:
   │   ├── external_message_id → whatsapp_messages finden
   │   ├── send_status aktualisieren (sent/delivered/read/failed)
   │   └── Wenn send_status = 'sent' AND activity_created = false:
   │       CRM: addActivityForContact({ activity_type: 'whatsapp_out', message_id })
   │       → activity_created = true
   │
   └── ERROR: Log-Eintrag, kein weiterer Seiteneffekt

4. WEBHOOK_LOG MARKIEREN
   └── processed = true, processed_at = now()

5. CRON-FALLBACK (/api/jobs/process-whatsapp-webhooks, jede Minute)
   └── Alle webhook_log Einträge mit processed = false verarbeiten
       (gleiche Logik wie Fast-Path)

6. MEDIA-DOWNLOAD (asynchroner Cron oder nach Verarbeitung)
   ├── Für messages mit media_url != null AND media_file_id = null
   ├── Download über 360dialog-Service-Client (Timeout: 10s, Max 20 MB)
   ├── Storage: whatsapp/{tenant_id}/{conversation_id}/{file_id}.{ext}
   ├── files-Eintrag (entity_type: 'whatsapp', entity_id: message.id)
   ├── message.media_file_id aktualisieren
   └── Bei Fehler: media_file_id bleibt NULL, media_url als Fallback
```

---

## 6. Outbound-Flow (Nachricht senden)

```
1. Händler tippt Nachricht → whatsapp.sendMessage({ conversationId, body })

2. Service prüft:
   ├── Konversation existiert und gehört zum Tenant
   ├── reply_window_expires > now() (24h-Fenster offen)
   │   └── Abgelaufen → TRPCError BAD_REQUEST
   └── body: nicht leer, max 4096 Zeichen

3. Nachricht lokal speichern:
   ├── whatsapp_messages INSERT (direction: 'outbound', send_status: 'sending',
   │   sent_by: ctx.userId, activity_created: false)
   └── conversation UPDATE (last_message_at, last_message_preview)
   ── KEINE CRM-Activity hier (erst nach erfolgreichem Send)

4. Direkt senden (KEIN Outbox):
   ├── threesixtyService.sendTextMessage(phone_number_id, remote_phone, body, message.id)
   ├── Erfolg:
   │   ├── send_status = 'sent', external_message_id speichern
   │   ├── CRM: addActivityForContact({ activity_type: 'whatsapp_out', message_id })
   │   └── activity_created = true
   └── Fehler:
       ├── send_status = 'failed', send_error speichern
       ├── Outbox-Eintrag als Retry:
       │   service: 'threesixty', action: 'retry_send', payload: { message_id }
       └── UI zeigt "Senden fehlgeschlagen"

5. Response an Frontend: Nachricht mit aktuellem send_status
```

### Retry-Flow

```
whatsapp.retryMessage({ messageId })
  ├── Nur für messages mit send_status = 'failed'
  ├── send_status = 'sending', send_error = null
  ├── Direkt senden (gleicher API-Call wie oben)
  ├── Erfolg → send_status = 'sent'
  │   └── Wenn activity_created = false:
  │       CRM-Activity erstellen, activity_created = true
  │   └── Wenn activity_created = true: KEINE neue Activity
  └── Fehler → send_status = 'failed', send_error neu setzen
```

**Keine doppelte Activity.** `activity_created`-Flag verhindert das. Retry sendet nur technisch erneut.

---

## 7. API (tRPC Router)

Router: `whatsapp` (registriert in `server/trpc/root.ts`)

### Typ-Definitionen

```typescript
type ConversationView = {
  id: string;
  contact: { id: string; display_name: string; phone: string | null };
  remote_phone: string;
  status: 'active' | 'archived';
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  reply_window_open: boolean;         // berechnet: reply_window_expires > now()
  reply_window_expires: string | null;
  created_at: string;
}

type MessageView = {
  id: string;
  direction: 'inbound' | 'outbound';
  message_type: MessageType;
  body: string | null;
  media_url: string | null;           // aufgelöste Storage-URL oder 360dialog-Fallback
  media_mime_type: string | null;
  send_status: SendStatus | null;
  send_error: string | null;
  sent_by: { id: string; name: string } | null;
  timestamp: string;
}

type ConnectionView = {
  id: string;
  display_phone: string;
  connection_status: 'disconnected' | 'connected' | 'error';
  webhook_verified: boolean;
  last_error: string | null;
}
```

### Procedures

```
whatsapp.getConnection
  Type:     query
  Auth:     roleProcedure(["owner", "admin"])
  Output:   ConnectionView | null

whatsapp.setupConnection
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Input:    { phone_number_id: string, waba_id: string, display_phone: string }
  Output:   ConnectionView
  Regeln:
    - Max 1 Verbindung pro Tenant
    - Verbindung testen + Webhook registrieren
    - Erfolg: connected, webhook_verified = true
    - Fehler: error, last_error
    - Schreibt Audit-Log

whatsapp.removeConnection
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin"])
  Output:   void
  Regeln:
    - Webhook deregistrieren (best-effort)
    - phone_number_id = NULL (stoppt Inbound-Mapping)
    - connection_status = 'disconnected'
    - Konversationen bleiben
    - Schreibt Audit-Log

whatsapp.listConversations
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    {
              cursor?: string,
              limit?: number (default 30, max 100),
              status?: 'active' | 'archived',
              unread_only?: boolean,
              search?: string (Kontaktname, Telefonnummer),
            }
  Output:   { items: ConversationView[], nextCursor: string | null }
  Regeln:
    - Sortierung: last_message_at DESC NULLS LAST, id DESC
    - Compound-Cursor

whatsapp.getMessages
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { conversationId: string, cursor?: string, limit?: number (default 50, max 200) }
  Output:   { items: MessageView[], nextCursor: string | null }
  Regeln:
    - Sortierung: timestamp DESC, id DESC
    - Compound-Cursor

whatsapp.sendMessage
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { conversationId: string, body: string }
  Output:   MessageView
  Regeln:
    - body: nicht leer, max 4096 Zeichen
    - 24h-Fenster prüfen
    - Direkt senden, CRM-Activity nach Erfolg
    - Bei Fehler: Outbox-Retry

whatsapp.retryMessage
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { messageId: string }
  Output:   MessageView
  Regeln:
    - Nur send_status = 'failed'
    - Erneut senden, KEINE doppelte CRM-Activity

whatsapp.markAsRead
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager", "salesperson"])
  Input:    { conversationId: string }
  Output:   ConversationView
  Regeln:
    - unread_count = 0
    - Nur lokal im MVP — keine Read-Receipts an 360dialog

whatsapp.archiveConversation
  Type:     mutation
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Input:    { conversationId: string }
  Output:   ConversationView
  Regeln:
    - status = 'archived'
    - Automatisch reaktiviert bei neuer eingehender Nachricht

whatsapp.getStats
  Type:     query
  Auth:     roleProcedure(["owner", "admin", "manager"])
  Output:   WhatsAppStats
            {
              total_conversations: number,
              unread_conversations: number,
              messages_today: number,
              messages_this_week: number,
              avg_response_time_minutes: number | null,
                -- Median der Zeit zwischen erster Inbound-Nachricht
                -- und erster Outbound-Antwort pro Konversation,
                -- nur letzte 30 Tage, nur Konversationen mit Antwort
            }
```

---

## 8. AI-Tools (für AI-Assistent)

Datei: `modules/whatsapp/ai-tools.ts`

### Lesende Tools

```typescript
{
  name: "list_whatsapp_conversations",
  description: "WhatsApp-Konversationen auflisten.",
  parameters: { unread_only?: boolean, search?: string },
  execute: (params, ctx) => whatsappService.listConversations(params, ctx)
},
{
  name: "get_whatsapp_messages",
  description: "Nachrichten einer Konversation abrufen.",
  parameters: { conversation_id?: string, contact_name?: string },
  execute: (params, ctx) => whatsappService.getMessagesByContactOrId(params, ctx)
},
{
  name: "get_whatsapp_stats",
  description: "WhatsApp-Statistiken abrufen.",
  parameters: {},
  execute: (params, ctx) => whatsappService.getStats(ctx)
}
```

### Schreibende Tools (PROPOSE → CONFIRM)

```typescript
{
  name: "propose_whatsapp_reply",
  description: "WhatsApp-Antwort vorschlagen. 
                Händler sagt z.B. 'Antworte Herrn Müller dass der BMW noch verfügbar ist'.
                Der Händler sieht den Vorschlag und bestätigt — KEIN Auto-Reply.",
  parameters: { conversation_id: string, body: string },
  execute: (params, ctx) => aiCommandService.propose({
    module: "whatsapp",
    action: "send_message",
    proposed_changes: { body: params.body },
    preview: () => messagePreview(params, ctx),
    executeOnConfirm: () => whatsappService.sendMessage(params, ctx)
  })
}
```

---

## 9. Cron-Übersicht (WhatsApp-spezifisch)

| Cron-Endpunkt | Intervall | Zweck |
|---------------|-----------|-------|
| `/api/jobs/process-whatsapp-webhooks` | 1 Min | Fallback: unverarbeitete webhook_log Einträge |
| `/api/jobs/process-outbox` | 1 Min | Retry fehlgeschlagener Sends (shared) |
| `/api/jobs/whatsapp-media-download` | 2 Min | Medien von 360dialog herunterladen |

---

## 10. Lese-Schnittstelle für andere Module

```typescript
// modules/whatsapp/index.ts
export { getConversationForContact } from "./services/whatsapp-service";
export { getUnreadCount } from "./services/whatsapp-service";
export type { ConversationView, MessageView } from "./domain/types";
```

---

## 11. UI-Screens (Händler-Interface)

### 11.1 Screens

| Screen | Route | Inhalt |
|--------|-------|--------|
| Unified Inbox | `/nachrichten` | Konversationsliste + Chat-Fenster |
| WhatsApp-Einstellungen | `/einstellungen/whatsapp` | Verbindung einrichten |

### 11.2 Unified Inbox

**Linkes Panel (Konversationsliste):**
- Sortiert: neueste Nachricht zuerst
- Pro Konversation: Kontaktname, Preview, Zeitpunkt, Unread-Badge
- Suche: Kontaktname, Telefonnummer
- Filter: Alle / Ungelesen
- Archivierte: separater Bereich

**Rechtes Panel (Chat-Fenster):**
- Nachrichten chronologisch (älteste oben)
- Inbound links, Outbound rechts
- Medien: Bilder inline, Dokumente als Download
- Status-Icons: ✓ sent, ✓✓ delivered, ✓✓ (blau) read, ❌ failed
- Eingabefeld unten (nur Text im MVP)
- 24h-Warnung: Fenster geschlossen → Eingabe deaktiviert
- Retry-Button bei fehlgeschlagenen Nachrichten
- Link zum CRM-Kontakt

**Mobile:** Liste und Chat als separate Views (nicht nebeneinander).

**Realtime:** Supabase Realtime auf `whatsapp_messages`. Kein Polling.

### 11.3 Komponenten

| Komponente | Zweck |
|------------|-------|
| `ConversationList` | Sortierbare, filterbare Konversationsliste |
| `ConversationItem` | Einzelne Konversation (Name, Preview, Badge) |
| `ChatWindow` | Chat mit Nachrichten und Eingabe |
| `MessageBubble` | Einzelne Nachricht |
| `MessageInput` | Texteingabe mit Send-Button |
| `ReplyWindowBanner` | "Antwortfenster geschlossen"-Warnung |
| `MediaPreview` | Inline-Bild oder Download-Link |
| `SendStatusIcon` | Häkchen-Icons |
| `UnreadBadge` | Ungelesen-Zähler |
| `RetryButton` | "Erneut senden" für fehlgeschlagene Nachrichten |
| `ConnectionSetup` | WhatsApp-Verbindungsformular |
| `ContactLink` | Link zum CRM-Kontakt-Detail |

---

## 12. Business Rules

### 12.1 24-Stunden-Antwortfenster

- Inbound setzt `reply_window_expires = timestamp + 24h`
- Outbound nur innerhalb des Fensters (Service prüft)
- Abgelaufen: UI deaktiviert Eingabe, zeigt Hinweis
- Neue Inbound-Nachricht öffnet Fenster neu
- Phase 2: Template-Messages außerhalb des Fensters

### 12.2 Unbekannte Kontakte

- Neue Nummer → neuer CRM-Kontakt:
  `last_name = 'Unbekannt'`, `source = 'whatsapp'`, `contact_type = 'prospect'`
- Händler kann Kontaktdaten jederzeit in CRM ergänzen

### 12.3 Konversations-Archivierung

- Manuell durch Händler
- Automatisch reaktiviert bei neuer Inbound-Nachricht
- Löscht keine Nachrichten

### 12.4 CRM-Activity-Timing

| Richtung | Wann wird Activity erstellt? |
|----------|------------------------------|
| Inbound | Sofort bei Nachrichtenverarbeitung (Fast-Path oder Cron) |
| Outbound | Nach erfolgreichem Send (`send_status = 'sent'`), nie vorher |
| Retry | Nur wenn `activity_created = false` — keine Duplikate |

### 12.5 Medien-Handling

- Download asynchron (Cron alle 2 Min)
- Max 20 MB pro Medium
- Erlaubt: JPEG, PNG, WebP, PDF, OGG, MP3, MP4
- Bei Fehler: `media_file_id = NULL`, 360dialog-URL als Fallback
- `files`-Eintrag: `entity_type = 'whatsapp'`, `entity_id = message.id`

### 12.6 Berechtigungen

| Aktion | Rollen |
|--------|--------|
| Nachrichten lesen/senden | `owner`, `admin`, `manager`, `salesperson` |
| Konversation archivieren | `owner`, `admin`, `manager` |
| Als gelesen markieren | `owner`, `admin`, `manager`, `salesperson` |
| Verbindung einrichten | `owner`, `admin` |
| Statistiken | `owner`, `admin`, `manager` |

**`receptionist` und `viewer`: kein WhatsApp-Zugriff.**

---

## 13. MVP-Scope vs. Phase 2

### MVP — Wird gebaut

- [x] Unified Inbox (Zwei-Panel, Realtime)
- [x] Inbound: architekturkonform (webhook_log + Fast-Path + Cron-Fallback)
- [x] Outbound: Textnachrichten direkt senden
- [x] CRM-Kontakt-Zuordnung (hierarchische Suche über 3 Nummernfelder)
- [x] CRM-Activity nach erfolgreichem Send (nicht vorher)
- [x] 24h-Fenster-Erzwingung
- [x] Zustellstatus-Updates
- [x] Medien-Download und -Anzeige (Inbound)
- [x] Retry ohne doppelte Activity
- [x] Konversations-Archivierung
- [x] AI-Tool: Antwort vorschlagen (PROPOSE, kein Auto-Reply)
- [x] Disconnect mit hartem Inbound-Stop
- [x] markAsRead nur lokal (keine Read-Receipts)

### Phase 2

- [ ] AI-Antwortvorschläge direkt in Inbox (ein Klick)
- [ ] AI-Autopilot für einfache Anfragen
- [ ] Template-Messages (Outbound außerhalb 24h)
- [ ] Medien senden (Bilder, Dokumente, Exposés)
- [ ] Outbound-Automation (Follow-ups, Erinnerungen)
- [ ] Quick-Reply-Vorlagen
- [ ] Konversations-Zuweisung an Mitarbeiter
- [ ] Read-Receipts (optional, konfigurierbar)
- [ ] Multi-Channel-Inbox (WhatsApp + E-Mail + SMS)

---

## 14. Technische Abhängigkeiten

### Interne

| Benötigt | Von | Zweck |
|----------|-----|-------|
| Platform Foundation | Auth, Tenants, RLS | Tenant-Kontext, Rollen |
| Modul 01 (CRM) | `findContactByWhatsApp`, `findContactByPhoneMobile`, `findContactByPhone`, `createContactFromExternal`, `addActivityForContact` | Kontakt-Zuordnung, Activity |
| Supabase Storage | File Storage | Medien |
| `files`-Tabelle | File Storage (Architektur) | Medien-Metadaten |
| Supabase Realtime | Echtzeit | Neue Nachrichten in Inbox |
| `webhook_log` | Architektur | Webhook-Logging + Cron-Fallback |
| Outbox (Architektur) | Retry | Fehlgeschlagene Sends |

### Externe

| Service | Zweck | Fallback |
|---------|-------|----------|
| 360dialog | WhatsApp Business API | Sends in Outbox, Inbound über Cron |

### Environment Variables

```
THREESIXTY_API_KEY=
THREESIXTY_PARTNER_ID=
THREESIXTY_WEBHOOK_SECRET=
```

---

## 15. Verwandte Dokumente

| Datei | Relevanz |
|-------|----------|
| `00_VISION.md` | Abschnitt 4 (WhatsApp MVP-Scope) |
| `01_ARCHITECTURE.md` | Abschnitt 8 (360dialog, Webhooks, Outbox, sofort senden) |
| `MOD_01_CRM.md` | Service-Exports für Kontakt-Zuordnung und Activities |

---

> **Hinweis für Claude Code:** Diese Datei definiert Modul 17 vollständig.
> MVP = Unified Inbox + manuell antworten + AI-Vorschlag (PROPOSE, kein Auto-Reply).
> User-getriggertes Senden: DIREKT, kein Outbox. Outbox nur als Retry.
> CRM-Activity für Outbound: ERST NACH erfolgreichem Send. activity_created-Flag verhindert Duplikate.
> Webhook: architekturkonform (webhook_log + Fast-Path + Cron-Fallback).
> Kontakt-Matching: hierarchisch über whatsapp_number → phone_mobile → phone.
> Unbekannte Nummer → last_name = 'Unbekannt' (CRM-konform, nicht null).
> Disconnect: phone_number_id = NULL stoppt Inbound hart.
> markAsRead: nur lokal, keine Read-Receipts im MVP.
