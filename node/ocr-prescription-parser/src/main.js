import { Client, Databases, ID, Storage } from "node-appwrite";
import { z } from "zod";

const DB = process.env.APPWRITE_DATABASE_ID || "medicine_support_hub";
const COL_RX = process.env.PRESCRIPTIONS_COLLECTION_ID || "prescriptions";
const COL_ITEMS = process.env.PRESCRIPTION_ITEMS_COLLECTION_ID || "prescription_items";
const BUCKET = process.env.APPWRITE_RX_BUCKET || "prescription-images";
const DISCLAIMER = "AI assistive only. Licensed pharmacist must verify.";

const InputSchema = z.object({
  imageId: z.string().optional(),
  image_id: z.string().optional(),
  user_id: z.string().optional(),
  userId: z.string().optional(),
  text: z.string().optional(),
  kind: z.string().optional(),
}).passthrough();

function json(res, status, body) {
  return res.json(body, status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function stubParse(rawText) {
  const lines = String(rawText || "").split(/[\n\r;]+/).map((l) => l.trim()).filter(Boolean).slice(0, 12);
  const medicines = [];
  for (const line of lines) {
    const dose = line.match(/(\d+\s?(?:mg|mcg|g|ml|IU)?)/i)?.[0] || "";
    const name = line.replace(dose, " ").replace(/[^\p{L}\p{N}\s\-_]/gu, " ").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name || name.length < 2) continue;
    medicines.push({ drug_name: name, dose, frequency: "", duration: "", confidence: name.length >= 4 && dose ? 0.72 : 0.55 });
  }
  if (!medicines.length) {
    medicines.push({ drug_name: String(rawText || "unreadable").slice(0, 60) || "unknown", dose: "", frequency: "", duration: "", confidence: 0.4 });
  }
  return medicines;
}

export default async ({ req, res, log, error }) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  try {
    const checked = InputSchema.safeParse(parseBody(req));
    if (!checked.success) return json(res, 400, { success: false, error: "Invalid input", disclaimer: DISCLAIMER });
    const p = checked.data;
    const imageId = p.imageId || p.image_id || "";
    const userId = p.user_id || p.userId || "";
    let text = String(p.text || "").trim();
    if (!text && !imageId) return json(res, 400, { success: false, error: "Provide { imageId } and/or { text }.", disclaimer: DISCLAIMER });

    const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT || process.env.APPWRITE_ENDPOINT;
    const project = process.env.APPWRITE_FUNCTION_PROJECT_ID || process.env.APPWRITE_PROJECT_ID;
    const key = process.env.APPWRITE_API_KEY || process.env.APPWRITE_FUNCTION_API_KEY;
    const client = endpoint && project && key ? new Client().setEndpoint(endpoint).setProject(project).setKey(key) : null;
    const db = client ? new Databases(client) : null;
    const storage = client ? new Storage(client) : null;

    if (!text && imageId && storage) {
      try {
        const meta = await storage.getFile(BUCKET, imageId);
        text = `Prescription image ${meta.name || imageId}`;
      } catch {
        text = `Prescription image ${imageId}`;
      }
    }

    const medicines = stubParse(text);
    let prescription_id = null;
    if (db) {
      const avg = medicines.reduce((s, m) => s + m.confidence, 0) / medicines.length;
      const rx = await db.createDocument(DB, COL_RX, ID.unique(), {
        user_id: userId, image_id: imageId, status: "parsed",
        ai_parsed_json: JSON.stringify(medicines), confidence_score: avg,
      });
      prescription_id = rx.$id;
      for (const m of medicines) {
        try {
          await db.createDocument(DB, COL_ITEMS, ID.unique(), {
            prescription_id: rx.$id, drug_name: m.drug_name, suggested_dose: m.dose,
            confidence: m.confidence, user_edited: false, status: "ai",
          });
        } catch (e) { log(String(e.message || e)); }
      }
    }

    return json(res, 200, { success: true, disclaimer: DISCLAIMER, prescription_id, medicines, parse_source: "stub" });
  } catch (err) {
    error(String(err.message || err));
    return json(res, 500, { success: false, error: String(err.message || err), disclaimer: DISCLAIMER });
  }
};
