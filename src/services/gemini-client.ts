const GEMINI_TIMEOUT_MS = 10_000;
const GEMINI_MODEL = "gemini-2.5-flash-lite";

export interface GeminiIngredient {
  name: string;
  present: boolean;
}

const responseSchema = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      name: { type: "STRING" },
      present: { type: "BOOLEAN" },
    },
    required: ["name", "present"],
  },
};

const SYSTEM_PROMPT =
  "Tu extrais une liste d'ingrédients de cuisine à partir d'une dictée vocale en français. " +
  "Pour chaque ingrédient mentionné, indique son nom (singulier, minuscule) et s'il doit être marqué présent " +
  "(ajout au stock) ou absent (retrait du stock, ingrédient à racheter). " +
  "Si la dictée ne mentionne aucun ingrédient, réponds avec un tableau vide.";

export async function callGemini(
  transcript: string,
  apiKey: string,
): Promise<GeminiIngredient[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
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

    if (!response.ok) {
      throw new Error(`Gemini API a répondu avec le statut ${response.status}`);
    }

    const payload = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Réponse Gemini vide ou mal formée");
    }

    const parsed = JSON.parse(text) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error("Réponse Gemini au format inattendu");
    }

    return parsed.map((item) => {
      const candidate = item as { name?: unknown; present?: unknown };
      if (typeof candidate.name !== "string" || typeof candidate.present !== "boolean") {
        throw new Error("Réponse Gemini au format inattendu");
      }
      return { name: candidate.name, present: candidate.present };
    });
  } finally {
    clearTimeout(timeout);
  }
}
