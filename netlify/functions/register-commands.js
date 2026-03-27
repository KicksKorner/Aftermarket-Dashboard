// netlify/functions/register-commands.js
// Run this ONCE to register /pokemonsku with Discord
// Call it by visiting: https://yourdomain.netlify.app/.netlify/functions/register-commands
// You can delete or protect this after first run

const DISCORD_APP_ID = process.env.DISCORD_APP_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;

exports.handler = async () => {
  const command = {
    name: "pokemonsku",
    description: "Look up Pokemon product barcodes and SKUs by set, store and product type",
    type: 1,
  };

  const res = await fetch(
    `https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify(command),
    }
  );

  const data = await res.json();

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Command registered", data }),
  };
};
