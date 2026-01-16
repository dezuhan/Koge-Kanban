export const getAutoFillPrompt = (title: string, description: string) => `
Role: Smart Project Manager.
Task: Auto-fill task details based on the title.
Title: "${title}"
${description ? `Current Description: "${description}"` : ''}

INSTRUCTIONS:
1. Analyze the title to understand the intent, scope, and urgency.
2. **Handle Metadata in Title**: This is your TOP priority. If the user writes specific patterns like "project: [Name]", "for: [Assignee]", "category: [Type]", or "priority: [Level]" in the title, you MUST extract these literal values and fill the corresponding JSON fields.
3. Generate a comprehensive DESCRIPTION in Markdown format.
4. Infer or extract the CATEGORY.
5. Infer or extract the PROJECT name.
6. Infer or extract the ASSIGNEE name.
7. Infer or extract the PRIORITY (High/Medium/Low).
8. Suggest a reasonable DUE DATE (as YYYY-MM-DD) if implied (e.g., "urgent" -> tomorrow, "next week" -> +7 days), otherwise null.
9. Suggest 3-5 relevant SUBTASKS.

OUTPUT FORMAT (JSON ONLY):
\`\`\`json
{
    "description": "Markdown string...",
    "category": "String",
    "project": "String",
    "assignee": "String",
    "priority": "High" | "Medium" | "Low",
    "dueDate": "YYYY-MM-DD" | null,
    "subTasks": [
        { "title": "Subtask 1" },
        { "title": "Subtask 2" }
    ]
}
\`\`\`
`.trim();

export const getDescriptionPrompt = (title: string, description: string, userInstructions: string) => `
Role: Task Management Assistant.

Context:
- Title: "${title}"
${description ? `- Existing Content: """${description}"""` : ''}
${userInstructions ? `- User Instruction: """${userInstructions}"""` : ''}

STRICT RULES:
1. **FOLLOW INSTRUCTIONS:** If "User Instruction" is provided, follow it exactly.
2. **NO UNSOLICITED REFINEMENT:** If the user DOES NOT explicitly ask to "refine", "rewrite", "improve", or "change" the existing content, **YOU MUST NOT CHANGE THE ORIGINAL WORDING**. 
   - You may only apply Markdown formatting (headers, lists).
   - You may add requested sections (e.g. "Add Acceptance Criteria") while keeping the original text identical.
3. **GENERATION:** Only generate new creative content if "Existing Content" is empty OR if the "User Instruction" asks for it.

PROCESS:
1. Plan in <think> tags.
2. Output the result.
`.trim();

export const getMarkdownFormatPrompt = (description: string) => `
Act as a Strict Markdown Formatter.

Input Text:
"""
${description}
"""

STRICT INSTRUCTIONS:
1. **DO NOT CHANGE THE CONTENT**: You are forbidden from adding, removing, or rephrasing words. The text must remain word-for-word identical to the input, except for the addition of Markdown syntax.
2. **ADD MARKDOWN ONLY**: Add '#' for headers, '-' for lists, '**' for bolding key terms, and other Markdown symbols where appropriate based on the context.
3. **STRUCTURE**: Infer the logical structure (headers, lists) from the input text.
4. **LANGUAGE**: Keep the original language exactly as is.

PROCESS:
1. Analyze the structure in <think> tags.
2. Output the formatted markdown.
`.trim();

