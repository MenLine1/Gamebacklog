import { gameRepository, validateGameInput } from '@/lib/game-repository';

export const runtime = 'nodejs';

function databaseError(error: unknown) {
  console.error('GameBacklog API database error:', error);
  return Response.json(
    { error: error instanceof Error && error.message.startsWith('Brak MONGODB_URI')
      ? error.message
      : 'Nie udało się połączyć z MongoDB. Sprawdź konfigurację i czy serwer bazy działa.' },
    { status: 503 },
  );
}

export async function GET() {
  try {
    return Response.json(await gameRepository.list());
  } catch (error) {
    return databaseError(error);
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Treść żądania musi być poprawnym JSON-em.' }, { status: 400 });
  }

  if (!validateGameInput(body)) {
    return Response.json({ error: 'Dane gry są nieprawidłowe. Sprawdź wymagane pola, zakresy i osiągnięcia.' }, { status: 400 });
  }

  try {
    return Response.json(await gameRepository.create(body), { status: 201 });
  } catch (error) {
    return databaseError(error);
  }
}
