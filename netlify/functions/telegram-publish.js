exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const article = JSON.parse(event.body);
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Telegram environment variables missing" })
      };
    }

    const title = article.title || "नई खबर";
    const description = article.description || "";
    const articleUrl = article.url || "";
    const imageUrl = article.image_url || "";

    const caption = `📰 ${title}\n${description}\n🔗 पूरी खबर पढ़ें:\n${articleUrl}`;

    const endpoint = imageUrl
      ? `https://api.telegram.org/bot${token}/sendPhoto`
      : `https://api.telegram.org/bot${token}/sendMessage`;

    const requestBody = imageUrl
      ? { chat_id: chatId, photo: imageUrl, caption }
      : { chat_id: chatId, text: caption };

    // Standard Netlify node 18+ includes global fetch, so we don't need node-fetch dependency.
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody)
    });

    const result = await response.json();
    if (!result.ok) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Telegram API error", details: result })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message })
    };
  }
};
