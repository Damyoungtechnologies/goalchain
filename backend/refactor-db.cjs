const fs = require('fs');

function refactorFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Change synchronous route handlers to async
  content = content.replace(/app\.get\("\/api\/admin\/markets", \(_req, res\) => \{/g, 'app.get("/api/admin/markets", async (_req, res) => {');
  content = content.replace(/app\.get\("\/api\/analytics", \(_req, res\) => \{/g, 'app.get("/api/analytics", async (_req, res) => {');
  content = content.replace(/app\.get\("\/api\/leaderboard", \(_req, res\) => \{/g, 'app.get("/api/leaderboard", async (_req, res) => {');

  // Find all db calls and prefix with await if not already
  // Specifically we know db.fixture, db.market, db.prediction, db.user, db.transaction
  const dbRegex = /([^a-zA-Z0-9_])db\.(fixture|market|prediction|user|transaction)\.(findMany|findUnique|create|update|upsert)\(/g;
  
  content = content.replace(dbRegex, (match, prefix, col, method) => {
    // If it's already preceded by await, don't add another
    if (prefix.endsWith('await ')) {
      return match;
    }
    return prefix + 'await db.' + col + '.' + method + '(';
  });

  // There's one case where findMany() is chained: db.fixture.findMany().filter(...)
  // So it becomes (await db.fixture.findMany()).filter(...)
  content = content.replace(/await db\.fixture\.findMany\(\)\.filter/g, '(await db.fixture.findMany()).filter');

  fs.writeFileSync(path, content);
  console.log('Refactored ' + path);
}

refactorFile('./src/server.js');
refactorFile('./src/routes/predictions.js');
