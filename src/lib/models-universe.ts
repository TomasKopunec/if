import pathLib = require('path');

import {ERRORS} from '../util/errors';

import {CONFIG, STRINGS} from '../config';

import {
  ClassContainerParams,
  GraphOptions,
  ImplInitializeModel,
  InitalizedModels,
} from '../types/models-universe';

const {ModelInitializationError, ModelCredentialError} = ERRORS;

const {GITHUB_PATH, NATIVE_MODEL} = CONFIG;
const {
  MISSING_CLASSNAME,
  NOT_MODEL_PLUGIN_EXTENSION,
  MISSING_PATH,
  NOT_NATIVE_MODEL,
  NOT_CONSTRUCTABLE_MODEL,
  NOT_INITIALIZED_MODEL,
  INVALID_MODULE_PATH,
} = STRINGS;

/**
 * Models Initialization Lifecycle.
 */
export class ModelsUniverse {
  /**
   * Models list.
   */
  public initalizedModels: InitalizedModels = {};

  /**
   * Checks if model is instance of `IOutputModelInterface`.
   */
  private instanceOfModel(ClassContainer: any, params: ClassContainerParams) {
    try {
      const testModel = new ClassContainer();
      const boolable = 'configure' in testModel && 'execute' in testModel;

      return boolable;
    } catch (error) {
      throw new ModelInitializationError(NOT_CONSTRUCTABLE_MODEL(params));
    }
  }

  /**
   * Imports module by given `path`.
   */
  private async importModuleFrom(path: string) {
    try {
      const module = await import(path);

      return module;
    } catch (error) {
      console.log(error);
      throw new ModelInitializationError(INVALID_MODULE_PATH(path));
    }
  }

  /**
   * Imports `module` from given `path`, then checks if it's `ModelPluginInterface` extension.
   */
  private async importAndVerifyModule(model: string, path: string) {
    const pluginModule = await this.importModuleFrom(path);

    if (!this.instanceOfModel(pluginModule[model], {model, path})) {
      throw new ModelInitializationError(NOT_MODEL_PLUGIN_EXTENSION);
    }

    return pluginModule[model];
  }

  /**
   * Returns plugin model. Checks if model is missing then rejects with error.
   * Then checks if `path` is starting with github, then grabs the repository name.
   * Imports module, then checks if it's a class which implements input model interface.
   */
  private async handModel(model: string, path: string) {
    if (path === 'builtin') {
      path = pathLib.normalize(`${__dirname}/../models/index.ts`);
    } else {
      if (path?.startsWith(GITHUB_PATH)) {
        const parts = path.split('/');
        path = parts[parts.length - 1];
      }

      if (!path.includes(NATIVE_MODEL)) {
        console.log(NOT_NATIVE_MODEL);
      }
    }

    return this.importAndVerifyModule(model, path);
  }

  /**
   * Initializes and registers model.
   */
  public async writeDown(modelToInitalize: ImplInitializeModel) {
    const {model, path, config, name} = modelToInitalize;

    if (!model) {
      throw new ModelCredentialError(MISSING_CLASSNAME);
    }

    if (!path) {
      throw new ModelCredentialError(MISSING_PATH);
    }

    const Model = await this.handModel(model, path);

    const callback = async (graphOptions: GraphOptions) => {
      const params = {
        ...config,
        ...graphOptions,
      };

      const initalizedModel = await new Model().configure(params);

      return initalizedModel;
    };

    this.initalizedModels = {
      ...this.initalizedModels,
      [name]: callback,
    };

    return this.initalizedModels;
  }

  /**
   * Returns existing model by `name`.
   */
  public async getInitializedModel(modelName: string, config: any) {
    if (this.initalizedModels[modelName]) {
      return this.initalizedModels[modelName](config);
    }

    throw new ModelInitializationError(NOT_INITIALIZED_MODEL(modelName));
  }
}
