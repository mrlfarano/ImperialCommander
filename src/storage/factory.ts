import { ApiTaskRepository } from "./api-repository.js";
import { FileTaskRepository } from "./file-repository.js";
import type { RepositoryFactoryOptions } from "./repository.js";
import type { TaskRepository } from "./repository.js";

export function createTaskRepository(options: RepositoryFactoryOptions): TaskRepository {
  if (options.backend === "file") {
    return new FileTaskRepository(options.file);
  }

  return new ApiTaskRepository(options.api);
}
