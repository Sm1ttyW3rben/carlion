/**
 * Börsen-Parser — parses mobile.de CSV and AutoScout24 CSV/XML export files.
 *
 * Phase 1: Field mappings are approximations; adjust when real export samples
 * are available from the Börsen partner team.
 *
 * Spec: MOD_13 Section 5
 */

import type { ParseResult, VehicleImportRow, ParseError, ParseWarning } from "@/modules/listings/domain/types";

// ---------------------------------------------------------------------------
// mobile.de CSV (semicolon-separated, ISO-8859-1 encoded)
// ---------------------------------------------------------------------------

/**
 * Parses a mobile.de CSV export.
 * Caller must decode ISO-8859-1 → UTF-8 before passing the string.
 */
export function parseMobileDeExport(csvContent: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const vehicles: VehicleImportRow[] = [];

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    errors.push({ row: 0, message: "Datei enthält keine Fahrzeuge (nur Kopfzeile oder leer)." });
    return { platform: "mobile_de", vehicles, errors, warnings };
  }

  const headers = lines[0]!.split(";").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (row: string[], name: string): string => {
    const idx = headers.indexOf(name);
    if (idx === -1) return "";
    return (row[idx] ?? "").trim().replace(/^"|"$/g, "");
  };

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!.split(";");
    const rowNum = i + 1;

    const externalId = col(raw, "id") || col(raw, "fahrzeugid") || col(raw, "vehicle_id");
    if (!externalId) {
      errors.push({ row: rowNum, field: "id", message: "Fahrzeug-ID fehlt — Zeile wird übersprungen." });
      continue;
    }

    const make = col(raw, "marke") || col(raw, "make") || col(raw, "hersteller");
    const model = col(raw, "modell") || col(raw, "model");
    if (!make || !model) {
      errors.push({ row: rowNum, message: `Marke oder Modell fehlt für Fahrzeug ${externalId}.` });
      continue;
    }

    const priceRaw = col(raw, "preis") || col(raw, "price") || col(raw, "verkaufspreis");
    const mileageRaw = col(raw, "kilometerstand") || col(raw, "mileage") || col(raw, "km");

    const unmappedFields: Record<string, string> = {};
    const knownFields = new Set(["id", "fahrzeugid", "vehicle_id", "marke", "make", "hersteller", "modell", "model", "preis", "price", "verkaufspreis", "kilometerstand", "mileage", "km", "kraftstoff", "fuel", "getriebe", "transmission", "erstzulassung", "first_registration", "aufbau", "body_type", "farbe", "color", "vin", "fin"]);
    headers.forEach((h, idx) => {
      if (!knownFields.has(h) && raw[idx]?.trim()) {
        unmappedFields[h] = raw[idx]!.trim();
      }
    });

    vehicles.push({
      sourceReference: `mobile_de:${externalId}`,
      externalId,
      make,
      model,
      variant: col(raw, "variante") || col(raw, "variant") || undefined,
      vin: col(raw, "vin") || col(raw, "fin") || undefined,
      mileageKm: mileageRaw ? parseInt(mileageRaw.replace(/[^\d]/g, ""), 10) || undefined : undefined,
      askingPriceGross: priceRaw ? priceRaw.replace(/[^\d.,]/g, "").replace(",", ".") || undefined : undefined,
      fuelType: col(raw, "kraftstoff") || col(raw, "fuel") || undefined,
      transmission: col(raw, "getriebe") || col(raw, "transmission") || undefined,
      firstRegistration: col(raw, "erstzulassung") || col(raw, "first_registration") || undefined,
      bodyType: col(raw, "aufbau") || col(raw, "body_type") || undefined,
      colorExterior: col(raw, "farbe") || col(raw, "color") || undefined,
      unmappedFields,
    });
  }

  if (vehicles.length === 0 && errors.length === 0) {
    warnings.push({ row: 0, message: "Keine Fahrzeuge in der Datei gefunden." });
  }

  return { platform: "mobile_de", vehicles, errors, warnings };
}

// ---------------------------------------------------------------------------
// AutoScout24 CSV (semicolon-separated, UTF-8)
// ---------------------------------------------------------------------------

export function parseAutoScout24Csv(csvContent: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const vehicles: VehicleImportRow[] = [];

  const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    errors.push({ row: 0, message: "Datei enthält keine Fahrzeuge." });
    return { platform: "autoscout24", vehicles, errors, warnings };
  }

  const headers = lines[0]!.split(";").map((h) => h.trim().replace(/^"|"$/g, "").toLowerCase());
  const col = (row: string[], name: string): string => {
    const idx = headers.indexOf(name);
    return idx === -1 ? "" : (row[idx] ?? "").trim().replace(/^"|"$/g, "");
  };

  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!.split(";");
    const rowNum = i + 1;

    const externalId = col(raw, "id") || col(raw, "article_id") || col(raw, "inseratsnummer");
    if (!externalId) {
      errors.push({ row: rowNum, field: "id", message: "Inserat-ID fehlt — Zeile wird übersprungen." });
      continue;
    }

    const make = col(raw, "marke") || col(raw, "make");
    const model = col(raw, "modell") || col(raw, "model");
    if (!make || !model) {
      errors.push({ row: rowNum, message: `Marke oder Modell fehlt für Inserat ${externalId}.` });
      continue;
    }

    const unmappedFields: Record<string, string> = {};
    const knownFields = new Set(["id", "article_id", "inseratsnummer", "marke", "make", "modell", "model", "preis", "price", "km", "kraftstoff", "fuel", "getriebe", "vin", "fin", "erstzulassung", "aufbau", "farbe"]);
    headers.forEach((h, idx) => {
      if (!knownFields.has(h) && raw[idx]?.trim()) {
        unmappedFields[h] = raw[idx]!.trim();
      }
    });

    vehicles.push({
      sourceReference: `autoscout24:${externalId}`,
      externalId,
      make,
      model,
      variant: col(raw, "variante") || undefined,
      vin: col(raw, "vin") || col(raw, "fin") || undefined,
      mileageKm: col(raw, "km") ? parseInt(col(raw, "km").replace(/[^\d]/g, ""), 10) || undefined : undefined,
      askingPriceGross: col(raw, "preis") || col(raw, "price") || undefined,
      fuelType: col(raw, "kraftstoff") || col(raw, "fuel") || undefined,
      firstRegistration: col(raw, "erstzulassung") || undefined,
      bodyType: col(raw, "aufbau") || undefined,
      colorExterior: col(raw, "farbe") || undefined,
      unmappedFields,
    });
  }

  return { platform: "autoscout24", vehicles, errors, warnings };
}

// ---------------------------------------------------------------------------
// AutoScout24 XML
// ---------------------------------------------------------------------------

export function parseAutoScout24Xml(xmlContent: string): ParseResult {
  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const vehicles: VehicleImportRow[] = [];

  const getTag = (xml: string, tag: string): string => {
    const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, "i"));
    return match?.[1]?.trim() ?? "";
  };

  const vehicleBlocks = [...xmlContent.matchAll(/<Ad[^>]*>([\s\S]*?)<\/Ad>/gi)];
  if (vehicleBlocks.length === 0) {
    warnings.push({ row: 0, message: "Keine Fahrzeuge im XML gefunden (<Ad>-Elemente erwartet)." });
    return { platform: "autoscout24", vehicles, errors, warnings };
  }

  vehicleBlocks.forEach((match, idx) => {
    const block = match[1] ?? "";
    const rowNum = idx + 1;

    const externalId = getTag(block, "Id") || getTag(block, "ID");
    if (!externalId) {
      errors.push({ row: rowNum, message: "Inserat ohne ID — wird übersprungen." });
      return;
    }

    const make = getTag(block, "Make") || getTag(block, "Marke");
    const model = getTag(block, "Model") || getTag(block, "Modell");
    if (!make || !model) {
      errors.push({ row: rowNum, message: `Marke/Modell fehlt für Inserat ${externalId}.` });
      return;
    }

    const priceRaw = getTag(block, "Price") || getTag(block, "Preis");
    const kmRaw = getTag(block, "Mileage") || getTag(block, "Kilometerstand");

    vehicles.push({
      sourceReference: `autoscout24:${externalId}`,
      externalId,
      make,
      model,
      variant: getTag(block, "Variant") || undefined,
      vin: getTag(block, "Vin") || getTag(block, "FIN") || undefined,
      mileageKm: kmRaw ? parseInt(kmRaw.replace(/[^\d]/g, ""), 10) || undefined : undefined,
      askingPriceGross: priceRaw.replace(/[^\d.,]/g, "").replace(",", ".") || undefined,
      fuelType: getTag(block, "FuelType") || getTag(block, "Kraftstoff") || undefined,
      firstRegistration: getTag(block, "FirstRegistration") || undefined,
      bodyType: getTag(block, "BodyType") || undefined,
      unmappedFields: {},
    });
  });

  return { platform: "autoscout24", vehicles, errors, warnings };
}

// ---------------------------------------------------------------------------
// Auto-detect format and dispatch
// ---------------------------------------------------------------------------

export function parseAutoScout24Export(content: string, format: "csv" | "xml"): ParseResult {
  return format === "xml" ? parseAutoScout24Xml(content) : parseAutoScout24Csv(content);
}

/** Detect format from content: XML starts with '<', otherwise CSV */
export function detectFormat(content: string): "csv" | "xml" {
  return content.trimStart().startsWith("<") ? "xml" : "csv";
}
