/**
 * Cloudflare Pages Function: POST /api/lead
 *
 * Nimmt einen Lead als JSON entgegen (Vorname + E-Mail), validiert ihn und
 * gibt eine Erfolgsmeldung zurück. Ist die Umgebungsvariable LEAD_WEBHOOK_URL
 * gesetzt, wird der Lead zusätzlich an diese URL weitergeleitet (z. B. an
 * Zapier, Make, einen eigenen Endpoint oder ein CRM).
 *
 * Env-Variable in Cloudflare setzen:
 *   Pages-Projekt → Settings → Environment variables → LEAD_WEBHOOK_URL
 */

const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  // 1) Body parsen (muss JSON sein)
  let data;
  try {
    data = await request.json();
  } catch {
    return json({ ok: false, error: "Ungültiges JSON im Request-Body." }, 400);
  }

  // 2) Felder lesen – akzeptiert "vorname" (Formular) oder "name"
  const vorname = String(data.vorname ?? data.name ?? "").trim();
  const email = String(data.email ?? "").trim();

  // 3) Validieren
  if (!vorname) {
    return json({ ok: false, error: "Vorname fehlt." }, 422);
  }
  if (!isValidEmail(email)) {
    return json({ ok: false, error: "Ungültige E-Mail-Adresse." }, 422);
  }

  const lead = {
    vorname,
    email,
    quelle: "landingpage",
    empfangenAm: new Date().toISOString(),
  };

  // 4) Optional an Webhook weiterleiten, wenn konfiguriert
  if (env.LEAD_WEBHOOK_URL) {
    try {
      const resp = await fetch(env.LEAD_WEBHOOK_URL, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(lead),
      });
      if (!resp.ok) {
        // Lead nicht verlieren: Fehler loggen, aber dem Nutzer Erfolg melden,
        // damit die UX nicht an einem Webhook-Problem scheitert.
        console.error("Webhook antwortete mit Status", resp.status);
      }
    } catch (err) {
      console.error("Webhook-Weiterleitung fehlgeschlagen:", err);
    }
  }

  // 5) Erfolg zurückgeben
  return json({ ok: true, message: `Danke, ${vorname}! Lead empfangen.` });
}

/**
 * Andere Methoden (GET, PUT, …) sauber ablehnen.
 */
export async function onRequest(context) {
  if (context.request.method === "POST") {
    return onRequestPost(context);
  }
  return json({ ok: false, error: "Methode nicht erlaubt. Bitte POST verwenden." }, 405);
}
