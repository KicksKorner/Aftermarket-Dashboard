iif (postToDiscord) {
  try {
    const webhook =
      destination === "sneakers"
        ? process.env.DISCORD_WEBHOOK_SNEAKERS
        : process.env.DISCORD_WEBHOOK_AMAZON;

    if (!webhook) {
      throw new Error("Missing Discord webhook");
    }

    await axios.post(webhook, {
      embeds: [
        {
          title:
            destination === "sneakers"
              ? "Percy Bargains Alert 🚨"
              : "Amazon STEAL! Alert 🚨",
          description,
          color: destination === "sneakers" ? 5763719 : 3447003,
          fields: [
            {
              name: "Price",
              value: formatPrice(price),
              inline: true,
            },
          ],
          image: imageUrl ? { url: imageUrl } : undefined,
          footer: {
            text:
              destination === "sneakers"
                ? "Bargain Sniper UK • Sneakers"
                : "Bargain Sniper UK • Deals",
          },
        },
      ],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 5,
              label: "View Deal",
              url: link,
            },
          ],
        },
      ],
    });

    results.discord = true;
  } catch (err: any) {
    errors.discord = err?.response?.data || err?.message || "Discord post failed";
  }
}