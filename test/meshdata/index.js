
const { Client: PostgresClient } = require('pg');
const { MeshData } = require('@hotmeshio/hotmesh');

console.log('\n* seeding meshdata test data ...\n');

(async () => {
  try {

    //1) init a postgres connection
    const connection = {
      class: PostgresClient,
      options: {
        connectionString: "postgresql://postgres:password@postgres:5432/hotmesh"
      }
    }

    const namespace = 'meshdata';
    const inputArgs = ['bronze', 'silver', 'gold'];

    //1) Define a search schema
    const schema = {
      schema: {
        id: { type: 'TAG', sortable: true },
        plan: { type: 'TAG', sortable: true },
        active: { type: 'TEXT', sortable: false },
      },
      index: `${namespace}-default`,    //the index name in Redis is 'default'
      prefix: ['default'], //only index documents with keys that begin with 'default'
    };

    //2) Initialize MeshData and Redis
    const meshData = new MeshData(connection, schema);

    //3) Connect a 'default' worker function; call 'default' so it has a namespace we've declared with the manifest
    //   (lets us see the data in the dashboard )
    console.log('\n* connecting workers ...\n');
    await meshData.connect({
      entity: 'default',
      target: async function(inputArg) {

        const search = await MeshData.workflow.search();
        await search.set('active', 'yes');

        //simulate a database call
        return `Welcome, ${inputArg}.`;
      },
      options: { namespace },
    });

    // Loop; call the 'default' worker for each user
    console.log('\n\n* inserting messages ...\n');
    for (const inputArg of inputArgs) {

      //4) Call the 'default' worker function; include search data
      const response = await meshData.exec({
        entity: 'default',
        args: [inputArg],
        options: {
          ttl: '45 minutes',
          id: inputArg,
          search: {
            data: { id: inputArg, plan: 'pro' }
          },
          namespace,       //redis app name (default is 'meshflow')
          signalIn: false, //false since demo doesn't showcase 'hooks' and 'signals'
        },
      });

      //5) Read data (by field name) directly from Redis
      const data = await meshData.get(
        'default',
        inputArg,
        { 
          fields: ['plan', 'id', 'active'],
          namespace,
        },
      );

      console.log(`${inputArg === inputArgs[0] ? '\n' : ''}* UserID: ${inputArg}, function response =>`, response, 'function state =>', data);
    }

    //when testing valkey skip FullTextSearch!
    if (process.env.FTS !== 'true') {
      console.log('\n* Full Text Search Unsupported.skipping search index creation and search\n');
    } else {
      //6) Create a search index
      console.log('\n\n* creating search index ...');
      await meshData.createSearchIndex('default', { namespace }, schema);

      //7) Full Text Search for records
      const results = await meshData.findWhere('default', {
        query: [{ field: 'id', is: '=', value: inputArgs[inputArgs.length - 1] }],
        limit: { start: 0, size: 100 },
        return: ['plan', 'id', 'active']
      });
      console.log(`\n\n* matching message (${inputArgs[inputArgs.length - 1]}) ...\n`, results, '\n');
    }

    //8) Shutdown
    await MeshData.shutdown();

    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
