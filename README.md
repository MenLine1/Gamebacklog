# GameBacklog

Prosta aplikacja do prowadzenia biblioteki gier. Next.js obsługuje interfejs i API, a MongoDB przechowuje dane. Lokalnie aplikację i bazę można uruchomić przez Docker Compose.

## Wymagania

- Node.js 20.19+ lub 22.13+ oraz npm.
- Działająca instancja MongoDB 6.0+ przy uruchomieniu bez kontenerów.
- Docker Desktop z włączonym silnikiem Linux containers, jeśli korzystasz z Docker Compose.

## Konfiguracja MongoDB w Windows PowerShell

1. Uruchom lokalną usługę MongoDB albo użyj własnej instancji.
2. Utwórz lokalny plik konfiguracyjny na podstawie przykładu:

   ```powershell
   Copy-Item .env.example .env.local
   ```

3. W razie potrzeby zmień `MONGODB_URI` i `MONGODB_DB` w `.env.local`. Nie wpisuj haseł do kodu ani nie dodawaj `.env.local` do repozytorium.

Przykładowa konfiguracja wskazuje na lokalny serwer MongoDB pod `mongodb://127.0.0.1:27017` i bazę `gamebacklog`.

## Uruchomienie lokalne

```powershell
npm install
npm run dev
```

Otwórz <http://localhost:3000>. Do uruchomienia produkcyjnego użyj `npm run build`, a następnie `npm start`.

## Uruchomienie przez Docker Desktop

Upewnij się, że Docker Desktop działa. Zatrzymaj lokalne `npm run dev`, jeśli zajmuje port `3000`, a następnie w PowerShell uruchom:

```powershell
docker compose up --build --detach
docker compose ps
```

Otwórz <http://localhost:3000>. Compose buduje produkcyjny obraz Next.js i uruchamia osobny kontener MongoDB. Aplikacja w Compose korzysta z tej lokalnej bazy pod nazwą hosta `mongodb`; `.env.local` z ustawieniami Atlas jest wykluczony z obrazu i nie jest używany przez Compose. Lokalny klaster Atlas i baza w Compose są odrębnymi bazami danych.

Jeśli port `3000` jest już zajęty, uruchom Compose na innym porcie hosta, np. `3001`:

```powershell
$env:APP_PORT = "3001"
docker compose up --build --detach
Remove-Item Env:APP_PORT
```

Wtedy aplikacja będzie pod <http://localhost:3001>.

### Codzienna obsługa kontenerów

- Uruchom lub zbuduj aplikację i bazę: `docker compose up --build --detach`.
- Sprawdź stan kontenerów: `docker compose ps`.
- Śledź logi: `docker compose logs --follow`. Zakończenie podglądu przez `Ctrl+C` nie zatrzymuje kontenerów.
- Zatrzymaj kontenery, zachowując je i dane: `docker compose stop`.
- Wznów zatrzymane kontenery: `docker compose start`.
- Usuń kontenery i sieć, ale zachowaj bazę: `docker compose down`. Później uruchom ponownie przez `docker compose up --build --detach`.

Do zwykłego wyłączenia używaj `docker compose stop` albo `docker compose down`. **Nie dodawaj `--volumes`**, jeśli chcesz zachować gry. Polecenie `docker compose down --volumes` (bez spacji między `--` i `volumes`) usuwa także wolumen MongoDB wraz z zapisanymi danymi. Po takim usunięciu aplikacja utworzy bazę od nowa i wstawi 21 gier demonstracyjnych.

Jeśli uruchamiasz równocześnie `npm run dev`, zatrzymaj jeden wariant przed startem drugiego, bo oba domyślnie używają portu `3000`.

## Uruchomienie w Kubernetes (Minikube)

Głównym profilem aplikacji jest `gamebacklog`. Uruchamia Next.js i MongoDB. Profil korzysta z Calico, dzięki czemu polityki z `k8s/policies.yaml` są egzekwowane. Nie twórz nowego profilu do zwykłego uruchomienia.

Wymagane: Docker Desktop z uruchomionym silnikiem Linux, Minikube i kubectl. Domyślny CNI kindnet nie egzekwuje NetworkPolicy. Profil `gamebacklog` utworzono więc od początku z Calico. Nie da się bezpiecznie przełączyć działającego klastra kindnet na Calico samym ponownym `minikube start --cni=calico`; zmiana CNI wymaga odtworzenia profilu i wcześniejszego zabezpieczenia danych z PVC.

W Minikube 1.39.0 z Docker Desktop potrzebne są poniższe poprawki wygenerowanego DaemonSetu Calico: jego obraz próbował montować niedostępny `securityfs`, a kernel WSL2 nie obsługiwał wykrytej funkcji nftables. Backend iptables Calico został przypięty do `nft`, aby zgadzał się z backendem kube-proxy. Wykonaj je po utworzeniu czystego profilu, przed wdrożeniem aplikacji:

```powershell
minikube start -p gamebacklog --driver=docker --cni=calico
kubectl --context=gamebacklog -n kube-system patch daemonset calico-node --type=json -p='[{"op":"remove","path":"/spec/template/spec/containers/0/volumeMounts/7"},{"op":"remove","path":"/spec/template/spec/volumes/6"}]'
kubectl --context=gamebacklog -n kube-system set env daemonset/calico-node FELIX_NFTABLESMODE=Disabled FELIX_FEATUREDETECTOVERRIDE=NFTablesSupported=false FELIX_IPTABLESBACKEND=nft
kubectl --context=gamebacklog -n kube-system rollout status daemonset/calico-node --timeout=240s
minikube addons enable ingress -p gamebacklog
```

Weryfikacja z 19 listopada 2026 r.: cztery NetworkPolicy znajdują się w namespace `gamebacklog`; aplikacja i MongoDB działają `1/1`, PVC ma stan `Bound`, żądanie API przez Ingress zwraca HTTP 200 i 22 gry. Połączenie z MongoDB z testowego poda w namespace `default` zostało zablokowane. To sprawdza zarówno ruch dozwolony, jak i blokowany.

### Uruchomienie istniejącego klastra

```powershell
minikube start -p gamebacklog
kubectl config use-context gamebacklog
kubectl --context=gamebacklog get nodes,pods,pvc,services,ingress -A
```

Przy pierwszym wdrożeniu lub po odtworzeniu klastra przygotuj lokalny plik Secret. Hasło nie może trafić do GitHub ani do obrazu kontenera:

```powershell
Copy-Item .\k8s\mongodb-secret.env.example .\k8s\mongodb-secret.env
notepad .\k8s\mongodb-secret.env
```

Zmień przykładowe hasło na własne alfanumeryczne. Następnie zbuduj i załaduj obraz, utwórz Secret i zastosuj manifesty:

```powershell
docker compose build app
minikube image load gamebacklog:local -p gamebacklog
kubectl --context=gamebacklog create namespace gamebacklog --dry-run=client -o yaml | kubectl --context=gamebacklog apply -f -
kubectl --context=gamebacklog create secret generic gamebacklog-mongodb -n gamebacklog --from-env-file=.\k8s\mongodb-secret.env --dry-run=client -o yaml | kubectl --context=gamebacklog apply -f -
kubectl --context=gamebacklog apply -k .\k8s
kubectl --context=gamebacklog rollout status statefulset/mongodb -n gamebacklog --timeout=180s
kubectl --context=gamebacklog rollout status deployment/gamebacklog -n gamebacklog --timeout=180s
kubectl --context=gamebacklog get pods,pvc,services,ingress,networkpolicy,resourcequota,limitrange -n gamebacklog
```

Manifesty obejmują Deployment aplikacji, StatefulSet MongoDB, PVC 2 GiB, Services, Ingress, ConfigMap, Secret, NetworkPolicy, ResourceQuota i LimitRange. Po zmianie aplikacji ponownie zbuduj i załaduj obraz, a potem wykonaj `kubectl --context=gamebacklog rollout restart deployment/gamebacklog -n gamebacklog`.

### Dostęp do aplikacji

Przekierowanie portu Service uruchom w osobnym oknie PowerShell:

```powershell
kubectl --context=gamebacklog port-forward --address 127.0.0.1 -n gamebacklog service/gamebacklog 18081:80
```

Otwórz <http://localhost:18081>. Przekierowanie kończy się po `Ctrl+C`.

Do testu Ingress uruchom:

```powershell
kubectl --context=gamebacklog port-forward --address 127.0.0.1 -n ingress-nginx service/ingress-nginx-controller 18080:80
curl.exe -i -H "Host: gamebacklog.local" http://127.0.0.1:18080/api/games
```

Oczekiwany kod API to HTTP 200. Pole `ADDRESS` w `kubectl get ingress` może być puste; test z nagłówkiem `Host` przez port-forward nadal sprawdza regułę Ingress.

### Test polityk NetworkPolicy

Lista czterech wdrożonych polityk:

```powershell
kubectl --context=gamebacklog get networkpolicy -n gamebacklog
```

Dozwolony ruch aplikacji do MongoDB sprawdź przez API aplikacji. Uruchom przekierowanie do Service opisane wyżej, a w drugim oknie PowerShell wykonaj:

```powershell
$games = Invoke-RestMethod -Uri "http://127.0.0.1:18081/api/games"
"HTTP 200; liczba gier: $($games.Count)"
```

Oczekiwany wynik to HTTP 200 i liczba zapisanych gier. Żądanie przechodzi przez aplikację, która pobiera dane z MongoDB.

Aby sprawdzić blokowanie połączeń spoza namespace aplikacji, uruchom tymczasowy pod w `default`:

```powershell
$mongoIp = kubectl --context=gamebacklog -n gamebacklog get pod mongodb-0 -o jsonpath='{.status.podIP}'
kubectl --context=gamebacklog -n default run np-blocked-test --image=mongo:8.0 --restart=Never --command -- sleep 300
kubectl --context=gamebacklog -n default wait --for=jsonpath='{.status.phase}'=Running pod/np-blocked-test --timeout=120s
kubectl --context=gamebacklog -n default exec np-blocked-test -- mongosh "mongodb://${mongoIp}:27017/admin?serverSelectionTimeoutMS=3000" --quiet --eval 'db.adminCommand({ping:1})'
kubectl --context=gamebacklog -n default delete pod np-blocked-test --wait=true
```

W tym teście polecenie `mongosh` ma zakończyć się błędem timeoutu połączenia. Oznacza to, że NetworkPolicy blokuje dostęp do MongoDB z nieuprawnionego namespace. Pod należy usunąć również wtedy, gdy test zostanie przerwany.

### Zatrzymywanie i zachowanie danych

Zatrzymaj port-forward przez `Ctrl+C`. Zatrzymanie klastra zachowuje konfigurację i PVC:

```powershell
minikube stop -p gamebacklog
```

Wznów go przez `minikube start -p gamebacklog`. Odtworzenie poda `mongodb-0` nie usuwa danych z PVC. **Usunięcie namespace `gamebacklog` lub PVC `data-mongodb-0` usuwa dane.** `kubectl delete -k .\k8s` obejmuje też manifest Namespace, więc nie używaj go, jeśli chcesz zachować bazę.

### Diagnostyka Kubernetes

```powershell
kubectl --context=gamebacklog get pods,pvc,services,ingress,networkpolicy,resourcequota,limitrange -n gamebacklog
kubectl --context=gamebacklog logs deployment/gamebacklog -n gamebacklog
kubectl --context=gamebacklog logs statefulset/mongodb -n gamebacklog
kubectl --context=gamebacklog describe pod mongodb-0 -n gamebacklog
```

W MongoDB demonstracyjne gry są dodawane tylko przy pierwszym połączeniu, jeśli kolekcja jest pusta. W Compose dane bazy są przechowywane w nazwanym wolumenie `mongodb-data`, a port MongoDB nie jest wystawiony na hosta.

## API

- `GET /api/games` — lista gier.
- `POST /api/games` — dodanie gry.
- `PUT /api/games/:id` — aktualizacja gry.
- `DELETE /api/games/:id` — usunięcie gry.

API waliduje wymagane pola, status, typy liczbowe, zakres ukończenia, datę wydania i relację liczby zdobytych do łącznej liczby osiągnięć. Błędne żądania otrzymują odpowiedź `400`; dla nieistniejącego identyfikatora `404`.

Przy pierwszym połączeniu z pustą kolekcją `games` aplikacja wstawia 21 gier demonstracyjnych. Jeśli kolekcja zawiera już dokumenty, seed nie jest ponownie uruchamiany. Każda zmiana wykonana w interfejsie jest zapisywana w MongoDB i pozostaje po odświeżeniu oraz restarcie aplikacji.

## Architektura

- `src/app/api/games` — Route Handlers Next.js dla operacji CRUD.
- `src/lib/game-repository.ts` — kontrakt repozytorium, walidacja i implementacja MongoDB.
- `src/lib/game-api.ts` — klient API używany przez UI.
- `src/types/game.ts` — typy i dostępne statusy.
- `src/data/games.ts` — jedno źródło danych startowych.
- `src/lib/filter-games.ts` — filtrowanie i sortowanie w interfejsie.

Komponenty UI korzystają z API, a route handlers z kontraktu repozytorium, co pozwala zachować interfejs przy dalszych zmianach warstwy danych.

## Ograniczenia

- W Compose lokalna MongoDB działa bez uwierzytelniania i jest dostępna tylko wewnątrz sieci Compose. To konfiguracja do lokalnej pracy; przed wdrożeniem poza lokalne środowisko należy dodać odpowiednie uwierzytelnianie i zarządzanie sekretami.
- Lokalny manifest Kubernetes zakłada pojedynczą replikę aplikacji i pojedynczą instancję MongoDB; nie zapewnia wysokiej dostępności ani kopii zapasowych.
- Manifest Kubernetes używa przykładowego sekretu tworzonego lokalnie. Kubernetes Secret domyślnie nie szyfruje wartości samym faktem zapisania ich w obiekcie Secret; konfiguracja jest przeznaczona do lokalnego klastra edukacyjnego. Do środowiska współdzielonego/produkcyjnego potrzebne są dodatkowe zabezpieczenia sekretów.
- Aplikacja nie ma logowania ani autoryzacji. Endpointy są dostępne lokalnie tak jak pozostałe trasy aplikacji; nie wystawiaj ich publicznie bez dodania zabezpieczeń.
- Brak migracji i kopii zapasowych. Usunięcie bazy lub kolekcji sprawi, że demo zostanie ponownie wstawione przy następnym odczycie.
- Nie ma zewnętrznych API, uploadu okładek ani mikroserwisów.

## Kontrole jakości

```powershell
npm run typecheck
npm run lint
npm run build
```

Ostatnia weryfikacja: `npm run typecheck` i `npm run lint` zakończyły się poprawnie. `npm run build` skompilował aplikację, ale zatrzymał się na ochronnym komunikacie Next.js dla zainstalowanej wersji 16.4.3, oznaczonej jako podatna. Przed publikacją lub wdrożeniem trzeba wykonać aktualizację bezpieczeństwa Next.js i ponownie uruchomić build. Wydanie Next.js 16.4.5 zawiera poprawki bezpieczeństwa: [release notes](https://github.com/vercel/next.js/releases/tag/v16.4.5).

## Publikacja na GitHub

Lokalne repozytorium jest już zainicjalizowane, ale nie ma jeszcze pierwszego commita ani zdalnego adresu. Utwórz puste repozytorium na GitHubie (bez automatycznego README, licencji i `.gitignore`), a następnie w PowerShellu w katalogu projektu wykonaj:

```powershell
git status --short
git check-ignore -v .env.local k8s/mongodb-secret.env
```

Drugie polecenie musi pokazać, że oba pliki są ignorowane. Dodaj tylko pliki projektu i manifesty, po czym sprawdź listę staged plików przed commitem:

```powershell
git add .dockerignore .gitignore .env.example Dockerfile README.md compose.yaml eslint.config.mjs next-env.d.ts next.config.mjs package.json package-lock.json postcss.config.mjs src tailwind.config.ts tsconfig.json k8s output/reports/Sprawozdanie_GameBacklog.docx
git status
```

Jeśli lista nie zawiera haseł, `.env.local`, `k8s/mongodb-secret.env` ani plików z `tmp/`, utwórz commit i podłącz repozytorium:

```powershell
git commit -m "Initial GameBacklog project"
git branch -M main
git remote add origin https://github.com/TWOJ_LOGIN/gamebacklog.git
git push -u origin main
```

Zastąp `TWOJ_LOGIN` swoim loginem i wklej link repozytorium do sprawozdania. Nie używaj `git add -f` dla plików z hasłami. Przed publicznym udostępnieniem sprawdź również historię commitów, aby upewnić się, że sekret nie był wcześniej dodany.

## Dokumenty projektu

- [Sprawozdanie z realizacji testów i wdrożenia](output/reports/Sprawozdanie_GameBacklog.pdf)

Sprawozdanie jest przygotowane w edytowalnym formacie Word. Zawiera aktualne wyniki, polecenia i miejsca na zrzuty. Przed oddaniem wstaw wskazane obrazy terminala i interfejsu oraz uzupełnij link do utworzonego repozytorium GitHub.
