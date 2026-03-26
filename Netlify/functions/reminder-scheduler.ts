import { schedule } from "@netlify/functions";
import { createClient } from "@supabase/supabase-js";
import axios from "axios";

const MEMBER_ROLE_ID = "726446805667020892";

const handler = schedule("* * * * *", async () => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const reminderWebhookUrl = process.env.REMINDERS_DISCORD_WEBHOOK_URL;
  if (!reminderWebhookUrl) {
    console.error("REMINDERS_DISCORD_WEBHOOK_URL is not set");
    return { statusCode: 200 };
  }

  const now = new Date();

  const { data: reminders, error } = await supabase
    .from("drop_reminders")
    .select("*")
    .eq("sent", false)
    .lte("remind_at", now.toISOString())
    .limit(10);

  if (error) {
    console.error("Supabase fetch error:", error);
    return { statusCode: 200 };
  }

  if (!reminders || reminders.length === 0) return { statusCode: 200 };

  for (const reminder of reminders) {
    try {
      const embed = {
        // Member ping above the embed
        content: `<@&${MEMBER_ROLE_ID}>`,
        embeds: [
          {
            title: `🔔  1 hour reminder — ${reminder.title}`,
            color: 0x3b82f6,
            fields: [
              { name: "Channel",   value: reminder.channel,             inline: true },
              { name: "Drop time", value: reminder.drop_date_formatted, inline: true },
              ...(reminder.writeup_url
                ? [{ name: "Writeup", value: `[Click here](${reminder.writeup_url})` }]
                : []),
            ],
            footer: { text: "Aftermarket Arbitrage | 2026" },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      await axios.post(reminderWebhookUrl, embed);

      await supabase
        .from("drop_reminders")
        .update({ sent: true })
        .eq("id", reminder.id);

      console.log(`Reminder sent for: ${reminder.title}`);
    } catch (err) {
      console.error(`Failed to send reminder for ${reminder.title}:`, err);
    }
  }

  return { statusCode: 200 };
});

export { handler };
