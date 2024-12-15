import * as fs from 'fs';
import * as path from 'path';
import { MeshOS, Types } from '@hotmeshio/hotmesh';

import * as Redis from 'redis';
import { Pool, Client as PGClient } from 'pg';
import { connect as NATS } from 'nats';
import { DefaultEntity } from './namespaces/default/index';

// Helper mapping for classes referenced in config
const CLASS_MAP = {
  redis: Redis,
  pg: PGClient,
  nats: NATS,
};

const ENTITY_MAP = {
  default: DefaultEntity,
};

export async function initializeHotMesh() {
  // Attempt to resolve the config file from multiple potential locations
  const potentialPaths = [
    path.resolve('/app/.hotmesh.config.json'), // Default mounted path in a container
    path.resolve('.hotmesh.config.json'),      // One level up
    path.resolve('../.hotmesh.config.json'),   // Two levels up
  ];

  let configPath = '';
  for (const potentialPath of potentialPaths) {
    if (fs.existsSync(potentialPath)) {
      configPath = potentialPath;
      break;
    }
  }

  if (!configPath) {
    throw new Error(
      `Configuration file not found. Checked paths: ${potentialPaths.join(', ')}`
    );
  }

  console.log(`Configuration file resolved at: ${configPath}`);

  // Read and parse the configuration file
  const rawConfig = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(rawConfig);

  // Register Databases
  for (const [dbKey, dbConfig] of Object.entries(config.databases as Record<string, any>)) {
    const dbConnection = { ...dbConfig };
    if (dbConnection.connection) {
      //always make the dashboard 'readonly' it's only there to report
      dbConnection.connection.readonly = true;
      //concise connection format
      if (dbConnection.connection?.class) {
        if(CLASS_MAP[dbConnection.connection.class]) {
          dbConnection.connection.class = CLASS_MAP[dbConnection.connection.class];
        }
      } else {
        //expanded connection object
        for (const [connKey, connVal] of Object.entries(dbConnection.connection)) {
          if (connVal['class'] && CLASS_MAP[connVal['class']]) {
            connVal['class'] = CLASS_MAP[connVal['class']];
          }
        }        
      }
    }
    console.log('Registering database', dbKey);
    MeshOS.registerDatabase(dbKey, dbConfig);
  }

  // Register Schemas
  for (const [schemaKey, schemaVal] of Object.entries(config.schemas)) {
    MeshOS.registerSchema(schemaKey, schemaVal as Types.WorkflowSearchSchema);
  }

  // Register Entities (entities are nouns like 'user' and contain a schema that defines the fields in the entity)
  for (const [entityKey, entityVal] of Object.entries(config.entities as Record<string, Types.Entity>)) {
    entityVal.schema = config.schemas[entityKey] || entityVal.schema
    const entityClass = ENTITY_MAP['default'];
    entityVal.class = entityClass;
    MeshOS.registerClass(entityKey, entityClass);
    MeshOS.registerEntity(entityKey, entityVal);
  }

  // Register Namespaces
  for (const [nsKey, nsConfig] of Object.entries(config.namespaces as Record<string, any>)) {
    nsConfig.entities = nsConfig.entities.map((entityName: string) => {
      return config.entities[entityName];
    });

    MeshOS.registerNamespace(nsKey, nsConfig);
  }

  // Register Profiles (optional: if you have multiple DB profiles)
  for (const dbKey of Object.keys(config.databases)) {
    MeshOS.registerProfile(dbKey, {
      db: MeshOS.databases[dbKey],
      namespaces: Object.keys(config.namespaces).reduce((acc, nsKey) => {
        acc[nsKey] = MeshOS.namespaces[nsKey];
        return acc;
      }, {}),
    });
  }

  // Initialize MeshOS
  await MeshOS.init();
}

export const getEntityInstance = (database: string, namespace: string, entity: string) => {
  return MeshOS.findEntity(database, namespace, entity);
};

export const getSchemas = (database: string, namespace: string) => {
  return MeshOS.findSchemas(database, namespace);
};

export const getProfilesJSON = () => {
  return MeshOS.toJSON();
};
