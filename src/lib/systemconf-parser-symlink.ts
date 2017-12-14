import { spawnSync } from "child_process";
import * as command from "../lib/command";
import * as parseTypes from "../config/parse-types";
import * as parseUtils from "../lib/parse-utils";


function installFn(parseResult: parseTypes.ParseResult): string {
    return `ln -fs ${parseResult.tokens[0]} ${parseResult.tokens[1]}`;
}

function uninstallFn(parseResult: parseTypes.ParseResult): string {
    return `rm -f ${parseResult.tokens[1]}`;
}

/**
 * Test that the symlink is correct by making sure it exists and points to the locaiton
 * that it should.
 */
function isInstalledFn(parseResult: parseTypes.ParseResult): string {
    return `ls -l ${parseResult.tokens[1]} | grep ${parseResult.tokens[0]}`;
}

/**
 * Mapper that enables symlink lines in systemconf config files. They look like 
 * 
 *     symlink vimrc: ~/linux-dotfiles/files/.vimrc ~/.vimrc
 * 
 * @param parseResults The parse results for git lines.
 */
function mapper(parseResults: parseTypes.ParseResult[]): parseTypes.ProcessedParseResults {
    const errors: parseTypes.ProcessingError[] = [];
    parseResults.reduce((acc, result) => {
        if (result.tokens.length !== 2) {
            acc.push({
                for: result,
                message: `Wrong args supplied to a symlink config line for ${result.name}. Each line should have included two args. Got ${result.rest}`
            });
        }

        // if the symlink target doesn't exist then it is an error
        if (spawnSync(`test -e ${result.tokens[0]}`, [], { shell: true }).status !== 0) {
            acc.push({
                for: result,
                message: `Target of the symlink doesn't exist: ${result.tokens[0]}`
            });
        }

        return acc;
    }, errors);

    const errorNames = new Set(errors.map(error => {
        if (typeof error.for === "string") {
            return error.for;
        }
        return error.for.name;
    }));

    const validParses = parseResults.filter(result => !errorNames.has(result.name));

    const partitionedResults = parseUtils.partitionByName(validParses);

    const commandSchemas = Object.keys(partitionedResults).map(name => {
        const groupedParseResults = partitionedResults[name];
        return parseUtils.parseResultsToCommandSchema(name, groupedParseResults, { installFn, uninstallFn, isInstalledFn });
    });

    return {
        commandSchemas,
        errors,
        parseResults
    }
}

const systemConfModule: parseTypes.SystemConfModule = {
    mapper,
    format: "symlink"
}

export default systemConfModule;
