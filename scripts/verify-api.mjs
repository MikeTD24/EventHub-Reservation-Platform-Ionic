import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const local = parseEnv(
  readFileSync(path.join(projectRoot, "Backend/.env"), "utf8"),
);
assert.equal(
  local.DB_NAME,
  "eventhub_ionic",
  "Les tests ne peuvent viser que la base eventhub_ionic.",
);
assert.ok(
  !local.DATABASE_URL && !process.env.DATABASE_URL,
  "DATABASE_URL doit être absente pour ce test local.",
);
Object.assign(process.env, local, {
  NODE_ENV: "test",
  SEED_DEMO_DATA: "false",
});

const require = createRequire(path.join(projectRoot, "Backend/package.json"));
const bcrypt = require("bcrypt");
const { sequelize, Utilisateur, Categorie, Evenement } =
  await import("../Backend/src/models/index.js");
const { default: app } = await import("../Backend/src/app.js");
const marker = `ionic-smoke-${Date.now()}-${randomBytes(3).toString("hex")}`;
const secret = randomBytes(24).toString("base64url");
const userIds = [];
const eventIds = [];
const categoryIds = [];
let server;
let baseUrl;
let assertions = 0;

async function request(method, route, body, token, expected = 200) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${result.message || response.status}`,
  );
  assertions += 1;
  return result;
}

try {
  await sequelize.authenticate();
  server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  await request("GET", "/health");
  await request("GET", "/categories", undefined, undefined, 401);
  await request("GET", "/events");
  await request("GET", "/reservations", undefined, undefined, 401);

  const admin = await Utilisateur.create({
    nom: marker,
    email: `${marker}-admin@example.test`,
    mot_de_passe: await bcrypt.hash(secret, 10),
    role: "admin",
  });
  userIds.push(admin.id);
  const { token: adminToken } = await request("POST", "/auth/login", {
    email: admin.email,
    mot_de_passe: secret,
  });
  const tokens = [];
  for (const suffix of ["a", "b"]) {
    const email = `${marker}-${suffix}@example.test`;
    const registered = await request(
      "POST",
      "/auth/register",
      { nom: marker, email, mot_de_passe: secret, role: "admin" },
      undefined,
      201,
    );
    userIds.push(registered.utilisateur.id);
    assert.equal(
      registered.utilisateur.role,
      "user",
      "Une inscription publique ne peut accorder le rôle admin.",
    );
    assert.equal(registered.utilisateur.mot_de_passe, undefined);
    await request(
      "POST",
      "/auth/register",
      { nom: marker, email, mot_de_passe: secret },
      undefined,
      409,
    );
    const authenticated = await request("POST", "/auth/login", {
      email,
      mot_de_passe: secret,
    });
    tokens.push(authenticated.token);
  }
  await request(
    "POST",
    "/auth/login",
    { email: admin.email, mot_de_passe: "incorrect-password" },
    undefined,
    401,
  );
  await request("POST", "/categories", { nom: marker }, tokens[0], 403);
  const { categorie } = await request(
    "POST",
    "/categories",
    { nom: marker },
    adminToken,
    201,
  );
  categoryIds.push(categorie.id);
  await request(
    "PUT",
    `/categories/${categorie.id}`,
    { nom: `${marker}-updated` },
    adminToken,
  );

  const eventBody = {
    titre: marker,
    description: "Événement temporaire de vérification Ionic.",
    lieu: "Bruxelles",
    date_evenement: new Date(Date.now() + 7 * 86400000).toISOString(),
    places_totales: 3,
    id_categorie: categorie.id,
  };
  await request("POST", "/events", eventBody, tokens[0], 403);
  const { evenement } = await request(
    "POST",
    "/events",
    eventBody,
    adminToken,
    201,
  );
  eventIds.push(evenement.id);
  await request(
    "PUT",
    `/events/${evenement.id}`,
    { ...eventBody, titre: `${marker}-updated` },
    adminToken,
  );
  await request(
    "DELETE",
    `/categories/${categorie.id}`,
    undefined,
    adminToken,
    409,
  );
  const { reservation } = await request(
    "POST",
    "/reservations",
    { id_evenement: evenement.id, nombre_places: 2 },
    tokens[0],
    201,
  );
  const own = await request("GET", "/reservations", undefined, tokens[0]);
  assert.ok(own.some((item) => item.id === reservation.id));
  const other = await request("GET", "/reservations", undefined, tokens[1]);
  assert.equal(other.length, 0);
  await request(
    "PUT",
    `/reservations/${reservation.id}`,
    { nombre_places: 1 },
    tokens[1],
    404,
  );
  await request(
    "PATCH",
    `/reservations/${reservation.id}/cancel`,
    {},
    tokens[1],
    404,
  );
  await request(
    "POST",
    "/reservations",
    { id_evenement: evenement.id, nombre_places: 1 },
    tokens[0],
    409,
  );
  await request(
    "POST",
    "/reservations",
    { id_evenement: evenement.id, nombre_places: 2 },
    tokens[1],
    409,
  );
  await request(
    "PUT",
    `/reservations/${reservation.id}`,
    { nombre_places: 4 },
    tokens[0],
    409,
  );
  await request(
    "PUT",
    `/events/${evenement.id}`,
    { ...eventBody, places_totales: 1 },
    adminToken,
    409,
  );
  await request(
    "GET",
    `/events/${evenement.id}/reservations`,
    undefined,
    tokens[0],
    403,
  );
  const participants = await request(
    "GET",
    `/events/${evenement.id}/reservations`,
    undefined,
    adminToken,
  );
  assert.equal(
    participants.reservations[0].utilisateur.mot_de_passe,
    undefined,
  );
  await request(
    "PUT",
    `/reservations/${reservation.id}`,
    { nombre_places: 1 },
    tokens[0],
  );
  await request(
    "PATCH",
    `/reservations/${reservation.id}/cancel`,
    {},
    tokens[0],
  );
  await request(
    "PUT",
    `/reservations/${reservation.id}`,
    { nombre_places: 1 },
    tokens[0],
    409,
  );
  const freed = await request("GET", `/events/${evenement.id}`);
  assert.equal(freed.places_restantes, 3);

  // Deux participants demandent simultanément la dernière place : exactement
  // une réservation doit réussir, grâce au verrou de ligne PostgreSQL.
  const concurrentEvent = await request(
    "POST",
    "/events",
    { ...eventBody, titre: `${marker}-race`, places_totales: 1 },
    adminToken,
    201,
  );
  eventIds.push(concurrentEvent.evenement.id);
  const concurrent = await Promise.all(
    tokens.map((token) =>
      fetch(`${baseUrl}/reservations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id_evenement: concurrentEvent.evenement.id,
          nombre_places: 1,
        }),
        signal: AbortSignal.timeout(10000),
      }),
    ),
  );
  assert.deepEqual(
    concurrent.map((response) => response.status).sort(),
    [201, 409],
  );
  assertions += 2;
  const lastPlace = await request(
    "GET",
    `/events/${concurrentEvent.evenement.id}`,
  );
  assert.equal(lastPlace.places_restantes, 0);

  const pastEvent = await request(
    "POST",
    "/events",
    {
      ...eventBody,
      titre: `${marker}-past`,
      date_evenement: new Date(Date.now() - 86400000).toISOString(),
    },
    adminToken,
    201,
  );
  eventIds.push(pastEvent.evenement.id);
  await request(
    "POST",
    "/reservations",
    { id_evenement: pastEvent.evenement.id, nombre_places: 1 },
    tokens[0],
    409,
  );
  for (const id of eventIds) {
    await request("DELETE", `/events/${id}`, undefined, adminToken);
    await request("GET", `/events/${id}`, undefined, undefined, 404);
  }
  await request("DELETE", `/categories/${categorie.id}`, undefined, adminToken);
  console.log(
    `API vérifiée : ${assertions} réponses HTTP validées, rôles, propriété, CRUD, annulation et concurrence sur la dernière place.`,
  );
} finally {
  if (server)
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  // Identifiants uniquement créés par cette exécution. Les réservations
  // temporaires sont supprimées par leurs clés étrangères ON DELETE CASCADE.
  for (const id of eventIds) await Evenement.destroy({ where: { id } });
  for (const id of categoryIds) await Categorie.destroy({ where: { id } });
  for (const id of userIds) await Utilisateur.destroy({ where: { id } });
  await sequelize.close();
  console.log("Données temporaires de vérification nettoyées.");
}
