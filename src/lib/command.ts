import { spawnSync } from "child_process";

export type Command = string;

export type OS = "ubuntu" | "osx";

// Will definitely have os in it
export type Environment = {
    [key: string]: any;
};

export type Condition = { [key: string]: any } | null;

export type PossibleCommands = Array<[Condition | null, Command]>;

export type Result = {
    status: "success" | "failure";
    stdout: string | null;
    stderr: string | null;
    message: string;
    commandSchema: CommandSchema,
    env: Environment
};

export type CommandSchema = {
    name: string;
    install: PossibleCommands;
    uninstall: PossibleCommands;
    isInstalled: PossibleCommands;
    priority: number;
};

export function isCommandSchema(a: any) : a is CommandSchema {
    return a && a.name && a.install && a.uninstall && a.isInstalled;
}

/**
 * Determine whether or not a condition is met by the current environment.
 * @param env The environment the commands will have access to.
 * @param condition A condition that determines whether or not a command should be run given
 * this environment.
 */
function satisfies(env: Environment, condition: Condition): boolean {
    if (condition === null) {
        return true;
    }

    // ensure that all of the keys in condition are present and have the same value in env
    for (var key in condition) {
        if (condition[key] !== env[key]) {
            return false;
        }
    }

    return true;
}

export function determineCommand(env: Environment, possibleCommands: PossibleCommands): Command | null {
    const applicableCommand = possibleCommands.find(([condition, command]) =>
        satisfies(env, condition)
    );

    if (applicableCommand === null || applicableCommand === undefined) {
        return null;
    }

    return applicableCommand[1];
}

function executeCommandSchema(env: Environment, commandSchema: CommandSchema, commandGetter: (env: Environment, commandSchema: CommandSchema) => Command | null): Result {
    const applicableCommand = commandGetter(env, commandSchema);

    if (applicableCommand === null || applicableCommand === undefined) {
        return {
            status: "failure",
            message:
            "None of the commands apply to the current environment: " +
            JSON.stringify(env),
            stderr: null,
            stdout: null,
            commandSchema,
            env
        };
    }

    const spawnResults = spawnSync(applicableCommand, [], { shell: true });

    return {
        status: spawnResults.status === 0 ? "success" : "failure",
        stderr: spawnResults.stderr.toString(),
        stdout: spawnResults.stdout.toString(),
        message: "Finished with this command: " + applicableCommand,
        commandSchema,
        env
    };
}

export function install(env: Environment, commandSchema: CommandSchema): Result {
    console.log("Installing " + commandSchema.name);
    return executeCommandSchema(env, commandSchema, (env, commandSchema) =>
        determineCommand(env, commandSchema.install)
    );
}

export function uninstall(env: Environment, commandSchema: CommandSchema): Result {
    console.log("Uninstalling " + commandSchema.name);
    return executeCommandSchema(env, commandSchema, (env, commandSchema) =>
        determineCommand(env, commandSchema.uninstall)
    );
}

export function isInstalled(env: Environment, commandSchema: CommandSchema): Result {
    return executeCommandSchema(env, commandSchema, (env, commandSchema) =>
        determineCommand(env, commandSchema.isInstalled)
    );
}

export function installIfNotInstalled(env: Environment, commandSchema: CommandSchema): Result {
    const isInstalledResult = isInstalled(env, commandSchema);

    if (isInstalledResult.status === "success") {
        return {
            status: "failure",
            message: "Already installed",
            stderr: null,
            stdout: null,
            commandSchema,
            env
        };
    }

    return install(env, commandSchema);
}
