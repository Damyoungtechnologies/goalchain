import crypto from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
dotenv.config();

let firestore;

try {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
      })
    });
    firestore = getFirestore();
    console.log("Firebase Admin Initialized Successfully");
  } else {
    console.warn("No Firebase credentials found in .env! Database will not persist.");
  }
} catch (error) {
  console.error("Firebase Admin Initialization Error:", error);
}

const queryCache = new Map();
const CACHE_TTL_MS = 5000;

// Helper to run query
async function runQuery(colName, where) {
  if (!firestore) return [];
  
  const cacheKey = colName + JSON.stringify(where || {});
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  let query = firestore.collection(colName);
  if (where) {
    for (const [k, v] of Object.entries(where)) {
      query = query.where(k, '==', v);
    }
  }
  
  let data = [];
  try {
    const snapshot = await query.get();
    data = snapshot.docs.map(doc => doc.data());
  } catch (e) {
    console.error(`Firebase query error on ${colName}:`, e.message);
    if (cached) return cached.data;
    return [];
  }
  
  queryCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

export const db = {
  get user() {
    return {
      findUnique: async ({ where } = {}) => {
        const results = await runQuery('users', where);
        return results[0];
      },
      findMany: async ({ where } = {}) => {
        return await runQuery('users', where);
      },
      create: async ({ data }) => {
        if (!firestore) return data;
        const id = data.id || crypto.randomUUID();
        const newUser = { ...data, id, createdAt: new Date().toISOString() };
        await firestore.collection('users').doc(id).set(newUser);
        queryCache.clear();
        return newUser;
      },
      update: async ({ where, data }) => {
        if (!firestore) return;
        const results = await runQuery('users', where);
        if (results.length > 0) {
          const id = results[0].id;
          await firestore.collection('users').doc(id).set(data, { merge: true });
          queryCache.clear();
          return { ...results[0], ...data };
        }
      }
    }
  },
  get prediction() {
    return {
      findUnique: async ({ where } = {}) => {
        const results = await runQuery('predictions', where);
        return results[0];
      },
      findMany: async ({ where } = {}) => {
        return await runQuery('predictions', where);
      },
      create: async ({ data }) => {
        if (!firestore) return data;
        const id = data.id || crypto.randomUUID();
        const newPred = { ...data, id, createdAt: new Date().toISOString() };
        await firestore.collection('predictions').doc(id).set(newPred);
        queryCache.clear();
        return newPred;
      },
      update: async ({ where, data }) => {
        if (!firestore) return;
        const results = await runQuery('predictions', where);
        if (results.length > 0) {
          const id = results[0].id;
          await firestore.collection('predictions').doc(id).set(data, { merge: true });
          queryCache.clear();
          return { ...results[0], ...data };
        }
      }
    }
  },
  get transaction() {
    return {
      create: async ({ data }) => {
        if (!firestore) return data;
        const id = data.id || crypto.randomUUID();
        const newTx = { ...data, id, createdAt: new Date().toISOString() };
        await firestore.collection('transactions').doc(id).set(newTx);
        queryCache.clear();
        return newTx;
      }
    }
  },
  get market() {
    return {
      findMany: async ({ where } = {}) => {
        return await runQuery('markets', where);
      },
      create: async ({ data }) => {
        if (!firestore) return data;
        const id = data.id || crypto.randomUUID();
        const newMarket = { ...data, id, createdAt: new Date().toISOString() };
        await firestore.collection('markets').doc(id).set(newMarket);
        queryCache.clear();
        return newMarket;
      },
      update: async ({ where, data }) => {
        if (!firestore) return;
        const results = await runQuery('markets', where);
        if (results.length > 0) {
          const id = results[0].id;
          await firestore.collection('markets').doc(id).set(data, { merge: true });
          queryCache.clear();
          return { ...results[0], ...data };
        }
      }
    }
  },
  get fixture() {
    return {
      findUnique: async ({ where } = {}) => {
        const results = await runQuery('fixtures', where);
        return results[0];
      },
      findMany: async ({ where } = {}) => {
        return await runQuery('fixtures', where);
      },
      upsert: async ({ where, update, create }) => {
        if (!firestore) return;
        const results = await runQuery('fixtures', where);
        if (results.length > 0) {
          const id = results[0].id || String(results[0].FixtureId);
          const docId = String(id);
          await firestore.collection('fixtures').doc(docId).set(update, { merge: true });
          queryCache.clear();
          return { ...results[0], ...update };
        } else {
          const id = create.id || String(create.FixtureId) || crypto.randomUUID();
          const docId = String(id);
          const newFixture = { ...create, id: docId, createdAt: new Date().toISOString() };
          await firestore.collection('fixtures').doc(docId).set(newFixture);
          queryCache.clear();
          return newFixture;
        }
      }
    }
  }
}
