const GEMINI_TIMEOUT_MS = 10_000;
const GEMINI_MODEL = "gemini-3.5-flash-lite";

const STORAGES = ["frigo", "placard", "congelateur"] as const;
type GeminiStorage = (typeof STORAGES)[number];
const DEFAULT_STORAGE: GeminiStorage = "placard";

export interface GeminiIngredient {
  name: string;
  present: boolean;
  storage: GeminiStorage;
}

export class GeminiTimeoutError extends Error {
  constructor() {
    super(`Gemini n'a pas répondu dans le délai de ${GEMINI_TIMEOUT_MS}ms`);
    this.name = "GeminiTimeoutError";
  }
}

export class GeminiNetworkError extends Error {
  constructor(cause: unknown) {
    super("Échec réseau lors de l'appel à Gemini", { cause });
    this.name = "GeminiNetworkError";
  }
}

export class GeminiHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`Gemini API a répondu avec le statut ${status}: ${body.slice(0, 500)}`);
    this.name = "GeminiHttpError";
  }
}

export class GeminiFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiFormatError";
  }
}

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      present: { type: "BOOLEAN" },
      storage: { type: "STRING", enum: STORAGES },
    },
    required: ["name", "present", "storage"],
  },
};

const SYSTEM_PROMPT =
  "Tu extrais une liste d'ingrédients de cuisine à partir d'une dictée vocale en français. " +
  "Pour chaque ingrédient mentionné, indique son nom (singulier, minuscule), s'il doit être marqué présent " +
  "(ajout au stock) ou absent (retrait du stock, ingrédient à racheter), et son lieu de rangement " +
  "(frigo, placard ou congelateur). Déduis le lieu de rangement de la dictée si elle le mentionne, " +
  "sinon choisis le plus plausible pour cet ingrédient. " +
  "Si la dictée ne mentionne aucun ingrédient, réponds avec un tableau vide.";

export async function callGemini(
  transcript: string,
  apiKey: string,
): Promise<GeminiIngredient[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    let response: Response;
    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: transcript }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema,
            },
          }),
        },
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new GeminiTimeoutError();
      }
      throw new GeminiNetworkError(error);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new GeminiHttpError(response.status, body);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new GeminiFormatError("Réponse Gemini vide ou mal formée");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new GeminiFormatError(
        `Réponse Gemini non-JSON: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (!Array.isArray(parsed)) {
      throw new GeminiFormatError("Réponse Gemini au format inattendu (tableau attendu)");
    }

    return parsed.map((item) => {
      const candidate = item as { name?: unknown; present?: unknown; storage?: unknown };
      if (typeof candidate.name !== "string" || typeof candidate.present !== "boolean") {
        throw new GeminiFormatError(
          `Élément Gemini au format inattendu: ${JSON.stringify(candidate)}`,
        );
      }
      const storage = STORAGES.includes(candidate.storage as GeminiStorage)
        ? (candidate.storage as GeminiStorage)
        : DEFAULT_STORAGE;
      return { name: candidate.name, present: candidate.present, storage };
    });
  } finally {
    clearTimeout(timeout);
  }
}
