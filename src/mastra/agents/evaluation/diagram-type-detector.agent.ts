import { Agent } from "@mastra/core/agent";
import { gemini25FlashLite } from "../../models/google";
import diagramTypeDetectorPrompt from "./prompts/diagram-type-detector.prompt";

const diagramTypeDetectorAgent = new Agent({
  name: "diagramTypeDetectorAgent",
  instructions: diagramTypeDetectorPrompt,
  model: gemini25FlashLite,
});

export default diagramTypeDetectorAgent;
