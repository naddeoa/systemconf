import * as command from "../lib/command";
import * as parseTypes from "../config/parse-types";
import * as parseUtils from "../lib/parse-utils";


function installFn(parseResult: parseTypes.ParseResult): string {
    return `sudo apt-get install -y ${parseResult.rest}`;
}

function uninstallFn(parseResult: parseTypes.ParseResult): string {
    return `sudo apt-get remove -y  ${parseResult.rest}`;
}

/**
 * Tset each package to see if it is installed. The test will use dpkg -l to
 * determine if the package is marked with a "ii". If it can't find the "ii" or
 * dpkg returns an error (happens if dpkg has never seen the package) then the
 * package is not installed.
 * @param parseResult The parse result that contains the apt package names.
 */
function isInstalledFn(parseResult: parseTypes.ParseResult): string {
    return parseResult.tokens.reduce( (builtCommand, currentResult) => {
        return builtCommand + (builtCommand === "" ? "" : " && ") + `dpkg -l ${currentResult} | grep "ii"`;
    }, "");
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
                message: `Wrong args supplied to apt line for ${result.name}. Each line should have included a list of apt package names, but got "${result.rest}"`});
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
    format: "apt"
}

export default systemConfModule;