// Servidor mínimo (Cloudflare Worker, plan gratuito) para Mi Agenda por Voz.
// Su única misión: guardar el "secreto de cliente" de Google y renovar sesiones sin que tengas que reconectar.
// Variables necesarias (Settings → Variables and secrets):
//   GOOGLE_CLIENT_ID      (texto)   tu ID de cliente
//   GOOGLE_CLIENT_SECRET  (secreto) tu secreto de cliente
//   ORIGEN_PERMITIDO      (texto, opcional) por defecto https://ppmpalao.github.io

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export default {
  async fetch(request, env) {
    const permitido = env.ORIGEN_PERMITIDO || "https://ppmpalao.github.io";
    const cors = {
      "Access-Control-Allow-Origin": permitido,
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Vary": "Origin"
    };
    const responder = (cuerpo, status) =>
      new Response(JSON.stringify(cuerpo), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json" }, cors) });

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return responder({ error: "metodo_no_permitido" }, 405);
    if (request.headers.get("Origin") !== permitido) return responder({ error: "origen_no_permitido" }, 403);
    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return responder({ error: "servidor_sin_configurar" }, 500);

    let datos;
    try { datos = await request.json(); } catch (e) { return responder({ error: "json_invalido" }, 400); }

    const ruta = new URL(request.url).pathname;
    const params = new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID, client_secret: env.GOOGLE_CLIENT_SECRET });

    if (ruta === "/canjear") {
      if (!datos.code) return responder({ error: "falta_code" }, 400);
      params.set("grant_type", "authorization_code");
      params.set("code", datos.code);
      params.set("redirect_uri", "postmessage");
    } else if (ruta === "/renovar") {
      if (!datos.refresh_token) return responder({ error: "falta_refresh_token" }, 400);
      params.set("grant_type", "refresh_token");
      params.set("refresh_token", datos.refresh_token);
    } else {
      return responder({ error: "no_encontrado" }, 404);
    }

    const g = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params });
    const r = await g.json().catch(() => ({}));
    if (!g.ok) return responder({ error: r.error || "error_google", error_description: r.error_description || "" }, g.status === 400 ? 400 : 502);
    // Solo se devuelve lo imprescindible
    return responder({ access_token: r.access_token, expires_in: r.expires_in, refresh_token: r.refresh_token || null, scope: r.scope });
  }
};
