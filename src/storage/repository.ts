import type { Task } from "../schemas/index.js";

export interface TaskRepository {
  findAll(options?: RepositoryTagOptions): Promise<Task[]>;
  findById(id: Task["id"], options?: RepositoryTagOptions): Promise<Task | undefined>;
  create(task: Task, options?: RepositoryTagOptions): Promise<Task>;
  update(id: Task["id"], patch: Partial<Task>, options?: RepositoryTagOptions): Promise<Task>;
  delete(id: Task["id"], options?: RepositoryTagOptions): Promise<boolean>;
  move(id: Task["id"], target: MoveTarget, options?: RepositoryTagOptions): Promise<Task>;
  listTags(): Promise<string[]>;
  createTag(tag: string, options?: CreateTagOptions): Promise<void>;
  deleteTag(tag: string): Promise<boolean>;
}

export interface RepositoryTagOptions {
  tag?: string;
}

export interface CreateTagOptions {
  description?: string;
}

export interface MoveTarget {
  tag?: string;
  beforeId?: Task["id"];
  afterId?: Task["id"];
}

export interface RepositoryFactoryOptions {
  backend: "file" | "api";
  file?: FileRepositoryFactoryOptions;
  api?: ApiRepositoryFactoryOptions;
}

export interface FileRepositoryFactoryOptions {
  projectRoot?: string;
  storePath?: string;
  currentTag?: string;
}

export interface ApiRepositoryFactoryOptions {
  endpoint?: string;
  storePath?: string;
  currentTag?: string;
}
