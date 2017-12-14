import * as command from "../lib/command";
import * as parseTypes from "../config/parse-types";
import * as parseUtils from "../lib/parse-utils";


function installFn(parseResult: parseTypes.ParseResult): string {
    return `git clone ${parseResult.tokens[0]} ${parseResult.tokens[1]}`;
}

function uninstallFn(parseResult: parseTypes.ParseResult): string {
    return `rm -rf ${parseResult.tokens[1]}`;
}

function isInstalledFn(parseResult: parseTypes.ParseResult): string {
    return `test -d ${parseResult.tokens[1]}`;
}

/**
 * Mapper that enables git lines in systemconf config files. They look like 
 * 
 *     git oh-my-zsh: https://github.com/robbyrussell/oh-my-zsh.git ~/foobarfoov
 * 
 * @param parseResults The parse results for git lines.
 */
function mapper(parseResults: parseTypes.ParseResult[]): parseTypes.ProcessedParseResults {
    const errors: parseTypes.ProcessingError[]  = [];
    parseResults.reduce( (acc, result) => {
        if(result.tokens.length !== 2){
            acc.push({
                for:result, 
                message: `Wrong args supplied to a git config line for ${result.name}. Each line should have included two args. Got ${result.rest}`
            });
        }

        return acc;
    }, errors);

    const validParses = parseResults.filter(result => result.tokens.length === 2);

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
    format: "git"
}

export default systemConfModule;