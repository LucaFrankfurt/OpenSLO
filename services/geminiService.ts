import { GoogleGenAI, Type } from "@google/genai";
import { SloState, BudgetingMethod, TimeWindowUnit } from "../types";

// Helper to sanitize Gemini response text
const cleanJson = (text: string) => {
  return text.replace(/```json\n?|\n?```/g, '').trim();
};

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async generateSloFromDescription(description: string): Promise<Partial<SloState>> {
    const model = this.ai.models;
    
    const prompt = `
      You are an expert Site Reliability Engineer (SRE) proficient in OpenSLO.
      Based on the following natural language description, generate a JSON object representing the state of an SLO or SLI configuration.
      
      User Description: "${description}"

      If the user requests an SLI, set "kind" to "SLI".
      If the user requests an SLO, set "kind" to "SLO".
      If the user wants to reference an existing SLI, use "indicatorMode": "reference" and provide "indicatorRef".
      Otherwise use "indicatorMode": "inline" and provide the metrics.

      The JSON structure MUST match this schema exactly:
      {
        "kind": "SLO" | "SLI",
        "name": "string (kebab-case)",
        "displayName": "string",
        "description": "string",
        "service": "string",
        "target": number (0.0 to 1.0),
        "timeWindowCount": number,
        "timeWindowUnit": "d" | "h" | "m" | "w",
        "indicatorMode": "inline" | "reference",
        "indicatorRef": "string",
        "indicatorType": "ratio" | "threshold",
        "budgetingMethod": "occurrences" | "timeslices",
        "ratioMetric": {
           "good": { "type": "string", "query": "string" },
           "total": { "type": "string", "query": "string" }
        },
        "thresholdMetric": {
           "source": { "type": "string", "query": "string" },
           "operator": "lt" | "lte" | "gt" | "gte",
           "value": number
        }
      }

      If the user does not specify a metric query, invent a plausible Prometheus query based on the service name.
      Only return valid JSON.
    `;

    try {
      const response = await model.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              kind: { type: Type.STRING, enum: ['SLO', 'SLI'] },
              name: { type: Type.STRING },
              displayName: { type: Type.STRING },
              description: { type: Type.STRING },
              service: { type: Type.STRING },
              target: { type: Type.NUMBER },
              timeWindowCount: { type: Type.NUMBER },
              timeWindowUnit: { type: Type.STRING, enum: [TimeWindowUnit.Day, TimeWindowUnit.Hour, TimeWindowUnit.Minute, TimeWindowUnit.Week] },
              indicatorMode: { type: Type.STRING, enum: ['inline', 'reference'] },
              indicatorRef: { type: Type.STRING },
              indicatorType: { type: Type.STRING, enum: ['ratio', 'threshold'] },
              budgetingMethod: { type: Type.STRING, enum: [BudgetingMethod.Occurrences, BudgetingMethod.Timeslices] },
              ratioMetric: {
                type: Type.OBJECT,
                properties: {
                  good: { 
                    type: Type.OBJECT, 
                    properties: { type: { type: Type.STRING }, query: { type: Type.STRING } } 
                  },
                  total: { 
                    type: Type.OBJECT, 
                    properties: { type: { type: Type.STRING }, query: { type: Type.STRING } } 
                  },
                }
              },
              thresholdMetric: {
                type: Type.OBJECT,
                properties: {
                  source: { 
                    type: Type.OBJECT, 
                    properties: { type: { type: Type.STRING }, query: { type: Type.STRING } } 
                  },
                  operator: { type: Type.STRING },
                  value: { type: Type.NUMBER }
                }
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      return JSON.parse(cleanJson(text));
    } catch (error) {
      console.error("Error generating SLO:", error);
      throw error;
    }
  }
}

export const geminiService = new GeminiService();