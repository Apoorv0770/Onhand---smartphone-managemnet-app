import { removeRunDir } from "./run";

/** Removes the run's throwaway data folder once every project has finished. */
export default function globalTeardown(): void {
  removeRunDir();
}
