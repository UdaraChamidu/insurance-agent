Please review this and let me know what you think RAG implementation: This reflects the “speed-first but compliant” approach: SharePoint sync (not runtime fetch), hybrid search (keyword+vector), intent-card routing instead of an LLM router, soft stage boosting, citations, audit logs, and strict privacy.



# 1) Data sources & environments



## 1.1 Knowledge sources



Only the following are indexed into RAG:



* Florida law/reg guidance (DFS/OIR)
* CMS Medicare marketing/comms guidance + models
* Federal ACA/HHS references
* ERISA/DOL/IRS references (if selling self-funded)
* Carrier/FMO manuals
* Internal SOPs / playbooks / scripts (compliance-reviewed)



## 1.2 Customer data separation

Customer PII/PHI must never be embedded into the vector DB.
Customer context is passed as non-PII flags only:

* product_universe
* state
* channel (EDE vs Healthcare.gov)
* age_band (<65/65+)
* event_flags (moved/lost coverage/turning 65)
* carrier (optional)



All raw customer info remains in CRM/DB and is redacted before any LLM call.



## 1.3 DEV vs PROD



* DEV uses KB-DEV + dev keys
* PROD uses KB-PROD + prod keys
* No dev access to PROD docs, recordings, transcripts



---



# 2) The “SharePoint sync, don’t fetch” rule (must implement)



SharePoint is never queried live during a call.
SharePoint is slow/throttled. We sync it to our own fast stores.



## 2.1 Sync pipeline (every 5–15 minutes)



Build a job that:



1. Enumerates SharePoint library files (KB-DEV / KB-PROD)
2. Detects changes using etag/lastModified
3. Downloads changed/new files only
4. Extracts text
5. Chunks + metadata
6. Updates:



* Object storage (original file)
* Postgres (document registry + extracted text + chunks)
* Vector DB (embeddings)
* Keyword index (BM25)
7. Writes back an ingestion manifest to SharePoint under /ingestion_artifacts/ (optional)



## 2.2 Required sync outputs



### A) documents table (Postgres)



Fields:



* doc_id (SharePoint file unique ID)
* doc_title
* sharepoint_url
* etag
* last_modified
* doc_version (SharePoint etag or DocVersion column)
* state
* product_universe
* regulator
* authority_level
* doc_type
* carrier
* effective_date
* topic_tags
* process_stage_default (optional)



### 😎 chunks table (Postgres)



Fields:



* chunk_id (stable)
* doc_id
* chunk_index
* text
* section_path (e.g., “Medicare > Marketing > Disclaimers”)
* page_start, page_end (if PDF)
* created_at
* hash (content hash)
* plus the metadata fields duplicated or referenced



### C) Vector index



Store:



* chunk_id as primary key
* embedding vector
* metadata for filtering (see Section 3)



### D) Keyword index (BM25)



Index the same chunk text with the same metadata fields.



---



# 3) Metadata schema (mandatory for safe retrieval)



Each chunk must include at least:



## 3.1 Hard routing filters



* state = FL
* product_universe = one of:



* Medicare, ACA, Medigap, Group_FI, SelfFunded_ERISA, MEWA, Medicaid, Ancillary, LTC, STM, General
* regulator = CMS, FL-DFS/OIR, HHS, DOL, IRS, Carrier, FMO
* authority_level =



* Law, Regulation, Guidance, CarrierPolicy, FMOPolicy, TrainingReference, InternalSOP
* doc_type =



* Regulation, Manual, Playbook, Script, Checklist, FAQ, Training



## 3.2 Optional but strongly recommended



* process_stage = Intake, Eligibility, Quote, Enrollment, PostEnroll, Appeals
* carrier (UHC, etc.)
* effective_date
* doc_version
* citation_prefix (from SharePoint column if used)



Important: Stage must be a soft boost in ranking, not a hard filter.



---



# 4) Chunking rules (“citation-grade”)



## 4.1 Chunk by structure



Chunk by headings and numbered sections. Preserve:



* section title path
* clause numbering
* form IDs
* CFR/USC references



## 4.2 Size targets



* 350–900 tokens per chunk
* overlap 50–120 tokens



## 4.3 Stable chunk IDs



Chunk IDs must be deterministic so citations don’t drift.



Recommended chunk ID:
hash(doc_id + section_path + page_start + chunk_index + content_hash_prefix)



Store content_hash separately for change detection.



---



# 5) Retrieval modifications (speed-first + compliant)



## 5.1 Use “Intent Cards” instead of an LLM router



We do not run an LLM router on every turn.



### Build an Intent Card index



Create 30–80 macro intents (“skeleton taxonomy”) as small JSON/text entries, e.g.:



* ACA_SEP_MOVE
* ACA_APTC_CSR
* ACA_APPEAL_STEPS
* MEDICARE_ENROLLMENT_PERIODS
* MEDICARE_MARKETING_DISCLAIMERS
* MEDIGAP_GI_RIGHTS
* FL_RECORDING_CONSENT
* FL_ADVERTISING_DO_DONTS
* CARRIER_ENROLLMENT_STEPS



Each intent card contains:



* intent_id
* product_universe
* primary_regulators
* required_disclaimers
* must_ask_questions
* escalation_triggers
* preferred_doc_types (playbook, guidance, law)
* keywords (exact tokens)
* description



Store these in:



* either a small vector index (intent embeddings) and/or keyword list



### Runtime routing



Given a user query + transcript snippet:



1. Run vector match against intent cards (top 3)
2. Also run keyword triggers:



* If query contains 1095-A, APTC, SEP, AEP, OEP, 42 CFR, etc., boost matching intents
3. Pick top intent if confidence high; else return clarifying questions.



This replaces the slow LLM router.



## 5.2 Hybrid retrieval (keyword + vector) inside routed universe



For the selected intent:



1. Build metadata filter:



* state=FL
* product_universe=intent.product_universe
* optionally regulator in intent.primary_regulators
* optionally doc_type in preferred_doc_types
2. Run retrieval in parallel:



* Vector topK=30
* Keyword topK=30 (BM25)
3. Fusion:



* default 50/50
* if query has exact tokens/codes, weight keyword 70%
4. Deduplicate by chunk_id
5. Optional rerank (recommended)
6. Select top 6–10 chunks



## 5.3 Reranker (recommended for accuracy)



After fusion:



* rerank top 30–40 chunks with a cross-encoder
* keep top 6–10



If reranker not available initially:



* ship without it, but leave a clean interface to add later.



## 5.4 Stage as boost, not filter



If conversation state indicates stage (Enrollment, Appeals, etc.):



* apply a ranking boost to chunks tagged with that stage
* do NOT exclude others



---



# 6) Generation rules (output format + compliance gating)



## 6.1 Strict output template



Always output:



1. Read-back (2–4 sentences)
2. Ask next (3 bullets)
3. Internal Do/Don’t (1–3 bullets)
4. Citations (each with doc title + section/page + version/date)
5. Escalate if (list triggers or “None”)



## 6.2 Evidence gating



If retrieval returns weak evidence:



* do not answer
* output:



* “Need to verify”
* top 2 clarifying questions
* what doc category is missing



### Evidence confidence calculation



Compute a confidence score from:



* reranker score (if present)
* number of sources with direct match
* presence of required exact tokens (if query had them)



If below threshold -> verify/escalate.



## 6.3 Disclaimers must be deterministic



Create a disclaimer library (local, versioned):



* FL recording consent script
* Medicare marketing disclaimers (as applicable)
* general informational disclaime
* carrier-specific required statements



The model chooses disclaimers by intent + universe (not by free generation).



---



# 7) Privacy & security modifications (must implement)



## 7.1 Redaction before LLM



Before sending transcript text to LLM:



* redact phone/email/address/DOB/SSN/member ID/name
* replace with tokens: [PHONE] [EMAIL] [DOB] [SSN] [ID] [NAME]



LLM gets:



* non-PII context flags
* redacted transcript snippet
* retrieved evidence chunks



## 7.2 Audit logs



Log every assist event:



* timestamp
* session ID
* router output (intent + confidence)
* filters used
* retrieved chunk IDs + scores
* final answer shown
* citations shown
* agent disposition



This log is required for QA and compliance defense.



---



# 😎 Performance modifications (live usability)



## 8.1 Progressive response UI



To avoid “dead air”:



* return immediate output:



* “Ask next questions” + “safe holding line” (within ~1s)
* then update with full citations answer (within ~2–4s)



## 8.2 Prompt budget control



Never send:



* full documents
* too many chunks



Hard cap:



* 6–10 chunks
* max token context budget



---



# 9) Testing & QA requirements



## 9.1 Test suite



Build a test set of 200–500 queries:



* codes: 1095-A, SEP, AEP/OEP
* appeals steps
* Medicare marketing restrictions
* Florida advertising rules
* carrier policy exceptions



Measure:



* correct universe routing
* correct doc retrieval
* citation correctness
* verify/escalate correctness



## 9.2 Weekly QA loop



Sample calls → identify misses → update:



* playbooks
* intent cards
* metadata tagging
* re-sync and reindex



---



# 10) Delivery milestones (build order)



1. SharePoint sync → Postgres document registry + chunk store
2. Vector indexing (Pinecone) with metadata filters
3. Keyword BM25 index with same metadata filters
4. Intent card router + confidence + clarifying questions
5. Hybrid retrieval + fusion
6. Strict output template + citations + evidence gating
7. Redaction layer
8. Audit log
9. Progressive UI update
10. Add reranker (optional but ideal)



---



## What you should tell the developer (copy/paste)



Implement RAG with: SharePoint sync pipeline (no live SharePoint queries), citation-grade chunking + stable chunk IDs, mandatory metadata filters (state + universe + authority), hybrid retrieval (BM25 + vector) with fusion and optional reranker, “intent cards” as a fast router instead of LLM router, stage as ranking boost not filter, strict response template with citations + verify/escalate gating, PII redaction before any LLM call, and full audit logs.



---



If you tell me what the developer chose for:



* vector DB (Pinecone/Qdrant/etc.)

* keyword search (OpenSearch/Postgres FTS/etc.)

* backend language (Python/Node)