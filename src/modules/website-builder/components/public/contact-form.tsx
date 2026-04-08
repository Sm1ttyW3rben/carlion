"use client";

/**
 * ContactForm — public website contact form.
 * POSTs to /api/forms/[tenant_slug]/contact
 * Spec: MOD_11 Section 6 & 10
 */

import { useState } from "react";

interface ContactFormProps {
  tenantSlug: string;
  vehicleId?: string;
  vehicleLabel?: string;
}

export function ContactForm({ tenantSlug, vehicleId, vehicleLabel }: ContactFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    vehicleLabel ? `Ich interessiere mich für: ${vehicleLabel}` : ""
  );
  const [honeypot, setHoneypot] = useState(""); // Must stay empty
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/forms/${tenantSlug}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, phone: phone || undefined, message, vehicleId, honeypot }),
      });

      if (res.ok || res.status === 429) {
        // Always show success — even rate-limited (to not reveal to bots)
        setSubmitted(true);
      } else {
        setError("Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.");
      }
    } catch {
      setError("Netzwerkfehler. Bitte versuchen Sie es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.625rem 0.875rem",
    border: "1px solid #d1d5db",
    borderRadius: "var(--brand-radius, 0.375rem)",
    fontSize: "0.9375rem",
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
  };

  if (submitted) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", background: "#f0fdf4", borderRadius: "var(--brand-radius, 0.5rem)", border: "1px solid #bbf7d0" }}>
        <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#15803d" }}>Vielen Dank!</p>
        <p style={{ color: "#166534", marginTop: "0.5rem" }}>Ihre Anfrage ist eingegangen. Wir melden uns so schnell wie möglich.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        style={{ display: "none" }}
        tabIndex={-1}
        autoComplete="off"
      />

      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
          Name *
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={inputStyle}
          placeholder="Ihr vollständiger Name"
        />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
          E-Mail *
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={inputStyle}
          placeholder="ihre@email.de"
        />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
          Telefon
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={inputStyle}
          placeholder="+49 ..."
        />
      </div>

      <div>
        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.375rem" }}>
          Nachricht *
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={5}
          style={{ ...inputStyle, resize: "vertical" }}
          placeholder="Ihre Nachricht..."
        />
      </div>

      {error && (
        <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        style={{
          background: "var(--brand-primary, #2563eb)",
          color: "var(--brand-on-primary, #ffffff)",
          border: "none",
          padding: "0.75rem 1.5rem",
          borderRadius: "var(--brand-radius, 0.375rem)",
          fontSize: "1rem",
          fontWeight: 700,
          cursor: isSubmitting ? "not-allowed" : "pointer",
          opacity: isSubmitting ? 0.7 : 1,
          fontFamily: "inherit",
        }}
      >
        {isSubmitting ? "Wird gesendet…" : "Anfrage senden"}
      </button>

      <p style={{ fontSize: "0.75rem", color: "#6b7280" }}>
        Mit dem Absenden erklären Sie sich mit unserer{" "}
        <a href="datenschutz" style={{ color: "var(--brand-primary, #2563eb)" }}>Datenschutzerklärung</a>{" "}
        einverstanden.
      </p>
    </form>
  );
}
