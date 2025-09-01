import { openai } from "@ai-sdk/openai";

const gpt5Nano = openai("gpt-5-nano");
const gpt5Mini = openai("gpt-5-mini");
const gpt41 = openai("gpt-4.1");
const gpt41Mini = openai("gpt-4.1-mini");

export { gpt5Nano, gpt5Mini, gpt41, gpt41Mini };
