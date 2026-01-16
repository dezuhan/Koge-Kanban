export const getSubtasksChecklistPrompt = (context: string) => `
Act as a Senior Project Manager. Analyze the following task title and description in detail.

${context}

Based on this context, break down this task into a logical, step-by-step checklist of subtasks required to complete it.
- If the description already lists steps, format them as subtasks.
- If the description is vague, infer the necessary steps based on the title and context.

Return ONLY the subtask titles, one per line. No numbering, no bullets, just plain text.
`.trim();

