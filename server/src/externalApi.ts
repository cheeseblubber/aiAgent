import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function openAiChat(
  message: string
): Promise<string> {
  const completion = await openai.chat.completions.create({
    messages: [{ role: "user", content: message }],
    model: "gpt-3.5-turbo",
  });

  return completion.choices[0]?.message?.content || "Sorry, I couldn't process that.";
}
