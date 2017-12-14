import * as parseTypes from "../config/parse-types";
import * as command from "../lib/command";

export type ParseResultsByName = { [name: string]: parseTypes.ParseResult[] };

/**
 * Given a list of parse results, group them into a multimap where the key is the name of the
 * individual parse results (the program they are intended for). Very useful for combining multiple
 * lines in a systemconf config file into one CommandSchema.
 * @param parseResults The partitioned parse resutls.
 * @returns A multimap from program name to parse resutls. The amount of entries for each value
 * will be the number of lines in the systemconf config file for that program.
 */
export function partitionByName(parseResults: parseTypes.ParseResult[]): ParseResultsByName {
    const initial: { [n: string]: parseTypes.ParseResult[] } = {};
    return parseResults.reduce((acc, current) => {
        const thingsWithSameName: parseTypes.ParseResult[] = acc[current.name] || [];
        thingsWithSameName.push(current);
        acc[current.name] = thingsWithSameName;
        return acc;
    }, initial);
}


export type ParseResultToCommandSchemaFunctions = {
    installFn(parseResult: parseTypes.ParseResult): string;
    uninstallFn(parseResult: parseTypes.ParseResult): string;
    isInstalledFn(parseResult: parseTypes.ParseResult): string;
};

/**
 * Helper function for taking a list of parse results and turning them into a command schema.
 * This function is intended for a very specific purpose. Consider the git config format:
 * 
 *   git({os: "ubuntu"}) oh-my-zsh: https://url.com ~/location
 * 
 * That one line is intended to generate the install, unininstall and isInstalled commands. That
 * means that one git config line maps to three commands, so they can all be generated at once. That
 * isn't the case with the cmd format, which has separate lines for install, uninstall and isInstalled.
 * 
 * If you're writing a format that maps from a single config line to all three commands then this is for
 * you. It is intended to be used on the output of partitionByName. Each of the array values in
 * the partitionByName output are for the same program name (oh-my-zsh in the example above), they
 * just represent different env predicates (maybe one applies to osx, one to ubuntu, etc.)
 * 
 * @param name The name of the program the line targets.
 * @param parseResults A parse result.
 * @param fns The functions that are used to go from that config line parse to a command schema's
 * install, uninstall and isInstalled functions.
 */
export function parseResultsToCommandSchema(name: string, parseResults: parseTypes.ParseResult[], fns: ParseResultToCommandSchemaFunctions): command.CommandSchema {
    // Make sure all of the parse results are targeted to the same program
    if (parseResults.filter(result => result.name !== name).length > 0) {
        throw new Error(`This method is intended for merging a bunch of parseResults for the same 
        program name into a CommandSchema. You can't combine different config for different programs 
        together with it. Try using it on the output of parseUtils.partitionByName`);
    }

    const initial: command.CommandSchema = { name, install: [], uninstall: [], isInstalled: [], priority: 100};

    return parseResults.reduce((acc, current) => {
        acc.install.push([current.predicate, fns.installFn(current)]);
        acc.uninstall.push([current.predicate, fns.uninstallFn(current)]);
        acc.isInstalled.push([current.predicate, fns.isInstalledFn(current)]);
        // Favor the smallest priority since that is higher.
        acc.priority = acc.priority < current.order ? acc.priority : current.order;
        return acc;
    }, initial);
}