import * as command from "./command";
import * as parseTypes from "../config/parse-types";
import { red, green, bold } from "colors";

const INDENT = "    ";

export type ResultReport = {
    success: command.Result[],
    failure: command.Result[],
};

export type Report = {
    commands: command.CommandSchema[],
    alreadyInstalled: command.CommandSchema[],
    willBeInstalled: command.CommandSchema[],
    encounteredError: command.CommandSchema[],
    errors: parseTypes.ProcessingError[]
};

export function generateInstallReport(env: command.Environment, processedParse: parseTypes.ProcessedParseResults): Report {
    const commands = processedParse.commandSchemas;
    const alreadyInstalled = commands.filter(
        commandSchema =>
            command.isInstalled(env, commandSchema).status === "success"
    );

    const notInstalled = commands.filter(commandSchema => {
        const result = command.isInstalled(env, commandSchema);
        // TODO a failure for isInstalled implies it needs to be installed, but I can't tell if it failed for error or on purpose
        return result.status === "failure";
    });

    // TODO can't tell the difference between an error and a failure
    // const encounteredError = commands.filter(commandSchema => {
    //     const result = command.isInstalled(env, commandSchema);
    //     return result.status === "failure";
    // });

    // make sure they execute in the order that they were parsed in
    notInstalled.sort((a, b) => {
        if (a.priority < b.priority) {
            return -1
        } else if (a.priority === b.priority) {
            return 0;
        } else {
            return 1;
        }
    });

    return {
        commands,
        encounteredError: [],
        alreadyInstalled,
        willBeInstalled: notInstalled,
        errors: processedParse.errors
    };
}

function indent(string: string): string {
    return INDENT + string.replace("\n", INDENT);
}

function indentn(s: string, n: number): string {
    var indent = "";
    for (let i = 0; i < n; i++) {
        indent += INDENT;
    }
    return indent + s.replace("\n", INDENT);
}

export function printResultReport(env: command.Environment, report: ResultReport) {
    if (report.success.length === 0 && report.failure.length === 0) {
        console.log(bold("Nothing was done."));
        return;
    }

    if (report.success.length > 0) {
        console.log();
        console.log(green(bold("Installed successfully:")));
        report.success.forEach(result => {
            console.log(indent(result.commandSchema.name));
        })
    }

    if (report.failure.length > 0) {
        console.log();
        console.log(red(bold("Failed to install:")));
        report.failure.forEach(result => {
            console.log();
            console.log(indent(result.commandSchema.name));
            console.log(indentn(result.message, 2));

            if (result.stdout) {
                console.log();
                console.log(indentn("stdout:", 2));
                console.log(indentn(result.stdout.replace("\n", "\n        "), 3));
            }

            if (result.stderr) {
                console.log();
                console.log(indentn("stderr:", 2));
                console.log(indentn(result.stderr.replace("\n", "\n        "), 3));
            }
        })
    }
}

export function printInstallReport(env: command.Environment, report: Report) {
    if (report.commands.length === 0) {
        console.log(red(bold("No commands found. Nothing to do.")));
        return;
    }

    console.log(bold("All known schemas:"));
    report.commands.forEach(cmd => console.log(indent(cmd.name)));

    if (report.alreadyInstalled.length > 0) {
        console.log();
        console.log(bold("These are already installed:"));
        report.alreadyInstalled.forEach(cmd => console.log(indent(cmd.name)));
    }

    if (report.encounteredError.length > 0) {
        console.log();
        console.log(bold("These encountered errors and will not be installed:"));
        report.encounteredError.forEach(cmd => console.log(indent(cmd.name)));
    }

    if (report.errors.length > 0) {
        console.log();
        console.log(bold(red("These encountered errors while parsing the config file and will not be installed:")));
        report.errors.forEach(error => {
            console.log(indent(typeof error.for === "string" ? error.for : error.for.name))
            console.log(indentn("⤷ " + error.message, 2));
        });
    }

    if (report.willBeInstalled.length === 0) {
        console.log();
        console.log(bold(green("Everything that can be installed is already installed")));
        return;
    } else {
        console.log();
        console.log(bold("These will be installed with the following commands:"));
        report.willBeInstalled.forEach(cmd => {
            const actualCmd = command.determineCommand(env, cmd.install);

            console.log(indent(cmd.name));
            if (actualCmd === null) {
                console.log(indentn(red("⤷ ??"), 2));
            } else {
                console.log(indentn("⤷ " + actualCmd, 2));
            }
        });
    }
    console.log();
}
