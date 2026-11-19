import { gameRepository, validateGameInput } from '@/lib/game-repository';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ id: string }> };

function databaseError(error: unknown) {
  console.error('GameBacklog API database error:', error);
  return Response.json(
    { error: error instanceof Error && error.message.startsWith('Brak MONGODB_URI')
      ? error.message
      : 'Nie udało się połączyć z MongoDB. Sprawdź konfigurację i czy serwer bazy działa.' },
    { status: 503 },
  );
}

export async function PUT(request: Request, { params }: RouteContext) {
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
    const { id } = await params;
    const game = await gameRepository.update(id, body);
    return game ? Response.json(game) : Response.json({ error: 'Nie znaleziono gry.' }, { status: 404 });
  } catch (error) {
    return databaseError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    return await gameRepository.remove(id)
      ? new Response(null, { status: 204 })
      : Response.json({ error: 'Nie znaleziono gry.' }, { status: 404 });
  } catch (error) {
    return databaseError(error);
  }
}
