export const getProjectSummaryPrompt = (projectName: string, totalTasks: number, byStatus: any, byPriority: any, highPriorityPending: number, overdueTasks: number) => `
Act as a Senior Project Manager and Agile Coach. Analyze the provided project data to generate a comprehensive "Project Status & Health Report".

Project Name: ${projectName}
Total Tasks: ${totalTasks}

Task Distribution by Status:
${JSON.stringify(byStatus, null, 2)}

Priority Breakdown:
- High Priority: ${byPriority.High}
- Medium Priority: ${byPriority.Medium}
- Low Priority: ${byPriority.Low}

Critical Metrics:
- High Priority NOT Completed: ${highPriorityPending}
- Overdue Tasks: ${overdueTasks}

Output Requirement:
- Tone: Highly Professional, Objective, Detail-Oriented, Strategic.
- Format: Strict Markdown.
- START DIRECTLY with the content. Do NOT include phrases like "Okay, here's the analysis" or "Here is the report".

Structure:
1. **Executive Summary**: A high-level assessment of project health (Healthy / At Risk / Critical) with justification.
2. **Key Metrics Analysis**:
   - Completion Rate Analysis.
   - Priority Distribution Insights.
   - Bottleneck Identification (based on status distribution).
3. **Critical Risks & Blockers**:
   - Deep dive into High Priority pending tasks.
   - Overdue item analysis.
4. **Strategic Recommendations**:
   - 3-5 specific, actionable steps to improve velocity or unblock critical paths.
   - Resource allocation suggestions if applicable (based on implied workload).

Ensure the report is ready for stakeholder presentation.
`.trim();

