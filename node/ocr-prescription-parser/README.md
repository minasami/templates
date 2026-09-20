# ⚡ OCR Prescription & Invoice Parser

Parse a prescription or pharmacy invoice from pasted text or an Appwrite Storage file id. Optional on-device OCR text can be sent as `text`.

Assistive only. A licensed pharmacist or the patient must confirm items before any order.

Reference implementation: [medicine-support-hub](https://github.com/minasami/medicine-support-hub).

## 🧰 Usage

### POST /

| Name | Description | Location | Type | Sample |
| --- | --- | --- | --- | --- |
| imageId | Storage file id | Body | String | `64f…` |
| text | Pre-extracted OCR | Body | String | `Augmentin 1g BID` |
| user_id | Owner user id | Body | String | `64a…` |
| kind | `prescription` or `invoice` | Body | String | `invoice` |

**200**

```json
{ "success": true, "prescription_id": "…", "confidence_score": 0.82 }
```

**400**

```json
{ "success": false, "error": "Provide { imageId } and/or { text } and/or image payload." }
```

## ⚙️ Configuration

| Setting | Value |
| --- | --- |
| Runtime | Node.js 20 |
| Entrypoint | src/main.js |
| Build Commands | npm install |
| Permissions | users |
| Timeout (Seconds) | 30 |
| Scopes | databases.read, databases.write, storage.read, users.read |

## 🔒 Environment Variables

### APPWRITE_DATABASE_ID

Database that holds `prescriptions` and `prescription_items`.

| Question | Answer |
| --- | --- |
| Required | Yes |
| Sample Value | medicine_support_hub |

### APPWRITE_RX_BUCKET

| Question | Answer |
| --- | --- |
| Required | No |
| Sample Value | prescription-images |

### APPWRITE_API_KEY

| Question | Answer |
| --- | --- |
| Required | Yes |
| Sample Value | standard_… |

### VERTEX_ACCESS_TOKEN

Optional Vertex / MedGemma parse. Stub parser runs when unset.
