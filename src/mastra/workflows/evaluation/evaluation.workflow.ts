import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import erdInformationExtractStep from "./steps/erd-information-extract.step";
import erdInformationExtractSchema from "../../../schemas/erdInformationExtractSchema";

const evaluationWorkflow = createWorkflow({
  id: "evaluationWorkflow",
  inputSchema: z.object({
    erdImage: z.string().url(),
  }),
  outputSchema: erdInformationExtractSchema,
})
  .then(erdInformationExtractStep)
  .commit();

export default evaluationWorkflow;
