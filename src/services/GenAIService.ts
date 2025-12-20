import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';
import * as fs from 'fs';
import { supabase } from '../lib/supabase';
import OpenAI from 'openai';

// Load env from backend root
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Helper to write to log file for debugging
const logErrorToFile = (message: string, error: any) => {
    const logPath = path.join(__dirname, '../../ai_debug.log');
    const timestamp = new Date().toISOString();

    let errorDetails = '';
    if (error instanceof Error) {
        errorDetails = error.stack || error.message;
    } else {
        errorDetails = JSON.stringify(error);
    }

    const logEntry = `\n[${timestamp}] ${message}\nError: ${errorDetails}\n-------------------\n`;

    try {
        fs.appendFileSync(logPath, logEntry);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
};

const logResponseToFile = (message: string, content: string) => {
    const logPath = path.join(__dirname, '../../ai_debug.log');
    const timestamp = new Date().toISOString();
    const logEntry = `\n[${timestamp}] ${message}\nContent Preview: ${content.substring(0, 500)}...\n-------------------\n`;
    try {
        fs.appendFileSync(logPath, logEntry);
    } catch (e) {
        console.error("Failed to write to log file:", e);
    }
};

interface AIConfig {
    apiKey?: string;
    model?: string;
    provider?: 'google' | 'openai';
    baseUrl?: string;
}

export class GenAIService {
    private defaultGenAI: GoogleGenerativeAI;
    private defaultModel: any;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        console.log(`[GenAIService] Initializing default with API Key present: ${!!apiKey}`);

        if (!apiKey) {
            console.error('[GenAIService] FATAL: GEMINI_API_KEY is missing in environment variables!');
            this.defaultGenAI = new GoogleGenerativeAI('dummy_key');
        } else {
            this.defaultGenAI = new GoogleGenerativeAI(apiKey);
        }

        // Default Model
        this.defaultModel = this.defaultGenAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            safetySettings: this.getSafetySettings()
        });
        console.log(`[GenAIService] Default Active Model: gemini-1.5-flash`);
    }

    private getSafetySettings() {
        return [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ];
    }

    // Helper to get active configuration (Default or Custom from DB)
    private async getActiveConfig(userId?: string): Promise<AIConfig> {
        if (!userId) {
            console.log(`[GenAIService] No UserID provided, using system default (Google).`);
            return { provider: 'google' };
        }

        // Validate if userId is a valid UUID to prevent Postgres crashing
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
            console.warn(`[GenAIService] UserID "${userId}" is not a valid UUID. Skipping Custom Key DB lookup and using system default.`);
            return { provider: 'google' };
        }

        try {
            // Fetch active key for user
            const { data: keyData, error } = await supabase
                .from('user_ai_keys')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .single();

            if (keyData && keyData.api_key) {
                console.log(`[GenAIService] ⚡ Using CUSTOM API KEY for user ${userId} (${keyData.name}) - Provider: ${keyData.provider || 'google'}`);
                return {
                    apiKey: keyData.api_key,
                    model: keyData.model || (keyData.provider === 'openai' ? 'gpt-4o' : 'gemini-1.5-flash'),
                    provider: keyData.provider || 'google', // Default to google for backward compatibility
                    baseUrl: keyData.base_url
                };
            }
        } catch (e) {
            console.warn(`[GenAIService] Failed to fetch custom key for user ${userId}, falling back to default. Error:`, e);
        }

        console.log(`[GenAIService] Using System Default for user ${userId}`);
        return { provider: 'google' };
    }

    // Unified Generation Method (Strategy Pattern)
    private async generateContentUnified(prompt: string, userId?: string): Promise<string> {
        const config = await this.getActiveConfig(userId);

        if (config.provider === 'openai') {
            return this.generateOpenAI(config, prompt);
        } else {
            return this.generateGoogle(config, prompt);
        }
    }

    // Google Implementation
    private async generateGoogle(config: AIConfig, prompt: string): Promise<string> {
        try {
            let model;
            if (config.apiKey) {
                const genAI = new GoogleGenerativeAI(config.apiKey);
                model = genAI.getGenerativeModel({
                    model: config.model || "gemini-1.5-flash",
                    safetySettings: this.getSafetySettings()
                });
            } else {
                model = this.defaultModel;
            }

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } catch (error) {
            logErrorToFile("Google Geneation Failed", error);
            throw error;
        }
    }

    // OpenAI Implementation
    private async generateOpenAI(config: AIConfig, prompt: string): Promise<string> {
        try {
            const openai = new OpenAI({
                apiKey: config.apiKey,
                baseURL: config.baseUrl || undefined // Optional base url
            });

            const completion = await openai.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: config.model || "gpt-4o",
            });

            return completion.choices[0].message.content || "";
        } catch (error) {
            logErrorToFile("OpenAI Generation Failed", error);
            throw error;
        }
    }


    async generateTestCases(requirements: string, userId?: string): Promise<string> {
        return this.generateContentUnified(`
        Act as a QA Engineer. Based on the following requirements, generate a list of structured test cases.
        For each test case, provide:
        - Test Scenario
        - Pre-conditions
        - Test Steps
        - Expected Result

        Requirements:
        "${requirements}"

        Format the output as a Markdown list.
        `, userId);
    }

    async summarizeBug(description: string, userId?: string): Promise<any> {
        const prompt = `
        Act as a QA Lead. Analyze the following verbose bug description/logs and generate a structured Bug Report.
        
        Bug Input:
        "${description}"

        Output format (JSON only):
        {
            "title": "Concise and Descriptive Bug Title",
            "description": "Professional summary of the issue",
            "stepsToReproduce": "Numbered list of reproduction steps inferred from input (e.g. 1. Step one 2. Step two)",
            "expectedResult": "What should happen",
            "actualResult": "What is actually happening",
            "severity": "Critical | High | Medium | Low",
            "priority": "P1 | P2 | P3 | P4"
        }
        `;

        const text = await this.generateContentUnified(prompt, userId);
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) return JSON.parse(jsonMatch[0]);
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON from AI response", text);
            throw new Error("Invalid JSON response from AI");
        }
    }

    async generateStructuredTestCase(prompt: string, userId?: string): Promise<any> {
        const systemPrompt = `
        Act as a Senior QA Automation Engineer.
        Your task is to generate a comprehensive SINGLE Test Case based on the user's description.
        You must strictly output VALID JSON that matches the following structure. Do not include markdown formatting or backticks.

        JSON Structure:
        {
            "module": "Suggest a module name based on context (e.g., Login, Checkout)",
            "testCaseId": "TC_AI_001", 
            "testScenario": "Brief one-line summary of the test",
            "testCaseDescription": "Detailed purpose of the test",
            "preConditions": "Numbered list of prerequisites (e.g., 1. User exists)",
            "testSteps": "Numbered list of steps (e.g., 1. Go to login page 2. Enter creds)",
            "testData": "Any user/input data needed (e.g. valid credentials)",
            "expectedResult": "Final success state description",
            "actualResult": "",
            "status": "Not Executed",
            "comments": "Generated by AI"
        }

        Rules:
        1. 'preConditions' and 'testSteps' MUST be plain text numbered lists. DO NOT use HTML tags like <ul> or <ol>.
        2. 'testCaseId' should be a placeholder like TC_GEN_01.
        
        User Prompt: "${prompt}"
        `;

        const text = await this.generateContentUnified(systemPrompt, userId);
        try {
            const jsonStart = text.indexOf('{');
            const jsonEnd = text.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
            }
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON from AI response", text);
            throw new Error("Invalid JSON response from AI");
        }
    }

    async generateBulkTestCases(prompt: string, userId?: string): Promise<any[]> {
        console.log("--> BACKEND: GenAIService generating BULK test cases, prompt len:", prompt.length);

        const systemPrompt = `
        Act as a Principal QA Engineer.
        Your task is to generate an EXHAUSTIVE and COMPREHENSIVE suite of test cases based on the user's detailed flow description.
        
        GOAL: Generate as many test cases as logically possible (target 20+ if the logic allows).
        OUTPUT FORMAT:
        You must strictly output a VALID JSON ARRAY of objects. 
        Do not include markdown formatting, backticks, or any explanation text outside the JSON.
        
        Each object in the array must match:
        {
            "module": "Inferred Module Name",
            "testCaseId": "TC_AI_AUTO_01", 
            "testScenario": "Summary of the test",
            "testCaseDescription": "Detailed purpose",
            "preConditions": "Numbered list (e.g. 1. Condition One)",
            "testSteps": "Numbered list (e.g. 1. Step One)",
            "testData": "Input data required",
            "expectedResult": "Expected outcome",
            "actualResult": "",
            "status": "Not Executed",
            "comments": "Auto-generated Type: [Type e.g., Negative/Edge]"
        }

        User Flow Description: "${prompt}"
        `;

        const text = await this.generateContentUnified(systemPrompt, userId);
        console.log("--> BACKEND: AI Response Length:", text.length);
        logResponseToFile("generateBulkTestCases Response", text);

        try {
            // Heuristic: OpenAI sometimes returns simple content, sometimes markdown. 
            // We need to find the array brackets.
            const jsonStart = text.indexOf('[');
            const jsonEnd = text.lastIndexOf(']');
            if (jsonStart !== -1 && jsonEnd !== -1) {
                return JSON.parse(text.substring(jsonStart, jsonEnd + 1));
            }
            return JSON.parse(text);
        } catch (error) {
            logErrorToFile("generateBulkTestCases Failed", error);
            console.error("Error generating bulk test cases:", error);
            throw new Error(`Failed to generate bulk test cases: ${(error as Error).message}`);
        }
    }

    async healSelector(htmlSnippet: string, oldSelector: string, errorMsg: string, userId?: string): Promise<string | null> {
        const prompt = `
        Act as a Test Automation Expert (Playwright).
        A test failed because the element with selector "${oldSelector}" was not found.
        
        Error Message: "${errorMsg}"
        
        Using the provided HTML Snippet of the current page state, identify the NEW selector for the element that most likely corresponds to the old one.
        Analyze attributes like id, class, name, text content, and structure.
        
        HTML Snippet:
        \`\`\`html
        ${htmlSnippet.substring(0, 15000)} 
        \`\`\`
        
        (Note: HTML is truncated to 15k chars to fit context window if large).

        OUTPUT FORMAT:
        Return ONLY the new selector string. Do not return JSON. Do not return Markdown. 
        If you cannot confidently find the element, return "null" (string).
        `;

        try {
            const text = (await this.generateContentUnified(prompt, userId)).trim();
            if (text.toLowerCase() === 'null') return null;
            return text.replace(/`/g, '').replace(/"/g, '').replace(/'/g, '');
        } catch (error) {
            logErrorToFile("healSelector Failed", error);
            console.error("Error healing selector:", error);
            return null;
        }
    }
}

export const genAIService = new GenAIService();
