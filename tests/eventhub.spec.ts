import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";

const local = parseEnv(readFileSync("Backend/.env", "utf8"));
if (local.DB_NAME !== "eventhub_ionic" || local.DATABASE_URL)
  throw new Error("Les tests exigent la base locale eventhub_ionic.");
const api = "http://127.0.0.1:3001/api";
const marker = "Parcours Ionic " + Date.now();
const email = "ionic-e2e-" + Date.now() + "@example.test";
const password = randomBytes(18).toString("base64url");
let token = "";
let categoryId = 0;
let eventId = 0;
let uiCategoryId = 0;

test.beforeAll(async ({ request }) => {
  const login = await request.post(api + "/auth/login", {
    data: {
      email: local.DEMO_ADMIN_EMAIL,
      mot_de_passe: local.DEMO_ADMIN_PASSWORD,
    },
  });
  expect(login.ok()).toBeTruthy();
  token = (await login.json()).token;
  const headers = { Authorization: "Bearer " + token };
  const category = await request.post(api + "/categories", {
    headers,
    data: { nom: marker },
  });
  expect(category.status()).toBe(201);
  categoryId = (await category.json()).categorie.id;
  const event = await request.post(api + "/events", {
    headers,
    data: {
      titre: marker,
      description: "Un atelier pour vérifier la réservation sur mobile.",
      lieu: "Bruxelles",
      date_evenement: new Date(Date.now() + 30 * 86400000).toISOString(),
      places_totales: 10,
      id_categorie: categoryId,
    },
  });
  expect(event.status()).toBe(201);
  eventId = (await event.json()).evenement.id;
});

test.afterAll(async ({ request }) => {
  const headers = { Authorization: "Bearer " + token };
  if (eventId) await request.delete(api + "/events/" + eventId, { headers });
  if (categoryId)
    await request.delete(api + "/categories/" + categoryId, { headers });
  if (uiCategoryId)
    await request.delete(api + "/categories/" + uiCategoryId, { headers });
  Object.assign(process.env, local);
  const { sequelize, Utilisateur } =
    await import("../Backend/src/models/index.js");
  try {
    await Utilisateur.destroy({ where: { email } });
  } finally {
    await sequelize.close();
  }
});

test("agenda responsive, recherche, filtre et erreur réseau", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/evenements");
  await expect(page.locator("app-event-list ion-card").first()).toBeVisible();
  await page.locator("ion-searchbar input").fill("aucun-resultat-xyz");
  await expect(
    page.getByText("Aucun événement trouvé", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Réinitialiser les filtres" }).click();
  await page.locator('ion-segment-button[value="available"]').click();
  await expect(
    page
      .locator("app-event-list ion-card ion-badge")
      .filter({ hasText: /^Terminé$|^Complet$/ }),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".bottom-nav")).toBeVisible();
  await expect(page.locator("app-event-list ion-card").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.route("**/api/events", (route) => route.abort());
  await page.reload();
  await expect(page.getByText("L’agenda est indisponible")).toBeVisible();
  await page.unroute("**/api/events");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.locator("app-event-list ion-card").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("inscription et réservation, modification, annulation et déconnexion sur mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/mes-reservations");
  await expect(page).toHaveURL(/connexion/);
  await page.locator('app-login a[routerlink="/inscription"]').click();
  await page
    .locator('app-register ion-input[formcontrolname="nom"] input')
    .fill("Participant Ionic");
  await page
    .locator('app-register ion-input[formcontrolname="email"] input')
    .fill(email);
  await page
    .locator('app-register ion-input[formcontrolname="mot_de_passe"] input')
    .fill(password);
  await page
    .locator(
      'app-register ion-input[formcontrolname="confirmation_mot_de_passe"] input',
    )
    .fill(password);
  await page
    .getByRole("button", { name: "Créer mon compte", exact: true })
    .click();
  await expect(
    page.getByText("Votre compte a été créé avec succès.", { exact: false }),
  ).toBeVisible();
  await page
    .locator('app-login ion-input[formcontrolname="email"] input')
    .fill(email);
  await page
    .locator('app-login ion-input[formcontrolname="mot_de_passe"] input')
    .fill(password);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/evenements/);
  await page.goto("/evenements/" + eventId);
  await page.locator("app-event-detail ion-input input").fill("2");
  await page.getByRole("button", { name: "Réserver mes places" }).click();
  await expect(page.locator("ion-alert")).toBeVisible();
  await page.locator("ion-alert button").last().click();
  await expect(
    page.getByRole("link", { name: "Voir mes réservations" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Voir mes réservations" }).click();
  const card = page
    .locator("app-my-reservations ion-card")
    .filter({ hasText: marker });
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Modifier", exact: true }).click();
  await card.locator("ion-input input").fill("3");
  await card.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page
    .locator("ion-alert")
    .getByRole("button", { name: "Enregistrer", exact: true })
    .click();
  await expect(card.locator(".seat-count strong")).toHaveText("3");
  await card.getByRole("button", { name: "Annuler", exact: true }).click();
  await page
    .locator("ion-alert")
    .getByRole("button", { name: "Annuler la réservation", exact: true })
    .click();
  await expect(card.locator("ion-badge")).toHaveText("Annulée");
  await page.reload();
  await expect(
    page.locator("app-my-reservations ion-card ion-badge"),
  ).toHaveText("Annulée");
  await page
    .locator(".bottom-nav")
    .getByRole("button", { name: "Déconnexion" })
    .click();
  await expect(page).toHaveURL(/connexion/);
  await page.goto("/admin/evenements");
  await expect(page).toHaveURL(/connexion/);
  await expect(page.locator("app-my-reservations ion-card")).toHaveCount(0);
});

test("administrateur : écrans de gestion et formulaire", async ({ page }) => {
  await page.goto("/connexion");
  await page
    .locator('app-login ion-input[formcontrolname="email"] input')
    .fill(local.DEMO_ADMIN_EMAIL);
  await page
    .locator('app-login ion-input[formcontrolname="mot_de_passe"] input')
    .fill(local.DEMO_ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Se connecter", exact: true }).click();
  await expect(page).toHaveURL(/evenements/);
  await page.goto("/admin/evenements");
  await expect(page.locator("app-admin-event-list")).toContainText(marker);
  await page.goto("/admin/evenements/" + eventId + "/modifier");
  await expect(
    page.locator('ion-input[formcontrolname="titre"] input'),
  ).toHaveValue(marker);
  await page
    .locator('ion-input[formcontrolname="titre"] input')
    .fill(marker + " modifié");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/evenements$/);
  await expect(page.locator("app-admin-event-list")).toContainText(
    marker + " modifié",
  );
  await page.goto("/admin/evenements/" + eventId + "/reservations");
  await expect(page.locator("app-admin-event-participants")).toContainText(
    marker,
  );
  await page.goto("/admin/categories");
  await expect(page.locator("app-admin-categories")).toContainText(marker);
  await page
    .locator('ion-input[formcontrolname="nom"] input')
    .fill(marker + " UI");
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/categories") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const createdResponse = await created;
  expect(createdResponse.status()).toBe(201);
  uiCategoryId = (await createdResponse.json()).categorie.id;
  const item = page
    .locator(".category-item")
    .filter({ hasText: marker + " UI" });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: "Modifier", exact: true }).click();
  await page
    .locator('ion-input[formcontrolname="nom"] input')
    .fill(marker + " UI renommée");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(item).toContainText("renommée");
  await item.getByRole("button", { name: "Supprimer", exact: true }).click();
  await page
    .locator("ion-alert")
    .getByRole("button", { name: "Supprimer", exact: true })
    .click();
  await expect(item).toHaveCount(0);
});
