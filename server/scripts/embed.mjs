// embed.mjs
import { MongoClient } from "mongodb";
import OpenAI from "openai";
import { readFileSync } from "fs";
const socJson = JSON.parse(readFileSync("./soc.json", "utf-8"));
const cpsJson = JSON.parse(readFileSync("./cps_available_codes.json", "utf-8"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const client = new MongoClient(process.env.DATABASE_URL);
const DB_NAME = process.env.DATABASE_NAME || "powertrace";

const BATCH_SIZE = 100; // OpenAI allows up to 2048 inputs per request

function toEmbedInput(entry) {
  // Richer text = better retrieval
  return `${entry.SOCTitle}. ${entry.SOCDefinition}`.trim();
}

async function embedAll() {
  await client.connect();
  const col = client.db(DB_NAME).collection("soc");
  const data = socJson.SOCGroups
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const inputs = batch.map(toEmbedInput);

    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs,
    });

    const docs = batch.map((entry, j) => ({
      ...entry,
      embedding: res.data[j].embedding, // 1536-dim float array
    }));

    await col.insertMany(docs);
    console.log(`Inserted ${i + batch.length} / ${data.length}`);
  }

  await client.close();
}

//embedAll();
function toEmbedInputCPS(entry) {
  // Richer text = better retrieval
  return `Census occupation code ${entry.occupation_code}. ${entry.occupation_text}`.trim();
}
async function embedAllCPS() {
  await client.connect();
  const col = client.db(DB_NAME).collection("cps");
  const data = cpsJson
  for (let i = 0; i < data.length; i += BATCH_SIZE) {
    const batch = data.slice(i, i + BATCH_SIZE);
    const inputs = batch.map(toEmbedInputCPS);

    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs,
    });

    const docs = batch.map((entry, j) => ({
      ...entry,
      embedding: res.data[j].embedding, // 1536-dim float array
    }));

    const ops = docs.map(item => ({
      updateOne: {
        filter: { occupation_code: item.occupation_code, type: item.type },
        update: { $set: { embedding: item.embedding } }
      }
    }));

    await col.bulkWrite(ops);

    console.log(`Inserted ${i + batch.length} / ${data.length}`);
  }

  await client.close();
}

//embedAllCPS();

// search.mjs
export async function findOccupations(col, userQuery, { group = null, k = 5 } = {}) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: userQuery,
  });
  const queryVector = res.data[0].embedding;

  const vectorStage = {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector,
      numCandidates: k * 10, // examine more, return top k
      limit: k,
      ...(group && { filter: { SOCGroup: group } }),
    },
  };

  return col.aggregate([
    vectorStage,
    {
      $project: {
        _id: 0,
        SOCCode: 1,
        SOCTitle: 1,
        SOCDefinition: 1,
        SOCGroup: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();
}

export async function findOccupationsCPS(col, userQuery, { type = 'le', k = 5 } = {}) {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: userQuery,
  });
  const queryVector = res.data[0].embedding;

  const vectorStage = {
    $vectorSearch: {
      index: "vector_index",
      path: "embedding",
      queryVector,
      numCandidates: k * 10, // examine more, return top k
      limit: k,
      ...(type && { filter: { type: type } }),
    },
  };

  return col.aggregate([
    vectorStage,
    {
      $project: {
        _id: 0,
        occupation_code: 1,
        occupation_text: 1,
        type: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]).toArray();
}

//const res = await findOccupations(client.db(DB_NAME).collection("soc"), "i create financial models for our company for projected cash flow, revenues and expenses. i have worked for 5 years.", {group: 'Detailed'})
//console.log(res)
const types = ['le', 'lu_wages', 'lu_coverage', 'lu_nonunion_wages'];

const results = Object.fromEntries(
  await Promise.all(
    types.map(async (type) => [
      type,
      await findOccupationsCPS(client.db(DB_NAME).collection("cps"), "i create financial models for our company for projected cash flow, revenues and expenses. i have worked for 5 years.", { type, k: 5 }),
    ])
  )
);
for (const [type, matches] of Object.entries(results)) {
  console.log(`\n--- ${type} ---`);
  console.log(matches);
}