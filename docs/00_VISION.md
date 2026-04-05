# Carlion — Vision & Produktdefinition

> Diese Datei ist die oberste Referenz für das gesamte Projekt.
> Sie wird in **jeder** Claude Code Session geladen.
> Keine Implementierungsdetails — nur Vision, Prinzipien und Scope.
>
> Letzte Aktualisierung: April 2026
> Status: Bestätigt

---

## 1. Vision

Carlion ist das Betriebssystem für Autohändler.

Kein Tool, keine App, kein CRM — ein vollständiges, AI-gesteuertes System das jeden Prozess eines Autohauses abdeckt: von der ersten Kundenanfrage bis zur Fahrzeugübergabe, von der Werkstatt bis zur Buchhaltung.

**Zentrale These:** Ein Händler soll sein gesamtes Geschäft durch natürliche Sprache steuern können. Kein Klicken durch Menüs, kein Wechsel zwischen Tools. Einfach sagen oder tippen was man will — die AI versteht, plant und handelt.

**Primärer Interaktionspunkt:** Ein persistenter AI-Assistent (Chat-Interface), erreichbar von jedem Screen über einen festen Button/Panel. Der Händler kann jederzeit eine Frage tippen oder einen Befehl geben, ohne den aktuellen Kontext zu verlassen. Der Assistent kennt den gesamten Tenant-Kontext (Bestand, Kontakte, offene Aufgaben) und kann modulübergreifend handeln.

**Zwei User-Gruppen:**
- **Primär:** Der Autohändler und sein Team (Verkäufer, Werkstatt, Geschäftsführer)
- **Sekundär:** Der Autokäufer (über Kundenportal, Chatbot, WhatsApp)

---

## 2. Kernprinzipien

Diese Prinzipien sind nicht verhandelbar. Jede Entscheidung — technisch, produktiv, designerisch — muss sich daran messen lassen.

### 2.1 AI-First, nicht AI-Added
Die AI ist nicht ein Feature — sie ist das Betriebssystem. Jedes Modul ist so gebaut, dass die AI darauf zugreifen, lesen und schreiben kann. Kein Modul existiert als Silo.

→ **Technische Implikation:** Jedes Modul muss eine Tool-Schicht exponieren die der AI-Agent aufrufen kann. Kein Modul darf nur über UI erreichbar sein.

### 2.2 Zero Friction
Komplexität ist versteckt — Einfachheit ist das Interface. Onboarding ist geführt, nicht erklärt. Jeder Screen hat einen klaren primären Pfad.

→ **Technische Implikation:** Sensible Defaults überall. Kein Feature erfordert Konfiguration bevor es Wert liefert.

### 2.3 Alles in einem
Kein Händler soll für irgendeinen Kernprozess ein externes Tool brauchen. Fahrzeugbörse, Zahlungen, Verträge, Werkstatt, Marketing — alles läuft in Carlion. Integrationen existieren, aber als Ergänzung, nicht als Notwendigkeit.

→ **Technische Implikation:** Baue immer die volle Funktionalität. Verweise nie auf externe Tools als Lösung für einen Kernprozess.

### 2.4 Vertrauen durch Transparenz
Jede AI-Aktion ist nachvollziehbar und reversibel. Händler sehen was die AI getan hat, warum, und können jederzeit eingreifen oder rückgängig machen. Kein Black-Box-Gefühl.

→ **Technische Implikation:** Jede AI-Aktion schreibt einen AI-Event-Log-Eintrag und einen Rollback-Snapshot. Keine AI-Aktion darf Daten endgültig löschen.

### 2.5 Mobile-First
Händler arbeiten auf dem Hof, im Showroom, unterwegs. Die primäre Erfahrung ist Mobile. Desktop ist vollwertig, aber nicht der Ausgangspunkt.

→ **Technische Implikation:** Jeder Screen wird zuerst für Mobile designed. Touch-Targets, responsive Layout und Offline-Fähigkeit (wo kritisch) sind Pflicht.

### 2.6 White-Label by Default
Alle kundensichtbaren Inhalte (Website, E-Mails, PDFs, Chatbot, Kundenportal) tragen das Branding des Händlers — Logo, Farben, Name, Ton. Der Endkunde sieht auf jeder Seite und in jeder Nachricht die Marke des Autohauses, nicht Carlion.

Phase 1: Händler-Subdomain (`autohaus-mueller.[produktname].de`). Inhalte und Design sind vollständig Händler-gebrandet, die URL enthält noch den Plattformnamen.
Phase 2: Custom Domains (`www.autohaus-mueller.de`) + gebrandete E-Mail-Absenderdomänen.

→ **Technische Implikation:** Jeder Tenant hat ein Branding-Profil. Jeder kundensichtbare Output liest Farben, Logo, Ton und Domain aus diesem Profil.

### 2.7 Mandantenfähigkeit auf allen Ebenen
Drei Ebenen: Plattform → Organisation (Gruppe) → Tenant (Standort). Daten sind auf jeder Ebene vollständig isoliert. Eine Gruppe sieht aggregierte Daten — aber Standort A sieht nie Rohdaten von Standort B.

→ **Technische Implikation:** `tenant_id` ist Pflichtfeld auf jeder Datenbanktabelle. Isolation wird auf DB-Ebene erzwungen (Row-Level Security), nicht auf Anwendungsebene.

---

## 3. Zielgruppe

### 3.1 Primär: Einzelhändler (Phase 1)
- 20–200 Fahrzeuge im Bestand
- 1–10 Mitarbeiter
- Kein IT-Team, keine technischen Kenntnisse
- Heutiger Stack: Excel, WhatsApp, mobile.de-Backend, 3–5 separate Tools
- Kernproblem: Zeitverlust, verlorene Leads, keine Übersicht
- Erwartung an Software: sofort verstehen, sofort nutzen, keine Schulung nötig
- **Subsegment Kleinhändler (5–15 Fahrzeuge):** Oft Ein-Mann-Betriebe oder Teilzeithändler. Extrem preissensibel. Brauchen die einfachste Version — kein komplexes Pipeline-Board, keine Team-Features. Werden über Free-Tier adressiert.

→ **Design-Konsequenz:** Jeder Screen muss ohne Erklärung funktionieren. Keine Fachbegriffe aus der Software-Welt. Sprache des Händlers verwenden, nicht Sprache des Entwicklers.

**Sprache des Händlers (für UI-Labels und AI-Texte):**
| Händler sagt | Nicht verwenden |
|-------------|-----------------|
| Interessent, Anfrage | Lead, Prospect |
| Fahrzeug, Wagen | Asset, Inventory Item |
| Angebot | Proposal, Quote |
| Abschluss, Verkauf | Deal Conversion, Closed Won |
| Bestand | Inventar, Stock |
| Börse | Marketplace (Börse = mobile.de/AutoScout24) |
| Inserat | Listing |
| Probefahrt | Test Drive |
| Standzeit | Days in Stock, Aging |
| Langsteher | Aged Inventory |
| Inzahlungnahme | Trade-in |
| Aufbereitung | Reconditioning |
| Übergabe | Handover, Delivery |
| TÜV, HU | Vehicle Inspection |
| Zusage | Approval (Bank genehmigt Finanzierung) |

### 3.2 Sekundär: Autohausgruppen (Phase 2)
- 2–20 Standorte, oft mehrere Marken
- Brauchen: konsolidiertes Reporting, zentrale Benutzerverwaltung, einheitliches Branding
- Jeder Standort arbeitet isoliert mit eigenen Daten

→ **Design-Konsequenz:** Organisation-Layer über Tenant-Layer. Aggregierte Ansichten für Gruppenleitung. Strikte Datentrennung zwischen Standorten.

### 3.3 Tertiär: Große Netze & Importeure (Phase 3)
- 20+ Standorte, dedizierte Infrastruktur
- Nicht relevant für aktuelle Implementierung

---

## 4. Produktstruktur — Modulübersicht

Carlion besteht aus 35 Modulen in 5 Kategorien. Jedes Modul hat eine eigene Spezifikationsdatei (`MOD_XX_NAME.md`). Diese Vision-Datei listet nur die Struktur — nicht die Details.

### Kerngeschäft
| Nr | Modul | Phase |
|----|-------|-------|
| 01 | CRM & Kundenmanagement | **MVP** |
| 02 | Fahrzeugverwaltung & Inventar | **MVP** |
| 03 | Verkauf & Lead-Pipeline | **MVP** |
| 04 | Finanzierung & Leasing | 2 |

### Betrieb
| Nr | Modul | Phase |
|----|-------|-------|
| 05 | Werkstatt & Service | 2 |
| 06 | Ankauf & Bewertungen | 2 |
| 07 | Dokumentenmanagement & e-Signatur | 2 |
| 08 | Mitarbeiterverwaltung | 2 |

### Wachstum & Sichtbarkeit
| Nr | Modul | Phase |
|----|-------|-------|
| 09 | AI Chatbot für Kunden | 2 |
| 10 | Marketing & Kampagnen | 2 |
| 11 | Website Builder | **MVP** |
| 12 | Business Intelligence | 2 |

### Kritische Integrationen
| Nr | Modul | Phase |
|----|-------|-------|
| 13 | Fahrzeugbörsen-Hub (mobile.de, AutoScout24) | **MVP** |
| 14 | Zahlungsabwicklung (Stripe) | 2 |
| 15 | Zulassung & Versicherung (i-Kfz) | 2 |
| 16 | Buchhaltungs-Export (DATEV, Lexoffice) | 2 |
| 17 | WhatsApp Business Integration | **MVP** |
| 18 | Meta Lead-Ads Integration | 2 |
| 19 | E-Mail Automation | 2 |
| 20 | Google Business Profile Sync | 2 |
| 21 | Bewertungsmanagement | 2 |
| 22 | AI Preisempfehlung | 2 |
| 23 | Churn-Früherkennung | 2 |
| 24 | Verkaufs-Coaching AI | 3 |
| 25 | Nachfrageprognose | 3 |
| 26 | Kundenportal (Käufer-App) | 2 |
| 27 | Loyalty & Wiederkauffunnel | 2 |
| 28 | Digitales Serviceheft | 2 |
| 29 | TÜV / HU Terminbuchung | 2 |
| 30 | Versicherungs-Integration | 2 |
| 31 | Bonitätsprüfung | 2 |
| 32 | B2B Händlernetzwerk | 3 |
| 33 | Carlion Fahrzeugbörse | 3 |

### Plattform-Fundament (unsichtbar, aber überall aktiv)
| Nr | Modul | Phase |
|----|-------|-------|
| 34 | DNA-Engine & Design Intelligence | **MVP** |
| 35 | Voice — Telefonintelligenz | 2 |

### MVP-Scope (Phase 1) — 7 Module + Platform Foundation

Nur diese Module werden initial gebaut. Sortiert nach empfohlener Build-Reihenfolge:

| Reihenfolge | Nr | Modul | MVP-Einschränkung |
|:-----------:|----|-------|-------------------|
| 0 | — | **Platform Foundation** | Auth, Tenant-Erstellung, User-Management, Basis-Layout (Shell, Navigation, Routing), Datenbank mit RLS. Muss stehen bevor das erste Modul gebaut wird. Details in `01_ARCHITECTURE.md` |
| 1 | 34 | DNA-Engine | Nur Onboarding-Flow + Branding-Generierung. Kein DIS-Scoring, keine kontinuierliche Optimierung |
| 2 | 02 | Fahrzeugverwaltung & Inventar | MVP-Scope laut `MOD_02_INVENTORY.md`. Kein AI-Vision, keine Zustandsbewertung, keine Fotodienst-Integration |
| 3 | 01 | CRM & Kundenmanagement | MVP-Scope laut `MOD_01_CRM.md`. Kein AI-Lead-Scoring, keine automatische Aufgabenerstellung |
| 4 | 03 | Verkauf & Lead-Pipeline | MVP-Scope laut `MOD_03_SALES.md`. Keine AI-Priorisierung, keine Verlustprävention |
| 5 | 13 | Fahrzeugbörsen-Hub | MVP-Scope laut `MOD_13_LISTINGS.md`. Initialer Import aus Börsen-Export + Zwei-Wege-Sync + Basis-Performance pro Inserat (Views, Klicks, Kontaktanfragen) |
| 6 | 11 | Website Builder | Nur Ebene 1: Auto-Sync aus Backend. Kein konversationelles Editing, keine autonome Optimierung |
| 7 | 17 | WhatsApp Integration | Nur Unified Inbox + manuell antworten. Keine AI-Antworten, kein Outbound-Automation |

**Begründung der Reihenfolge:**
- Platform Foundation zuerst: ohne Auth, Tenants und RLS kann kein Modul existieren
- DNA-Engine früh: liefert das Branding-Profil das Website und alle Outputs brauchen
- Fahrzeuge vor CRM: ohne Bestand kein Geschäft, Fahrzeuge sind das zentrale Datenobjekt
- CRM + Pipeline zusammen: Leads und Deals setzen auf Fahrzeugen und Kontakten auf
- Börsen-Hub nach Inventar: synchronisiert Fahrzeuge die bereits existieren
- Website nach Börsen: zeigt Fahrzeuge an die bereits im System sind
- WhatsApp zuletzt: setzt funktionierendes CRM voraus um Nachrichten zuzuordnen

### Daten-Migration (MVP-Pflicht)

Kein Händler startet bei Null. Diese Import-Wege sind MVP:

**Fahrzeugbestand: Börsen-Export-Import (Modul 13)**
Händler exportiert seinen Bestand aus dem mobile.de / AutoScout24 Backend als CSV/XML (offizielles Export-Feature, 3 Klicks). Carlion hat einen Parser für diese Export-Formate. Fahrzeuge sind in 2 Minuten im System. Sobald die API-Verbindung steht (Partnervertrag): automatischer Zwei-Wege-Sync.

**Branding & Profil: Website-Crawl (Modul 34)**
Händler gibt im Onboarding seine Website-URL an. DNA-Engine crawlt automatisch: Logo, Farben, Öffnungszeiten, Adresse. Fließt direkt in das Branding-Profil.

**Kontakte: manueller Import**
- CSV/Excel-Import für bestehende Kundenlisten
- vCard-Import für Handy-Kontakte
- Kein Crawling möglich — Kundendaten sind nirgendwo öffentlich

**Alle anderen Module: Nicht implementieren bis explizit beauftragt.**

---

## 5. AI-Automatisierungsstufen

Jedes Modul unterstützt drei Automatisierungsstufen. Der Händler konfiguriert pro Modul welche Stufe aktiv ist.

### Stufe 1 — Assistent (Default)
AI schlägt vor, Mensch bestätigt jeden Schritt. AI verändert nie Daten ohne explizite Bestätigung.

### Stufe 2 — Kopilot
AI handelt eigenständig, Mensch sieht Live-Log und kann jederzeit eingreifen. AI informiert nach jeder Aktion.

### Stufe 3 — Autopilot
AI steuert vollständig, eskaliert nur bei Ausnahmen oder Unsicherheit. Mensch wird über Ergebnisse informiert.

### Unveränderliche AI-Grenzen (gelten in JEDER Stufe)
- AI kann keine Daten endgültig löschen (nur soft-delete)
- AI kann keine Zahlungen auslösen ohne Bestätigung
- AI kann keine Nutzer entfernen oder Rollen ändern
- AI kann keine Verträge unterschreiben
- AI kann keine externen APIs mit Kosten >5€ aufrufen ohne Bestätigung
- Jede AI-Aktion schreibt einen AI-Event-Log-Eintrag
- Jede AI-Aktion erzeugt einen Rollback-Snapshot
- Händler kann jede AI-Aktion mit einem Klick rückgängig machen

### MVP-Scope
**Phase 1: Nur Stufe 1 (Assistent) implementieren.** Stufe 2 und 3: Phase 2.

---

## 6. Nicht-Ziele

Was Carlion bewusst NICHT ist:

- **Kein OEM-System** — keine herstellerspezifische Logik
- **Kein reines CRM** — Carlion ist mehr als Kontaktverwaltung
- **Keine Low-Code-Plattform** — Händler konfigurieren nicht, sie nutzen
- **Kein Tool das Programmierkenntnisse voraussetzt**
- **Keine Desktop-only Anwendung** — Mobile-First
- **Kein generisches Multi-Branchen-Tool** — 100% Automotive
- **Keine eigene AI-Modell-Trainierung** — wir nutzen Foundation Models (Claude API), kein eigenes ML
- **Kein Marketplace für Drittanbieter-Plugins in Phase 1**
- **Keine native Mobile App** — PWA für alle mobilen Touchpoints

---

## 7. Sprache & Markt

| Aspekt | Festlegung |
|--------|-----------|
| Primärmarkt | Deutschland (Phase 1) |
| Sekundär | Österreich, Schweiz (Phase 2) |
| UI-Sprache | Deutsch (Phase 1). Mehrsprachigkeit Phase 3 |
| AI-Kommunikation | Deutsch. Alle AI-generierten Texte in Deutsch |
| Codebase | Englisch (Variablennamen, Kommentare, Commits) |
| Währung | EUR (Phase 1). CHF-Support Phase 2 |
| Rechtsraum | Deutsches Recht, DSGVO. AT/CH-Anpassungen Phase 2 |

---

## 8. Verwandte Dokumente

| Datei | Inhalt |
|-------|--------|
| `01_ARCHITECTURE.md` | Tech Stack, Datenbank, Auth, Tenant-Isolation, AI-Infrastruktur |
| `MOD_XX_*.md` | Detailspezifikation pro Modul (Datenmodell, API, AI-Verhalten, Business Rules) |
| `CROSS_NOTIFICATIONS.md` | Benachrichtigungssystem über alle Module |
| `CROSS_CALENDAR.md` | Terminverwaltung & Verfügbarkeitslogik |
| `CROSS_SEARCH.md` | Globale Suche & Filterlogik |
| `CROSS_AI_AGENTS.md` | AI-Agent-Architektur, Prompts, Tools, Token-Budgets |
| `CROSS_ONBOARDING.md` | Registrierung bis Wow-Moment |
| `CROSS_SECURITY.md` | DSGVO, Verschlüsselung, Audit-Logs, Incident Response |

---

> **Hinweis für Claude Code:** Diese Datei definiert WAS gebaut wird und WARUM.
> Für das WIE (Tech Stack, Patterns, Datenbank): siehe `01_ARCHITECTURE.md`.
> Für Modul-Details: siehe die jeweilige `MOD_XX`-Datei.
> Baue niemals Module die nicht im MVP-Scope stehen, es sei denn explizit beauftragt.
