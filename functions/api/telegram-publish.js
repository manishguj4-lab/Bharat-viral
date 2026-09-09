export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const authHeader = context.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Missing or malformed Authorization header" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = context.env.SUPABASE_URL || "https://ocarsylhsyxjqpzidndb.supabase.co";
    const anonKey = context.env.SUPABASE_KEY;
    const serviceRoleKey = context.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. Verify the Supabase access token server-side and resolve the authenticated user
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "GET",
      headers: {
        "apikey": anonKey,
        "Authorization": authHeader
      }
    });

    if (!userRes.ok) {
      return new Response(JSON.stringify({ error: "Invalid authentication token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const user = await userRes.json();
    const userId = user.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Query user_roles server-side using service_role credential to check for admin role
    const rolesRes = await fetch(`${supabaseUrl}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.admin`, {
      method: "GET",
      headers: {
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      }
    });

    if (!rolesRes.ok) {
      return new Response(JSON.stringify({ error: "Internal authorization error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const roles = await rolesRes.json();
    if (!Array.isArray(roles) || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin privileges required" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Validate Request Body
    let article;
    try {
      article = await context.request.json();
      if (!article || typeof article !== "object") throw new Error("Invalid body");
    } catch (err) {
      return new Response(JSON.stringify({ error: "Malformed JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const token = context.env.TELEGRAM_BOT_TOKEN;
    const chatId = context.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return new Response(JSON.stringify({ error: "Telegram environment variables missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const title = typeof article.title === "string" ? article.title.substring(0, 200).trim() : "नई खबर";
    const description = typeof article.description === "string" ? article.description.substring(0, 1000).trim() : "";

    let articleUrl = "";
    if (article.url && typeof article.url === "string") {
      try {
        articleUrl = new URL(article.url).href;
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid article URL format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    let imageUrl = "";
    if (article.image_url && typeof article.image_url === "string") {
      try {
        imageUrl = new URL(article.image_url).href;
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid image URL format" }), {
          status: 400,
          headers: { "Content-Type": "application/json" }
        });
      }
    }

    const caption = `📰 ${title}\n${description}\n🔗 पूरी खबर पढ़ें:\n${articleUrl}`;

    const endpoint = imageUrl
      ? `https://api.telegram.org/bot${token}/sendPhoto`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const body = imageUrl
      ? { chat_id: chatId, photo: imageUrl, caption }
      : { chat_id: chatId, text: caption };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const result = await response.json();
    if (!result.ok) {
      return new Response(JSON.stringify({ error: "Telegram API error", details: result }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}