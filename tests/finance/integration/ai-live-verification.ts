import { getAIConfig } from "@/lib/ai/config";
import { OllamaProvider } from "@/lib/ai/providers/ollama";
import { isAIConfigured, checkAIAvailability, runAICompletion } from "@/lib/ai/provider";
import {
  formalizeText,
  improveWording,
  summarizeText,
  translateText,
  structureMeetingNotes
} from "../../../src/lib/ai/document-ai-service";
import { AIError } from "@/lib/ai/types";
import { z } from "zod";

async function runLiveVerification() {
  console.log("==================================================================");
  console.log("PHASE 8: LIVE VERIFICATION SUITE — LOCAL OLLAMA & QWEN2.5:7B");
  console.log("==================================================================\n");

  const results: Record<string, { status: "PASS" | "FAIL"; details: string; durationMs: number }> = {};

  // 1. CONFIGURATION & SANITIZATION CHECK
  {
    const start = Date.now();
    try {
      const config = getAIConfig();
      if (!config.enabled || config.provider !== "ollama" || !config.ollama.baseUrl || !config.ollama.model) {
        throw new Error(`Invalid config: ${JSON.stringify(config)}`);
      }
      results["1_CONFIG_CHECK"] = {
        status: "PASS",
        details: `Enabled: ${config.enabled}, Provider: ${config.provider}, BaseUrl: ${config.ollama.baseUrl}, Model: ${config.ollama.model}`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["1_CONFIG_CHECK"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 2. LIVE OLLAMA CONNECTIVITY & HEALTH CHECK
  {
    const start = Date.now();
    try {
      const provider = new OllamaProvider();
      const availability = await provider.checkAvailability();
      if (!availability.available) {
        throw new Error(`Ollama not available: ${availability.error}`);
      }
      if (!availability.modelFound) {
        throw new Error(`Model not found in list: ${JSON.stringify(availability.details?.models)}`);
      }
      results["2_CONNECTIVITY_AND_MODEL_CHECK"] = {
        status: "PASS",
        details: `Available: true, Target Model Found: ${availability.modelFound}, Models in Ollama: ${availability.details?.models?.join(", ")}`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["2_CONNECTIVITY_AND_MODEL_CHECK"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 3. REAL LIVE INFERENCE VIA AI PROVIDER ABSTRACTION (qwen2.5:7b)
  {
    const start = Date.now();
    try {
      const provider = new OllamaProvider();
      const response = await provider.generateText({
        system: "You are the administrative assistant of the Algerian football club ESH (Espoir Sidi Hosni). Respond in French.",
        prompt: "Confirme la devise du club en une seule phrase courte.",
        maxTokens: 100,
        temperature: 0.1
      });

      if (!response.text || response.text.trim().length === 0) {
        throw new Error("Empty text returned from Ollama");
      }
      if (response.model !== "qwen2.5:7b") {
        throw new Error(`Unexpected model in response: ${response.model}`);
      }

      results["3_REAL_INFERENCE_GENERATE_TEXT"] = {
        status: "PASS",
        details: `Model: ${response.model}, Provider: ${response.provider}, Output length: ${response.text.length} chars, Sample: "${response.text.trim().slice(0, 100)}..."`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["3_REAL_INFERENCE_GENERATE_TEXT"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 4. REAL LIVE STRUCTURED GENERATION WITH ZOD VALIDATION
  {
    const start = Date.now();
    try {
      const provider = new OllamaProvider();
      const matchReportSchema = z.object({
        competition: z.string(),
        homeTeam: z.string(),
        awayTeam: z.string(),
        keySummary: z.string()
      });

      const structured = await provider.generateStructured({
        system: "Extract structured match information into JSON.",
        prompt: "Match de Championnat Régionale 1: Espoir Sidi Hosni 2 - 1 JS Sig. Match intense, victoire arrachée en fin de rencontre.",
        schema: matchReportSchema,
        timeoutMs: 45000
      });

      if (!structured.homeTeam || !structured.awayTeam || !structured.keySummary) {
        throw new Error(`Malformed structured output: ${JSON.stringify(structured)}`);
      }

      results["4_REAL_STRUCTURED_GENERATION_ZOD"] = {
        status: "PASS",
        details: `Validated JSON: Home=${structured.homeTeam}, Away=${structured.awayTeam}, Competition=${structured.competition}`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["4_REAL_STRUCTURED_GENERATION_ZOD"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 5. DOCUMENT AI SERVICE INTEGRATION (formalizeText, improveWording, translateText)
  {
    const start = Date.now();
    try {
      const rawText = "le joeur a bien joué mais il est un peu fatigué et il faut repos";
      const formalized = await formalizeText(rawText);

      if (!formalized || formalized === rawText) {
        throw new Error(`formalizeText did not improve text or returned original: ${formalized}`);
      }

      results["5_DOCUMENT_AI_FORMALIZE"] = {
        status: "PASS",
        details: `Input: "${rawText}" -> Formalized: "${formalized.trim().slice(0, 120)}..."`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["5_DOCUMENT_AI_FORMALIZE"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 6. MULTILINGUAL ARABIC INFERENCE CHECK (Arabic administrative football phrasing)
  {
    const start = Date.now();
    try {
      const arPrompt = "أعد صياغة هذه الملاحظة بأسلوب إداري رسمي لنادي أمل سيدي حسني: 'اللاعب غاب عن الحصة التدريبية دون مبرر'";
      const result = await runAICompletion({
        system: "أنت المساعد الإداري لنادي أمل سيدي حسني (ESH). أجب باللغة العربية الرسمية فقط.",
        input: arPrompt,
        maxTokens: 150
      });

      if (!result || !/[\u0600-\u06FF]/.test(result)) {
        throw new Error(`Expected Arabic text output, received: ${result}`);
      }

      results["6_MULTILINGUAL_ARABIC_INFERENCE"] = {
        status: "PASS",
        details: `Arabic response verified: "${result.trim().slice(0, 120)}..."`,
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["6_MULTILINGUAL_ARABIC_INFERENCE"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 7. TIMEOUT ENFORCEMENT VERIFICATION
  {
    const start = Date.now();
    try {
      const provider = new OllamaProvider();
      // Set an impossibly short timeout of 1ms on real inference to verify timeout triggers cleanly
      let caughtTimeout = false;
      try {
        await provider.generateText({
          system: "You are a test assistant.",
          prompt: "Generate a 1000 word essay about football history.",
          timeoutMs: 1 // 1 millisecond timeout!
        });
      } catch (err: any) {
        if (err instanceof AIError && (err.code === "AI_TIMEOUT" || err.code === "AI_UNAVAILABLE")) {
          caughtTimeout = true;
        } else if (err.name === "TimeoutError" || err.message?.includes("timed out") || err.message?.includes("aborted")) {
          caughtTimeout = true;
        } else {
          throw err;
        }
      }

      if (!caughtTimeout) {
        throw new Error("1ms timeout was not triggered");
      }

      results["7_TIMEOUT_BEHAVIOR"] = {
        status: "PASS",
        details: "AI_TIMEOUT was cleanly caught and normalized when deadline expired",
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["7_TIMEOUT_BEHAVIOR"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    }
  }

  // 8. MODEL NOT FOUND BEHAVIOR (404 handling)
  {
    const start = Date.now();
    const origModel = process.env.OLLAMA_MODEL;
    try {
      process.env.OLLAMA_MODEL = "non-existent-model-xyz-999";
      const provider = new OllamaProvider();
      let caughtModelNotFound = false;
      try {
        await provider.generateText({
          system: "test",
          prompt: "test"
        });
      } catch (err: any) {
        if (err instanceof AIError && err.code === "AI_MODEL_NOT_FOUND") {
          caughtModelNotFound = true;
        }
      }

      if (!caughtModelNotFound) {
        throw new Error("AI_MODEL_NOT_FOUND was not raised for non-existent model");
      }

      results["8_MODEL_NOT_FOUND_HANDLING"] = {
        status: "PASS",
        details: "Clean AI_MODEL_NOT_FOUND raised with actionable remediation message",
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["8_MODEL_NOT_FOUND_HANDLING"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    } finally {
      if (origModel !== undefined) process.env.OLLAMA_MODEL = origModel;
      else delete process.env.OLLAMA_MODEL;
    }
  }

  // 9. AI DISABLED BEHAVIOR & GRACEFUL APPLICATION FALLBACK
  {
    const start = Date.now();
    const origEnabled = process.env.AI_ENABLED;
    try {
      process.env.AI_ENABLED = "false";
      const originalText = "Texte original préservé sans altération.";
      const result = await formalizeText(originalText);

      if (result !== originalText) {
        throw new Error(`When AI is disabled, original text must be preserved. Received: ${result}`);
      }

      results["9_AI_DISABLED_GRACEFUL_FALLBACK"] = {
        status: "PASS",
        details: "System gracefully degraded: returned original text with zero crashes or mutations",
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["9_AI_DISABLED_GRACEFUL_FALLBACK"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    } finally {
      if (origEnabled !== undefined) process.env.AI_ENABLED = origEnabled;
      else delete process.env.AI_ENABLED;
    }
  }

  // 10. UNREACHABLE OLLAMA SERVICE FALLBACK (Simulate service down)
  {
    const start = Date.now();
    const origUrl = process.env.OLLAMA_BASE_URL;
    try {
      process.env.OLLAMA_BASE_URL = "http://127.0.0.1:54321"; // dead port
      const originalText = "Rapport de réunion non modifié.";
      const result = await formalizeText(originalText);

      if (result !== originalText) {
        throw new Error(`When Ollama is unreachable, formalizeText must return original text. Received: ${result}`);
      }

      results["10_SERVICE_UNREACHABLE_FALLBACK"] = {
        status: "PASS",
        details: "Document AI caught connection refusal and seamlessly fell back to raw text",
        durationMs: Date.now() - start
      };
    } catch (e: any) {
      results["10_SERVICE_UNREACHABLE_FALLBACK"] = { status: "FAIL", details: e.message, durationMs: Date.now() - start };
    } finally {
      if (origUrl !== undefined) process.env.OLLAMA_BASE_URL = origUrl;
      else delete process.env.OLLAMA_BASE_URL;
    }
  }

  // PRINT SUMMARY
  console.log("\n=================== LIVE VERIFICATION RESULTS ===================");
  let allPassed = true;
  for (const [key, res] of Object.entries(results)) {
    const symbol = res.status === "PASS" ? "✅" : "❌";
    console.log(`${symbol} [${res.status}] ${key} (${res.durationMs}ms)`);
    console.log(`   -> ${res.details}`);
    if (res.status !== "PASS") allPassed = false;
  }
  console.log("=================================================================\n");

  if (allPassed) {
    console.log("FINAL OUTCOME: ALL 10 LIVE VERIFICATION CHECKS PASSED!");
    process.exit(0);
  } else {
    console.error("FINAL OUTCOME: ONE OR MORE LIVE CHECKS FAILED.");
    process.exit(1);
  }
}

runLiveVerification().catch((err) => {
  console.error("UNHANDLED CRITICAL FAILURE:", err);
  process.exit(1);
});
