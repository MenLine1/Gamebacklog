import { MongoClient, type Collection } from 'mongodb';
import { demoGames } from '@/data/games';
import { STATUSES, type Game, type GameInput } from '@/types/game';

type GameDocument = Game;

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB ?? 'gamebacklog';

declare global {
  var gameBacklogMongoClient: Promise<MongoClient> | undefined;
  var gameBacklogMongoCollection: Promise<Collection<GameDocument>> | undefined;
}

async function collection(): Promise<Collection<GameDocument>> {
  if (!uri) throw new Error('Brak MONGODB_URI. Uzupełnij konfigurację MongoDB w pliku .env.local.');

  globalThis.gameBacklogMongoCollection ??= (async () => {
    globalThis.gameBacklogMongoClient ??= new MongoClient(uri).connect();
    let client: MongoClient;
    try {
      client = await globalThis.gameBacklogMongoClient;
    } catch (error) {
      globalThis.gameBacklogMongoClient = undefined;
      throw error;
    }
    const database = client.db(databaseName);
    const games = database.collection<GameDocument>('games');
    const seedState = database.collection<{ _id: string; initializedAt: Date }>('gamebacklog_meta');
    const seedId = 'demo-data-v1';

    if (!await seedState.findOne({ _id: seedId })) {
      if (await games.estimatedDocumentCount() === 0) {
        await games.insertMany(demoGames.map((game) => ({ ...game })));
      }
      await seedState.updateOne({ _id: seedId }, { $setOnInsert: { initializedAt: new Date() } }, { upsert: true });
    }

    return games;
  })();

  const pendingCollection = globalThis.gameBacklogMongoCollection;
  try {
    return await pendingCollection;
  } catch (error) {
    if (globalThis.gameBacklogMongoCollection === pendingCollection) {
      globalThis.gameBacklogMongoCollection = undefined;
    }
    throw error;
  }
}

export interface GameRepository {
  list(): Promise<Game[]>;
  create(input: GameInput): Promise<Game>;
  update(id: string, input: GameInput): Promise<Game | null>;
  remove(id: string): Promise<boolean>;
}

export const gameRepository: GameRepository = {
  async list() {
    return (await collection()).find({}, { projection: { _id: 0 } }).sort({ releaseDate: -1 }).toArray();
  },

  async create(input) {
    const game: Game = { ...input, id: crypto.randomUUID() };
    await (await collection()).insertOne(game);
    return game;
  },

  async update(id, input) {
    const games = await collection();
    const result = await games.findOneAndUpdate(
      { id },
      { $set: input },
      { returnDocument: 'after', projection: { _id: 0 } },
    );
    return result;
  },

  async remove(id) {
    const result = await (await collection()).deleteOne({ id });
    return result.deletedCount === 1;
  },
};

export function validateGameInput(value: unknown): value is GameInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  const allowedKeys = new Set(['title', 'publisher', 'platform', 'genre', 'releaseDate', 'status', 'playtime', 'completion', 'achievements', 'achievementTotal', 'favorite', 'accent', 'icon']);
  if (Object.keys(input).some((key) => !allowedKeys.has(key))) return false;
  const requiredStrings = ['title', 'publisher', 'platform', 'genre', 'releaseDate', 'accent', 'icon'];

  if (requiredStrings.some((key) => typeof input[key] !== 'string' || !(input[key] as string).trim())) return false;
  if (!STATUSES.includes(input.status as (typeof STATUSES)[number])) return false;
  if (typeof input.favorite !== 'boolean') return false;

  const numericFields = ['playtime', 'completion', 'achievements', 'achievementTotal'];
  if (numericFields.some((key) => typeof input[key] !== 'number' || !Number.isFinite(input[key]))) return false;
  if ((input.playtime as number) < 0 || (input.completion as number) < 0 || (input.completion as number) > 100) return false;
  if ((input.achievements as number) < 0 || (input.achievementTotal as number) < 0) return false;
  if ((input.achievements as number) > (input.achievementTotal as number)) return false;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.releaseDate as string)) return false;
  const parsedDate = new Date(`${input.releaseDate}T00:00:00.000Z`);
  return !Number.isNaN(parsedDate.valueOf()) && parsedDate.toISOString().slice(0, 10) === input.releaseDate;
}
