import * as command from "../lib/command";

/**
 * Represents the output of a parsing a systemconf config file.
 */
export interface ParseResult {

    /**
     * The name of the thing that the command will be trying to install/uninstall.
     */
    name: string;

    /**
     * The format of this line of the config file. Should be the first thing on the line.
     */
    commandFormat: CommandFormat;

    /**
     * An object that will be compared against the env during execution to
     * determine if it actually applies. Should come right after the format
     * in the config file and it takes the appearance of a JSON object.
     */
    predicate: object | null;

    /**
     * The rest of the line. In the following line
     * 
     *     cmd({"os": "ubuntu"}) name: install -- something
     * 
     * this would contain
     * 
     *     "install -- something"
     * 
     * since the first part is standard across all parsers. 
     */
    rest: string;

    /**
     * A tokenized version of the rest string, split on whitespace.
     */
    tokens: string[];

    /**
     * The order in which the parse was encountered. Used to eventually
     * execute them.
     */
    order: number;
}

export type ProcessedParseResults = {
    /**
     * The original parsed results that were used.
     */
    parseResults: ParseResult[];

    /**
     * Any parseResults that had errors while being procesed. it is assumed
     * that these won't have a presene in the commandSchema list.
     */
    errors: ProcessingError[];

    /**
     * The command schemas that could be extracted from these items.
     */
    commandSchemas: command.CommandSchema[];
}

export type ProcessingError = {

    /**
     * The parse result that the error is for.
     */
    for: ParseResult | string;

    /**
     * Error message that can be displayed to a user.
     */
    message: string;
}

export function isProcessingError(a: any): a is ProcessingError {
    return a && a.for && a.message;
}

export function isParsingError(a: any): a is {error: string} {
    return a && a.error && typeof a.error === "string";
}

/**
 * A function that takes in a parse results and returns a CommandSchema.
 */
export type ConfigLineMapper = <T extends ParseResult>(parseResults: T[]) => ProcessedParseResults;

/**
 * The format is the string that each line starts with in the config file.
 */
export type CommandFormat = string;

/**
 * This is the thing that people  will have to export from their modules if they
 * want to provide expanded syntax to the systemconf config files.
 */
export interface SystemConfModule {
    mapper: ConfigLineMapper;
    format: string
}

/**
 * Utility type guard for the SystemConfModule interface.
 * @param a anything
 */
export function isSystemConfModule(a: any): a is SystemConfModule {
    return a.mapper && a.format;
}