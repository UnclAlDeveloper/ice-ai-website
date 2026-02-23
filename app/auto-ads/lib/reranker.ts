import {AutoTokenizer, AutoModelForSequenceClassification, PreTrainedTokenizer, PreTrainedModel, Tensor} from "@huggingface/transformers";

const MODEL_NAME = "jinaai/jina-reranker-v1-tiny-en";

// RERANK RESULT
export interface RerankResult {
    /**
     * Represents a single reranked item with its original index and relevance score.
     */

    index: number;
    score: number;
}

// SINGLETON MODEL CACHE
let cachedTokenizer: PreTrainedTokenizer | null = null;
let cachedModel: PreTrainedModel | null = null;
let loadingPromise: Promise<void> | null = null;

// BATCH SIZE
const BATCH_SIZE = 8;

// SCORE CUTOFF
const SCORE_CUTOFF = -1;

// LOAD MODEL
async function loadModel(): Promise<void> {
    /**
     * Downloads and caches the Jina cross-encoder model and tokenizer.
     * Uses a singleton promise to prevent multiple concurrent loads.
     * Model supports up to 8K tokens via ALiBi positional encoding.
     */

    if (cachedTokenizer && cachedModel) return;

    if (loadingPromise) {
        await loadingPromise;
        return;
    }

    loadingPromise = (async () => {
        const mem = process.memoryUsage();
        console.log(`[RERANKER] Loading model: ${MODEL_NAME} | rss: ${(mem.rss / 1024 / 1024).toFixed(1)}MiB | heap: ${(mem.heapUsed / 1024 / 1024).toFixed(1)}MiB`);
        const startTime = Date.now();

        cachedTokenizer = await AutoTokenizer.from_pretrained(MODEL_NAME);
        const tokenizerMem = process.memoryUsage();
        console.log(`[RERANKER] Tokenizer loaded | rss: ${(tokenizerMem.rss / 1024 / 1024).toFixed(1)}MiB | heap: ${(tokenizerMem.heapUsed / 1024 / 1024).toFixed(1)}MiB`);

        cachedModel = await AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, {
            dtype: "fp32",
        });

        const elapsed = Date.now() - startTime;
        const modelMem = process.memoryUsage();
        console.log(`[RERANKER] Model loaded in ${elapsed}ms | rss: ${(modelMem.rss / 1024 / 1024).toFixed(1)}MiB | heap: ${(modelMem.heapUsed / 1024 / 1024).toFixed(1)}MiB`);
    })();

    await loadingPromise;
}

// RERANK
export async function rerank(query: string, documents: string[], topK: number): Promise<RerankResult[]> {
    /**
     * Scores each document against the query using the cross-encoder model,
     * then returns the top K results sorted by descending relevance score.
     * Documents with a logit score below SCORE_CUTOFF are excluded.
     */

    if (documents.length === 0) return [];

    await loadModel();

    if (!cachedTokenizer || !cachedModel) {
        throw new Error("Reranker model failed to load");
    }

    // score query-document pairs in batches for faster inference
    const scores: number[] = [];
    const totalDocs = documents.length;
    console.log(`[RERANKER] Scoring ${totalDocs} documents in batches of ${BATCH_SIZE}`);
    const scoringStartTime = Date.now();

    for (let batchStart = 0; batchStart < totalDocs; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, totalDocs);
        const batchDocs = documents.slice(batchStart, batchEnd);
        const batchQueries = Array(batchDocs.length).fill(query);

        // tokenize the full batch at once
        const inputs = cachedTokenizer(batchQueries, {
            text_pair: batchDocs,
            padding: true,
            truncation: true,
            max_length: 2048,
            return_tensors: "pt",
        });

        const output = await cachedModel(inputs);

        // extract relevance scores from batch logits
        const logits = output.logits as Tensor;
        for (let j = 0; j < batchDocs.length; j++) {
            scores.push(logits.data[j] as number);
        }

        // log progress after each batch
        const mem = process.memoryUsage();
        console.log(`[RERANKER] Scored ${batchEnd}/${totalDocs} | rss: ${(mem.rss / 1024 / 1024).toFixed(1)}MiB | elapsed: ${Date.now() - scoringStartTime}ms`);
    }

    // build results with indices, sort by score descending, discard below cutoff, take top K
    return scores
        .map((score, index) => ({index, score}))
        .sort((a, b) => b.score - a.score)
        .filter((r) => r.score >= SCORE_CUTOFF)
        .slice(0, topK);
}

// Re-export for convenience; prefer importing from buildDocumentText for pages that only need document building.
export {buildDocumentText} from "./buildDocumentText";
