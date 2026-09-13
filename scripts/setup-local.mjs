import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import net from "node:net";
import path from "node:path";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const backendRoot = path.join(projectRoot, "Backend");
const envFile = path.join(backendRoot, ".env");
const require = createRequire(path.join(backendRoot, "package.json"));
const { Client } = require("pg");
const databaseName = "eventhub_ionic";
const password = () => randomBytes(24).toString("base64url");
const quote = (value) => JSON.stringify(String(value));
const postgresRoot = path.join(projectRoot, ".local-postgres");
const postgresData = path.join(postgresRoot, "data");
const postgresFlag = path.join(postgresRoot, "instance.json");

function writeEnv(values, options = {}) {
  writeFileSync(
    envFile,
    Object.entries(values)
      .map(([key, value]) => `${key}=${quote(value)}`)
      .join("\n") + "\n",
    { mode: 0o600, ...options },
  );
}

function postgresBinary(name) {
  if (process.env.POSTGRES_BIN)
    return path.join(
      process.env.POSTGRES_BIN,
      process.platform === "win32" ? `${name}.exe` : name,
    );
  if (process.platform === "win32") {
    const directory = path.join(
      process.env.ProgramFiles || "C:\\Program Files",
      "PostgreSQL",
    );
    const versionFile = path.join(postgresData, "PG_VERSION");
    if (existsSync(versionFile)) {
      const requiredVersion = readFileSync(versionFile, "utf8").trim();
      const matchingBinary = path.join(
        directory,
        requiredVersion,
        "bin",
        `${name}.exe`,
      );
      if (existsSync(matchingBinary)) return matchingBinary;
      throw new Error(
        `PostgreSQL ${requiredVersion} est nécessaire pour cette instance. Définissez POSTGRES_BIN si son installation a été déplacée.`,
      );
    }
    const versions = existsSync(directory)
      ? readdirSync(directory).sort((a, b) =>
          b.localeCompare(a, undefined, { numeric: true }),
        )
      : [];
    for (const version of versions) {
      const binary = path.join(directory, version, "bin", `${name}.exe`);
      if (existsSync(binary)) return binary;
    }
  }
  return name;
}

function runPostgres(name, args, allowFailure = false) {
  // Sous Windows, postgres lancé en arrière-plan peut conserver les pipes de
  // pg_ctl ouverts. Ignorer ces flux évite d'attendre sa fermeture indéfiniment.
  const result = spawnSync(postgresBinary(name), args, {
    windowsHide: true,
    stdio: "ignore",
  });
  if (result.error || result.status !== 0) {
    if (allowFailure) return false;
    throw new Error(
      `${name} a échoué. Vérifiez PostgreSQL/POSTGRES_BIN et le journal .local-postgres/server.log. ${result.error?.code || result.stderr?.trim() || ""}`,
    );
  }
  return true;
}

function startLocalPostgres() {
  if (!existsSync(postgresFlag)) return;
  if (runPostgres("pg_ctl", ["-D", postgresData, "status"], true)) return;
  const config = JSON.parse(readFileSync(postgresFlag, "utf8"));
  runPostgres("pg_ctl", [
    "-D",
    postgresData,
    "-l",
    path.join(postgresRoot, "server.log"),
    "-o",
    `-h 127.0.0.1 -p ${config.port}`,
    "-w",
    "start",
  ]);
  console.log(
    `Instance PostgreSQL dédiée démarrée sur 127.0.0.1:${config.port}.`,
  );
}

function stopLocalPostgres() {
  if (
    !existsSync(postgresFlag) ||
    !runPostgres("pg_ctl", ["-D", postgresData, "status"], true)
  )
    return;
  runPostgres("pg_ctl", ["-D", postgresData, "-m", "fast", "-w", "stop"]);
  console.log("Instance PostgreSQL dédiée arrêtée.");
}

async function initializeLocalPostgres(local) {
  if (!existsSync(postgresFlag)) {
    if (existsSync(path.join(postgresData, "PG_VERSION"))) {
      throw new Error(
        "Une base PostgreSQL non gérée existe dans .local-postgres/data : aucune modification automatique.",
      );
    }
    const dedicatedPassword = password();
    const dedicatedUser = "eventhub_ionic_owner";
    const dedicatedPort = 5433;
    await new Promise((resolve, reject) => {
      const probe = net.createServer();
      probe.once("error", () =>
        reject(
          new Error(
            "Le port PostgreSQL dédié 5433 est déjà utilisé. Aucun processus existant ne sera arrêté.",
          ),
        ),
      );
      probe.listen(dedicatedPort, "127.0.0.1", () => probe.close(resolve));
    });
    mkdirSync(postgresRoot, { recursive: true });
    const passwordFile = path.join(postgresRoot, "init-password.tmp");
    writeFileSync(passwordFile, `${dedicatedPassword}\n`, {
      mode: 0o600,
      flag: "wx",
    });
    try {
      runPostgres("initdb", [
        "-D",
        postgresData,
        "-U",
        dedicatedUser,
        "--auth=scram-sha-256",
        "--encoding=UTF8",
        "--locale=C",
        `--pwfile=${passwordFile}`,
      ]);
    } finally {
      unlinkSync(passwordFile);
    }
    Object.assign(local, {
      DB_HOST: "127.0.0.1",
      DB_PORT: String(dedicatedPort),
      DB_USER: dedicatedUser,
      DB_PASSWORD: dedicatedPassword,
    });
    writeEnv(local);
    writeFileSync(
      postgresFlag,
      JSON.stringify({ port: dedicatedPort, database: databaseName }, null, 2) +
        "\n",
    );
    console.log("Instance PostgreSQL privée initialisée dans .local-postgres.");
  }
  startLocalPostgres();
}

async function setup() {
  if (process.argv.includes("--start-db")) {
    startLocalPostgres();
    return;
  }
  if (process.argv.includes("--stop-db")) {
    stopLocalPostgres();
    return;
  }
  if (!existsSync(envFile)) {
    const sourceFlag = process.argv.indexOf("--from-env");
    const sourceFile = sourceFlag >= 0 ? process.argv[sourceFlag + 1] : null;
    if (sourceFlag >= 0 && !sourceFile) {
      throw new Error("Indiquez le chemin du fichier après --from-env.");
    }

    // Cette option lit seulement les accès PostgreSQL. Aucune écriture dans
    // le projet source et aucun mot de passe n'est affiché dans le terminal.
    const source = sourceFile
      ? parseEnv(readFileSync(path.resolve(sourceFile), "utf8"))
      : process.env;
    let connection = {
      DB_HOST: source.DB_HOST || "localhost",
      DB_PORT: source.DB_PORT || "5432",
      DB_USER: source.DB_USER || "postgres",
      DB_PASSWORD: source.DB_PASSWORD || "",
    };
    if (source.DATABASE_URL) {
      const originalUrl = new URL(source.DATABASE_URL);
      connection = {
        DB_HOST: originalUrl.hostname,
        DB_PORT: originalUrl.port || "5432",
        DB_USER: decodeURIComponent(originalUrl.username),
        DB_PASSWORD: decodeURIComponent(originalUrl.password),
      };
    }

    const local = {
      PORT: "3001",
      ...connection,
      DB_NAME: databaseName,
      JWT_SECRET: password() + password(),
      JWT_EXPIRES_IN: "24h",
      NODE_ENV: "development",
      SEED_DEMO_DATA: "true",
      DEMO_SEED_PASSWORD: password(),
      DEMO_ADMIN_EMAIL: "admin@eventhub-ionic.local",
      DEMO_ADMIN_PASSWORD: password(),
      DEMO_USER_EMAIL: "participant@eventhub-ionic.local",
      DEMO_USER_PASSWORD: password(),
    };
    writeEnv(local, { flag: "wx" });
    console.log("Backend/.env créé : base dédiée et secrets aléatoires.");
  }

  const local = parseEnv(readFileSync(envFile, "utf8"));
  if (
    local.DB_NAME !== databaseName ||
    local.DATABASE_URL ||
    process.env.DATABASE_URL
  ) {
    throw new Error(
      "Le setup local exige DB_NAME=eventhub_ionic et aucune DATABASE_URL.",
    );
  }
  if (process.argv.includes("--isolated-postgres"))
    await initializeLocalPostgres(local);
  else if (existsSync(postgresFlag)) startLocalPostgres();
  Object.assign(process.env, local);

  const client = new Client({
    host: local.DB_HOST,
    port: Number(local.DB_PORT || 5432),
    user: local.DB_USER,
    password: local.DB_PASSWORD,
    database: "postgres",
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const existing = await client.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );
    if (existing.rowCount === 0) {
      // Nom constant : ne crée, ne supprime et ne modifie aucune autre base.
      await client.query('CREATE DATABASE "eventhub_ionic"');
      console.log("Base PostgreSQL eventhub_ionic créée.");
    } else {
      console.log("Base PostgreSQL eventhub_ionic déjà présente.");
    }
  } catch (error) {
    if (error.code === "42501") {
      throw new Error(
        "Le rôle PostgreSQL ne peut pas créer de base. Faites créer eventhub_ionic avec ce rôle comme propriétaire, puis relancez npm run setup:local.",
      );
    }
    throw new Error(
      `Connexion/création PostgreSQL impossible (${error.code || "erreur"}). Vérifiez les accès dans Backend/.env et le service PostgreSQL.`,
    );
  } finally {
    await client.end();
  }

  const { sequelize } = await import("../Backend/src/models/index.js");
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    if (local.SEED_DEMO_DATA === "true") {
      const { seedDemoData } =
        await import("../Backend/src/config/seedDemoData.js");
      await seedDemoData();
    }
  } finally {
    await sequelize.close();
  }

  if (local.SEED_DEMO_DATA === "true") {
    writeFileSync(
      path.join(projectRoot, "LOCAL-ACCESS.md"),
      [
        "# Accès locaux EventHub Ionic",
        "",
        "Fichier privé ignoré par Git. Ne pas publier ni partager.",
        "",
        "- Application en développement : http://localhost:8100",
        "- API locale : http://localhost:3001/api",
        "- Base dédiée : `eventhub_ionic`",
        `- PostgreSQL : ${local.DB_HOST}:${local.DB_PORT}`,
        "",
        "| Rôle | Adresse email | Mot de passe |",
        "| --- | --- | --- |",
        `| Administrateur | ${local.DEMO_ADMIN_EMAIL || ""} | ${local.DEMO_ADMIN_PASSWORD || ""} |`,
        `| Participant | ${local.DEMO_USER_EMAIL || ""} | ${local.DEMO_USER_PASSWORD || ""} |`,
        "",
        "Ces comptes et leurs mots de passe sont propres à cette instance. Le compte technique participant.demo@eventhub.local rend un événement complet.",
        "",
      ].join("\n"),
      { mode: 0o600 },
    );
  }
  console.log(
    "Installation locale terminée. Accès démo dans LOCAL-ACCESS.md (ignoré par Git).",
  );
}

setup().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
