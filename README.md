# HotMesh UI

**A visual dashboard for your distributed HotMesh routers and workflows.**

## Overview

HotMesh UI is configured through a `.hotmesh.config.json` file, which should be mounted into the container at `/app/.hotmesh.config.json`. This file defines:

- **Databases**: Connection details for Postgres, Redis, NATS, and other backends.
- **Schemas**: JSON-based workflow search schemas that define how entities are indexed and queried.
- **Entities**: Logical building blocks that use classes and schemas for orchestrations.
- **Namespaces**: Groupings of entities that provide a logical structure for workflows and data.

**Important:** Unlike simpler UIs (e.g., Temporal UI), which rely heavily on environment variables, HotMesh UI uses this structured configuration file for robust flexibility. By editing `.hotmesh.config.json`, you can change backends, namespaces, and schemas without altering application code.

## Example Configuration

Below is an example `.hotmesh.config.json` illustrating how to define databases, schemas, entities, and namespaces. This setup references a single default schema and entity for demonstration purposes. All entities and schemas map to the `default` keys, which correspond internally to the default class and schema registered within HotMesh.

Create a `.hotmesh.config.json` file in your project root (next to your `docker-compose.yml`):

```json
{
  "databases": {
    "redis": {
      "name": "Redis",
      "label": "redis/redis-stack7.2.0",
      "search": true,
      "connection": {
        "class": "redis",
        "options": {
          "url": "redis://:key_admin@redis:6379"
        }
      }
    },
    "postgres": {
      "name": "Postgres",
      "label": "postgres:latest",
      "search": false,
      "connection": {
        "store": {
          "class": "pg",
          "options": {
            "connectionString": "postgresql://postgres:password@postgres:5432/hotmesh"
          }
        },
        "stream": {
          "class": "pg",
          "options": {
            "connectionString": "postgresql://postgres:password@postgres:5432/hotmesh"
          }
        },
        "sub": {
          "class": "nats",
          "options": {
            "servers": ["nats:4222"]
          }
        }
      }
    }
  },
  "schemas": {
    "default": {
      "id": {
        "type": "TAG",
        "sortable": false
      },
      "plan": {
        "type": "TAG",
        "sortable": true
      },
      "active": {
        "type": "TEXT",
        "sortable": false
      }
    }
  },
  "entities": {
    "default": {
      "name": "default",
      "schema": "default"
    }
  },
  "namespaces": {
    "meshdata": {
      "name": "MeshData Demo",
      "type": "meshdata",
      "label": "MeshData Demo",
      "module": "meshdata",
      "entities": ["default"]
    }
  }
}
```

**Key Points:**

- **`databases`**: Defines one or more database connections. Here, Redis and Postgres (with a NATS streaming component) are configured. Each `class` value (`redis`, `pg`, `nats`) will be mapped internally to their respective drivers.

- **`schemas`**: Defines how entities are indexed and searched. The `default` schema above shows how fields (`$entity`, `id`, `plan`, `active`) are defined as tags or text, along with whether they are sortable or required.

- **`entities`**: Lists available entity templates. In this example, a single `default` entity is used. More complex setups may define multiple entities keyed by different labels.

- **`namespaces`**: Groups entities together under logical namespaces. Each entity in the `namespaces` section references its `schema` and `class` by label (in this case, both are `default`), ensuring that all entities in `meshdata` use the default configuration and indexing rules.

## Running the UI

1. **Place `.hotmesh.config.json` and `docker-compose.yml` together.**  
   Ensure `.hotmesh.config.json` is in the same directory as your `docker-compose.yml`.

2. **Update your `docker-compose.yml`** to mount the config file into the container and define your services:

```yaml
services:
  hotmesh-ui:
    image: hotmeshio/hotmesh-ui:latest
    environment:
      - NODE_ENV=production
      - PORT=3010
    volumes:
      - ./.hotmesh.config.json:/app/.hotmesh.config.json:ro
    ports:
      - "3010:3010"
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy

  redis:
    image: redis/redis-stack:7.2.0-v10
    environment:
      REDIS_ARGS: "--requirepass key_admin"
    ports:
      - "6399:6379"
      - "8001:8001"
    healthcheck:
      test: ["CMD", "redis-cli", "-h", "localhost", "-p", "6379", "-a", "key_admin", "ping"]
      interval: 5s
      timeout: 10s
      retries: 3

  postgres:
    image: postgres:latest
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: hotmesh
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3
```

3. **Start the environment:**  
   Run:
   ```bash
   docker-compose up
   ```

   Once running, visit `http://localhost:3010` to access the HotMesh UI.

## Environment Variables

Although the configuration is primarily defined by `.hotmesh.config.json`, you can still use environment variables to adjust runtime behavior and telemetry:

- **NODE_ENV**: Node.js environment (e.g. `production`)
- **PORT**: Port for the UI (default `3010`)
- **HONEYCOMB_API_KEY**, **OTEL_SERVICE_NAME**, **HONEYCOMB_SERVICE_NAME**, **HONEYCOMB_ENVIRONMENT**: For distributed tracing and telemetry.
- **OPENAI_API_KEY**: If you enable GPT-based features in the dashboard.

## Releasing & Updating

- **Automated Builds**: Tagging a version in GitHub triggers a build and push to Docker Hub.
- **Docker Tags**: Use `hotmeshio/hotmesh-ui:latest` or a specific version like `hotmeshio/hotmesh-ui:vX.Y.Z`.

## Support & Issues

For questions, issues, or feature requests, please open an issue in our GitHub repository. Contributions and community feedback are welcome.
