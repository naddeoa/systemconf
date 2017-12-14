import * as command from "../lib/command";
import * as parseTypes from "../config/parse-types";
import * as parseUtils from "../lib/parse-utils";


function installFn(parseResult: parseTypes.ParseResult): string {
    return `brew install ${parseResult.rest}`;
}

function uninstallFn(parseResult: parseTypes.ParseResult): string {
    return `brew uninstall ${parseResult.rest}`;
}

function isInstalledFn(parseResult: parseTypes.ParseResult): string {
    return `brew list ${parseResult.rest}`;
}

/**
 * Mapper that enables apt lines in systemconf config files. They look like 
 * 
 *     apt git
 * 
 * @param parseResults The parse results for git lines.
 */
function mapper(parseResults: parseTypes.ParseResult[]): parseTypes.ProcessedParseResults {
    // Make sure everything is in the right format. We expect each line to contain at least one
    const errors: parseTypes.ProcessingError[]  = [];
    parseResults.reduce( (acc, result) => {
        if(result.tokens.length === 0){
            acc.push({
                for:result, 
                message: `Wrong args supplied to a brew config for ${result.name}. Each line should have included a list of brew package names. Got "${result.rest}"`
            });
        }

        return acc;
    }, errors);

    const validParses = parseResults.filter(result => result.tokens.length > 0);

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
    format: "brew"
}

export default systemConfModule;