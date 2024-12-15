const { Client: PostgresClient } = require('pg');
const { MeshFlow, HotMesh } = require('@hotmeshio/hotmesh');
const workflows = require('./workflows');

console.log('seeding meshflow test data ...\n');

(async () => {
  try {
    //0) init a postgres connection
    const connection = {
      class: PostgresClient,
      options: {
        connectionString: "postgresql://postgres:password@postgres:5432/hotmesh"
      }
    }

    //1) Initialize the worker; this is typically done in
    //   another file, but is done here for convenience.
    //   The worker will stay open, listening to its
    //   task queue until MeshFlow.shutdown is called.
    await MeshFlow.Worker.create({
      connection,
      taskQueue: 'default',
      namespace: 'meshflow',
      workflow: workflows.example,
      options: {
        backoffCoefficient: 2,
        maximumAttempts: 1_000,
        maximumInterval: '5 seconds'
      }
    });

    //2) initialize the client; this is typically done in
    //   another file, but is done here for convenience
    const client = new MeshFlow.Client({ connection });

    //3) start a new workflow
    const workflowId = `default-${HotMesh.guid()}`;
    const handle = await client.workflow.start({
      namespace: 'meshflow', //the app name in Redis
      taskQueue: 'default',
      workflowName: 'example',
      workflowId,
      args: ['HotMesh', 'es'],
      expire: 3_600,
      //add searchable, indexed data
      search: {
        data: {
          '$entity': 'default',
          id : workflowId,
        },
      },
    });

    //4) subscribe to the eventual result
    console.log('\nRESPONSE', await handle.result(), '\n');

    //5) Shutdown (typically on sigint/sigterm)
    await MeshFlow.shutdown();

    process.exit(0);
  } catch (error) {
    console.error('An error occurred:', error);

    // Shutdown and exit with error code
    await MeshFlow.shutdown();
    process.exit(1);
  }
})();
