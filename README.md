# playdust-api

Marketplace private api including auction house trading module as well as wallet based authentication mechanism.

## Installation
```bash
npm install
```

## E2E test for local api server
```bash
# run api server first
npm run dev

# run test in other terminal
npm test
```

## OpenApi UI

http://localhost:3000/api-docs

## dynamodb-local

```bash
docker pull amazon/dynamodb-local
docker run -p 8000:8000 amazon/dynamodb-local
```
