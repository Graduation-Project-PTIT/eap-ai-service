# Chatbot ERD Generation Implementation Plan

## Overview

Extend the chatbot feature to support both ERD (Chen notation) and Physical Database schema generation, with AI-driven intent detection and cross-type conversion capabilities.

---

## Table of Contents

1. [Requirements Summary](#requirements-summary)
2. [Architecture Overview](#architecture-overview)
3. [Backend Implementation Tasks](#backend-implementation-tasks)
4. [Frontend Implementation Tasks](#frontend-implementation-tasks)
5. [Detailed Implementation Steps](#detailed-implementation-steps)
6. [File Changes Summary](#file-changes-summary)

---

## Requirements Summary

### Core Behavior

- AI detects user intent: ERD vs Physical DB based on user's prompt
- **Default**: ERD when ambiguous
- Suggest generating the other type at the end (only on initial creation)

### Output Formats

| Type                | Schema                          | DDL     | Frontend View      |
| ------------------- | ------------------------------- | ------- | ------------------ |
| ERD (Chen notation) | `erdInformationExtractSchema`   | None    | `erd-diagram-view` |
| Physical DB         | `dbInformationGenerationSchema` | SQL DDL | `db-diagram-view`  |

### Conversion Rules

| From        | To          | Allowed? | Action                              |
| ----------- | ----------- | -------- | ----------------------------------- |
| ERD         | Physical DB | ✅ Yes   | AI converts automatically           |
| Physical DB | ERD         | ❌ No    | Ask user to create new conversation |

### Modification Behavior

- When both schemas exist: Modify ERD first (source of truth) → Auto-regenerate Physical DB

### Frontend Tabs

- 3 tabs: `ERD` | `Physical` | `DDL`
- Empty tab: Show "No content yet" or "Generate Physical DB to see DDL"

---

## Architecture Overview

### Current Flow (Physical DB Only)

```
User Message → Intent Classification → chatbotWorkflow → dbGenerationWorkflow
                  ↓                                            ↓
            [schema/side-question]                    schemaGenerationStep
            [create/modify]                                    ↓
                                                      ddlGenerationStep
                                                             ↓
                                                    Physical DB Schema + DDL
```

### New Flow (ERD + Physical DB)

```
User Message → Intent Classification → chatbotWorkflow → Branch by diagramType
                  ↓                                            ↓
            [schema/side-question]              ┌──────────────┴──────────────┐
            [create/modify]                     ↓                              ↓
            [diagramType: ERD/PHYSICAL_DB]  ERD Branch                   Physical DB Branch
                                               ↓                              ↓
                                    erdGenerationWorkflow          dbGenerationWorkflow
                                               ↓                              ↓
                                    erdGenerationStep              schemaGenerationStep
                                               ↓                              ↓
                                       ERD Schema                  ddlGenerationStep
                                    + Suggestion                          ↓
                                                               Physical DB Schema + DDL
```

---

## Backend Implementation Tasks

### Phase 1: Database Schema Changes

- [ ] Add `currentErdSchema` (jsonb) column to `chatbot_conversation_history`
- [ ] Add `diagramType` (varchar) column to `chatbot_conversation_history`
- [ ] Create database migration

### Phase 2: Schema & Type Definitions

- [ ] Create `erdInformationGenerationSchema.ts` (based on `erdInformationExtractSchema.ts`)
- [ ] Update response types to include ERD schema

### Phase 3: Intent Classification Enhancement

- [ ] Update `intentClassificationAgent` to detect `diagramType` (ERD/PHYSICAL_DB)
- [ ] Add keywords detection for ERD vs Physical DB
- [ ] Default to ERD when ambiguous

### Phase 4: ERD Generation Workflow

- [ ] Create `erdGenerationWorkflow` (similar to `dbGenerationWorkflow`)
- [ ] Create `erdGenerationStep` (generates ERD schema)
- [ ] Create `erdGenerationAgent` with appropriate prompt
- [ ] Create `erd-generation-prompt.ts` for ERD generation

### Phase 5: Workflow Branching

- [ ] Update `chatbotWorkflow` to branch based on `diagramType`
- [ ] Create `erdWorkflowBranchStep` (similar to `schemaWorkflowBranchStep`)
- [ ] Handle ERD → Physical DB conversion flow

### Phase 6: Handler Updates

- [ ] Update `send-message.handler.ts` for dual schema support
- [ ] Add prevention logic: Block ERD generation when Physical DB exists
- [ ] Add conversion logic: ERD → Physical DB
- [ ] Add suggestion logic: Append conversion suggestion on initial creation
- [ ] Update modification flow: ERD first → regenerate Physical DB

### Phase 7: Conversion Logic

- [ ] Create `erd-to-physical-conversion-step.ts` for ERD → Physical DB conversion
- [ ] Handle multivalued attributes → junction tables
- [ ] Handle composite attributes → flatten to columns
- [ ] Handle derived attributes → exclude from Physical DB
- [ ] Handle weak entities → regular tables with composite FK

---

## Frontend Implementation Tasks

### Phase 8: API & Types

- [ ] Update `chat-service.ts` API types to include `erdSchema`
- [ ] Update `ChatMessage` type to include `erdSchema`
- [ ] Update conversation response types

### Phase 9: ERD Sidebar Updates

- [ ] Update `ERDSidebar.tsx` to support 3 tabs: ERD | Physical | DDL
- [ ] Add tab switching logic based on available content
- [ ] Show "No content yet" for empty tabs
- [ ] Show "Generate Physical DB to see DDL" for DDL tab when only ERD exists
- [ ] Integrate `erd-diagram-view` component for ERD tab

### Phase 10: State Management

- [ ] Update chatbot state to track both `erdSchema` and `physicalSchema`
- [ ] Update `useConversation` hook for dual schema handling

---

## Detailed Implementation Steps

### Step 1: Database Migration

**File**: `eap-evaluation-service/src/mastra/api/db/schema/chatbot-conversation-history.ts`

Add new columns:

```typescript
currentErdSchema: jsonb("current_erd_schema"),
diagramType: varchar("diagram_type", { length: 20 }), // 'ERD' | 'PHYSICAL_DB'
```

**Migration SQL**:

```sql
ALTER TABLE chatbot_conversation_history
ADD COLUMN current_erd_schema JSONB,
ADD COLUMN diagram_type VARCHAR(20);
```

---

### Step 2: Create ERD Generation Schema

**File**: `eap-evaluation-service/src/schemas/erdInformationGenerationSchema.ts`

Create new schema based on `erdInformationExtractSchema.ts`:

- Remove `type: z.literal("ERD")` (not needed for generation)
- Keep: entities, attributes (with ERD-specific flags), relationships, weak entities

---

### Step 3: Update Intent Classification Agent

**File**: `eap-evaluation-service/src/mastra/agents/chatbot/intent-classification-agent.ts`

Add `diagramType` to output schema:

```typescript
diagramType: z.enum(["ERD", "PHYSICAL_DB"]).describe(
  "Type of diagram to generate"
);
```

Update prompt with detection keywords:

- **Physical DB triggers**: "database schema", "tables", "DDL", "SQL", "create tables", "physical"
- **ERD triggers**: "ERD", "entity relationship", "conceptual", "Chen notation", "ER diagram"
- **Default**: ERD

---

### Step 4: Create ERD Generation Agent

**File**: `eap-evaluation-service/src/mastra/agents/chatbot/erd-generation/erd-generation-agent.ts`

Create new agent similar to `schema-generation-agent.ts`:

- Use appropriate LLM model
- Reference ERD generation prompt

---

### Step 5: Create ERD Generation Prompt

**File**: `eap-evaluation-service/src/mastra/agents/chatbot/erd-generation/prompts/erd-generation-prompt.ts`

Prompt should instruct AI to:

- Generate Chen notation ERD schema
- Identify strong and weak entities
- Classify attributes (key, multivalued, derived, composite)
- Define relationships with cardinality and participation constraints
- Follow `erdInformationGenerationSchema` structure

---

### Step 6: Create ERD Generation Step

**File**: `eap-evaluation-service/src/mastra/workflows/chatbot/erd-generation/steps/erd-generation-step.ts`

Similar to `schema-generation-step.ts`:

- Input: userMessage, fullContext, domain, enableSearch
- Output: erdSchema, agentResponse
- Call `erdGenerationAgent` with structured output

---

### Step 7: Create ERD Generation Workflow

**File**: `eap-evaluation-service/src/mastra/workflows/chatbot/erd-generation/erd-generation.workflow.ts`

Similar to `db-generation.workflow.ts`:

- Single step workflow (no DDL generation for ERD)
- Input: userMessage, fullContext, domain, enableSearch
- Output: erdSchema, agentResponse

---

### Step 8: Create ERD Workflow Branch Step

**File**: `eap-evaluation-service/src/mastra/workflows/chatbot/steps/erd-workflow-branch-step.ts`

Similar to `schema-workflow-branch-step.ts`:

- Invokes `erdGenerationWorkflow`
- Returns ERD schema and response

---

### Step 9: Create ERD to Physical DB Conversion Step

**File**: `eap-evaluation-service/src/mastra/workflows/chatbot/conversion/erd-to-physical-step.ts`

Conversion logic (AI-driven via prompt):

- Multivalued attributes → separate junction/child tables
- Composite attributes → flatten to individual columns
- Derived attributes → exclude (computed at query time)
- Weak entities → regular tables with composite FK
- Relationships → foreign key constraints

---

### Step 10: Update Chatbot Workflow

**File**: `eap-evaluation-service/src/mastra/workflows/chatbot/chatbot.workflow.ts`

Add branching for `diagramType`:

```typescript
.branch([
  // Side question branch (unchanged)
  [condition: intent === "side-question", sideQuestionStep],

  // ERD generation branch
  [condition: intent === "schema" && diagramType === "ERD", erdWorkflowBranchStep],

  // Physical DB generation branch
  [condition: intent === "schema" && diagramType === "PHYSICAL_DB", schemaWorkflowBranchStep],
])
```

Update input/output schemas to include `diagramType`.

---

### Step 11: Update Send Message Handler

**File**: `eap-evaluation-service/src/mastra/api/modules/chatbot/handlers/send-message.handler.ts`

#### 11.1 Intent Classification Update

Add `diagramType` to intent classification output.

#### 11.2 Prevention Logic

```typescript
// Block ERD generation when Physical DB already exists
if (hasPhysicalSchema && intentClassification.diagramType === "ERD") {
  return "Physical DB schema already exists. Please create a new conversation for ERD.";
}
```

#### 11.3 Conversion Detection

```typescript
// Detect if user wants to convert ERD → Physical DB
if (
  hasErdSchema &&
  !hasPhysicalSchema &&
  intentClassification.diagramType === "PHYSICAL_DB"
) {
  // Trigger conversion flow
}
```

#### 11.4 Suggestion Logic

```typescript
// On initial ERD creation, append suggestion
if (isInitialCreation && diagramType === "ERD") {
  agentResponse +=
    "\n\n---\n\n💡 **Tip:** Would you like me to convert this ERD to a Physical Database schema with DDL?";
}
```

#### 11.5 Modification Sync

```typescript
// When modifying and both schemas exist
if (hasErdSchema && hasPhysicalSchema && schemaIntent === "modify") {
  // 1. Modify ERD first
  // 2. Regenerate Physical DB from updated ERD
}
```

#### 11.6 Response Handling

Update to return both schemas:

```typescript
return {
  erdSchema: result.erdSchema || conversation.currentErdSchema,
  schema: result.physicalSchema || conversation.currentSchema,
  ddl: result.ddlScript || conversation.currentDdl,
  diagramType: intentClassification.diagramType,
};
```

---

### Step 12: Register New Agents and Workflows

**File**: `eap-evaluation-service/src/mastra/index.ts`

Register:

- `erdGenerationAgent`
- `erdGenerationWorkflow`

---

### Step 13: Frontend - Update API Types

**File**: `eap-frontend/src/api/services/chat-service.ts`

Update types:

```typescript
interface ChatMessage {
  // ... existing fields
  erdSchema?: ERDSchema; // Add ERD schema
  schema?: DBSchema; // Rename clarity: Physical DB schema
}

interface ConversationResponse {
  // ... existing fields
  erdSchema?: ERDSchema;
  schema?: DBSchema;
  diagramType?: "ERD" | "PHYSICAL_DB";
}
```

---

### Step 14: Frontend - Update ERDSidebar Component

**File**: `eap-frontend/src/pages/main/Chatbot/components/ERDSidebar.tsx`

#### 14.1 Props Update

```typescript
interface ERDSidebarProps {
  erdSchema: ERDSchema | null; // Add ERD schema
  schema: { entities: DBEntity[] } | null; // Physical DB schema
  ddl: string | null;
  // ... rest unchanged
}
```

#### 14.2 Tab Structure

Change from 2 tabs to 3 tabs:

```tsx
<TabsList className="grid w-full grid-cols-3 max-w-md">
  <TabsTrigger value="erd">ERD</TabsTrigger>
  <TabsTrigger value="physical">Physical</TabsTrigger>
  <TabsTrigger value="ddl">DDL</TabsTrigger>
</TabsList>
```

#### 14.3 ERD Tab Content

```tsx
<TabsContent value="erd">
  {erdSchema ? (
    <ERDDiagram initialNodes={erdNodes} initialEdges={erdEdges} />
  ) : (
    <EmptyState message="No ERD generated yet" />
  )}
</TabsContent>
```

#### 14.4 Physical Tab Content

```tsx
<TabsContent value="physical">
  {schema?.entities?.length > 0 ? (
    <DBDiagram
      initialNodes={dbNodes}
      initialEdges={dbEdges}
      onEntityUpdate={onEntityUpdate}
    />
  ) : (
    <EmptyState message="No Physical DB schema yet" />
  )}
</TabsContent>
```

#### 14.5 DDL Tab Content

```tsx
<TabsContent value="ddl">
  {ddl ? (
    <Editor value={ddl} ... />
  ) : (
    <EmptyState message="Generate Physical DB to see DDL" />
  )}
</TabsContent>
```

---

### Step 15: Frontend - Update ERD Diagram Utilities

**Files to check/update**:

- `eap-frontend/src/components/erd/erd-diagram-view/utils/getNodesForERDDiagram.ts`
- `eap-frontend/src/components/erd/erd-diagram-view/utils/getEdgesForERDDiagram.ts`

Ensure these utilities can handle the `erdInformationGenerationSchema` structure.

---

### Step 16: Frontend - Update Chatbot State

**File**: `eap-frontend/src/pages/main/Chatbot/index.tsx`

Update state management:

```typescript
const [currentErdSchema, setCurrentErdSchema] = useState<ERDSchema | null>(
  null
);
const [currentSchema, setCurrentSchema] = useState<DBSchema | null>(null);
const [currentDdl, setCurrentDdl] = useState<string | null>(null);
```

Update response handling to set both schemas.

---

## File Changes Summary

### Backend - New Files

| File                                                             | Description                   |
| ---------------------------------------------------------------- | ----------------------------- |
| `schemas/erdInformationGenerationSchema.ts`                      | Zod schema for ERD generation |
| `agents/chatbot/erd-generation/erd-generation-agent.ts`          | ERD generation agent          |
| `agents/chatbot/erd-generation/prompts/erd-generation-prompt.ts` | ERD generation prompt         |
| `workflows/chatbot/erd-generation/erd-generation.workflow.ts`    | ERD generation workflow       |
| `workflows/chatbot/erd-generation/steps/erd-generation-step.ts`  | ERD generation step           |
| `workflows/chatbot/steps/erd-workflow-branch-step.ts`            | ERD workflow branch step      |
| `workflows/chatbot/conversion/erd-to-physical-step.ts`           | ERD → Physical DB conversion  |

### Backend - Modified Files

| File                                            | Changes                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| `db/schema/chatbot-conversation-history.ts`     | Add `currentErdSchema`, `diagramType` columns           |
| `agents/chatbot/intent-classification-agent.ts` | Add `diagramType` detection                             |
| `workflows/chatbot/chatbot.workflow.ts`         | Add ERD branch, update schemas                          |
| `handlers/send-message.handler.ts`              | Dual schema support, prevention, conversion, suggestion |
| `mastra/index.ts`                               | Register new agents/workflows                           |

### Frontend - Modified Files

| File                                           | Changes                         |
| ---------------------------------------------- | ------------------------------- |
| `api/services/chat-service.ts`                 | Add ERD schema types            |
| `pages/main/Chatbot/components/ERDSidebar.tsx` | 3 tabs, ERD diagram integration |
| `pages/main/Chatbot/index.tsx`                 | Dual schema state management    |

---

## Testing Checklist

### Backend Tests

- [ ] Intent classification correctly detects ERD vs Physical DB
- [ ] ERD generation produces valid schema
- [ ] ERD → Physical DB conversion works correctly
- [ ] Prevention: Block ERD when Physical DB exists
- [ ] Modification syncs both schemas (ERD first, then regenerate Physical)
- [ ] Suggestion appears only on initial creation

### Frontend Tests

- [ ] 3 tabs display correctly
- [ ] ERD tab shows Chen notation diagram
- [ ] Physical tab shows table diagram
- [ ] DDL tab shows SQL script
- [ ] Empty states display correct messages
- [ ] Tab switching works smoothly

### Integration Tests

- [ ] Full flow: Create ERD → Convert to Physical DB
- [ ] Full flow: Create Physical DB directly
- [ ] Modification flow with both schemas
- [ ] Conversation history preserves both schemas

---

## Implementation Order (Recommended)

1. **Phase 1**: Database migration (Step 1)
2. **Phase 2**: Schema definition (Step 2)
3. **Phase 3**: Intent classification update (Step 3)
4. **Phase 4**: ERD generation components (Steps 4-8)
5. **Phase 5**: Conversion logic (Step 9)
6. **Phase 6**: Workflow integration (Step 10)
7. **Phase 7**: Handler updates (Step 11)
8. **Phase 8**: Registration (Step 12)
9. **Phase 9**: Frontend API types (Step 13)
10. **Phase 10**: Frontend UI updates (Steps 14-16)

---

## Notes

### ERD Schema Structure (for reference)

```typescript
{
  entities: [{
    name: string,
    attributes: [{
      name: string,
      type: string,
      primaryKey: boolean,
      isMultivalued?: boolean,
      isDerived?: boolean,
      isComposite?: boolean,
      subAttributes?: [...]
    }],
    isWeakEntity: boolean,
    identifyingEntity?: string
  }],
  relationships: [{
    name: string,
    sourceEntity: string,
    targetEntity: string,
    relationType: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many",
    sourceParticipation?: "total" | "partial",
    targetParticipation?: "total" | "partial",
    attributes?: [...]
  }]
}
```

### Physical DB Schema Structure (for reference)

```typescript
{
  entities: [{
    name: string,
    attributes: [{
      name: string,
      type: string,  // SQL type
      primaryKey: boolean,
      foreignKey: boolean,
      unique: boolean,
      nullable: boolean,
      foreignKeyTable?: string,
      foreignKeyAttribute?: string,
      relationType?: "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"
    }]
  }]
}
```

---

## Estimated Effort

| Phase                                          | Effort          |
| ---------------------------------------------- | --------------- |
| Database & Schema                              | 1-2 hours       |
| Intent Classification                          | 2-3 hours       |
| ERD Generation (Agent, Prompt, Step, Workflow) | 4-6 hours       |
| Conversion Logic                               | 3-4 hours       |
| Handler Updates                                | 4-5 hours       |
| Frontend Updates                               | 4-6 hours       |
| Testing & Debugging                            | 4-6 hours       |
| **Total**                                      | **22-32 hours** |
