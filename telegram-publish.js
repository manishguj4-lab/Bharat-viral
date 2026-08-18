export default async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  try {
    const article = await req.json();
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return new Response(JSON.stringify({ error: "Telegram environment variables missing" }),
        { status: 500, headers: { "Content-Type": "application/json" } });
    }

    const title = article.title || "नई खबर";
    const description = article.description || "";
    const articleUrl = article.url || "";
    const imageUrl = article.image_url || "";

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
      return new Response(JSON.stringify({ error: "Telegram API error", details: result }),
        { status: 500, headers: { "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } });
  }
};
