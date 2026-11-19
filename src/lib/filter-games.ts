import type { Game } from '@/types/game';
export type GameFilters = { query: string; platform: string; genre: string; status: string; favorites: boolean; completionMin: number; completionMax: number; achievementMin: number; achievementMax: number; sort: string };
export function filterGames(games: Game[], f: GameFilters): Game[] {
  return games.filter(g => {
    const achievementProgress = g.achievementTotal ? Math.round(g.achievements / g.achievementTotal * 100) : 0;
    return (!f.query || g.title.toLocaleLowerCase('pl').includes(f.query.toLocaleLowerCase('pl')))
      && (!f.platform || g.platform === f.platform) && (!f.genre || g.genre === f.genre) && (!f.status || g.status === f.status)
      && (!f.favorites || g.favorite) && g.completion >= f.completionMin && g.completion <= f.completionMax
      && achievementProgress >= f.achievementMin && achievementProgress <= f.achievementMax;
  }).sort((a,b) => f.sort === 'title' ? a.title.localeCompare(b.title,'pl') : f.sort === 'completion' ? b.completion-a.completion : f.sort === 'playtime' ? b.playtime-a.playtime : b.releaseDate.localeCompare(a.releaseDate));
}
