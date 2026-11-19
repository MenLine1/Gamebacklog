export const STATUSES = ['Do ogrania', 'W trakcie', 'Ukończona', 'Wstrzymana'] as const;
export type GameStatus = typeof STATUSES[number];
export type Game = { id: string; title: string; publisher: string; platform: string; genre: string; releaseDate: string; status: GameStatus; playtime: number; completion: number; achievements: number; achievementTotal: number; favorite: boolean; accent: string; icon: string };
export type GameInput = Omit<Game, 'id'>;
