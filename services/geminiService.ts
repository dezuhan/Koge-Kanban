import { GoogleGenAI, Type } from "@google/genai";
import { Task, Priority } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `You are a helpful project management assistant. Your goal is to help users refine task descriptions, suggest categories, estimate priorities, and break down tasks into actionable subtasks.`;

export const generateTaskDetails = async (title: string, currentDesc: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Task Title: "${title}". Current Description: "${currentDesc}". 
      Please generate a better description, suggest a one-word category, estimate priority (Low, Medium, High), and provide a list of 3-5 subtasks to complete this main task.`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING, description: "A clearer, concise description of the task." },
            category: { type: Type.STRING, description: "A short category name (e.g., Design, Backend, Marketing)." },
            priority: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
            subTasks: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "A list of actionable subtasks."
            }
          },
          required: ["description", "category", "priority", "subTasks"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini AI Error:", error);
    throw error;
  }
};