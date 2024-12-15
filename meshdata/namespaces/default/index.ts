import { MeshOS } from '@hotmeshio/hotmesh';

/**
 * generic entity to represent all entities across all modules; opens
 * in readonly mode
 */
class DefaultEntity extends MeshOS {
  async connect() {
    //no-op; default entity doesn't have workers in the dashboard
  }
}

export { DefaultEntity };
