# FlagShip

## 이 프로젝트는?

| | |
|---|---|
| **무엇을** | 코드 배포 없이 Feature Flag를 ON/OFF하고, 타겟 유저·비율 롤아웃으로 기능을 점진 공개하는 SaaS |
| **왜** | 신규 기능을 전 사용자에게 한 번에 열면 리스크가 커서, 일부 공개 → 즉시 차단 → 점진 확대가 필요함 |
| **어떻게** | NestJS 평가 엔진 + Redis 캐시/무효화 + Audit Log + SDK Evaluate API, Next.js 관리 대시보드 |

**코드 배포 없이 기능을 켜고 끄고, 사용자별로 점진적으로 기능을 공개하세요.**

Feature Flag Management SaaS — 환경별 ON/OFF, 타겟 유저, 비율 롤아웃, Redis 캐시, Audit Log, SDK Evaluate API.

---

## 해결하려는 문제

신규 기능을 전 사용자에게 한 번에 열지 않고:

1. 일부 사용자에게만 먼저 공개하고
2. 문제가 생기면 배포 없이 즉시 OFF 하고
3. 점진적으로 롤아웃 비율을 높입니다.

---

## 아키텍처

```
Next.js Dashboard ──JWT──▶ NestJS API
                              │
Client SDK ──X-API-Key──▶ POST /api/v1/evaluate
                              │
                     ┌────────┴────────┐
                     │ Flag Evaluator  │
                     │ Redis Cache     │
                     └────────┬────────┘
                              ▼
                         PostgreSQL
```

### 평가 우선순위

1. `enabled=false` → OFF  
2. `userId ∈ targetUsers` → ON  
3. `rolloutPercentage` 버킷(`sha256(flagKey:userId) % 100`) 비교

---

## ERD

```
users
 └── projects
      ├── environments (DEV / STAGING / PROD)
      ├── api_keys
      └── feature_flags
           └── flag_audits
```

---

## 기술 스택

| Layer | Stack |
|-------|-------|
| Backend | NestJS, TypeScript, Swagger |
| DB | PostgreSQL, Prisma |
| Cache | Redis (ioredis) |
| Frontend | Next.js |
| Deploy | Docker Compose |

---

## 주요 API

### Auth
- `POST /api/auth/register|login|demo`
- `GET /api/auth/me`

### Projects
- `GET/POST /api/projects`
- `POST /api/projects/:id/api-keys`

### Flags
- `GET /api/projects/:id/flags?environmentId=`
- `POST /api/projects/:id/environments/:envId/flags`
- `PATCH/DELETE /api/projects/:id/flags/:flagId`
- `GET /api/projects/:id/audits`
- `POST /api/projects/:id/evaluate` (dashboard preview)

### SDK
```bash
curl -X POST localhost:3002/api/v1/evaluate \
  -H 'x-api-key: fs_...' \
  -H 'content-type: application/json' \
  -d '{"key":"new_dashboard","userId":"user_101","environment":"PRODUCTION"}'
```

Swagger: [http://localhost:3002/api/docs](http://localhost:3002/api/docs)

---

## 로컬 실행

```bash
cp .env.example .env
cp .env.example apps/api/.env
docker compose up -d          # postgres:5433, redis:6380

cd apps/api && npx prisma migrate dev && npx prisma generate && cd ../..

npm run start:dev -w @flagship/api   # :3002
npm run dev -w @flagship/web        # :3003
```

Demo 로그인: 화면의 **Demo** (`demo@flagship.test` / `password123`)

---

## 테스트

```bash
npm test -w @flagship/api
```

포함: rollout bucket, evaluate 엔진(타겟/비율/비활성)

---

## 포트폴리오 포인트

- Feature Flag **평가 엔진** (타겟 + 해시 기반 비율)
- **환경 분리** (Dev/Staging/Prod)
- Redis **캐시 + 변경 시 무효화** (장애 시 DB 폴백)
- **Audit Log**로 설정 변경 추적
- SDK용 **API Key 인증 Evaluate API** + Swagger
