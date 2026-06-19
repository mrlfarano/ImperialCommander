import { resolveApiStorePath } from "../cloud/paths.js";
import type { Task } from "../schemas/index.js";
import { FileTaskRepository } from "./file-repository.js";
import type {
  CreateTagOptions,
  MoveTarget,
  RepositoryTagOptions,
  TaskRepository,
} from "./repository.js";

export interface ApiTaskRepositoryOptions {
  endpoint?: string;
  storePath?: string;
  currentTag?: string;
}

export class ApiTaskRepository implements TaskRepository {
  private readonly delegate: FileTaskRepository;

  constructor(options: ApiTaskRepositoryOptions = {}) {
    this.delegate = new FileTaskRepository({
      storePath: options.storePath ?? resolveApiStorePath(options.endpoint),
      currentTag: options.currentTag,
    });
  }

  findAll(options?: RepositoryTagOptions): Promise<Task[]> {
    return this.delegate.findAll(options);
  }

  findById(id: Task["id"], options?: RepositoryTagOptions): Promise<Task | undefined> {
    return this.delegate.findById(id, options);
  }

  create(task: Task, options?: RepositoryTagOptions): Promise<Task> {
    return this.delegate.create({ ...task, id: String(task.id) }, options);
  }

  update(id: Task["id"], patch: Partial<Task>, options?: RepositoryTagOptions): Promise<Task> {
    return this.delegate.update(String(id), patch, options);
  }

  delete(id: Task["id"], options?: RepositoryTagOptions): Promise<boolean> {
    return this.delegate.delete(String(id), options);
  }

  move(id: Task["id"], target: MoveTarget, options?: RepositoryTagOptions): Promise<Task> {
    return this.delegate.move(String(id), target, options);
  }

  listTags(): Promise<string[]> {
    return this.delegate.listTags();
  }

  createTag(tag: string, options?: CreateTagOptions): Promise<void> {
    return this.delegate.createTag(tag, options);
  }

  deleteTag(tag: string): Promise<boolean> {
    return this.delegate.deleteTag(tag);
  }
}
