const { Client: PostgresClient } = require('pg');
const { HotMesh } = require('@hotmeshio/hotmesh');
console.log('seeding hotmesh test data ...\n');

(async () => {

  //1) init a postgres connection
  const connection = {
    class: PostgresClient,
    options: {
      connectionString: "postgresql://postgres:password@postgres:5432/hotmesh"
    }
  }

  //2) init an engine and worker
  const hotMesh = await HotMesh.init({
    appId: 'hotmesh',
    logLevel: 'debug',
    engine: { connection },

    workers: [
      { 
        topic: 'work.do',
        connection,
        callback: async function (payload) {
          return {
            metadata: { ...payload.metadata },
            data: { workerOutput: `${payload?.data?.workerInput} world` }
          };
        }
      }
    ]
  });

  //3) compile and deploy the app (the distributed executable)
  await hotMesh.deploy(`app:
  id: hotmesh
  version: '1'
  graphs:
    - subscribes: hotmesh.test
      publishes: hotmesh.tested

      expire: 3600

      input:
        schema:
          type: object
          properties:
            input:
              type: string

      output:
        schema:
          type: object
          properties:
            output:
              type: string

      activities:
        trigger1:
          type: trigger
        worker1:
          type: worker
          topic: work.do
          input:
            schema:
              type: object
              properties:
                workerInput:
                  type: string
            maps:
              workerInput: '{trigger1.output.data.input}'
          output:
            schema:
              type: object
              properties:
                workerOutput:
                  type: string
          job:
            maps:
              output: '{$self.output.data.workerOutput}'
      transitions:
        trigger1:
          - to: worker1`);

  //4) activate the app (happens simultaneously network wide)
  await hotMesh.activate('1');

  //5) run input test
  const jobId = await hotMesh.pub(
    'hotmesh.test',
    { input : 'hello' },
    { data: {}, metadata: {} },
    {
      search: {
        howdy: 'partner',
        custom: '0',
        bool: 'false'
      },
    }
  );

  //typically call pubsub, but for the test, just loop and check status (semaphore that tracks open threads)
  while (await hotMesh.getStatus(jobId) !== 0) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  console.log('\nRESPONSE', await hotMesh.getState('hotmesh.test', jobId), '\n');

  //6) Shutdown
  hotMesh.stop();
  await HotMesh.stop();

  process.exit(0);
})();
