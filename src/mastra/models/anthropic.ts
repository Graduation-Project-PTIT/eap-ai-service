import { anthropic } from "@ai-sdk/anthropic";

const claudeSonnet45 = anthropic("claude-sonnet-4-5");
const claudeHaiku45 = anthropic("claude-haiku-4-5");

export { claudeSonnet45, claudeHaiku45 };