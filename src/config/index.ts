import * as command from "../lib/command";
import * as fs from "fs";
import { parse } from "./parser";
import * as parseTypes from "./parse-types";
import cmdModule from "../lib/systemconf-parser-cmd";
import gitModule from "../lib/systemconf-parser-git";
import aptModule from "../lib/systemconf-parser-apt";
import brewModule from "../lib/systemconf-parser-brew";
import symlinkModule from "../lib/systemconf-parser-symlink";

/**
 * Given a systemconf conig file, parse and  convert it into a collection of CommandSchema that
 * can be executed.
 * @param configFilePath The path to a config file to parse.
 */
export function getCommands(configFilePath: string): parseTypes.ProcessedParseResults {
    const configFile = fs.readFileSync(configFilePath).toString();
    const parsedConfigFile = parse(configFile);
    const parseResults: any[] | null = parsedConfigFile.filter(x => x !== null && !x.error);

    const parseErrors: parseTypes.ProcessingError[] = parsedConfigFile
        .filter(parseTypes.isParsingError)
        .map(x => ({ for: x.error, message: `Couldn't parse a line in the config file: "${x.error}"` }));


    if (isValidParse(parseResults)) {

        // Partition the parses up into a map from their format to the individual resutls so each one can be passed to the mapper for it.
        const partitionByFormat: { [s: string]: parseTypes.ParseResult[] } = parseResults.reduce((acc: { [s: string]: parseTypes.ParseResult[] }, current: parseTypes.ParseResult) => {
            const parses = acc[current.commandFormat] || [];
            parses.push(current);
            acc[current.commandFormat] = parses;
            return acc;
        }, {});

        const nestedCommandSchemas: parseTypes.ProcessedParseResults[] = Object.keys(partitionByFormat)
            .filter(name => commandFormatMappers.has(name))
            .map(name => {
                const mapper = commandFormatMappers.get(name);
                if (!mapper) {
                    throw new Error(`No mapper registered for config type ${name}`);
                }

                const specificParses = partitionByFormat[name];
                return mapper(specificParses);
            });

        const noMappersRegistered: parseTypes.ProcessingError[] = Object.keys(partitionByFormat)
            .filter(name => !commandFormatMappers.has(name))
            .map(name => ({for: name, message: `No mapper registered for "${name}" lines`}))

        const commands = nestedCommandSchemas.reduce((acc, current) => {
            return {
                parseResults: acc.parseResults.concat(current.parseResults),
                errors: acc.errors.concat(current.errors),
                commandSchemas: acc.commandSchemas.concat(current.commandSchemas)
            };
        }, { parseResults: [], errors: parseErrors.concat(noMappersRegistered), commandSchemas: [] });

        return commands;
    }


    throw new Error("Couldn't parse the config file");
}

/**
 * Type guard for parse results.
 * @param a The output of the parse() function from pegjs
 */
function isValidParse(a: any[]): a is parseTypes.ParseResult[] {
    return a && a.filter(parse => parse.name && parse.commandFormat).length === a.length;
}


/**
 * Registered mappers that take the parse results of config files and turn them into a CommandSchema so that
 * they can be executed.
 */
const commandFormatMappers: Map<parseTypes.CommandFormat, parseTypes.ConfigLineMapper> = new Map();

/**
 * Register a command mapper for a certain type of config file format.
 * This will be the function responsible for turning that into a CommandSchema
 * so that it can be executed.
 * @param format The unique string format. This is the first thing on each line of the config file.
 * @param mapper The function that will take that line and return a CommandSchema for each one.
 */
export function registerSystemConfModule(module: parseTypes.SystemConfModule) {
    if (commandFormatMappers.has(module.format)) {
        throw new TypeError(`There is already a mapper responsible for ${module.format}`);
    }

    commandFormatMappers.set(module.format, module.mapper);
}

// Default support for cmd lines
registerSystemConfModule(cmdModule);
registerSystemConfModule(gitModule);
registerSystemConfModule(aptModule);
registerSystemConfModule(brewModule);
registerSystemConfModule(symlinkModule)