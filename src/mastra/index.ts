import { Mastra } from "@mastra/core/mastra";
import evaluationWorkflow from "./workflows/evaluation/evaluation.workflow";
import erdInformationExtractAgent from "./agents/erd-information-extract.agent";
import { PinoLogger } from "@mastra/loggers";

export const mastra = new Mastra({
  workflows: {
    evaluationWorkflow,
  },
  agents: {
    erdInformationExtractAgent,
  },
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
});
